#!/usr/bin/env node
/**
 * Marmalade / Poetree — Native SQLite Backup & Restore CLI
 *
 * Uses better-sqlite3's native C++ Online Backup API (.backup) to guarantee
 * zero lock interruptions, safe live snapshots in WAL mode, integrity checking,
 * and automatic retention rotation.
 *
 * Usage:
 *   node scripts/backup.js [--db <path>] [--dir <backupDir>] [--keep <number>]
 *   node scripts/backup.js --restore <backup-file> [--target <db-path>]
 *   node scripts/backup.js --verify <db-file>
 *   npm run backup
 */

import Database from 'better-sqlite3';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * Verify integrity of a SQLite database file using PRAGMA quick_check.
 */
export function verifyDatabaseIntegrity(filePath) {
  if (!fs.existsSync(filePath)) {
    throw new Error(`File not found: ${filePath}`);
  }
  const db = new Database(filePath, { readonly: true, fileMustExist: true });
  try {
    const rows = db.pragma('quick_check');
    const isOk = rows.length > 0 && rows[0].quick_check === 'ok';
    if (!isOk) {
      throw new Error(`Integrity check failed: ${JSON.stringify(rows)}`);
    }
    return true;
  } finally {
    db.close();
  }
}

/**
 * Rotate older backups in backupDir, keeping at most keepCount backups.
 */
export function rotateBackups(backupDir, keepCount = 7) {
  if (keepCount <= 0 || !fs.existsSync(backupDir)) return [];

  const files = fs
    .readdirSync(backupDir)
    .filter((f) => /^sprout_backup_.*\.db$/.test(f))
    .map((f) => {
      const fullPath = path.join(backupDir, f);
      const stat = fs.statSync(fullPath);
      return { path: fullPath, filename: f, mtime: stat.mtimeMs };
    })
    .sort((a, b) => b.mtime - a.mtime);

  const removed = [];
  if (files.length > keepCount) {
    const toRemove = files.slice(keepCount);
    for (const file of toRemove) {
      fs.unlinkSync(file.path);
      removed.push(file.filename);
    }
  }
  return removed;
}

/**
 * Create a safe, verified online backup.
 */
export async function createBackup(options = {}) {
  const dbPath =
    options.dbPath ||
    process.env.SPROUT_DB_PATH ||
    process.env.DB_PATH ||
    process.env.DATABASE_PATH ||
    'data/sprout.db';
  const backupDir = options.backupDir || process.env.BACKUP_DIR || 'backups';
  const keepCount =
    Number(options.keepCount ?? process.env.BACKUP_KEEP) || 7;
  const verbose = options.verbose ?? true;

  if (!fs.existsSync(dbPath)) {
    throw new Error(`Source database '${dbPath}' does not exist.`);
  }

  // 1. Verify source database integrity
  if (verbose) console.log(`Checking integrity of source database: ${dbPath}`);
  verifyDatabaseIntegrity(dbPath);

  // 2. Prepare backup destination
  fs.mkdirSync(backupDir, { recursive: true });
  const now = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  const timestamp = `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}_${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`;
  const targetFile = path.join(backupDir, `sprout_backup_${timestamp}.db`);

  // 3. Perform online backup via better-sqlite3 C++ API
  if (verbose) console.log(`Creating online SQLite backup at: ${targetFile}`);
  const sourceDb = new Database(dbPath, { readonly: true, fileMustExist: true });
  try {
    await sourceDb.backup(targetFile);
  } finally {
    sourceDb.close();
  }

  // 4. Verify integrity of the newly created backup
  if (verbose) console.log('Verifying integrity of backup file...');
  verifyDatabaseIntegrity(targetFile);

  const stat = fs.statSync(targetFile);
  const sizeKb = (stat.size / 1024).toFixed(1);

  // 5. Rotate older backups
  const removed = rotateBackups(backupDir, keepCount);

  if (verbose) {
    console.log(`✓ Backup successfully created: ${targetFile} (${sizeKb} KB)`);
    if (removed.length > 0) {
      console.log(`Rotated ${removed.length} older backup(s) (retained last ${keepCount}): ${removed.join(', ')}`);
    }
  }

  return {
    targetFile,
    sizeBytes: stat.size,
    sizeKb: Number(sizeKb),
    removedBackups: removed,
  };
}

/**
 * Safely restore a backup to the target database path.
 * Cleans up stale WAL and SHM files to prevent corruption.
 */
