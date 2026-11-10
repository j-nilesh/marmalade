#!/usr/bin/env node
/**
 * Marmalade / Poetree - Parent Password Reset CLI
 *
 * Usage:
 *   node scripts/reset-parent-password.js [--db <path>] [--username <username>] [--password <new-password>]
 *   npm run reset-password -- --username parent --password newpassword123
 */

import Database from 'better-sqlite3';
import { randomBytes, scryptSync } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import readline from 'node:readline';

const KEY_LEN = 64;

function hashPassword(password) {
  const salt = randomBytes(16).toString('hex');
  const derived = scryptSync(password, salt, KEY_LEN).toString('hex');
  return `${salt}:${derived}`;
}

function parseArgs(args) {
  const parsed = {
    db: process.env.DB_PATH || 'data/sprout.db',
    username: null,
    password: null,
  };

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === '--db' && args[i + 1]) {
      parsed.db = args[++i];
    } else if ((arg === '--username' || arg === '-u') && args[i + 1]) {
      parsed.username = args[++i];
    } else if ((arg === '--password' || arg === '-p') && args[i + 1]) {
      parsed.password = args[++i];
    } else if (arg === '--help' || arg === '-h') {
      console.log(`
Usage:
  node scripts/reset-parent-password.js [options]

Options:
  --db <path>          Path to sqlite database (default: data/sprout.db or DB_PATH)
  --username, -u <usr> Username of parent account (auto-detected if only 1 parent exists)
  --password, -p <pwd> New password (prompted interactively if omitted)
  --help, -h           Show this help message
`);
      process.exit(0);
    }
  }

  return parsed;
}

async function promptPassword(promptText) {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  return new Promise((resolve) => {
    rl.question(promptText, (answer) => {
      rl.close();
      resolve(answer.trim());
    });
  });
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const dbPath = path.resolve(process.cwd(), args.db);

  if (!fs.existsSync(dbPath)) {
    console.error(`[Error] Database file not found at: ${dbPath}`);
    console.error(`If running in Docker or another directory, specify --db <path>.`);
    process.exit(1);
  }

  const db = new Database(dbPath);

  // Check if users table exists
  const tableCheck = db
    .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='users'")
    .get();

  if (!tableCheck) {
    console.error(`[Error] 'users' table not found in ${dbPath}. Has family setup been completed?`);
    db.close();
    process.exit(1);
  }

  let user = null;

  if (args.username) {
    const userNorm = args.username.trim().toLowerCase();
    user = db
      .prepare("SELECT id, username, display_name, role FROM users WHERE username = ?")
      .get(userNorm);

    if (!user) {
      console.error(`[Error] User '${args.username}' not found in database.`);
      db.close();
      process.exit(1);
    }
  } else {
    const parentUsers = db
      .prepare("SELECT id, username, display_name, role FROM users WHERE role = 'parent'")
      .all();

    if (parentUsers.length === 0) {
      console.error(`[Error] No parent account found in database.`);
      db.close();
      process.exit(1);
    }

    if (parentUsers.length === 1) {
      user = parentUsers[0];
    } else {
      console.error(
        `[Error] Multiple parent accounts found (${parentUsers.map((u) => u.username).join(', ')}). Specify --username <username>.`
      );
      db.close();
      process.exit(1);
    }
  }

  console.log(`Found account: ${user.display_name} (@${user.username}) [role: ${user.role}]`);

  let newPassword = args.password;
  if (!newPassword) {
    newPassword = await promptPassword('Enter new password (min 8 chars): ');
  }

  if (!newPassword || newPassword.length < 8) {
    console.error(`[Error] Password must be at least 8 characters long.`);
    db.close();
    process.exit(1);
  }

  const newHash = hashPassword(newPassword);

  const update = db.transaction(() => {
    db.prepare('UPDATE users SET password_hash = ? WHERE id = ?').run(newHash, user.id);
    const deletedSessions = db
      .prepare('DELETE FROM sessions WHERE user_id = ?')
      .run(user.id);
    return deletedSessions.changes;
  });

  const sessionCount = update();
  db.close();

  console.log(
    `[Success] Password successfully reset for @${user.username}. Invalidate ${sessionCount} active session(s).`
  );
}

main().catch((err) => {
  console.error('[Fatal Error]', err);
  process.exit(1);
});
