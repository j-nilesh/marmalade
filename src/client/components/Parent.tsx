import React, { useEffect, useState } from 'react';
import { api } from '../api';
import { Brand } from './Common';
import { ProviderSettings, Limits, SearchSettings } from './ParentSettings';
import { Feedback, PageHeading, useAction } from './Common';
import type { ParentDashboardSummary, UserPublic } from '../../shared/types';
import { SAFETY_CATEGORIES } from '../../shared/safety';
import { BRANDING } from '../../shared/branding';

type Provider = ParentDashboardSummary['providers'][number] & {
  readiness?: { ok: boolean; details: string };
};
export function ParentWorkspace({
  user,
  fresh,
  onSignOut,
}: {
  user: UserPublic;
  fresh: boolean;
  onSignOut: () => Promise<void>;
}) {
  const [dashboard, setDashboard] = useState<ParentDashboardSummary | null>(
      null
    ),
    [view, setView] = useState('overview'),
    [setup, setSetup] = useState<boolean | null>(null),
    [step, setStep] = useState(0),
    [connectionConfirmed, setConnectionConfirmed] = useState(false),
    [settingsTab, setSettingsTab] = useState<'all' | 'ai' | 'limits' | 'search'>('all');
  const action = useAction();
  async function refresh() {
    const [d, e] = await Promise.all([
      api<ParentDashboardSummary>('/parent/dashboard'),
      api<{ completed: boolean }>('/parent/experience'),
    ]);
    setDashboard(d);
    if (setup === null) setSetup(fresh || !e.completed);
  }
  useEffect(() => {
    void action.run(refresh);
  }, []);
  if (!dashboard)
    return (
      <main className="auth-shell th-modern">
        <Brand />
        <Feedback action={action} />
        {action.error && (
          <button onClick={() => action.run(refresh)}>Try again</button>
        )}
      </main>
    );
  const selected = dashboard.providers.find(
    (p) => p.id === dashboard.policy.activeProvider
  ) as Provider | undefined;
  const canHandOff =
    dashboard.policy.activeProvider === 'mock' ||
    Boolean(selected?.readiness?.ok);
  return (
    <div className="app-layout parent-modern th-modern">
      <aside className="sidebar">
        <Brand />
        <p className="workspace-label">Parent workspace</p>
        <nav aria-label="Parent navigation">
          {['overview', 'requests', 'settings'].map((v) => (
            <button
              key={v}
              aria-current={view === v && !setup ? 'page' : undefined}
              onClick={() => {
                setSetup(false);
                setView(v);
                action.clear();
              }}
            >
              {v === 'overview'
                ? 'Overview'
                : v === 'requests'
                  ? `Requests${dashboard.pendingExtensions.length ? ` (${dashboard.pendingExtensions.length})` : ''}`
                  : 'Settings'}
            </button>
          ))}
        </nav>
        <div className="account">
          <span>{user.displayName}</span>
          <button onClick={() => action.run(onSignOut)}>Sign out</button>
        </div>
      </aside>
      <main id="main-content" className="workspace">
        <Feedback action={action} />
        {setup ? (
          <>
            <PageHeading
              eyebrow={`Family setup · ${step + 2} of 5`}
              title={
                [
                  'Connect your AI',
                  'Choose everyday limits',
                  'Find sources on the web',
                  canHandOff
                    ? dashboard.policy.activeProvider === 'mock'
                      ? 'Try the demo workspace'
                      : 'Ready for your child'
                    : 'Check the connection first',
                ][step]
              }
            />
            <ol className="setup-progress" aria-label="Setup progress">
              {['AI connection', 'Limits', 'Web research', 'Ready'].map(
                (label, i) => (
                  <li
                    key={label}
                    aria-current={i === step ? 'step' : undefined}
                  >
                    <button
                      type="button"
                      className="tab-step-button"
                      onClick={() => {
                        setStep(i);
                        action.clear();
                      }}
                    >
                      {label}
                    </button>
                  </li>
                )
              )}
            </ol>
            {step === 0 && (
              <ProviderSettings
                dashboard={dashboard}
                onRefresh={refresh}
                onConfigured={() => setConnectionConfirmed(true)}
              />
            )}{' '}
            {step === 1 && (
              <Limits
                policy={dashboard.policy}
                onSaved={async () => {
                  await refresh();
                  setStep(2);
                }}
              />
            )}{' '}
            {step === 2 && (
              <SearchSettings
                dashboard={dashboard}
                onRefresh={async () => {
                  await refresh();
                  setStep(3);
                }}
              />
            )}{' '}
            {step === 3 && (
              <section className="surface">
                <h2>
                  {dashboard.policy.activeProvider === 'mock'
                    ? 'Demo workspace is ready'
                    : canHandOff
                      ? 'Your family workspace is set up'
                      : 'An answer test is still needed'}
                </h2>
                <p>
                  {dashboard.policy.activeProvider === 'mock'
                    ? 'Demo answers are examples, not real AI. Connect a tested provider in Settings before relying on explanations.'
                    : selected?.readiness?.ok
                      ? 'The configured AI has answered a sample question.'
                      : 'The selected connection needs a new sample test before your child uses it.'}
                </p>
                <dl className="summary-list">
                  <div>
                    <dt>Time each day</dt>
                    <dd>{dashboard.policy.globalDailyMinutes} minutes</dd>
                  </div>
                  <div>
                    <dt>Breaks</dt>
                    <dd>
                      After {dashboard.policy.maxContinuousSessionMinutes}{' '}
                      minutes · {dashboard.policy.sessionCooldownMinutes}-minute
                      break
                    </dd>
                  </div>
                  <div>
                    <dt>Research</dt>
                    <dd>
                      {dashboard.policy.allowExternalSearch
                        ? 'Web search enabled'
                        : 'Limited local library'}
                    </dd>
                  </div>
                </dl>
                <p>
                  Only notes and work your child explicitly saves are stored.
                  Unsaved activities can be restored for 15 minutes without a
                  turn. Cloud AI receives submitted content; the parent overview
                  has no transcript reader.
                </p>
                <button
                  className="primary"
                  disabled={!canHandOff}
                  onClick={() =>
                    action.run(async () => {
                      await api('/parent/experience/complete', 'POST');
                      await onSignOut();
                    })
                  }
                >
                  Sign out for child login
                </button>
                <button
                  onClick={() =>
                    action.run(async () => {
                      await api('/parent/experience/complete', 'POST');
                      setSetup(false);
                    })
                  }
                >
                  Go to parent overview
                </button>
              </section>
            )}
            <div className="step-actions">
              {step > 0 && (
                <button onClick={() => setStep(step - 1)}>Back</button>
              )}
              {/* Keep a distinct element when its native form association changes. */}
              {step < 3 && (
                <button
                  key={step}
                  className="primary"
                  type={step === 0 ? 'button' : 'submit'}
                  form={
                    step === 1
                      ? 'household-limits'
                      : step === 2
                        ? 'research-settings'
                        : undefined
                  }
                  onClick={step === 0 ? () => setStep(1) : undefined}
                >
                  {step === 2 ? 'Continue to summary' : 'Continue'}
                </button>
              )}
            </div>
          </>
        ) : view === 'overview' ? (
          <>
            <PageHeading eyebrow="Your household" title="Your family today">
              Time, connections, and requests at a glance.
            </PageHeading>
            <section className="connection-line">
              <div>
                <h2>AI connection</h2>
                <p>{selected?.displayName}</p>
                <span
                  className={`status-dot ${selected?.readiness?.ok ? 'good' : ''}`}
                >
                  {dashboard.policy.activeProvider === 'mock'
                    ? 'Demo mode'
                    : selected?.readiness?.ok
                      ? 'Sample answer succeeded'
                      : 'Sample test needed'}
                </span>
              </div>
              <button onClick={() => setView('settings')}>
                Check connection
              </button>
            </section>
            <section>
              <div className="section-heading">
                <h2>Today</h2>
                <button onClick={() => action.run(refresh)}>
                  Refresh overview
                </button>
              </div>
              <div className="metrics">
                <div>
                  <span>Active time</span>
                  <strong>
                    {dashboard.todayStats.totalActiveMinutes}{' '}
                    <small>
                      /{' '}
                      {(dashboard.quota.globalDailyLimitSeconds +
                        dashboard.quota.globalBonusSeconds) /
                        60}{' '}
                      min
                    </small>
                  </strong>
                </div>
                <div>
                  <span>Estimated API spend today</span>
                  <strong>
                    $
                    {(
                      dashboard.todayStats.estimatedSpendTodayCents / 100
                    ).toFixed(2)}
                  </strong>
                </div>
                <div>
                  <span>This month</span>
                  <strong>
                    $
                    {(
                      dashboard.todayStats.estimatedSpendMonthCents / 100
                    ).toFixed(2)}{' '}
                    <small>
                      / $
                      {(dashboard.policy.monthlySpendCapCents / 100).toFixed(2)}
                    </small>
                  </strong>
                </div>
              </div>
              <p className="muted">
                Estimates include external AI only. Your provider’s bill is
                authoritative. Demo and local activity cost $0.
              </p>
              <div className="usage-list">
                {Object.entries(dashboard.todayStats.activeMinutesByMode).map(
                  ([mode, used]) => (
                    <div key={mode}>
                      <span>
                        {mode === 'ask'
                          ? 'Ask'
                          : mode === 'schoolwork'
                            ? 'Schoolwork'
                            : mode === 'play'
                              ? 'Play'
                              : 'Research'}
                      </span>
                      <progress
                        max={
                          dashboard.quota.modes[
                            mode as keyof typeof dashboard.quota.modes
                          ].dailyLimitSeconds +
                          dashboard.quota.modes[
                            mode as keyof typeof dashboard.quota.modes
                          ].bonusSeconds
                        }
                        value={used * 60}
                      />
                      <span>{used} min</span>
                    </div>
                  )
                )}
              </div>
            </section>
            <section className="surface">
              <h2>
                {dashboard.pendingExtensions.length
                  ? 'Extra time needs a decision'
                  : 'Nothing needs your attention'}
              </h2>
              <p>
                {dashboard.pendingExtensions.length
                  ? `${dashboard.pendingExtensions.length} request${dashboard.pendingExtensions.length > 1 ? 's' : ''} waiting.`
                  : 'Your child can explore within the limits you chose.'}
              </p>
              {dashboard.pendingExtensions.length > 0 && (
                <button onClick={() => setView('requests')}>
                  Review requests
                </button>
              )}
            </section>
            <section className="surface" aria-labelledby="built-in-guardrails">
              <h2 id="built-in-guardrails">Built-in guardrails</h2>
              <p>
                These rules are part of Marmalade and cannot be changed in
                Settings.
              </p>
              <dl className="guardrail-list">
                <div>
                  <dt>Ask &amp; Learn</dt>
                  <dd>
                    Up to 8 replies per conversation. Ordinary questions get
                    direct answers, without a compulsory quiz.
                  </dd>
                </div>
                <div>
                  <dt>Fiction &amp; fan fiction</dt>
                  <dd>
                    In Ask, recognized creative conversations allow up to 3
                    short AI contributions, with a child idea between passages.
                    Creative answers are capped at 140 words. Familiar
                    characters follow the same age-appropriate content guidance.
                  </dd>
                </div>
                <div>
                  <dt>Schoolwork</dt>
                  <dd>
                    Up to 7 coaching replies after the opening prompt. Marmalade
                    supports the child’s own thinking; saving work and learning
                    notes remains available at the stopping point.
                  </dd>
                </div>
                <div>
                  <dt>Play</dt>
                  <dd>
                    Story Relay ends after 6 scenes; Trivia after 10 questions;
                    Twenty Questions after 20 turns. Story suggestions can be
                    edited before submitting.
                  </dd>
                </div>
                <div>
                  <dt>Research</dt>
                  <dd>
                    One answer per query, with sources and an explicit
                    no-results state. Source citations are checked against
                    returned records; they do not guarantee every claim is
                    supported.
                  </dd>
                </div>
                <div>
                  <dt>Participation &amp; endings</dt>
                  <dd>
                    Bare “continue” requests in recognized fiction need a child
                    idea. Completed activities stop generating; the child can
                    save work or explicitly begin another activity within your
                    household limits.
                  </dd>
                </div>
              </dl>
              <p className="muted">
                Creative-request recognition and AI content safeguards are
                imperfect. Marmalade gives the AI age-appropriate guidance and uses
                available provider safeguards; this is not a guarantee that
                every response is suitable.
              </p>
              <details>
                <summary>Your household controls &amp; privacy</summary>
                <p>
                  Daily time: {dashboard.quota.globalDailyLimitSeconds / 60}{' '}
                  minutes, plus {dashboard.quota.globalBonusSeconds / 60}{' '}
                  granted today. Breaks:{' '}
                  {dashboard.quota.continuousLimitSeconds / 60} minutes of use,
                  then {dashboard.quota.cooldownMinutes} minutes away.
                </p>
                <p>
                  Estimated spending caps: $
                  {(dashboard.policy.dailySpendCapCents / 100).toFixed(2)} daily
                  and $
                  {(dashboard.policy.monthlySpendCapCents / 100).toFixed(2)}{' '}
                  monthly. Time, mode access and spending controls are enforced
                  by the server. Extra-time requests need a parent decision.
                </p>
                <p>
                  Conversation content is stored only when explicitly saved.
                  Accounts, settings and usage totals are also stored. Unsaved
                  activities recover within a 15-minute idle window and
                  disappear after logout or server restart. Cloud providers
                  receive submitted content under their own data policies. This
                  dashboard has no child transcript reader.
                </p>
                <p>
                  You can change household limits and connections in Settings;
                  the built-in activity boundaries above stay in place.
                </p>
              </details>
            </section>
            <details className="surface" open={dashboard.safetyEvents.length > 0}>
              <summary>
                Safety indicators ({dashboard.safetyEvents.length})
              </summary>
              <p>
                Broad categories only. In keeping with {BRANDING.productName}’s privacy commitment, the parent dashboard has <strong>no transcript reader</strong>. When an alert occurs, the child receives immediate supportive guidance and helplines, while you receive the category, timestamp, and mode below.
              </p>
              {dashboard.safetyEvents.map((e) => {
                const catDef = SAFETY_CATEGORIES[e.category as keyof typeof SAFETY_CATEGORIES];
                const label = catDef?.label || e.category;
                const timeStr = new Date(e.createdAtMs).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                return (
                  <div key={e.id} className="indicator-event-row">
                    <span className={`severity-tag ${e.severity}`}>{e.severity.toUpperCase()}</span>
                    <strong>{label}</strong>
                    <span className="muted">· in {e.mode} mode at {timeStr}</span>
                  </div>
                );
              })}
              {!dashboard.safetyEvents.length && (
                <p className="empty">No safety indicators recorded today.</p>
              )}

              {/* Standardized category definitions (Item 4) */}
              <div className="category-definitions-block">
                <h3>Defined Safety Categories</h3>
                <dl className="category-def-list">
                  {Object.values(SAFETY_CATEGORIES).map((cat) => (
                    <div key={cat.key} className="category-def-item">
                      <dt>
                        <strong>{cat.label}</strong> ({cat.severity} severity)
                      </dt>
                      <dd>{cat.definition}</dd>
                      <dd className="child-response-hint">
                        <small>
                          <em>Child immediately sees:</em> {cat.childImmediateSupport.message.slice(0, 110)}…
                        </small>
                      </dd>
                    </div>
                  ))}
                </dl>
              </div>
            </details>
          </>
        ) : view === 'requests' ? (
          <>
            <PageHeading title="Extra-time requests">
              Give a little more room when it makes sense.
            </PageHeading>
            {!dashboard.pendingExtensions.length && (
              <p className="empty">No requests waiting.</p>
            )}
            {dashboard.pendingExtensions.map((req) => (
              <article className="request-row" key={req.id}>
                <div>
                  <h2>
                    +{req.requestedMinutes} minutes for{' '}
                    {req.requestedMode === 'global'
                      ? 'the day'
                      : req.requestedMode}
                  </h2>
                  {req.reasonNote && <p>{req.reasonNote}</p>}
                </div>
                <div className="button-row">
                  <button
                    className="primary"
                    disabled={action.busy}
                    onClick={() =>
                      action.run(async () => {
                        await api(
                          `/parent/extensions/${req.id}/resolve`,
                          'POST',
                          {
                            approve: true,
                            grantedMinutes: req.requestedMinutes,
                          }
                        );
                        await refresh();
                        action.setMessage('Extra time approved.');
                      })
                    }
                  >
                    Approve
                  </button>
                  <button
                    disabled={action.busy}
                    onClick={() =>
                      action.run(async () => {
                        await api(
                          `/parent/extensions/${req.id}/resolve`,
                          'POST',
                          { approve: false }
                        );
                        await refresh();
                        action.setMessage('Request declined.');
                      })
                    }
                  >
                    Decline
                  </button>
                </div>
              </article>
            ))}
            <h2>Recent decisions</h2>
            {dashboard.recentExtensions
              .filter((r) => r.status !== 'pending')
              .map((r) => (
                <p key={r.id}>
                  {r.requestedMode} · +{r.requestedMinutes} min · {r.status}
                </p>
              ))}
          </>
        ) : (
          <>
            <PageHeading title="Household settings">
              Set things up once. Adjust when life changes.
            </PageHeading>
            <div className="subnav-tabs" role="tablist">
              <button
                type="button"
                className={settingsTab === 'all' ? 'primary' : ''}
                onClick={() => setSettingsTab('all')}
              >
                All Settings
              </button>
              <button
                type="button"
                className={settingsTab === 'ai' ? 'primary' : ''}
                onClick={() => setSettingsTab('ai')}
              >
                AI Connection
              </button>
              <button
                type="button"
                className={settingsTab === 'limits' ? 'primary' : ''}
                onClick={() => setSettingsTab('limits')}
              >
                Everyday Limits
              </button>
              <button
                type="button"
                className={settingsTab === 'search' ? 'primary' : ''}
                onClick={() => setSettingsTab('search')}
              >
                Web Research (Search)
              </button>
            </div>
            {(settingsTab === 'all' || settingsTab === 'ai') && (
              <ProviderSettings dashboard={dashboard} onRefresh={refresh} />
            )}
            {(settingsTab === 'all' || settingsTab === 'limits') && (
              <Limits policy={dashboard.policy} onSaved={refresh} />
            )}
            {(settingsTab === 'all' || settingsTab === 'search') && (
              <SearchSettings dashboard={dashboard} onRefresh={refresh} />
            )}
            <button
              onClick={() => {
                setStep(0);
                setSetup(true);
              }}
            >
              Walk through setup again
            </button>
          </>
        )}
      </main>
    </div>
  );
}