export async function restoreBackup(options = {}) {
  const backupFile = options.backupFile;
  const targetDb =
    options.targetDb ||
    process.env.SPROUT_DB_PATH ||
    process.env.DB_PATH ||
    process.env.DATABASE_PATH ||
    'data/sprout.db';
  const verbose = options.verbose ?? true;

  if (!backupFile) {
    throw new Error('No backup file specified for restore.');
  }
  if (!fs.existsSync(backupFile)) {
    throw new Error(`Backup file does not exist: ${backupFile}`);
  }

  // 1. Verify backup file integrity before touching destination
  if (verbose) console.log(`Verifying backup file integrity: ${backupFile}`);
  verifyDatabaseIntegrity(backupFile);

  // 2. Ensure target parent directory exists
  const targetDir = path.dirname(targetDb);
  if (!fs.existsSync(targetDir)) {
    fs.mkdirSync(targetDir, { recursive: true });
  }

  // 3. Remove stale WAL and SHM files (critical for SQLite WAL mode restore)
  const walPath = `${targetDb}-wal`;
  const shmPath = `${targetDb}-shm`;
  if (fs.existsSync(walPath)) {
    if (verbose) console.log(`Removing stale WAL file: ${walPath}`);
    fs.unlinkSync(walPath);
  }
  if (fs.existsSync(shmPath)) {
    if (verbose) console.log(`Removing stale SHM file: ${shmPath}`);
    fs.unlinkSync(shmPath);
  }

  // 4. Copy backup to target destination
  if (verbose) console.log(`Restoring ${backupFile} -> ${targetDb}...`);
  fs.copyFileSync(backupFile, targetDb);

  // 5. Verify restored database
  if (verbose) console.log('Verifying integrity of restored database...');
  verifyDatabaseIntegrity(targetDb);

  if (verbose) {
    console.log(`✓ Successfully restored database to ${targetDb}`);
  }

  return {
    targetDb,
    verified: true,
  };
}

// CLI Execution Support
function parseCliArgs(args) {
  const parsed = {
    action: 'backup',
    db: null,
    dir: null,
    keep: null,
    file: null,
    target: null,
  };

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === '--restore') {
      parsed.action = 'restore';
      if (args[i + 1] && !args[i + 1].startsWith('-')) {
        parsed.file = args[++i];
      }
    } else if (arg === '--verify') {
      parsed.action = 'verify';
      if (args[i + 1] && !args[i + 1].startsWith('-')) {
        parsed.file = args[++i];
      }
    } else if (arg === '--backup') {
      parsed.action = 'backup';
    } else if ((arg === '--db' || arg === '-d') && args[i + 1]) {
      parsed.db = args[++i];
    } else if ((arg === '--dir' || arg === '-b') && args[i + 1]) {
      parsed.dir = args[++i];
    } else if ((arg === '--keep' || arg === '-k') && args[i + 1]) {
      parsed.keep = parseInt(args[++i], 10);
    } else if ((arg === '--target' || arg === '-t') && args[i + 1]) {
      parsed.target = args[++i];
    } else if (arg === '--help' || arg === '-h') {
      console.log(`
Marmalade / Poetree — SQLite Backup & Restore CLI

Usage:
  node scripts/backup.js [dbPath] [backupDir]
  node scripts/backup.js --backup [--db <path>] [--dir <path>] [--keep <count>]
  node scripts/backup.js --restore <backup-file> [--target <db-path>]
  node scripts/backup.js --verify <db-file>

Options:
  --db, -d <path>         Path to source SQLite database (default: data/sprout.db or DB_PATH)
  --dir, -b <dir>         Directory to store backups (default: backups or BACKUP_DIR)
  --keep, -k <count>      Number of historical backups to retain (default: 7 or BACKUP_KEEP)
  --restore <file>        Restore database from a backup file (cleans stale -wal/-shm)
  --target, -t <path>     Target database path for restore (default: data/sprout.db)
  --verify <file>         Run PRAGMA quick_check on database file
  --help, -h              Show this help message
`);
      process.exit(0);
    } else if (!arg.startsWith('-')) {
      if (!parsed.db) {
        parsed.db = arg;
      } else if (!parsed.dir) {
        parsed.dir = arg;
      }
    }
  }

  return parsed;
}

const isDirectRun =
  process.argv[1] &&
  fileURLToPath(import.meta.url) === path.resolve(process.argv[1]);

if (isDirectRun) {
  const cli = parseCliArgs(process.argv.slice(2));

  try {
    if (cli.action === 'restore') {
      if (!cli.file) {
        console.error('Error: Please specify the backup file to restore from.');
        process.exit(1);
      }
      await restoreBackup({
        backupFile: cli.file,
        targetDb: cli.target || cli.db,
        verbose: true,
      });
    } else if (cli.action === 'verify') {
      if (!cli.file) {
        console.error('Error: Please specify the database file to verify.');
        process.exit(1);
      }
      verifyDatabaseIntegrity(cli.file);
      console.log(`✓ Database '${cli.file}' integrity OK (PRAGMA quick_check passed)`);
    } else {
      await createBackup({
        dbPath: cli.db,
        backupDir: cli.dir,
        keepCount: cli.keep,
        verbose: true,
      });
    }
  } catch (err) {
    console.error(`Error: ${err.message}`);
    process.exit(1);
  }
}
