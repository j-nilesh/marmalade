import type {
  ActivityMode,
  ModeQuotaStatus,
  PolicyBlockReason,
  PolicyConfig,
  QuotaStatusSummary,
} from '../../shared/types.js';
import { isProviderAllowedForMinors } from '../../shared/providerPolicy.js';
import type { MarmaladeDatabase, SproutDatabase } from '../db/sqlite.js';
import type { ProviderRegistry } from '../providers/registry.js';

export const INTERACTION_LEASE_DURATION_MS = 90 * 1000; // 90s bounded lease after user interaction
export const TURN_ACTIVE_SLICE_SECONDS = 15; // 15s active interaction slice per turn/heartbeat tick

export function getDateKeyInTimezone(nowMs: number, timezone: string): string {
  let effectiveTz = timezone;
  try {
    new Intl.DateTimeFormat('en-CA', { timeZone: effectiveTz });
  } catch {
    effectiveTz = 'UTC';
  }
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: effectiveTz,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  const parts = formatter.formatToParts(new Date(nowMs));
  const year = parts.find((p) => p.type === 'year')?.value ?? '1970';
  const month = parts.find((p) => p.type === 'month')?.value ?? '01';
  const day = parts.find((p) => p.type === 'day')?.value ?? '01';
  return `${year}-${month}-${day}`;
}

export function getMonthKeyInTimezone(
  nowMs: number,
  timezone: string,
  resetDay = 1
): string {
  const dateKey = getDateKeyInTimezone(nowMs, timezone);
  const [yearStr, monthStr, dayStr] = dateKey.split('-');
  let year = Number(yearStr);
  let month = Number(monthStr);
  const day = Number(dayStr);

  if (resetDay > 1 && day < resetDay) {
    month -= 1;
    if (month < 1) {
      month = 12;
      year -= 1;
    }
  }
  return `${String(year).padStart(4, '0')}-${String(month).padStart(2, '0')}`;
}

export class PolicyEngine {
  constructor(
    private readonly db: MarmaladeDatabase,
    private readonly providerRegistry?: ProviderRegistry
  ) {}

