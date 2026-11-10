/**
 * Sign-in Rate Limiting with Progressive Throttling (Item 7)
 * Throttles brute-force attempts per client IP and per (IP + username) pair.
 * Prevents account lockout attacks where an external attacker locks out the parent,
 * and maintains bounded memory with automatic LRU and TTL sweeps.
 */

interface AttemptRecord {
  count: number;
  firstAttemptMs: number;
  lastAttemptMs: number;
  blockedUntilMs: number;
}

const WINDOW_MS = 5 * 60 * 1000; // 5 minute tracking window
const MAX_ATTEMPTS_BEFORE_WARN = 5;
const MAX_ATTEMPTS_BEFORE_HARD_BLOCK = 10;
const SHORT_BLOCK_DURATION_MS = 30 * 1000; // 30s block after 5 failed attempts
const HARD_BLOCK_DURATION_MS = 15 * 60 * 1000; // 15m block after 10 failed attempts
const MAX_MAP_ENTRIES = 5000;

export class LoginRateLimiter {
  private readonly ipAttempts = new Map<string, AttemptRecord>();
  private readonly userAttempts = new Map<string, AttemptRecord>();
  private lastSweepMs = 0;

  public checkRateLimit(
    ip: string,
    username: string,
    nowMs = Date.now()
  ): { allowed: boolean; retryAfterSeconds: number } {
    this.maybeSweep(nowMs);
    const cleanIp = (ip || '127.0.0.1').trim();
    const uKey = `${cleanIp}:${username.toLowerCase().trim()}`;

    const ipRec = this.getOrCleanRecord(this.ipAttempts, cleanIp, nowMs);
    const userRec = this.getOrCleanRecord(this.userAttempts, uKey, nowMs);

    const now = nowMs;
    if (ipRec && ipRec.blockedUntilMs > now) {
      const waitSec = Math.ceil((ipRec.blockedUntilMs - now) / 1000);
      return { allowed: false, retryAfterSeconds: waitSec };
    }

    if (userRec && userRec.blockedUntilMs > now) {
      const waitSec = Math.ceil((userRec.blockedUntilMs - now) / 1000);
      return { allowed: false, retryAfterSeconds: waitSec };
    }

    return { allowed: true, retryAfterSeconds: 0 };
  }

  public recordFailedAttempt(
    ip: string,
    username: string,
    nowMs = Date.now()
  ): { retryAfterSeconds: number } {
    this.maybeSweep(nowMs);
    const cleanIp = (ip || '127.0.0.1').trim();
    const uKey = `${cleanIp}:${username.toLowerCase().trim()}`;

    const ipRec = this.recordKey(this.ipAttempts, cleanIp, nowMs);
    const userRec = this.recordKey(this.userAttempts, uKey, nowMs);

    this.evictOldestIfOverCapacity(this.ipAttempts);
    this.evictOldestIfOverCapacity(this.userAttempts);

    const maxBlocked = Math.max(ipRec.blockedUntilMs, userRec.blockedUntilMs);
    if (maxBlocked > nowMs) {
      return { retryAfterSeconds: Math.ceil((maxBlocked - nowMs) / 1000) };
    }
    return { retryAfterSeconds: 0 };
  }

  public resetAttempts(ip: string, username: string): void {
    const cleanIp = (ip || '127.0.0.1').trim();
    this.ipAttempts.delete(cleanIp);
    this.userAttempts.delete(`${cleanIp}:${username.toLowerCase().trim()}`);
  }

  public sweep(nowMs = Date.now()): void {
    this.pruneExpired(this.ipAttempts, nowMs);
    this.pruneExpired(this.userAttempts, nowMs);
  }

  public getEntryCounts(): { ipCount: number; userCount: number } {
    return {
      ipCount: this.ipAttempts.size,
      userCount: this.userAttempts.size,
    };
  }

  private maybeSweep(nowMs: number): void {
    if (
      this.ipAttempts.size > MAX_MAP_ENTRIES ||
      this.userAttempts.size > MAX_MAP_ENTRIES ||
      nowMs - this.lastSweepMs > WINDOW_MS
    ) {
      this.sweep(nowMs);
      this.lastSweepMs = nowMs;

      // If still over capacity after sweeping expired, evict oldest
      this.evictOldestIfOverCapacity(this.ipAttempts);
      this.evictOldestIfOverCapacity(this.userAttempts);
    }
  }

  private pruneExpired(map: Map<string, AttemptRecord>, nowMs: number): void {
    for (const [key, rec] of map.entries()) {
      if (nowMs - rec.firstAttemptMs > WINDOW_MS && rec.blockedUntilMs <= nowMs) {
        map.delete(key);
      }
    }
  }

  private evictOldestIfOverCapacity(map: Map<string, AttemptRecord>): void {
    if (map.size <= MAX_MAP_ENTRIES) return;
    const sorted = [...map.entries()].sort(
      (a, b) => a[1].firstAttemptMs - b[1].firstAttemptMs
    );
    const toRemove = sorted.slice(0, map.size - MAX_MAP_ENTRIES);
    for (const [key] of toRemove) {
      map.delete(key);
    }
  }

  private getOrCleanRecord(
    map: Map<string, AttemptRecord>,
    key: string,
    nowMs: number
  ): AttemptRecord | undefined {
    if (!key) return undefined;
    const rec = map.get(key);
    if (!rec) return undefined;

    // If window expired and not currently blocked, prune
    if (nowMs - rec.firstAttemptMs > WINDOW_MS && rec.blockedUntilMs <= nowMs) {
      map.delete(key);
      return undefined;
    }
    return rec;
  }

  private recordKey(
    map: Map<string, AttemptRecord>,
    key: string,
    nowMs: number
  ): AttemptRecord {
    let rec = this.getOrCleanRecord(map, key, nowMs);
    if (!rec) {
      rec = {
        count: 1,
        firstAttemptMs: nowMs,
        lastAttemptMs: nowMs,
        blockedUntilMs: 0,
      };
      map.set(key, rec);
      return rec;
    }

    rec.count += 1;
    rec.lastAttemptMs = nowMs;

    if (rec.count >= MAX_ATTEMPTS_BEFORE_HARD_BLOCK) {
      rec.blockedUntilMs = nowMs + HARD_BLOCK_DURATION_MS;
    } else if (rec.count >= MAX_ATTEMPTS_BEFORE_WARN) {
      rec.blockedUntilMs = nowMs + SHORT_BLOCK_DURATION_MS;
    }

    return rec;
  }
}
