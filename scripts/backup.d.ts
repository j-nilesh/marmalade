export function verifyDatabaseIntegrity(filePath: string): boolean;
export function rotateBackups(backupDir: string, keepCount?: number): string[];
export function createBackup(options?: {
  dbPath?: string;
  backupDir?: string;
  keepCount?: number;
  verbose?: boolean;
}): Promise<{
  targetFile: string;
  sizeBytes: number;
  sizeKb: number;
  removedBackups: string[];
}>;
export function restoreBackup(options?: {
  backupFile?: string;
  targetDb?: string;
  verbose?: boolean;
}): Promise<{
  targetDb: string;
  verified: boolean;
}>;