  public getQuotaStatus(nowMs = Date.now(), targetMode?: ActivityMode): QuotaStatusSummary {
    const policy = this.db.getPolicyConfig();
    const dateKey = getDateKeyInTimezone(nowMs, policy.timezone);
    const monthKey = getMonthKeyInTimezone(
      nowMs,
      policy.timezone,
      policy.monthlyResetDay
    );

    const daily = this.db.getOrCreateDailyUsage(dateKey);
    const monthly = this.db.getOrCreateMonthlyUsage(monthKey);

    // If cooldown has elapsed since last interaction, reset continuous session counter
    const cooldownMs = policy.sessionCooldownMinutes * 60 * 1000;
    let continuousUsedSeconds = daily.continuous_active_seconds;
    if (
      daily.last_interaction_at_ms > 0 &&
      nowMs - daily.last_interaction_at_ms >= cooldownMs &&
      continuousUsedSeconds > 0
    ) {
      this.db.raw
        .prepare(
          'UPDATE daily_usage SET continuous_active_seconds = 0, continuous_started_at_ms = 0 WHERE date_key = ?'
        )
        .run(dateKey);
      continuousUsedSeconds = 0;
    }

    const globalDailyLimitSeconds = policy.globalDailyMinutes * 60;
    const globalBonusSeconds = daily.bonus_global_seconds;
    const globalUsedSeconds = daily.global_active_seconds;
    const globalRemainingSeconds = Math.max(
      0,
      globalDailyLimitSeconds + globalBonusSeconds - globalUsedSeconds
    );

    const continuousLimitSeconds = policy.maxContinuousSessionMinutes * 60;
    const continuousRemainingSeconds = Math.max(
      0,
      continuousLimitSeconds - continuousUsedSeconds
    );

    const buildModeStatus = (mode: ActivityMode): ModeQuotaStatus => {
      const modeCfg = policy.modes[mode];
      const dailyLimitSeconds = modeCfg.dailyMinutes * 60;
      const bonusSeconds = Number(daily[`bonus_${mode}_seconds` as keyof typeof daily] ?? 0);
      const usedSeconds = Number(daily[`${mode}_active_seconds` as keyof typeof daily] ?? 0);
      const remainingSeconds = Math.max(0, dailyLimitSeconds + bonusSeconds - usedSeconds);
      const effectiveRemainingSeconds = modeCfg.enabled
        ? Math.min(globalRemainingSeconds, remainingSeconds, continuousRemainingSeconds)
        : 0;

      return {
        mode,
        enabled: modeCfg.enabled,
        dailyLimitSeconds,
        bonusSeconds,
        usedSeconds,
        remainingSeconds,
        effectiveRemainingSeconds,
        isExhausted: !modeCfg.enabled || effectiveRemainingSeconds <= 0,
      };
    };

    const modes: Record<ActivityMode, ModeQuotaStatus> = {
      ask: buildModeStatus('ask'),
      research: buildModeStatus('research'),
      schoolwork: buildModeStatus('schoolwork'),
      play: buildModeStatus('play'),
    };

    const providerMeta = this.providerRegistry
      ? this.providerRegistry.getModelProvider(policy.activeProvider)
      : { safetyVerified: policy.activeProvider === 'mock' || policy.activeProvider === 'local_ollama' };
    let blockingReason: PolicyBlockReason | null = null;

    if (!isProviderAllowedForMinors(policy.activeProvider)) {
      blockingReason = 'PROVIDER_NOT_ALLOWED_FOR_MINORS';
    } else if (!providerMeta || !providerMeta.safetyVerified) {
      blockingReason = 'PROVIDER_NOT_SAFETY_VERIFIED';
    } else if (globalRemainingSeconds <= 0) {
      blockingReason = 'GLOBAL_TIME_LIMIT_REACHED';
    } else if (continuousRemainingSeconds <= 0) {
      blockingReason = 'CONTINUOUS_SESSION_LIMIT_REACHED';
    } else if (
      daily.spent_cost_cents + daily.reserved_cost_cents >=
      policy.dailySpendCapCents
    ) {
      blockingReason = 'DAILY_SPEND_CAP_REACHED';
    } else if (
      monthly.spent_cost_cents + monthly.reserved_cost_cents >=
      policy.monthlySpendCapCents
    ) {
      blockingReason = 'MONTHLY_SPEND_CAP_REACHED';
    } else if (targetMode) {
      if (!modes[targetMode].enabled) {
        blockingReason = 'MODE_DISABLED';
      } else if (modes[targetMode].remainingSeconds <= 0) {
        blockingReason = 'MODE_TIME_LIMIT_REACHED';
      }
    }

    return {
      dateKey,
      monthKey,
      timezone: policy.timezone,
      globalDailyLimitSeconds,
      globalBonusSeconds,
      globalUsedSeconds,
      globalRemainingSeconds,
      continuousLimitSeconds,
      continuousUsedSeconds,
      continuousRemainingSeconds,
      cooldownMinutes: policy.sessionCooldownMinutes,
      cooldownEndsAtMs: continuousRemainingSeconds <= 0 ? daily.last_interaction_at_ms + cooldownMs : null,
      dailySpendCapCents: policy.dailySpendCapCents,
      dailySpentCents: daily.spent_cost_cents,
      dailyReservedCents: daily.reserved_cost_cents,
      monthlySpendCapCents: policy.monthlySpendCapCents,
      monthlySpentCents: monthly.spent_cost_cents,
      monthlyReservedCents: monthly.reserved_cost_cents,
      interactionLeaseActive: nowMs <= daily.interaction_lease_until_ms,
      interactionLeaseUntilMs: daily.interaction_lease_until_ms,
      modes,
      blockingReason,
    };
  }

