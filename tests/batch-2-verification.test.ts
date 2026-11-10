import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import Database from 'better-sqlite3';
import { createSproutApp } from '../src/server/app.js';
import { SproutDatabase } from '../src/server/db/sqlite.js';
import { AnthropicModelProvider } from '../src/server/providers/anthropic.js';
import { OllamaModelProvider } from '../src/server/providers/ollama.js';
import {
  createBackup,
  restoreBackup,
  rotateBackups,
  verifyDatabaseIntegrity,
} from '../scripts/backup.js';

describe('Batch 2 Verification Suite', () => {
  describe('1. Child Age Configuration & Clamping (8-14)', () => {
    it('defaults childAge to 11 on fresh setup', () => {
      const db = new SproutDatabase(':memory:');
      db.initializeFamilySetup({
        parentUsername: 'parent',
        parentDisplayName: 'Parent',
        parentPassword: 'Password123!',
        childUsername: 'child',
        childDisplayName: 'Child',
        childPassword: 'Password123!',
      });
      const policy = db.getPolicyConfig();
      expect(policy.childAge).toBe(11);
    });

    it('allows setting custom childAge at setup and clamps out-of-range values', () => {
      const db1 = new SproutDatabase(':memory:');
      db1.initializeFamilySetup({
        parentUsername: 'parent',
        parentDisplayName: 'Parent',
        parentPassword: 'Password123!',
        childUsername: 'child',
        childDisplayName: 'Child',
        childPassword: 'Password123!',
        childAge: 9,
      });
      expect(db1.getPolicyConfig().childAge).toBe(9);

      // Clamp below 8 -> 8
      db1.updatePolicyConfig({ childAge: 5 });
      expect(db1.getPolicyConfig().childAge).toBe(8);

      // Clamp above 14 -> 14
      db1.updatePolicyConfig({ childAge: 17 });
      expect(db1.getPolicyConfig().childAge).toBe(14);

      // Normal valid update
      db1.updatePolicyConfig({ childAge: 13 });
      expect(db1.getPolicyConfig().childAge).toBe(13);
    });
  });

  describe('2. Prompt Delimiting & Socratic / Homework Scaffolding', () => {
    it('Study Nook follow-up sends delimited tags and Socratic instructions', async () => {
      const appInstance = createSproutApp({ dbPath: ':memory:' });
      const { db, activityEngine, providerRegistry } = appInstance;
      db.initializeFamilySetup({
        parentUsername: 'parent',
        parentDisplayName: 'Parent',
        parentPassword: 'Password123!',
        childUsername: 'child',
        childDisplayName: 'Child',
        childPassword: 'Password123!',
        childAge: 12,
      });

      let capturedRequest: any = null;
      const mockProvider = providerRegistry.getModelProvider('mock');
      const originalGenerate = mockProvider.generate.bind(mockProvider);
      mockProvider.generate = async (req: any) => {
        capturedRequest = req;
        return originalGenerate(req);
      };

      const startRes = await activityEngine.startSchoolworkSession(
        'Write an essay explaining photosynthesis and its chemical equation.'
      );
      expect(startRes.ok).toBe(true);
      if (!startRes.ok) return;

      const followRes = await activityEngine.followupSchoolwork(
        startRes.session.sessionId,
        'Can you just write the introduction paragraph for me?',
        Date.now()
      );
      expect(followRes.ok).toBe(true);

      expect(capturedRequest).not.toBeNull();
      const messages = capturedRequest.messages;
      const coachSystemMsg = messages.find((m: any) => m.content.includes('Study Nook Coach'))?.content || '';
      const contextMsg = messages.find((m: any) => m.content.includes('<assignment_context>'))?.content || '';
      const questionMsg = messages.find((m: any) => m.content.includes('<student_question>'))?.content || '';

      // Check Socratic instructions and dynamic child age
      expect(coachSystemMsg).toContain('12-year-old student');
      expect(coachSystemMsg).toContain('Scaffold rather than solve');
      expect(coachSystemMsg).toContain('discover');

      // Check prompt delimiting
      expect(contextMsg).toContain('<assignment_context>');
      expect(contextMsg).toContain('</assignment_context>');
      expect(questionMsg).toContain('<student_question>');
      expect(questionMsg).toContain('</student_question>');
      expect(questionMsg).toContain('Can you just write the introduction paragraph for me?');
    });

    it('Question Room (Ask) includes Homework Guard, dynamic brand/age, and student_question delimiters', async () => {
      const appInstance = createSproutApp({ dbPath: ':memory:' });
      const { db, activityEngine, providerRegistry } = appInstance;
      db.initializeFamilySetup({
        parentUsername: 'parent',
        parentDisplayName: 'Parent',
        parentPassword: 'Password123!',
        childUsername: 'child',
        childDisplayName: 'Child',
        childPassword: 'Password123!',
        childAge: 10,
      });

      let capturedRequest: any = null;
      const mockProvider = providerRegistry.getModelProvider('mock');
      const originalGenerate = mockProvider.generate.bind(mockProvider);
      mockProvider.generate = async (req: any) => {
        capturedRequest = req;
        return originalGenerate(req);
      };

      const askRes = await activityEngine.submitAskTurn({
        prompt: 'Can you do my 5th grade math homework worksheet for me?',
      });
      expect(askRes.ok).toBe(true);

      expect(capturedRequest).not.toBeNull();
      const messages = capturedRequest.messages;
      const baseSystemMsg = messages[0]?.content || '';
      const askSystemMsg = messages.find((m: any) => m.content.includes('The Question Room'))?.content || '';
      const lastUserMsg = messages[messages.length - 1]?.content || '';

      // Dynamic brand and age in base system message
      expect(baseSystemMsg).toContain('Marmalade');
      expect(baseSystemMsg).toContain('~10 years old');

      // Homework Guard check in Question Room
      expect(askSystemMsg).toContain('Homework & Schoolwork Guard');
      expect(askSystemMsg).toContain('Study Nook');
      expect(askSystemMsg).toContain('10-year-old child');

      // Delimiter check
      expect(lastUserMsg).toContain('<student_question>');
      expect(lastUserMsg).toContain('</student_question>');
      expect(lastUserMsg).toContain('Can you do my 5th grade math homework worksheet for me?');
    });

    it('Trivia round delimits topic in <topic> tag when live provider generates', async () => {
      const appInstance = createSproutApp({ dbPath: ':memory:' });
      const { db, activityEngine, providerRegistry } = appInstance;
      db.initializeFamilySetup({
        parentUsername: 'parent',
        parentDisplayName: 'Parent',
        parentPassword: 'Password123!',
        childUsername: 'child',
        childDisplayName: 'Child',
        childPassword: 'Password123!',
        childAge: 13,
      });

      // Switch active provider to anthropic with a mock generator
      db.raw.prepare("UPDATE policy_config SET active_provider = 'anthropic' WHERE id = 1").run();
      let capturedRequest: any = null;
      const anthropicProvider = providerRegistry.getModelProvider('anthropic') as AnthropicModelProvider;
      (anthropicProvider as any).apiKey = 'sk-ant-test-key';
      (anthropicProvider as any).zeroDataRetentionApproved = true;
      anthropicProvider.generate = async (req: any) => {
        capturedRequest = req;
        return {
          content: '{"questions":[]}',
          tokenUsage: { promptTokens: 20, completionTokens: 10, totalTokens: 30 },
          estimatedCostCents: 0.01,
        };
      };

      await activityEngine.startTriviaRound({
        topic: 'science_nature',
        customTopic: 'Bioluminescent deep sea creatures',
        difficulty: 'challenging',
      });

      expect(capturedRequest).not.toBeNull();
      const messages = capturedRequest.messages;
      const promptContent = messages.map((m: any) => m.content).join('\n');
      expect(promptContent).toContain('<topic>Bioluminescent deep sea creatures</topic>');
      expect(promptContent).toContain('13-year-old');
    });
  });

  describe('3. Anthropic Adapter Hardening', () => {
    it('handles refusal stop_reason gracefully without crashing', async () => {
      const provider = new AnthropicModelProvider({
        apiKey: 'test-api-key',
        model: 'claude-3-7-sonnet-latest',
        zeroDataRetentionApproved: true,
      });

      // Mock fetch response with stop_reason = 'refusal'
      const originalFetch = globalThis.fetch;
      globalThis.fetch = vi.fn().mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          stop_reason: 'refusal',
          content: [],
          usage: { input_tokens: 50, output_tokens: 10 },
        }),
      } as any);

      try {
        const result = await provider.generate({
          mode: 'ask',
          maxOutputTokens: 1000,
          messages: [{ role: 'user', content: 'test question' }],
        });

        expect(result.safetyFlagged).toEqual({ category: 'refusal', severity: 'low' });
        expect(result.content).toContain("Let's try exploring another question");
        expect(result.tokenUsage.promptTokens).toBe(50);
        expect(result.tokenUsage.completionTokens).toBe(10);
      } finally {
        globalThis.fetch = originalFetch;
      }
    });

    it('recovers from empty output by retrying without thinking and accumulates token usage', async () => {
      const provider = new AnthropicModelProvider({
        apiKey: 'test-api-key',
        model: 'claude-3-7-sonnet-latest',
        zeroDataRetentionApproved: true,
      });

      const originalFetch = globalThis.fetch;
      let callCount = 0;
      let secondCallBody: any = null;

      globalThis.fetch = vi.fn().mockImplementation(async (url, init: any) => {
        callCount++;
        const parsedBody = JSON.parse(init.body);
        if (callCount === 1) {
          // First attempt: thinking block consumed tokens, zero text output
          return {
            ok: true,
            json: async () => ({
              stop_reason: 'end_turn',
              content: [
                { type: 'thinking', thinking: 'I am pondering this deeply...' },
              ],
              usage: { input_tokens: 60, output_tokens: 40 },
            }),
          };
        } else {
          // Second attempt: retry without thinking block
          secondCallBody = parsedBody;
          return {
            ok: true,
            json: async () => ({
              stop_reason: 'end_turn',
              content: [
                { type: 'text', text: 'Here is the clear answer!' },
              ],
              usage: { input_tokens: 60, output_tokens: 25 },
            }),
          };
        }
      });

      try {
        const result = await provider.generate({
          mode: 'ask',
          maxOutputTokens: 1000,
          messages: [{ role: 'user', content: 'Explain gravity.' }],
        });

        expect(callCount).toBe(2);
        // Verified thinking was removed on retry, not sent as { type: 'disabled' }
        expect(secondCallBody.thinking).toBeUndefined();
        expect(result.content).toBe('Here is the clear answer!');
        // Verified tokens accumulated across both attempts (60 + 60 = 120, 40 + 25 = 65)
        expect(result.tokenUsage.promptTokens).toBe(120);
        expect(result.tokenUsage.completionTokens).toBe(65);
        expect(result.tokenUsage.totalTokens).toBe(185);
      } finally {
        globalThis.fetch = originalFetch;
      }
    });
  });

  describe('4. Ollama Adapter Hardening', () => {
    it('uses /api/chat with structured messages and num_ctx: 4096', async () => {
      const provider = new OllamaModelProvider({ baseUrl: 'http://127.0.0.1:11434' });

      const originalFetch = globalThis.fetch;
      let requestedUrl = '';
      let requestedBody: any = null;

      globalThis.fetch = vi.fn().mockImplementation(async (url, init: any) => {
        requestedUrl = String(url);
        requestedBody = JSON.parse(init.body);
        return {
          ok: true,
          json: async () => ({
            message: { role: 'assistant', content: 'Local model response' },
            prompt_eval_count: 35,
            eval_count: 20,
          }),
        };
      });

      try {
        const result = await provider.generate({
          mode: 'ask',
          maxOutputTokens: 500,
          messages: [
            { role: 'system', content: 'You are a tutor.' },
            { role: 'user', content: 'Why is the sky blue?' },
          ],
        });

        expect(requestedUrl).toBe('http://127.0.0.1:11434/api/chat');
        expect(requestedBody.messages).toHaveLength(2);
        expect(requestedBody.messages[0]).toEqual({
          role: 'system',
          content: 'You are a tutor.',
        });
        expect(requestedBody.messages[1]).toEqual({
          role: 'user',
          content: 'Why is the sky blue?',
        });
        expect(requestedBody.options.num_ctx).toBe(4096);
        expect(result.content).toBe('Local model response');
      } finally {
        globalThis.fetch = originalFetch;
      }
    });
  });

  describe('5. Native SQLite Backup & Restore CLI', () => {
    let tmpDir: string;
    let dbPath: string;
    let backupDir: string;

    beforeEach(() => {
      tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'sprout-backup-test-'));
      dbPath = path.join(tmpDir, 'test.db');
      backupDir = path.join(tmpDir, 'backups');

      // Create a test database with table & data
      const db = new Database(dbPath);
      db.pragma('journal_mode = WAL');
      db.exec('CREATE TABLE notes (id INTEGER PRIMARY KEY, text TEXT);');
      db.prepare('INSERT INTO notes (text) VALUES (?)').run('Original secret note 42');
      db.close();
    });

    afterEach(() => {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    });

    it('creates a verified online backup using better-sqlite3 native backup', async () => {
      const backupResult = await createBackup({
        dbPath,
        backupDir,
        keepCount: 5,
        verbose: false,
      });

      expect(fs.existsSync(backupResult.targetFile)).toBe(true);
      expect(backupResult.sizeBytes).toBeGreaterThan(0);
      expect(verifyDatabaseIntegrity(backupResult.targetFile)).toBe(true);

      // Verify backed-up data can be queried independently
      const bDb = new Database(backupResult.targetFile, { readonly: true });
      const row = bDb.prepare('SELECT text FROM notes WHERE id = 1').get() as any;
      expect(row.text).toBe('Original secret note 42');
      bDb.close();
    });

    it('rotates older backups retaining only keepCount', () => {
      fs.mkdirSync(backupDir, { recursive: true });

      // Create 5 dummy backup files with staggered modification times
      const now = Date.now();
      for (let i = 1; i <= 5; i++) {
        const fPath = path.join(backupDir, `sprout_backup_2026010${i}_120000.db`);
        fs.writeFileSync(fPath, 'dummy-data');
        const mtime = new Date(now + i * 1000);
        fs.utimesSync(fPath, mtime, mtime);
      }

      // Rotate with keepCount = 3 -> should remove the 2 oldest
      const removed = rotateBackups(backupDir, 3);
      expect(removed.length).toBe(2);
      expect(removed).toContain('sprout_backup_20260101_120000.db');
      expect(removed).toContain('sprout_backup_20260102_120000.db');

      const remaining = fs.readdirSync(backupDir);
      expect(remaining.length).toBe(3);
    });

    it('safely restores from backup, wiping stale -wal and -shm files', async () => {
      // 1. Create a backup of initial state
      const backupResult = await createBackup({
        dbPath,
        backupDir,
        verbose: false,
      });

      // 2. Modify original db and simulate stale WAL & SHM files with dummy garbage
      const walPath = `${dbPath}-wal`;
      const shmPath = `${dbPath}-shm`;
      fs.writeFileSync(walPath, 'stale-corrupt-wal-bytes');
      fs.writeFileSync(shmPath, 'stale-corrupt-shm-bytes');

      // 3. Restore from backup
      const restoreResult = await restoreBackup({
        backupFile: backupResult.targetFile,
        targetDb: dbPath,
        verbose: false,
      });

      expect(restoreResult.verified).toBe(true);
      // Stale garbage must have been purged (any active wal file recreated by sqlite will not contain the stale string)
      if (fs.existsSync(walPath)) {
        expect(fs.readFileSync(walPath, 'utf8')).not.toBe('stale-corrupt-wal-bytes');
      }

      // Verify restored content matches original backup state
      const rDb = new Database(dbPath, { readonly: true });
      const rows = rDb.prepare('SELECT * FROM notes').all() as any[];
      expect(rows.length).toBe(1);
      expect(rows[0].text).toBe('Original secret note 42');
      rDb.close();
    });
  });
});
