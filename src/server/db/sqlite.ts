import Database from 'better-sqlite3';
import { mkdirSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import type {
  ActivityMode,
  PolicyConfig,
  ProviderId,
  ProviderSettingsPublic,
  SafetyEventSummary,
  SavedArtifact,
  TimeExtensionRequest,
  UserPublic,
  UserRole,
} from '../../shared/types.js';
import {
  generateCsrfToken,
  generateSessionToken,
  hashPassword,
  hashSessionToken,
  verifyPassword,
  encryptApiKey,
  decryptApiKey,
} from '../auth/crypto.js';

export const PARENT_SESSION_TTL_MS = 15 * 60 * 1000; // 15 minutes short auto-timeout for parent
export const CHILD_SESSION_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours sensible session timeout for child workspace

export interface DailyUsageRow {
  date_key: string;
  global_active_seconds: number;
  bonus_global_seconds: number;
  ask_active_seconds: number;
  research_active_seconds: number;
  schoolwork_active_seconds: number;
  play_active_seconds: number;
  bonus_ask_seconds: number;
  bonus_research_seconds: number;
  bonus_schoolwork_seconds: number;
  bonus_play_seconds: number;
  request_count: number;
  completed_sessions_count: number;
  spent_cost_cents: number;
  reserved_cost_cents: number;
  continuous_active_seconds: number;
  continuous_started_at_ms: number;
  last_interaction_at_ms: number;
  last_tick_at_ms: number;
  interaction_lease_until_ms: number;
}

export interface MonthlyUsageRow {
  month_key: string;
  spent_cost_cents: number;
  reserved_cost_cents: number;
  request_count: number;
}

export interface SessionRecord {
  tokenHash: string;
  user: UserPublic;
  csrfToken: string;
  createdAtMs: number;
  expiresAtMs: number;
  lastSeenAtMs: number;
}

export function resolveDefaultDbPath(dataDir: string = './data'): string {
  const envPath =
    process.env.MARMALADE_DB_PATH ||
    process.env.SPROUT_DB_PATH ||
    process.env.DB_PATH ||
    process.env.DATABASE_PATH;
  if (envPath) return envPath;

  const defaultMarmalade = join(dataDir, 'marmalade.db');
  const legacySprout = join(dataDir, 'sprout.db');
  if (!existsSync(defaultMarmalade) && existsSync(legacySprout)) {
    return legacySprout;
  }
  return defaultMarmalade;
}

export class MarmaladeDatabase {
  public readonly raw: Database.Database;

  public close(): void {
    this.raw.close();
  }

  constructor(dbPath: string = resolveDefaultDbPath()) {
    if (dbPath !== ':memory:') {
      mkdirSync(dirname(dbPath), { recursive: true });
    }
    this.raw = new Database(dbPath);
    const requestedJournalMode = (
      process.env.MARMALADE_SQLITE_JOURNAL_MODE ||
      process.env.SPROUT_SQLITE_JOURNAL_MODE ||
      (process.env.K_SERVICE ? 'DELETE' : 'WAL')
    ).toUpperCase();
    try {
      this.raw.pragma(`journal_mode = ${requestedJournalMode}`);
    } catch {
      this.raw.pragma('journal_mode = DELETE');
    }
    this.raw.pragma('foreign_keys = ON');
    this.migrate();
  }

  private migrate(): void {
    this.raw.exec(`
      CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT NOT NULL UNIQUE,
        display_name TEXT NOT NULL,
        role TEXT NOT NULL CHECK (role IN ('parent', 'child')),
        password_hash TEXT NOT NULL,
        created_at_ms INTEGER NOT NULL
      );

      CREATE TABLE IF NOT EXISTS sessions (
        token_hash TEXT PRIMARY KEY,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        role TEXT NOT NULL CHECK (role IN ('parent', 'child')),
        csrf_token TEXT NOT NULL,
        created_at_ms INTEGER NOT NULL,
        expires_at_ms INTEGER NOT NULL,
        last_seen_at_ms INTEGER NOT NULL
      );

      CREATE TABLE IF NOT EXISTS policy_config (
        id INTEGER PRIMARY KEY CHECK (id = 1),
        timezone TEXT NOT NULL DEFAULT 'UTC',
        global_daily_minutes INTEGER NOT NULL DEFAULT 90,
        max_continuous_session_minutes INTEGER NOT NULL DEFAULT 30,
        session_cooldown_minutes INTEGER NOT NULL DEFAULT 10,
        ask_enabled INTEGER NOT NULL DEFAULT 1,
        research_enabled INTEGER NOT NULL DEFAULT 1,
        schoolwork_enabled INTEGER NOT NULL DEFAULT 1,
        play_enabled INTEGER NOT NULL DEFAULT 1,
        ask_daily_minutes INTEGER NOT NULL DEFAULT 45,
        research_daily_minutes INTEGER NOT NULL DEFAULT 45,
        schoolwork_daily_minutes INTEGER NOT NULL DEFAULT 60,
        play_daily_minutes INTEGER NOT NULL DEFAULT 25,
        daily_spend_cap_cents INTEGER NOT NULL DEFAULT 100,
        monthly_spend_cap_cents INTEGER NOT NULL DEFAULT 1500,
        monthly_reset_day INTEGER NOT NULL DEFAULT 1,
        active_provider TEXT NOT NULL DEFAULT 'mock',
        allow_external_search INTEGER NOT NULL DEFAULT 0,
        updated_at_ms INTEGER NOT NULL
      );

      CREATE TABLE IF NOT EXISTS daily_usage (
        date_key TEXT PRIMARY KEY,
        global_active_seconds INTEGER NOT NULL DEFAULT 0,
        bonus_global_seconds INTEGER NOT NULL DEFAULT 0,
        ask_active_seconds INTEGER NOT NULL DEFAULT 0,
        research_active_seconds INTEGER NOT NULL DEFAULT 0,
        schoolwork_active_seconds INTEGER NOT NULL DEFAULT 0,
        play_active_seconds INTEGER NOT NULL DEFAULT 0,
        bonus_ask_seconds INTEGER NOT NULL DEFAULT 0,
        bonus_research_seconds INTEGER NOT NULL DEFAULT 0,
        bonus_schoolwork_seconds INTEGER NOT NULL DEFAULT 0,
        bonus_play_seconds INTEGER NOT NULL DEFAULT 0,
        request_count INTEGER NOT NULL DEFAULT 0,
        completed_sessions_count INTEGER NOT NULL DEFAULT 0,
        spent_cost_cents INTEGER NOT NULL DEFAULT 0,
        reserved_cost_cents INTEGER NOT NULL DEFAULT 0,
        continuous_active_seconds INTEGER NOT NULL DEFAULT 0,
        continuous_started_at_ms INTEGER NOT NULL DEFAULT 0,
        last_interaction_at_ms INTEGER NOT NULL DEFAULT 0,
        last_tick_at_ms INTEGER NOT NULL DEFAULT 0,
        interaction_lease_until_ms INTEGER NOT NULL DEFAULT 0
      );

      CREATE TABLE IF NOT EXISTS monthly_usage (
        month_key TEXT PRIMARY KEY,
        spent_cost_cents INTEGER NOT NULL DEFAULT 0,
        reserved_cost_cents INTEGER NOT NULL DEFAULT 0,
        request_count INTEGER NOT NULL DEFAULT 0
      );

      CREATE TABLE IF NOT EXISTS saved_artifacts (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        title TEXT NOT NULL,
        mode TEXT NOT NULL CHECK (mode IN ('ask', 'research', 'schoolwork', 'play')),
        activity_type TEXT NOT NULL,
        content TEXT NOT NULL,
        created_at_ms INTEGER NOT NULL
      );

      CREATE TABLE IF NOT EXISTS learning_ledger (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        subject TEXT NOT NULL,
        summary TEXT NOT NULL,
        concepts_json TEXT NOT NULL DEFAULT '[]',
        uncertainties_json TEXT NOT NULL DEFAULT '[]',
        approved_by_child_at_ms INTEGER NOT NULL,
        updated_at_ms INTEGER NOT NULL
      );

      CREATE TABLE IF NOT EXISTS time_extension_requests (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        date_key TEXT NOT NULL,
        requested_mode TEXT NOT NULL CHECK (requested_mode IN ('ask', 'research', 'schoolwork', 'play', 'global')),
        requested_minutes INTEGER NOT NULL,
        reason_note TEXT NOT NULL DEFAULT '',
        status TEXT NOT NULL CHECK (status IN ('pending', 'approved', 'denied')),
        granted_minutes INTEGER NOT NULL DEFAULT 0,
        created_at_ms INTEGER NOT NULL,
        resolved_at_ms INTEGER
      );

      CREATE TABLE IF NOT EXISTS safety_events (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        category TEXT NOT NULL,
        severity TEXT NOT NULL CHECK (severity IN ('low', 'medium', 'high')),
        mode TEXT NOT NULL CHECK (mode IN ('ask', 'research', 'schoolwork', 'play')),
        created_at_ms INTEGER NOT NULL,
        acknowledged INTEGER NOT NULL DEFAULT 0
      );

      CREATE TABLE IF NOT EXISTS provider_settings (
        id INTEGER PRIMARY KEY CHECK (id = 1),
        gemini_api_key TEXT NOT NULL DEFAULT '',
        gemini_fast_model TEXT NOT NULL DEFAULT 'gemini-2.5-flash',
        gemini_reasoning_model TEXT NOT NULL DEFAULT 'gemini-2.5-pro',
        gemini_zdr_approved INTEGER NOT NULL DEFAULT 0,
        ollama_base_url TEXT NOT NULL DEFAULT 'http://127.0.0.1:11434',
        ollama_model TEXT NOT NULL DEFAULT 'llama3.2',
        openai_api_key TEXT NOT NULL DEFAULT '',
        openai_model TEXT NOT NULL DEFAULT 'gpt-4o-mini',
        openai_zdr_approved INTEGER NOT NULL DEFAULT 0,
        anthropic_api_key TEXT NOT NULL DEFAULT '',
        anthropic_model TEXT NOT NULL DEFAULT 'claude-haiku-5-5',
        anthropic_zdr_approved INTEGER NOT NULL DEFAULT 0,
        search_api_url TEXT NOT NULL DEFAULT '',
        search_api_key TEXT NOT NULL DEFAULT '',
        updated_at_ms INTEGER NOT NULL
      );
    `);

    // Safe column migrations for existing databases
    const cols = this.raw.prepare('PRAGMA table_info(provider_settings)').all() as Array<{ name: string }>;
    const colNames = new Set(cols.map((c) => c.name));
    if (!colNames.has('gemini_api_key')) {
      this.raw.exec("ALTER TABLE provider_settings ADD COLUMN gemini_api_key TEXT NOT NULL DEFAULT ''");
    }
    if (!colNames.has('gemini_fast_model')) {
      this.raw.exec(
        "ALTER TABLE provider_settings ADD COLUMN gemini_fast_model TEXT NOT NULL DEFAULT 'gemini-2.5-flash'"
      );
    }
    if (!colNames.has('gemini_reasoning_model')) {
      this.raw.exec(
        "ALTER TABLE provider_settings ADD COLUMN gemini_reasoning_model TEXT NOT NULL DEFAULT 'gemini-2.5-pro'"
      );
    }
    if (!colNames.has('gemini_zdr_approved')) {
      this.raw.exec(
        'ALTER TABLE provider_settings ADD COLUMN gemini_zdr_approved INTEGER NOT NULL DEFAULT 0'
      );
    }
    if (!colNames.has('anthropic_api_key')) {
      this.raw.exec(
        "ALTER TABLE provider_settings ADD COLUMN anthropic_api_key TEXT NOT NULL DEFAULT ''"
      );
    }
    if (!colNames.has('anthropic_model')) {
      this.raw.exec(
        "ALTER TABLE provider_settings ADD COLUMN anthropic_model TEXT NOT NULL DEFAULT 'claude-haiku-5-5'"
      );
    }
    if (!colNames.has('anthropic_zdr_approved')) {
      this.raw.exec(
        'ALTER TABLE provider_settings ADD COLUMN anthropic_zdr_approved INTEGER NOT NULL DEFAULT 0'
      );
    }

    // Migrate any retired Claude 3 model strings to active Claude Haiku 5.5
    try {
      this.raw.exec(`
        UPDATE provider_settings 
        SET anthropic_model = 'claude-haiku-5-5' 
        WHERE id = 1 AND (anthropic_model LIKE 'claude-3%' OR anthropic_model = '');
      `);
    } catch {
      // Ignore if table not ready
    }

    // Safe column migrations for users (Item 2: first-run explainer status)
    const userCols = this.raw.prepare('PRAGMA table_info(users)').all() as Array<{ name: string }>;
    const userColNames = new Set(userCols.map((c) => c.name));
    if (!userColNames.has('seen_first_run_explainer')) {
      this.raw.exec('ALTER TABLE users ADD COLUMN seen_first_run_explainer INTEGER NOT NULL DEFAULT 0');
    }

    // Safe column migrations for policy_config (Item 0: instance name, Item 1 & 3: provider compliance & PII filter)
    const policyCols = this.raw.prepare('PRAGMA table_info(policy_config)').all() as Array<{ name: string }>;
    const policyColNames = new Set(policyCols.map((c) => c.name));
    if (!policyColNames.has('instance_display_name')) {
      this.raw.exec("ALTER TABLE policy_config ADD COLUMN instance_display_name TEXT NOT NULL DEFAULT ''");
    }
    if (!policyColNames.has('pii_filter_enabled')) {
      this.raw.exec('ALTER TABLE policy_config ADD COLUMN pii_filter_enabled INTEGER NOT NULL DEFAULT 1');
    }
    if (!policyColNames.has('openai_under_13_confirmed')) {
      this.raw.exec('ALTER TABLE policy_config ADD COLUMN openai_under_13_confirmed INTEGER NOT NULL DEFAULT 0');
    }
    if (!policyColNames.has('anthropic_conditions_confirmed')) {
      this.raw.exec('ALTER TABLE policy_config ADD COLUMN anthropic_conditions_confirmed INTEGER NOT NULL DEFAULT 0');
    }
    if (!policyColNames.has('child_age')) {
      this.raw.exec('ALTER TABLE policy_config ADD COLUMN child_age INTEGER NOT NULL DEFAULT 11');
    }

    const ledgerColumns = this.raw.prepare('PRAGMA table_info(learning_ledger)').all() as Array<{name: string}>;
    if (!ledgerColumns.some(c => c.name === 'source_session_id')) this.raw.exec('ALTER TABLE learning_ledger ADD COLUMN source_session_id TEXT');
    this.raw.exec('CREATE UNIQUE INDEX IF NOT EXISTS ledger_source_session ON learning_ledger(source_session_id) WHERE source_session_id IS NOT NULL');
    this.raw.exec(`CREATE TABLE IF NOT EXISTS experience_settings (id INTEGER PRIMARY KEY CHECK(id=1), onboarding_completed INTEGER NOT NULL DEFAULT 0); INSERT OR IGNORE INTO experience_settings(id) VALUES(1);`);
    const existingConfig = this.raw
      .prepare('SELECT id FROM policy_config WHERE id = 1')
      .get();
    if (!existingConfig) {
      const defaultProvider =
        process.env.ANTHROPIC_API_KEY
          ? 'anthropic'
          : process.env.OPENAI_API_KEY
            ? 'openai'
            : 'mock';
      this.raw
        .prepare(
          `INSERT INTO policy_config (
            id, timezone, global_daily_minutes, max_continuous_session_minutes,
            session_cooldown_minutes, ask_enabled, research_enabled, schoolwork_enabled,
            play_enabled, ask_daily_minutes, research_daily_minutes, schoolwork_daily_minutes,
            play_daily_minutes, daily_spend_cap_cents, monthly_spend_cap_cents,
            monthly_reset_day, active_provider, allow_external_search,
            instance_display_name, pii_filter_enabled, openai_under_13_confirmed, anthropic_conditions_confirmed,
            updated_at_ms
          ) VALUES (1, 'UTC', 90, 30, 10, 1, 1, 1, 1, 45, 45, 60, 25, 100, 1500, 1, ?, 0, '', 1, 0, 0, ?)`
        )
        .run(defaultProvider, Date.now());
    }

    const existingProviderSettings = this.raw
      .prepare('SELECT id FROM provider_settings WHERE id = 1')
      .get();
    if (!existingProviderSettings) {
      this.raw
        .prepare(
          `INSERT INTO provider_settings (
            id, gemini_api_key, gemini_fast_model, gemini_reasoning_model, gemini_zdr_approved,
            ollama_base_url, ollama_model, openai_api_key, openai_model,
            openai_zdr_approved, anthropic_api_key, anthropic_model, anthropic_zdr_approved,
            search_api_url, search_api_key, updated_at_ms
          ) VALUES (1, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
        )
        .run(
          process.env.GEMINI_API_KEY || '',
          process.env.GEMINI_FAST_MODEL || 'gemini-3.8-flash',
          process.env.GEMINI_REASONING_MODEL || 'gemini-3.8-flash',
          process.env.GEMINI_ZDR_APPROVED === 'true' || process.env.GEMINI_ZDR_APPROVED === '1' ? 1 : 0,
          process.env.OLLAMA_BASE_URL || 'http://127.0.0.1:11434',
          process.env.OLLAMA_MODEL || 'llama3.2',
          process.env.OPENAI_API_KEY || '',
          process.env.OPENAI_MODEL || 'gpt-4o-mini',
          process.env.OPENAI_ZDR_APPROVED === 'true' || process.env.OPENAI_ZDR_APPROVED === '1' ? 1 : 0,
          process.env.ANTHROPIC_API_KEY || '',
          process.env.ANTHROPIC_MODEL || 'claude-haiku-5-5',
          process.env.ANTHROPIC_ZDR_APPROVED === 'true' || process.env.ANTHROPIC_ZDR_APPROVED === '1' ? 1 : 0,
          process.env.SEARCH_API_URL || '',
          process.env.SEARCH_API_KEY || '',
          Date.now()
        );
    }
  }

  public isInitialized(): boolean {
    const row = this.raw
      .prepare("SELECT COUNT(*) as cnt FROM users WHERE role = 'parent'")
      .get() as { cnt: number };
    return row.cnt > 0;
  }

  public initializeFamilySetup(params: {
    parentUsername: string;
    parentDisplayName: string;
    parentPassword: string;
    childUsername: string;
    childDisplayName: string;
    childPassword: string;
    timezone?: string;
    childAge?: number;
    globalDailyMinutes?: number;
    playDailyMinutes?: number;
    nowMs?: number;
  }): { parentUser: UserPublic; childUser: UserPublic } {
    const now = params.nowMs ?? Date.now();
    const tx = this.raw.transaction(() => {
      if (this.isInitialized()) {
        throw new Error('SETUP_ALREADY_COMPLETED');
      }
      const parentUserNorm = params.parentUsername.trim().toLowerCase();
      const childUserNorm = params.childUsername.trim().toLowerCase();
      if (!parentUserNorm || !childUserNorm || parentUserNorm === childUserNorm) {
        throw new Error('INVALID_USERNAMES');
      }
      if (params.parentPassword.length < 8 || params.childPassword.length < 6) {
        throw new Error('PASSWORD_TOO_SHORT');
      }

      const parentHash = hashPassword(params.parentPassword);
      const childHash = hashPassword(params.childPassword);

      const pRes = this.raw
        .prepare(
          `INSERT INTO users (username, display_name, role, password_hash, created_at_ms)
           VALUES (?, ?, 'parent', ?, ?)`
        )
        .run(
          parentUserNorm,
          params.parentDisplayName.trim() || 'Parent Admin',
          parentHash,
          now
        );

      const cRes = this.raw
        .prepare(
          `INSERT INTO users (username, display_name, role, password_hash, created_at_ms)
           VALUES (?, ?, 'child', ?, ?)`
        )
        .run(
          childUserNorm,
          params.childDisplayName.trim() || 'Explorer',
          childHash,
          now
        );

      if (params.timezone) {
        let validTz = params.timezone.trim();
        try {
          new Intl.DateTimeFormat('en-US', { timeZone: validTz });
        } catch {
          validTz = 'UTC';
        }
        this.raw
          .prepare('UPDATE policy_config SET timezone = ?, updated_at_ms = ? WHERE id = 1')
          .run(validTz, now);
      }
      if (typeof params.globalDailyMinutes === 'number') {
        this.raw
          .prepare(
            'UPDATE policy_config SET global_daily_minutes = ?, updated_at_ms = ? WHERE id = 1'
          )
          .run(Math.max(1, Math.floor(params.globalDailyMinutes)), now);
      }
      if (typeof params.playDailyMinutes === 'number') {
        this.raw
          .prepare(
            'UPDATE policy_config SET play_daily_minutes = ?, updated_at_ms = ? WHERE id = 1'
          )
          .run(Math.max(1, Math.floor(params.playDailyMinutes)), now);
      }
      if (typeof params.childAge === 'number') {
        const clampedAge = Math.max(6, Math.min(16, Math.floor(params.childAge)));
        this.raw
          .prepare(
            'UPDATE policy_config SET child_age = ?, updated_at_ms = ? WHERE id = 1'
          )
          .run(clampedAge, now);
      }

      return {
        parentUser: {
          id: Number(pRes.lastInsertRowid),
          username: parentUserNorm,
          displayName: params.parentDisplayName.trim() || 'Parent Admin',
          role: 'parent' as const,
        },
        childUser: {
          id: Number(cRes.lastInsertRowid),
          username: childUserNorm,
          displayName: params.childDisplayName.trim() || 'Explorer',
          role: 'child' as const,
        },
      };
    });

    return tx();
  }

  public authenticateUser(
    username: string,
    password: string,
    nowMs = Date.now()
  ): { rawToken: string; session: SessionRecord } | null {
    const userNorm = username.trim().toLowerCase();
    const row = this.raw
      .prepare(
        'SELECT id, username, display_name, role, password_hash, seen_first_run_explainer FROM users WHERE username = ?'
      )
      .get(userNorm) as
      | {
          id: number;
          username: string;
          display_name: string;
          role: UserRole;
          password_hash: string;
          seen_first_run_explainer?: number;
        }
      | undefined;

    if (!row) return null;
    if (!verifyPassword(password, row.password_hash)) return null;

    return this.createSessionForUser(
      {
        id: row.id,
        username: row.username,
        displayName: row.display_name,
        role: row.role,
        seenFirstRunExplainer: Boolean(row.seen_first_run_explainer),
      },
      nowMs
    );
  }

  public purgeExpiredSessions(nowMs = Date.now()): number {
    const res = this.raw
      .prepare('DELETE FROM sessions WHERE expires_at_ms <= ?')
      .run(nowMs);
    return res.changes;
  }

  public createSessionForUser(
    user: UserPublic,
    nowMs = Date.now()
  ): { rawToken: string; session: SessionRecord } {
    this.purgeExpiredSessions(nowMs);
    const rawToken = generateSessionToken();
    const tokenHash = hashSessionToken(rawToken);
    const csrfToken = generateCsrfToken();
    const ttl = user.role === 'parent' ? PARENT_SESSION_TTL_MS : CHILD_SESSION_TTL_MS;
    const expiresAtMs = nowMs + ttl;

    this.raw
      .prepare(
        `INSERT INTO sessions (token_hash, user_id, role, csrf_token, created_at_ms, expires_at_ms, last_seen_at_ms)
         VALUES (?, ?, ?, ?, ?, ?, ?)`
      )
      .run(tokenHash, user.id, user.role, csrfToken, nowMs, expiresAtMs, nowMs);

    return {
      rawToken,
      session: {
        tokenHash,
        user,
        csrfToken,
        createdAtMs: nowMs,
        expiresAtMs,
        lastSeenAtMs: nowMs,
      },
    };
  }

  public getValidSession(rawToken: string, nowMs = Date.now()): SessionRecord | null {
    const tokenHash = hashSessionToken(rawToken);
    const row = this.raw
      .prepare(
        `SELECT s.token_hash, s.csrf_token, s.created_at_ms, s.expires_at_ms, s.last_seen_at_ms,
                u.id as user_id, u.username, u.display_name, u.role, u.seen_first_run_explainer
         FROM sessions s
         JOIN users u ON u.id = s.user_id
         WHERE s.token_hash = ?`
      )
      .get(tokenHash) as
      | {
          token_hash: string;
          csrf_token: string;
          created_at_ms: number;
          expires_at_ms: number;
          last_seen_at_ms: number;
          user_id: number;
          username: string;
          display_name: string;
          role: UserRole;
          seen_first_run_explainer?: number;
        }
      | undefined;

    if (!row) return null;

    // Enforce strict expiry & parent 15-minute inactivity timeout
    if (nowMs >= row.expires_at_ms) {
      this.raw.prepare('DELETE FROM sessions WHERE token_hash = ?').run(tokenHash);
      return null;
    }

    if (row.role === 'parent' && nowMs - row.last_seen_at_ms > PARENT_SESSION_TTL_MS) {
      this.raw.prepare('DELETE FROM sessions WHERE token_hash = ?').run(tokenHash);
      return null;
    }

    // Slide parent expiry up to 15 min from now on active parent requests
    const nextExpires =
      row.role === 'parent' ? nowMs + PARENT_SESSION_TTL_MS : row.expires_at_ms;
    this.raw
      .prepare(
        'UPDATE sessions SET last_seen_at_ms = ?, expires_at_ms = ? WHERE token_hash = ?'
      )
      .run(nowMs, nextExpires, tokenHash);

    return {
      tokenHash: row.token_hash,
      csrfToken: row.csrf_token,
      createdAtMs: row.created_at_ms,
      expiresAtMs: nextExpires,
      lastSeenAtMs: nowMs,
      user: {
        id: row.user_id,
        username: row.username,
        displayName: row.display_name,
        role: row.role,
        seenFirstRunExplainer: Boolean(row.seen_first_run_explainer),
      },
    };
  }

  public ackFirstRunExplainer(userId: number): void {
    this.raw
      .prepare('UPDATE users SET seen_first_run_explainer = 1 WHERE id = ?')
      .run(userId);
  }

  public deleteSession(rawToken: string): void {
    const tokenHash = hashSessionToken(rawToken);
    this.raw.prepare('DELETE FROM sessions WHERE token_hash = ?').run(tokenHash);
  }

  public getPolicyConfig(): PolicyConfig {
    const row = this.raw
      .prepare('SELECT * FROM policy_config WHERE id = 1')
      .get() as Record<string, unknown>;

    return {
      timezone: String(row.timezone),
      instanceDisplayName: String(row.instance_display_name || ''),
      childAge:
        row.child_age !== undefined && row.child_age !== null
          ? Number(row.child_age)
          : 11,
      piiFilterEnabled:
        row.pii_filter_enabled !== undefined ? Boolean(row.pii_filter_enabled) : true,
      openaiUnder13Confirmed: Boolean(row.openai_under_13_confirmed),
      anthropicConditionsConfirmed: Boolean(row.anthropic_conditions_confirmed),
      globalDailyMinutes: Number(row.global_daily_minutes),
      maxContinuousSessionMinutes: Number(row.max_continuous_session_minutes),
      sessionCooldownMinutes: Number(row.session_cooldown_minutes),
      modes: {
        ask: {
          enabled: Boolean(row.ask_enabled),
          dailyMinutes: Number(row.ask_daily_minutes),
        },
        research: {
          enabled: Boolean(row.research_enabled),
          dailyMinutes: Number(row.research_daily_minutes),
        },
        schoolwork: {
          enabled: Boolean(row.schoolwork_enabled),
          dailyMinutes: Number(row.schoolwork_daily_minutes),
        },
        play: {
          enabled: Boolean(row.play_enabled),
          dailyMinutes: Number(row.play_daily_minutes),
        },
      },
      dailySpendCapCents: Number(row.daily_spend_cap_cents),
      monthlySpendCapCents: Number(row.monthly_spend_cap_cents),
      monthlyResetDay: Number(row.monthly_reset_day),
      activeProvider: String(row.active_provider) as ProviderId,
      allowExternalSearch: Boolean(row.allow_external_search),
      updatedAtMs: Number(row.updated_at_ms),
    };
  }

  public updatePolicyConfig(
    patch: Partial<{
      timezone: string;
      instanceDisplayName: string;
      childAge: number;
      piiFilterEnabled: boolean;
      openaiUnder13Confirmed: boolean;
      anthropicConditionsConfirmed: boolean;
      globalDailyMinutes: number;
      maxContinuousSessionMinutes: number;
      sessionCooldownMinutes: number;
      modes: Partial<{
        ask: Partial<{ enabled: boolean; dailyMinutes: number }>;
        research: Partial<{ enabled: boolean; dailyMinutes: number }>;
        schoolwork: Partial<{ enabled: boolean; dailyMinutes: number }>;
        play: Partial<{ enabled: boolean; dailyMinutes: number }>;
      }>;
      dailySpendCapCents: number;
      monthlySpendCapCents: number;
      monthlyResetDay: number;
      activeProvider: ProviderId;
      allowExternalSearch: boolean;
    }>,
    nowMs = Date.now()
  ): PolicyConfig {
    const current = this.getPolicyConfig();

    // Validate timezone using Intl.DateTimeFormat; fail safely on invalid timezone
    let timezone = current.timezone;
    if (patch.timezone !== undefined) {
      try {
        Intl.DateTimeFormat('en-US', { timeZone: patch.timezone });
        timezone = patch.timezone;
      } catch {
        throw new Error(`INVALID_TIMEZONE: ${patch.timezone}`);
      }
    }

    const clampMinutes = (val: number | undefined, fallback: number, min = 0, max = 1440) => {
      if (val === undefined || Number.isNaN(val)) return fallback;
      return Math.max(min, Math.min(max, Math.floor(val)));
    };

    const next: PolicyConfig = {
      timezone,
      instanceDisplayName:
        patch.instanceDisplayName !== undefined
          ? patch.instanceDisplayName.trim()
          : (current.instanceDisplayName || ''),
      childAge: clampMinutes(patch.childAge, current.childAge ?? 11, 6, 16),
      piiFilterEnabled:
        patch.piiFilterEnabled !== undefined
          ? Boolean(patch.piiFilterEnabled)
          : (current.piiFilterEnabled ?? true),
      openaiUnder13Confirmed:
        patch.openaiUnder13Confirmed !== undefined
          ? Boolean(patch.openaiUnder13Confirmed)
          : Boolean(current.openaiUnder13Confirmed),
      anthropicConditionsConfirmed:
        patch.anthropicConditionsConfirmed !== undefined
          ? Boolean(patch.anthropicConditionsConfirmed)
          : Boolean(current.anthropicConditionsConfirmed),
      globalDailyMinutes: clampMinutes(
        patch.globalDailyMinutes,
        current.globalDailyMinutes,
        0,
        1440
      ),
      maxContinuousSessionMinutes: clampMinutes(
        patch.maxContinuousSessionMinutes,
        current.maxContinuousSessionMinutes,
        1,
        720
      ),
      sessionCooldownMinutes: clampMinutes(
        patch.sessionCooldownMinutes,
        current.sessionCooldownMinutes,
        1,
        240
      ),
      modes: {
        ask: {
          enabled: patch.modes?.ask?.enabled ?? current.modes.ask.enabled,
          dailyMinutes: clampMinutes(
            patch.modes?.ask?.dailyMinutes,
            current.modes.ask.dailyMinutes
          ),
        },
        research: {
          enabled: patch.modes?.research?.enabled ?? current.modes.research.enabled,
          dailyMinutes: clampMinutes(
            patch.modes?.research?.dailyMinutes,
            current.modes.research.dailyMinutes
          ),
        },
        schoolwork: {
          enabled: patch.modes?.schoolwork?.enabled ?? current.modes.schoolwork.enabled,
          dailyMinutes: clampMinutes(
            patch.modes?.schoolwork?.dailyMinutes,
            current.modes.schoolwork.dailyMinutes
          ),
        },
        play: {
          enabled: patch.modes?.play?.enabled ?? current.modes.play.enabled,
          dailyMinutes: clampMinutes(
            patch.modes?.play?.dailyMinutes,
            current.modes.play.dailyMinutes
          ),
        },
      },
      dailySpendCapCents:
        patch.dailySpendCapCents !== undefined
          ? Math.max(0, Math.floor(patch.dailySpendCapCents))
          : current.dailySpendCapCents,
      monthlySpendCapCents:
        patch.monthlySpendCapCents !== undefined
          ? Math.max(0, Math.floor(patch.monthlySpendCapCents))
          : current.monthlySpendCapCents,
      monthlyResetDay: clampMinutes(patch.monthlyResetDay, current.monthlyResetDay, 1, 28),
      activeProvider: patch.activeProvider ?? current.activeProvider,
      allowExternalSearch: patch.allowExternalSearch ?? current.allowExternalSearch,
      updatedAtMs: nowMs,
    };

    this.raw
      .prepare(
        `UPDATE policy_config SET
          timezone = ?,
          global_daily_minutes = ?,
          max_continuous_session_minutes = ?,
          session_cooldown_minutes = ?,
          ask_enabled = ?,
          research_enabled = ?,
          schoolwork_enabled = ?,
          play_enabled = ?,
          ask_daily_minutes = ?,
          research_daily_minutes = ?,
          schoolwork_daily_minutes = ?,
          play_daily_minutes = ?,
          daily_spend_cap_cents = ?,
          monthly_spend_cap_cents = ?,
          monthly_reset_day = ?,
          active_provider = ?,
          allow_external_search = ?,
          instance_display_name = ?,
          child_age = ?,
          pii_filter_enabled = ?,
          openai_under_13_confirmed = ?,
          anthropic_conditions_confirmed = ?,
          updated_at_ms = ?
         WHERE id = 1`
      )
      .run(
        next.timezone,
        next.globalDailyMinutes,
        next.maxContinuousSessionMinutes,
        next.sessionCooldownMinutes,
        next.modes.ask.enabled ? 1 : 0,
        next.modes.research.enabled ? 1 : 0,
        next.modes.schoolwork.enabled ? 1 : 0,
        next.modes.play.enabled ? 1 : 0,
        next.modes.ask.dailyMinutes,
        next.modes.research.dailyMinutes,
        next.modes.schoolwork.dailyMinutes,
        next.modes.play.dailyMinutes,
        next.dailySpendCapCents,
        next.monthlySpendCapCents,
        next.monthlyResetDay,
        next.activeProvider,
        next.allowExternalSearch ? 1 : 0,
        next.instanceDisplayName || '',
        next.childAge ?? 11,
        next.piiFilterEnabled ? 1 : 0,
        next.openaiUnder13Confirmed ? 1 : 0,
        next.anthropicConditionsConfirmed ? 1 : 0,
        next.updatedAtMs
      );

    return next;
  }

  public getOrCreateDailyUsage(dateKey: string): DailyUsageRow {
    this.raw
      .prepare('INSERT OR IGNORE INTO daily_usage (date_key) VALUES (?)')
      .run(dateKey);
    return this.raw
      .prepare('SELECT * FROM daily_usage WHERE date_key = ?')
      .get(dateKey) as DailyUsageRow;
  }

  public getOrCreateMonthlyUsage(monthKey: string): MonthlyUsageRow {
    this.raw
      .prepare('INSERT OR IGNORE INTO monthly_usage (month_key) VALUES (?)')
      .run(monthKey);
    return this.raw
      .prepare('SELECT * FROM monthly_usage WHERE month_key = ?')
      .get(monthKey) as MonthlyUsageRow;
  }

  public incrementCompletedSessions(dateKey: string): void {
    this.getOrCreateDailyUsage(dateKey);
    this.raw
      .prepare(
        'UPDATE daily_usage SET completed_sessions_count = completed_sessions_count + 1 WHERE date_key = ?'
      )
      .run(dateKey);
  }

  public saveArtifact(params: {
    title: string;
    mode: ActivityMode;
    activityType: string;
    content: string;
    nowMs?: number;
  }): SavedArtifact {
    const now = params.nowMs ?? Date.now();
    const res = this.raw
      .prepare(
        `INSERT INTO saved_artifacts (title, mode, activity_type, content, created_at_ms)
         VALUES (?, ?, ?, ?, ?)`
      )
      .run(
        params.title.trim() || 'Untitled Note',
        params.mode,
        params.activityType,
        params.content,
        now
      );
    return {
      id: Number(res.lastInsertRowid),
      title: params.title.trim() || 'Untitled Note',
      mode: params.mode,
      activityType: params.activityType,
      content: params.content,
      createdAtMs: now,
    };
  }

  public listArtifacts(): SavedArtifact[] {
    const rows = this.raw
      .prepare('SELECT * FROM saved_artifacts ORDER BY created_at_ms DESC, id DESC')
      .all() as Array<{
      id: number;
      title: string;
      mode: ActivityMode;
      activity_type: string;
      content: string;
      created_at_ms: number;
    }>;
    return rows.map((r) => ({
      id: r.id,
      title: r.title,
      mode: r.mode,
      activityType: r.activity_type,
      content: r.content,
      createdAtMs: r.created_at_ms,
    }));
  }

  public deleteArtifact(id: number): boolean {
    const res = this.raw.prepare('DELETE FROM saved_artifacts WHERE id = ?').run(id);
    return res.changes > 0;
  }

  public createTimeExtensionRequest(params: {
    dateKey: string;
    requestedMode: ActivityMode | 'global';
    requestedMinutes: number;
    reasonNote: string;
    nowMs?: number;
  }): TimeExtensionRequest {
    const now = params.nowMs ?? Date.now();
    const mins = Math.max(5, Math.min(120, Math.floor(params.requestedMinutes)));
    const note = params.reasonNote.trim().slice(0, 200);
    const res = this.raw
      .prepare(
        `INSERT INTO time_extension_requests
          (date_key, requested_mode, requested_minutes, reason_note, status, granted_minutes, created_at_ms, resolved_at_ms)
         VALUES (?, ?, ?, ?, 'pending', 0, ?, NULL)`
      )
      .run(params.dateKey, params.requestedMode, mins, note, now);

    return {
      id: Number(res.lastInsertRowid),
      dateKey: params.dateKey,
      requestedMode: params.requestedMode,
      requestedMinutes: mins,
      reasonNote: note,
      status: 'pending',
      grantedMinutes: 0,
      createdAtMs: now,
      resolvedAtMs: null,
    };
  }

  public resolveTimeExtensionRequest(params: {
    requestId: number;
    approve: boolean;
    grantedMinutes?: number;
    nowMs?: number;
  }): TimeExtensionRequest {
    const now = params.nowMs ?? Date.now();
    const tx = this.raw.transaction(() => {
      const row = this.raw
        .prepare('SELECT * FROM time_extension_requests WHERE id = ?')
        .get(params.requestId) as
        | {
            id: number;
            date_key: string;
            requested_mode: ActivityMode | 'global';
            requested_minutes: number;
            reason_note: string;
            status: 'pending' | 'approved' | 'denied';
            granted_minutes: number;
            created_at_ms: number;
            resolved_at_ms: number | null;
          }
        | undefined;

      if (!row) {
        throw new Error('EXTENSION_REQUEST_NOT_FOUND');
      }
      if (row.status !== 'pending') {
        throw new Error('EXTENSION_ALREADY_RESOLVED');
      }

      const granted = params.approve
        ? Math.max(1, Math.min(180, Math.floor(params.grantedMinutes ?? row.requested_minutes)))
        : 0;
      const nextStatus = params.approve ? 'approved' : 'denied';

      this.raw
        .prepare(
          `UPDATE time_extension_requests
           SET status = ?, granted_minutes = ?, resolved_at_ms = ?
           WHERE id = ?`
        )
        .run(nextStatus, granted, now, row.id);

      if (params.approve && granted > 0) {
        this.getOrCreateDailyUsage(row.date_key);
        const addSeconds = granted * 60;
        if (row.requested_mode === 'global') {
          this.raw
            .prepare(
              'UPDATE daily_usage SET bonus_global_seconds = bonus_global_seconds + ? WHERE date_key = ?'
            )
            .run(addSeconds, row.date_key);
        } else {
          const col = `bonus_${row.requested_mode}_seconds`;
          // Granting extra mode time also adds to global bonus so the child can actually use the approved mode extension
          this.raw
            .prepare(
              `UPDATE daily_usage
               SET ${col} = ${col} + ?,
                   bonus_global_seconds = bonus_global_seconds + ?
               WHERE date_key = ?`
            )
            .run(addSeconds, addSeconds, row.date_key);
        }
      }

      return {
        id: row.id,
        dateKey: row.date_key,
        requestedMode: row.requested_mode,
        requestedMinutes: row.requested_minutes,
        reasonNote: row.reason_note,
        status: nextStatus as 'approved' | 'denied',
        grantedMinutes: granted,
        createdAtMs: row.created_at_ms,
        resolvedAtMs: now,
      };
    });

    return tx();
  }

  public listTimeExtensionRequests(dateKey?: string): TimeExtensionRequest[] {
    const rows = (
      dateKey
        ? this.raw
            .prepare(
              'SELECT * FROM time_extension_requests WHERE date_key = ? ORDER BY created_at_ms DESC, id DESC'
            )
            .all(dateKey)
        : this.raw
            .prepare('SELECT * FROM time_extension_requests ORDER BY created_at_ms DESC, id DESC LIMIT 30')
            .all()
    ) as Array<{
      id: number;
      date_key: string;
      requested_mode: ActivityMode | 'global';
      requested_minutes: number;
      reason_note: string;
      status: 'pending' | 'approved' | 'denied';
      granted_minutes: number;
      created_at_ms: number;
      resolved_at_ms: number | null;
    }>;

    return rows.map((r) => ({
      id: r.id,
      dateKey: r.date_key,
      requestedMode: r.requested_mode,
      requestedMinutes: r.requested_minutes,
      reasonNote: r.reason_note,
      status: r.status,
      grantedMinutes: r.granted_minutes,
      createdAtMs: r.created_at_ms,
      resolvedAtMs: r.resolved_at_ms,
    }));
  }

  public recordSafetyEvent(params: {
    category: string;
    severity: 'low' | 'medium' | 'high';
    mode: ActivityMode;
    nowMs?: number;
  }): SafetyEventSummary {
    const now = params.nowMs ?? Date.now();
    const res = this.raw
      .prepare(
        `INSERT INTO safety_events (category, severity, mode, created_at_ms, acknowledged)
         VALUES (?, ?, ?, ?, 0)`
      )
      .run(params.category, params.severity, params.mode, now);

    return {
      id: Number(res.lastInsertRowid),
      category: params.category,
      severity: params.severity,
      mode: params.mode,
      createdAtMs: now,
      acknowledged: false,
    };
  }

  public saveApprovedLedgerEntry(params: {
    sourceSessionId?: string;
    subject: string;
    summary: string;
    concepts: string[];
    uncertainties: string[];
    nowMs?: number;
  }): { id: number; subject: string; summary: string; concepts: string[]; uncertainties: string[]; approvedAtMs: number } {
    const now = params.nowMs ?? Date.now();
    const res = this.raw
      .prepare(
        `INSERT OR IGNORE INTO learning_ledger (subject, summary, concepts_json, uncertainties_json, approved_by_child_at_ms, updated_at_ms, source_session_id)
         VALUES (?, ?, ?, ?, ?, ?, ?)`
      )
      .run(
        params.subject.trim() || 'General Learning',
        params.summary.trim(),
        JSON.stringify(params.concepts),
        JSON.stringify(params.uncertainties),
        now,
        now,
        params.sourceSessionId ?? null
      );

    if (!res.changes && params.sourceSessionId) {
      const existing = this.raw.prepare('SELECT * FROM learning_ledger WHERE source_session_id=?').get(params.sourceSessionId) as any;
      return {id:existing.id,subject:existing.subject,summary:existing.summary,concepts:JSON.parse(existing.concepts_json),uncertainties:JSON.parse(existing.uncertainties_json),approvedAtMs:existing.approved_by_child_at_ms};
    }
    return {
      id: Number(res.lastInsertRowid),
      subject: params.subject.trim() || 'General Learning',
      summary: params.summary.trim(),
      concepts: params.concepts,
      uncertainties: params.uncertainties,
      approvedAtMs: now,
    };
  }

  public listLearningLedger(): Array<{
    id: number;
    subject: string;
    summary: string;
    concepts: string[];
    uncertainties: string[];
    approvedAtMs: number;
  }> {
    const rows = this.raw
      .prepare('SELECT * FROM learning_ledger ORDER BY approved_by_child_at_ms DESC, id DESC')
      .all() as any[];

    return rows.map((r) => ({
      id: r.id,
      subject: r.subject,
      summary: r.summary,
      concepts: JSON.parse(r.concepts_json || '[]'),
      uncertainties: JSON.parse(r.uncertainties_json || '[]'),
      approvedAtMs: r.approved_by_child_at_ms,
    }));
  }

  public updateLearningLedgerEntry(params: {
    id: number;
    subject: string;
    summary: string;
    concepts: string[];
    uncertainties: string[];
    nowMs?: number;
  }): boolean {
    const now = params.nowMs ?? Date.now();
    const res = this.raw
      .prepare(
        `UPDATE learning_ledger
         SET subject = ?, summary = ?, concepts_json = ?, uncertainties_json = ?, updated_at_ms = ?
         WHERE id = ?`
      )
      .run(
        params.subject.trim() || 'General Learning',
        params.summary.trim(),
        JSON.stringify(params.concepts),
        JSON.stringify(params.uncertainties),
        now,
        params.id
      );
    return res.changes > 0;
  }

  public deleteLearningLedgerEntry(id: number): boolean {
    const res = this.raw.prepare('DELETE FROM learning_ledger WHERE id = ?').run(id);
    return res.changes > 0;
  }

  public getProviderSettingsInternal(): {
    geminiApiKey: string;
    geminiFastModel: string;
    geminiReasoningModel: string;
    geminiZdrApproved: boolean;
    ollamaBaseUrl: string;
    ollamaModel: string;
    openaiApiKey: string;
    openaiModel: string;
    openaiZdrApproved: boolean;
    anthropicApiKey: string;
    anthropicModel: string;
    anthropicZdrApproved: boolean;
    searchApiUrl: string;
    searchApiKey: string;
    updatedAtMs: number;
  } {
    const row = this.raw
      .prepare('SELECT * FROM provider_settings WHERE id = 1')
      .get() as Record<string, unknown>;

    return {
      geminiApiKey: decryptApiKey(String(row.gemini_api_key || '')),
      geminiFastModel: String(row.gemini_fast_model || 'gemini-3.8-flash'),
      geminiReasoningModel: String(row.gemini_reasoning_model || 'gemini-3.8-flash'),
      geminiZdrApproved: Boolean(row.gemini_zdr_approved),
      ollamaBaseUrl: String(row.ollama_base_url || 'http://127.0.0.1:11434'),
      ollamaModel: String(row.ollama_model || 'llama3.2'),
      openaiApiKey: decryptApiKey(String(row.openai_api_key || '')),
      openaiModel: String(row.openai_model || 'gpt-4o-mini'),
      openaiZdrApproved: Boolean(row.openai_zdr_approved),
      anthropicApiKey: decryptApiKey(String(row.anthropic_api_key || '')),
      anthropicModel: String(row.anthropic_model || 'claude-haiku-5-5'),
      anthropicZdrApproved: Boolean(row.anthropic_zdr_approved),
      searchApiUrl: String(row.search_api_url || ''),
      searchApiKey: decryptApiKey(String(row.search_api_key || '')),
      updatedAtMs: Number(row.updated_at_ms || Date.now()),
    };
  }

  public getProviderSettingsPublic(): ProviderSettingsPublic {
    const internal = this.getProviderSettingsInternal();
    const policy = this.getPolicyConfig();
    const maskKey = (k: string): string | null => {
      const trimmed = k.trim();
      if (trimmed.length >= 8) return `${trimmed.slice(0, 3)}…${trimmed.slice(-4)}`;
      if (trimmed.length > 0) return '•••';
      return null;
    };

    const geminiKey = internal.geminiApiKey.trim();
    const openaiKey = internal.openaiApiKey.trim();
    const anthropicKey = internal.anthropicApiKey.trim();

    return {
      geminiFastModel: internal.geminiFastModel,
      geminiReasoningModel: internal.geminiReasoningModel,
      hasGeminiApiKey: geminiKey.length > 0,
      geminiApiKeyHint: maskKey(geminiKey),
      geminiZdrApproved: internal.geminiZdrApproved,
      ollamaBaseUrl: internal.ollamaBaseUrl,
      ollamaModel: internal.ollamaModel,
      openaiModel: internal.openaiModel,
      hasOpenaiApiKey: openaiKey.length > 0,
      openaiApiKeyHint: maskKey(openaiKey),
      openaiZdrApproved: internal.openaiZdrApproved,
      openaiUnder13Confirmed: Boolean(policy.openaiUnder13Confirmed),
      anthropicModel: internal.anthropicModel,
      hasAnthropicApiKey: anthropicKey.length > 0,
      anthropicApiKeyHint: maskKey(anthropicKey),
      anthropicZdrApproved: internal.anthropicZdrApproved,
      anthropicConditionsConfirmed: Boolean(policy.anthropicConditionsConfirmed),
      piiFilterEnabled: Boolean(policy.piiFilterEnabled ?? true),
      searchApiUrl: internal.searchApiUrl,
      hasSearchApiKey: internal.searchApiKey.trim().length > 0,
      updatedAtMs: internal.updatedAtMs,
    };
  }

  public updateProviderSettings(
    patch: Partial<{
      geminiApiKey: string;
      clearGeminiApiKey: boolean;
      geminiFastModel: string;
      geminiReasoningModel: string;
      geminiZdrApproved: boolean;
      ollamaBaseUrl: string;
      ollamaModel: string;
      openaiApiKey: string;
      clearOpenaiApiKey: boolean;
      openaiModel: string;
      openaiZdrApproved: boolean;
      anthropicApiKey: string;
      clearAnthropicApiKey: boolean;
      anthropicModel: string;
      anthropicZdrApproved: boolean;
      searchApiUrl: string;
      searchApiKey: string;
      clearSearchApiKey: boolean;
    }>,
    nowMs = Date.now()
  ): ProviderSettingsPublic {
    const current = this.getProviderSettingsInternal();
    const nextGeminiApiKey = patch.clearGeminiApiKey
      ? ''
      : patch.geminiApiKey !== undefined && patch.geminiApiKey.trim() !== ''
        ? patch.geminiApiKey.trim()
        : current.geminiApiKey;
    const nextGeminiFastModel =
      patch.geminiFastModel !== undefined
        ? patch.geminiFastModel.trim() || 'gemini-3.8-flash'
        : current.geminiFastModel;
    const nextGeminiReasoningModel =
      patch.geminiReasoningModel !== undefined
        ? patch.geminiReasoningModel.trim() || 'gemini-3.8-flash'
        : current.geminiReasoningModel;
    const nextGeminiZdr =
      patch.geminiZdrApproved !== undefined
        ? patch.geminiZdrApproved
        : current.geminiZdrApproved;
    const nextOllamaBaseUrl =
      patch.ollamaBaseUrl !== undefined
        ? patch.ollamaBaseUrl.trim() || 'http://127.0.0.1:11434'
        : current.ollamaBaseUrl;
    const nextOllamaModel =
      patch.ollamaModel !== undefined
        ? patch.ollamaModel.trim() || 'llama3.2'
        : current.ollamaModel;
    const nextOpenaiModel =
      patch.openaiModel !== undefined
        ? patch.openaiModel.trim() || 'gpt-4o-mini'
        : current.openaiModel;
    const nextOpenaiApiKey = patch.clearOpenaiApiKey
      ? ''
      : patch.openaiApiKey !== undefined && patch.openaiApiKey.trim() !== ''
        ? patch.openaiApiKey.trim()
        : current.openaiApiKey;
    const nextOpenaiZdr =
      patch.openaiZdrApproved !== undefined
        ? patch.openaiZdrApproved
        : current.openaiZdrApproved;
    const nextAnthropicModel =
      patch.anthropicModel !== undefined
        ? patch.anthropicModel.trim() || 'claude-haiku-5-5'
        : current.anthropicModel;
    const nextAnthropicApiKey = patch.clearAnthropicApiKey
      ? ''
      : patch.anthropicApiKey !== undefined && patch.anthropicApiKey.trim() !== ''
        ? patch.anthropicApiKey.trim()
        : current.anthropicApiKey;
    const nextAnthropicZdr =
      patch.anthropicZdrApproved !== undefined
        ? patch.anthropicZdrApproved
        : current.anthropicZdrApproved;
    const nextSearchApiUrl =
      patch.searchApiUrl !== undefined ? patch.searchApiUrl.trim() : current.searchApiUrl;
    const nextSearchApiKey = patch.clearSearchApiKey
      ? ''
      : patch.searchApiKey !== undefined && patch.searchApiKey.trim() !== ''
        ? patch.searchApiKey.trim()
        : current.searchApiKey;

    this.raw
      .prepare(
        `UPDATE provider_settings SET
          gemini_api_key = ?,
          gemini_fast_model = ?,
          gemini_reasoning_model = ?,
          gemini_zdr_approved = ?,
          ollama_base_url = ?,
          ollama_model = ?,
          openai_api_key = ?,
          openai_model = ?,
          openai_zdr_approved = ?,
          anthropic_api_key = ?,
          anthropic_model = ?,
          anthropic_zdr_approved = ?,
          search_api_url = ?,
          search_api_key = ?,
          updated_at_ms = ?
         WHERE id = 1`
      )
      .run(
        encryptApiKey(nextGeminiApiKey),
        nextGeminiFastModel,
        nextGeminiReasoningModel,
        nextGeminiZdr ? 1 : 0,
        nextOllamaBaseUrl,
        nextOllamaModel,
        encryptApiKey(nextOpenaiApiKey),
        nextOpenaiModel,
        nextOpenaiZdr ? 1 : 0,
        encryptApiKey(nextAnthropicApiKey),
        nextAnthropicModel,
        nextAnthropicZdr ? 1 : 0,
        nextSearchApiUrl,
        encryptApiKey(nextSearchApiKey),
        nowMs
      );

    return this.getProviderSettingsPublic();
  }

  public listSafetyEvents(): SafetyEventSummary[] {
    const rows = this.raw
      .prepare('SELECT * FROM safety_events ORDER BY created_at_ms DESC, id DESC LIMIT 25')
      .all() as Array<{
      id: number;
      category: string;
      severity: 'low' | 'medium' | 'high';
      mode: ActivityMode;
      created_at_ms: number;
      acknowledged: number;
    }>;

    return rows.map((r) => ({
      id: r.id,
      category: r.category,
      severity: r.severity,
      mode: r.mode,
      createdAtMs: r.created_at_ms,
      acknowledged: Boolean(r.acknowledged),
    }));
  }
}

export { MarmaladeDatabase as SproutDatabase };