  /**
   * Processes a client heartbeat or user interaction signal.
   * - If `userInteracted` is true, extends the 90s server-side interaction lease.
   * - Credits elapsed active seconds since `last_tick_at_ms` (up to 15s per tick) ONLY while within the active lease.
   * - Deduplicates concurrent heartbeats from multiple open browser tabs.
   */
  public recordHeartbeat(params: {
    mode: ActivityMode;
    userInteracted: boolean;
    nowMs?: number;
  }): QuotaStatusSummary {
    const now = params.nowMs ?? Date.now();
    const tx = this.db.raw.transaction(() => {
      const statusBefore = this.getQuotaStatus(now, params.mode);
      const dateKey = statusBefore.dateKey;
      const daily = this.db.getOrCreateDailyUsage(dateKey);

      let leaseUntil = daily.interaction_lease_until_ms;
      let lastInteraction = daily.last_interaction_at_ms;

      if (params.userInteracted) {
        leaseUntil = now + INTERACTION_LEASE_DURATION_MS;
        lastInteraction = now;
      }

      // If lease has expired, do not credit idle tab time
      if (now > leaseUntil) {
        this.db.raw
          .prepare(
            'UPDATE daily_usage SET interaction_lease_until_ms = ?, last_interaction_at_ms = ? WHERE date_key = ?'
          )
          .run(leaseUntil, lastInteraction, dateKey);
        return this.getQuotaStatus(now, params.mode);
      }

      // Calculate elapsed time since last tick (prevent multi-tab double-counting)
      const elapsedSec =
        daily.last_tick_at_ms > 0
          ? Math.floor((now - daily.last_tick_at_ms) / 1000)
          : 0;

      if (elapsedSec <= 0) {
        this.db.raw
          .prepare(
            'UPDATE daily_usage SET interaction_lease_until_ms = ?, last_interaction_at_ms = ? WHERE date_key = ?'
          )
          .run(leaseUntil, lastInteraction, dateKey);
        return this.getQuotaStatus(now, params.mode);
      }

      const modeStatus = statusBefore.modes[params.mode];
      if (!modeStatus.enabled || modeStatus.effectiveRemainingSeconds <= 0) {
        return statusBefore;
      }

      const creditSec = Math.min(
        TURN_ACTIVE_SLICE_SECONDS,
        elapsedSec,
        modeStatus.effectiveRemainingSeconds
      );

      const modeCol = `${params.mode}_active_seconds`;
      this.db.raw
        .prepare(
          `UPDATE daily_usage
           SET global_active_seconds = global_active_seconds + ?,
               ${modeCol} = ${modeCol} + ?,
               continuous_active_seconds = continuous_active_seconds + ?,
               continuous_started_at_ms = CASE WHEN continuous_started_at_ms = 0 THEN ? ELSE continuous_started_at_ms END,
               last_interaction_at_ms = ?,
               last_tick_at_ms = ?,
               interaction_lease_until_ms = ?
           WHERE date_key = ?`
        )
        .run(
          creditSec,
          creditSec,
          creditSec,
          now,
          lastInteraction || now,
          now,
          leaseUntil,
          dateKey
        );

      return this.getQuotaStatus(now, params.mode);
    });

    return tx.immediate();
  }

  /**
   * Hard pre-request policy gate & budget reservation.
   * Runs inside an IMMEDIATE SQLite transaction so concurrent tabs cannot bypass time or spend limits.
   */
  public evaluatePolicyAndReserve(params: {
    mode: ActivityMode;
    maxPotentialCostCents: number;
    creditSliceSeconds?: number;
    nowMs?: number;
  }):
    | {
        allowed: true;
        dateKey: string;
        monthKey: string;
        reservedCostCents: number;
        creditedSeconds: number;
        quota: QuotaStatusSummary;
        policy: PolicyConfig;
      }
    | {
        allowed: false;
        reason: PolicyBlockReason;
        message: string;
        quota: QuotaStatusSummary;
        policy: PolicyConfig;
      } {
    const now = params.nowMs ?? Date.now();
    // Settle elapsed active time once, before renewing the interaction lease.
    this.recordHeartbeat({ mode: params.mode, userInteracted: false, nowMs: now });
    const sliceRequested = params.creditSliceSeconds ?? 0;

    const tx = this.db.raw.transaction(() => {
      const policy = this.db.getPolicyConfig();
      const quota = this.getQuotaStatus(now, params.mode);

      // 0. Provider minor compliance gate (Item 1)
      if (!isProviderAllowedForMinors(policy.activeProvider)) {
        return {
          allowed: false as const,
          reason: 'PROVIDER_NOT_ALLOWED_FOR_MINORS' as const,
          message:
            'This AI provider prohibits use by minors under its terms of service. A parent must select a compliant provider (such as Anthropic Claude or OpenAI) in Settings.',
          quota,
          policy,
        };
      }

      // 1. Provider safety verification check
      const providerMeta = this.providerRegistry
        ? this.providerRegistry.getModelProvider(policy.activeProvider)
        : { safetyVerified: policy.activeProvider === 'mock' || policy.activeProvider === 'local_ollama' };
      if (!providerMeta || !providerMeta.safetyVerified) {
        return {
          allowed: false as const,
          reason: 'PROVIDER_NOT_SAFETY_VERIFIED' as const,
          message:
            'A parent needs to review and configure this AI connection before it can be used.',
          quota,
          policy,
        };
      }

      // 2. Mode enabled check
      const modeStatus = quota.modes[params.mode];
      if (!modeStatus.enabled) {
        return {
          allowed: false as const,
          reason: 'MODE_DISABLED' as const,
          message: `${params.mode.toUpperCase()} mode is currently turned off in Parent Settings.`,
          quota,
          policy,
        };
      }

      // 3. Global daily time cap check (applies across all modes!)
      if (quota.globalRemainingSeconds <= 0) {
        return {
          allowed: false as const,
          reason: 'GLOBAL_TIME_LIMIT_REACHED' as const,
          message:
            'Your total daily active time across all modes is finished for today. You can save your work or ask a parent for an extension.',
          quota,
          policy,
        };
      }

      // 4. Mode-specific daily time cap check
      if (modeStatus.remainingSeconds <= 0) {
        return {
          allowed: false as const,
          reason: 'MODE_TIME_LIMIT_REACHED' as const,
          message: `Your daily time for ${params.mode.toUpperCase()} is finished for today. You can still save your work or request extra time.`,
          quota,
          policy,
        };
      }

      // 5. Continuous session duration check
      if (quota.continuousRemainingSeconds <= 0) {
        return {
          allowed: false as const,
          reason: 'CONTINUOUS_SESSION_LIMIT_REACHED' as const,
          message: `Time for a ${policy.sessionCooldownMinutes}-minute break! You have reached the continuous session limit.`,
          quota,
          policy,
        };
      }

      // 6. Spend cap check & reservation
      const reserveCents = Math.max(0, Math.ceil(params.maxPotentialCostCents));
      if (
        reserveCents > 0 &&
        quota.dailySpentCents + quota.dailyReservedCents + reserveCents >
          policy.dailySpendCapCents
      ) {
        return {
          allowed: false as const,
          reason: 'DAILY_SPEND_CAP_REACHED' as const,
          message: 'The daily API spending limit configured by your parent has been reached.',
          quota,
          policy,
        };
      }

      if (
        reserveCents > 0 &&
        quota.monthlySpentCents + quota.monthlyReservedCents + reserveCents >
          policy.monthlySpendCapCents
      ) {
        return {
          allowed: false as const,
          reason: 'MONTHLY_SPEND_CAP_REACHED' as const,
          message:
            'The monthly API spending limit configured by your parent has been reached.',
          quota,
          policy,
        };
      }

      // 7. Atomically credit active interaction slice and reserve budget
      const creditedSeconds = Math.min(
        sliceRequested,
        quota.globalRemainingSeconds,
        modeStatus.remainingSeconds,
        quota.continuousRemainingSeconds
      );

      const modeCol = `${params.mode}_active_seconds`;
      const leaseUntil = now + INTERACTION_LEASE_DURATION_MS;

      this.db.raw
        .prepare(
          `UPDATE daily_usage
           SET global_active_seconds = global_active_seconds + ?,
               ${modeCol} = ${modeCol} + ?,
               continuous_active_seconds = continuous_active_seconds + ?,
               continuous_started_at_ms = CASE WHEN continuous_started_at_ms = 0 THEN ? ELSE continuous_started_at_ms END,
               request_count = request_count + 1,
               reserved_cost_cents = reserved_cost_cents + ?,
               last_interaction_at_ms = ?,
               last_tick_at_ms = ?,
               interaction_lease_until_ms = ?
           WHERE date_key = ?`
        )
        .run(
          creditedSeconds,
          creditedSeconds,
          creditedSeconds,
          now,
          reserveCents,
          now,
          now,
          leaseUntil,
          quota.dateKey
        );

      this.db.raw
        .prepare(
          `UPDATE monthly_usage
           SET reserved_cost_cents = reserved_cost_cents + ?,
               request_count = request_count + 1
           WHERE month_key = ?`
        )
        .run(reserveCents, quota.monthKey);

      const updatedQuota = this.getQuotaStatus(now, params.mode);

      return {
        allowed: true as const,
        dateKey: quota.dateKey,
        monthKey: quota.monthKey,
        reservedCostCents: reserveCents,
        creditedSeconds,
        quota: updatedQuota,
        policy,
      };
    });

    return tx.immediate();
  }

  public reconcileCostReservation(params: {
    dateKey: string;
    monthKey: string;
    reservedCostCents: number;
    actualCostCents: number;
  }): void {
    const actual = Math.max(0, Number(params.actualCostCents.toFixed(6)));
    const reserved = Math.max(0, Math.ceil(params.reservedCostCents));

    const tx = this.db.raw.transaction(() => {
      this.db.getOrCreateDailyUsage(params.dateKey);
      this.db.getOrCreateMonthlyUsage(params.monthKey);

      this.db.raw
        .prepare(
          `UPDATE daily_usage
           SET reserved_cost_cents = MAX(0, reserved_cost_cents - ?),
               spent_cost_cents = spent_cost_cents + ?
           WHERE date_key = ?`
        )
        .run(reserved, actual, params.dateKey);

      this.db.raw
        .prepare(
          `UPDATE monthly_usage
           SET reserved_cost_cents = MAX(0, reserved_cost_cents - ?),
               spent_cost_cents = spent_cost_cents + ?
           WHERE month_key = ?`
        )
        .run(reserved, actual, params.monthKey);
    });

    tx.immediate();
  }
}
