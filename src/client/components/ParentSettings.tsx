import React, { useState } from 'react';
import { api } from '../api';
import { Field, Feedback, Submit, useAction } from './Common';
import type {
  ParentDashboardSummary,
  PolicyConfig,
  ProviderId,
  ProviderPreflightResult,
} from '../../shared/types';
import { PROVIDER_POLICY_MATRIX } from '../../shared/providerPolicy';

export function ProviderSettings({
  dashboard,
  onRefresh,
  onConfigured,
}: {
  dashboard: ParentDashboardSummary;
  onRefresh: () => Promise<void>;
  onConfigured?: () => void;
}) {
  const settings = dashboard.providerSettings;
  const action = useAction();
  const [provider, setProvider] = useState<ProviderId>(
    dashboard.policy.activeProvider
  );
  const [key, setKey] = useState('');
  const [customModelMode, setCustomModelMode] = useState(false);

  // Model state
  const [anthropicModel, setAnthropicModel] = useState(
    settings.anthropicModel && !settings.anthropicModel.startsWith('claude-3')
      ? settings.anthropicModel
      : 'claude-haiku-5-5'
  );
  const [openModel, setOpenModel] = useState(
    settings.openaiModel || 'gpt-4o-mini'
  );
  const [base, setBase] = useState(settings.ollamaBaseUrl);
  const [local, setLocal] = useState(settings.ollamaModel);

  // Provider conditions checkboxes (Item 1)
  const [anthropicConsent, setAnthropicConsent] = useState(
    Boolean(settings.anthropicConditionsConfirmed || settings.anthropicZdrApproved)
  );
  const [openaiUnder13Confirmed, setOpenaiUnder13Confirmed] = useState(
    Boolean(settings.openaiUnder13Confirmed)
  );
  const [openaiConsent, setOpenaiConsent] = useState(
    Boolean(settings.openaiZdrApproved)
  );
  const [ollamaAck, setOllamaAck] = useState(true);

  const [test, setTest] = useState<ProviderPreflightResult | null>(null);

  const policyInfo = PROVIDER_POLICY_MATRIX[provider];
  const isMinorBlocked = policyInfo?.minorsStatus === 'not_allowed';

  async function saveProviderCredentials() {
    if (provider === 'anthropic') {
      await api('/parent/providers/config', 'PUT', {
        anthropicApiKey: key || undefined,
        anthropicModel,
        anthropicZdrApproved: anthropicConsent,
      });
      await api('/parent/policy', 'PUT', {
        anthropicConditionsConfirmed: anthropicConsent,
      });
    } else if (provider === 'openai') {
      await api('/parent/providers/config', 'PUT', {
        openaiApiKey: key || undefined,
        openaiModel: openModel,
        openaiZdrApproved: openaiConsent,
      });
      await api('/parent/policy', 'PUT', {
        openaiUnder13Confirmed,
      });
    } else if (provider === 'local_ollama') {
      await api('/parent/providers/config', 'PUT', {
        ollamaBaseUrl: base,
        ollamaModel: local,
      });
    }
    setKey('');
  }

  // Unified single flow: save credentials -> run preflight test -> activate connection (Item 14)
  async function handleConnectAndTest() {
    if (isMinorBlocked) {
      throw new Error(
        policyInfo?.rejectionReason ||
          'This provider is not permitted for child spaces.'
      );
    }

    if (provider === 'anthropic' && !anthropicConsent) {
      throw new Error(
        'Please confirm parental authorization under Anthropic commercial terms.'
      );
    }

    if (provider === 'openai' && !openaiConsent) {
      throw new Error(
        'Please confirm parental supervision under OpenAI terms.'
      );
    }

    action.setMessage('Saving configuration and testing connection…');
    await saveProviderCredentials();

    if (provider === 'mock') {
      await api('/parent/policy', 'PUT', { activeProvider: 'mock' });
      await onRefresh();
      onConfigured?.();
      action.setMessage('Demo mode selected.');
      return;
    }

    const testRes = await api(`/parent/providers/${provider}/test`, 'POST');
    setTest(testRes.preflight);

    if (!testRes.preflight.ok) {
      throw new Error(
        testRes.preflight.details ||
          'Connection test failed. Please verify your credentials or server status.'
      );
    }

    // Activate the provider for child space now that test succeeded
    await api('/parent/policy', 'PUT', { activeProvider: provider });
    await onRefresh();
    onConfigured?.();
    action.setMessage(
      'Connection test succeeded! This provider is now active for your child’s space.'
    );
  }

  return (
    <section className="surface">
      <h2>AI connection</h2>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          void action.run(handleConnectAndTest);
        }}
      >
        <fieldset disabled={action.busy} className="control-group">
          <Field label="Choose AI provider">
            <select
              value={provider}
              onChange={(e) => {
                const id = e.target.value as ProviderId;
                setProvider(id);
                setKey('');
                setTest(null);
              }}
            >
              <option value="anthropic">Anthropic Claude (Compliant for minors)</option>
              <option value="openai">OpenAI (Compliant for minors with conditions)</option>
              <option value="local_ollama">Local model via Ollama (Self-hosted)</option>
              <option value="mock">Demo examples (No live AI / No charges)</option>
              <option value="gemini">Google Gemini (Blocked for minors)</option>
            </select>
          </Field>

          {/* Provider policy information & terms link (Item 1) */}
          {policyInfo && (
            <div
              className={`provider-policy-card ${
                isMinorBlocked ? 'policy-blocked' : 'policy-allowed'
              }`}
            >
              <div className="policy-header">
                <strong>Minors Policy Status: </strong>
                <span className={`badge ${policyInfo.minorsStatus}`}>
                  {policyInfo.minorsStatus === 'not_allowed'
                    ? 'Prohibited for Minors'
                    : policyInfo.minorsStatus === 'allowed_with_conditions'
                      ? 'Allowed with Conditions'
                      : 'Allowed'}
                </span>
              </div>
              <p className="policy-summary">{policyInfo.summary}</p>
              {policyInfo.termsUrl && (
                <p className="policy-links">
                  <a
                    href={policyInfo.termsUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    View Provider Terms ↗
                  </a>
                  {policyInfo.guidanceUrl && (
                    <>
                      {' · '}
                      <a
                        href={policyInfo.guidanceUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        Provider Minors Guidance ↗
                      </a>
                    </>
                  )}
                </p>
              )}
            </div>
          )}

          {/* Gemini Block Notice */}
          {provider === 'gemini' && (
            <div className="notice error" role="alert">
              <p>
                <strong>Google Gemini API terms prohibit minors:</strong>{' '}
                {policyInfo?.rejectionReason}
              </p>
              <p>
                Marmalade cannot connect Gemini to child workspaces. Please select{' '}
                <strong>Anthropic Claude</strong>, <strong>OpenAI</strong>, or a{' '}
                <strong>Local Model</strong>.
              </p>
            </div>
          )}

          {/* Anthropic Configuration */}
          {provider === 'anthropic' && (
            <>
              <Field
                label="Anthropic API Key"
                hint={
                  settings.hasAnthropicApiKey
                    ? `A key is saved (${settings.anthropicApiKeyHint}). Leave blank to keep it.`
                    : 'Stored securely server-side; never returned to the browser client.'
                }
              >
                <input
                  type="password"
                  autoComplete="off"
                  placeholder={
                    settings.hasAnthropicApiKey ? '••••••••••••••••' : 'sk-ant-api03-...'
                  }
                  value={key}
                  onChange={(e) => setKey(e.target.value)}
                />
              </Field>

              {/* Model selection as dropdown (Item 13) */}
              <Field label="Claude Model">
                {customModelMode ? (
                  <input
                    value={anthropicModel}
                    onChange={(e) => setAnthropicModel(e.target.value)}
                    placeholder="e.g. claude-haiku-5-5"
                  />
                ) : (
                  <select
                    value={anthropicModel}
                    onChange={(e) => {
                      setAnthropicModel(e.target.value);
                      setTest(null);
                    }}
                  >
                    <option value="claude-haiku-5-5">
                      Claude Haiku 5.5 (Recommended · Fast, low-cost tutoring &amp; answers)
                    </option>
                    <option value="claude-sonnet-5-5">
                      Claude Sonnet 5.5 (Advanced reasoning &amp; deep coaching)
                    </option>
                    <option value="claude-opus-5-5">
                      Claude Opus 5.5 (Deepest analysis &amp; research)
                    </option>
                    <option value="claude-haiku-4-5-20251001">
                      Claude Haiku 4.5
                    </option>
                    <option value="claude-sonnet-4-5-20250929">
                      Claude Sonnet 4.5
                    </option>
                  </select>
                )}
              </Field>

              <label className="check toggle-advanced">
                <input
                  type="checkbox"
                  checked={customModelMode}
                  onChange={(e) => setCustomModelMode(e.target.checked)}
                />
                Use a custom Anthropic model string
              </label>

              {/* Conditions checklist for Anthropic */}
              <div className="conditions-checklist">
                <h3>Anthropic Minors Safeguards Checklist</h3>
                <ul className="conditions-list">
                  <li className="satisfied">
                    ✓ <strong>Content filtering:</strong> Marmalade screens inputs and outputs for self-harm, weapons, and inappropriate material.
                  </li>
                  <li className="satisfied">
                    ✓ <strong>Safety monitoring:</strong> Marmalade logs standardized safety categories for parents without reading conversations.
                  </li>
                  <li className="satisfied">
                    ✓ <strong>AI disclosure:</strong> Child space includes persistent notices stating they are talking to an AI that can make mistakes.
                  </li>
                  <li className="satisfied">
                    ✓ <strong>Child-safety prompt:</strong> Anthropic’s minor safety guidance is composed into all API calls.
                  </li>
                </ul>
                <label className="check required-ack">
                  <input
                    type="checkbox"
                    checked={anthropicConsent}
                    onChange={(e) => setAnthropicConsent(e.target.checked)}
                    required
                  />
                  <strong>Parental Authorization:</strong> I confirm that as the supervising parent or guardian, I authorize this instance and accept Anthropic Commercial Terms.
                </label>
              </div>
            </>
          )}

          {/* OpenAI Configuration */}
          {provider === 'openai' && (
            <>
              <Field
                label="OpenAI API Key"
                hint={
                  settings.hasOpenaiApiKey
                    ? `A key is saved (${settings.openaiApiKeyHint}). Leave blank to keep it.`
                    : 'Stored securely server-side; never returned to the browser client.'
                }
              >
                <input
                  type="password"
                  autoComplete="off"
                  placeholder={
                    settings.hasOpenaiApiKey ? '••••••••••••••••' : 'sk-proj-...'
                  }
                  value={key}
                  onChange={(e) => setKey(e.target.value)}
                />
              </Field>

              {/* Model selection as dropdown (Item 13) */}
              <Field label="OpenAI Model">
                {customModelMode ? (
                  <input
                    value={openModel}
                    onChange={(e) => setOpenModel(e.target.value)}
                    placeholder="e.g. gpt-4o-mini"
                  />
                ) : (
                  <select
                    value={openModel}
                    onChange={(e) => {
                      setOpenModel(e.target.value);
                      setTest(null);
                    }}
                  >
                    <option value="gpt-4o-mini">
                      GPT-4o Mini (Fast, capable everyday model &amp; low API cost)
                    </option>
                    <option value="gpt-4o">
                      GPT-4o (High-intelligence flagship model)
                    </option>
                  </select>
                )}
              </Field>

              <label className="check toggle-advanced">
                <input
                  type="checkbox"
                  checked={customModelMode}
                  onChange={(e) => setCustomModelMode(e.target.checked)}
                />
                Use a custom OpenAI model string
              </label>

              {/* Conditions checklist for OpenAI */}
              <div className="conditions-checklist">
                <h3>OpenAI Under-18 Safeguards Checklist</h3>
                <ul className="conditions-list">
                  <li className="satisfied">
                    ✓ <strong>Age-appropriate filters:</strong> Turn limits, Socratic guidance, and dangerous content filtering are enforced in code.
                  </li>
                  <li className="satisfied">
                    ✓ <strong>AI disclosure:</strong> Child workspace informs the student they are interacting with an AI.
                  </li>
                  <li className="satisfied">
                    ✓ <strong>Flagship safety alignment:</strong> Using current safety-aligned models (GPT-4o / GPT-4o-mini).
                  </li>
                </ul>

                <label className="check required-ack">
                  <input
                    type="checkbox"
                    checked={openaiUnder13Confirmed}
                    onChange={(e) => setOpenaiUnder13Confirmed(e.target.checked)}
                  />
                  <strong>Under-13 Zero Data Retention:</strong> If your child is under 13, confirm that Zero Data Retention (ZDR) has been approved on your OpenAI account.
                </label>

                <label className="check required-ack">
                  <input
                    type="checkbox"
                    checked={openaiConsent}
                    onChange={(e) => setOpenaiConsent(e.target.checked)}
                    required
                  />
                  <strong>Parental Supervision:</strong> I confirm that I supervise this connection under OpenAI API Terms of Use.
                </label>
              </div>
            </>
          )}

          {/* Local Ollama Configuration */}
          {provider === 'local_ollama' && (
            <>
              <p className="privacy-note">
                Local models run entirely on your local machine or private server. No external data is shared, but external vendor content moderation is not present. Marmalade application guardrails remain active.
              </p>
              <Field label="Ollama Server URL">
                <input
                  type="url"
                  required
                  value={base}
                  onChange={(e) => setBase(e.target.value)}
                />
              </Field>
              <Field label="Installed Model">
                {customModelMode ? (
                  <input
                    required
                    value={local}
                    onChange={(e) => setLocal(e.target.value)}
                    placeholder="e.g. llama3.2"
                  />
                ) : (
                  <select
                    value={local}
                    onChange={(e) => {
                      setLocal(e.target.value);
                      setTest(null);
                    }}
                  >
                    <option value="llama3.2">llama3.2 (Recommended for general learning)</option>
                    <option value="mistral">mistral (General instruction)</option>
                    <option value="qwen2.5">qwen2.5 (Strong reasoning &amp; STEM)</option>
                  </select>
                )}
              </Field>

              <label className="check toggle-advanced">
                <input
                  type="checkbox"
                  checked={customModelMode}
                  onChange={(e) => setCustomModelMode(e.target.checked)}
                />
                Use custom Ollama model tag
              </label>

              <label className="check required-ack">
                <input
                  type="checkbox"
                  checked={ollamaAck}
                  onChange={(e) => setOllamaAck(e.target.checked)}
                  required
                />
                I understand that our family is responsible for local model output.
              </label>
            </>
          )}

          {/* Mock / Demo Mode */}
          {provider === 'mock' && (
            <p className="privacy-note">
              Demo mode uses built-in sample responses. It does not send queries to live AI or incur charges.
            </p>
          )}

          <Feedback action={action} />

          {test && (
            <p
              role="status"
              className={`notice ${test.ok ? 'success' : 'error'}`}
            >
              {test.details}
            </p>
          )}

          {test?.sampleAnswers?.length ? (
            <details open className="sample-answers-box">
              <summary>Sample answers from connection test</summary>
              {test.sampleAnswers.map((sample) => (
                <p key={sample.mode}>
                  <strong>
                    {sample.mode === 'schoolwork' ? 'Schoolwork' : 'Everyday'}:
                  </strong>{' '}
                  {sample.answer}
                </p>
              ))}
            </details>
          ) : null}

          {/* Unified single connect and test button (Item 14) */}
          <Submit busy={action.busy} disabled={isMinorBlocked}>
            {provider === 'mock'
              ? 'Select demo examples'
              : isMinorBlocked
                ? 'Provider blocked for minors'
                : 'Test sample answer & activate connection'}
          </Submit>
        </fieldset>
      </form>
    </section>
  );
}

export function Limits({
  policy,
  onSaved,
}: {
  policy: PolicyConfig;
  onSaved: () => Promise<void>;
}) {
  const [draft, setDraft] = useState(policy);
  const action = useAction();

  const numeric = (
    key:
      | 'globalDailyMinutes'
      | 'maxContinuousSessionMinutes'
      | 'sessionCooldownMinutes'
  ) => ({
    type: 'number',
    min: 1,
    max: 1440,
    required: true,
    value: draft[key],
    onChange: (e: React.ChangeEvent<HTMLInputElement>) =>
      setDraft({ ...draft, [key]: Number(e.target.value) }),
  });

  return (
    <section className="surface">
      <h2>Time, privacy, and limits</h2>
      <form
        id="household-limits"
        onSubmit={(e) => {
          e.preventDefault();
          void action.run(async () => {
            await api(
              '/parent/policy',
              'PUT',
              (({ activeProvider, allowExternalSearch, ...limits }) => limits)(
                draft
              )
            );
            await onSaved();
            action.setMessage('Household limits saved.');
          });
        }}
      >
        {/* Child Space Name (Item 0) */}
        <Field
          label="Child Space Display Name"
          hint="What your child sees as the title of her space (e.g. Explorer’s Space, Family Room). Leave blank for default."
        >
          <input
            type="text"
            maxLength={40}
            placeholder="e.g. Explorer’s Space"
            value={draft.instanceDisplayName || ''}
            onChange={(e) =>
              setDraft({ ...draft, instanceDisplayName: e.target.value })
            }
          />
        </Field>

        {/* PII Filter toggle (Item 3) */}
        <label className="check" style={{ marginBottom: '20px' }}>
          <input
            type="checkbox"
            checked={draft.piiFilterEnabled ?? true}
            onChange={(e) =>
              setDraft({ ...draft, piiFilterEnabled: e.target.checked })
            }
          />
          <strong>Filter personal information:</strong> Automatically strip phone numbers, home addresses, emails, and school names from child prompts before sending to cloud providers.
        </label>

        <div className="form-columns">
          <Field label="Total minutes each day">
            <input {...numeric('globalDailyMinutes')} />
          </Field>
          <Field label="Break after (minutes)">
            <input {...numeric('maxContinuousSessionMinutes')} />
          </Field>
          <Field label="Break length (minutes)">
            <input {...numeric('sessionCooldownMinutes')} />
          </Field>
        </div>

        <details>
          <summary>Per-activity limits and advanced settings</summary>
          <div className="mode-settings">
            {Object.entries(draft.modes).map(([mode, value]) => (
              <div key={mode}>
                <label className="check">
                  <input
                    type="checkbox"
                    checked={value.enabled}
                    onChange={(e) =>
                      setDraft({
                        ...draft,
                        modes: {
                          ...draft.modes,
                          [mode]: { ...value, enabled: e.target.checked },
                        },
                      })
                    }
                  />
                  {mode === 'ask'
                    ? 'Ask'
                    : mode === 'schoolwork'
                      ? 'Schoolwork'
                      : mode === 'play'
                        ? 'Play'
                        : 'Research'}
                </label>
                <Field label={`${mode} minutes each day`}>
                  <input
                    type="number"
                    min={0}
                    max={1440}
                    required
                    value={value.dailyMinutes}
                    onChange={(e) =>
                      setDraft({
                        ...draft,
                        modes: {
                          ...draft.modes,
                          [mode]: {
                            ...value,
                            dailyMinutes: Number(e.target.value),
                          },
                        },
                      })
                    }
                  />
                </Field>
              </div>
            ))}
          </div>
          <Field label="Family time zone">
            <input
              required
              value={draft.timezone}
              onChange={(e) => setDraft({ ...draft, timezone: e.target.value })}
            />
          </Field>
          <div className="form-columns">
            <Field label="Daily API limit ($)">
              <input
                type="number"
                min={0}
                step="0.01"
                value={draft.dailySpendCapCents / 100}
                onChange={(e) =>
                  setDraft({
                    ...draft,
                    dailySpendCapCents: Math.round(
                      Number(e.target.value) * 100
                    ),
                  })
                }
              />
            </Field>
            <Field label="Monthly API limit ($)">
              <input
                type="number"
                min={0}
                step="0.01"
                value={draft.monthlySpendCapCents / 100}
                onChange={(e) =>
                  setDraft({
                    ...draft,
                    monthlySpendCapCents: Math.round(
                      Number(e.target.value) * 100
                    ),
                  })
                }
              />
            </Field>
            <Field label="Monthly reset day">
              <input
                type="number"
                min={1}
                max={28}
                required
                value={draft.monthlyResetDay}
                onChange={(e) =>
                  setDraft({
                    ...draft,
                    monthlyResetDay: Number(e.target.value),
                  })
                }
              />
            </Field>
          </div>
        </details>
        <Feedback action={action} />
        <Submit busy={action.busy}>Save limits &amp; preferences</Submit>
      </form>
    </section>
  );
}

export function SearchSettings({
  dashboard,
  onRefresh,
}: {
  dashboard: ParentDashboardSummary;
  onRefresh: () => Promise<void>;
}) {
  const action = useAction(),
    [url, setUrl] = useState(
      dashboard.providerSettings.searchApiUrl ||
        'https://api.search.brave.com/res/v1/web/search'
    ),
    [key, setKey] = useState(''),
    [searchService, setSearchService] = useState<'brave' | 'searxng'>(
      dashboard.providerSettings.searchApiUrl &&
        !dashboard.providerSettings.searchApiUrl.includes('brave.com')
        ? 'searxng'
        : 'brave'
    ),
    [enabled, setEnabled] = useState(
      Boolean(
        dashboard.policy.allowExternalSearch ||
          dashboard.providerSettings.hasSearchApiKey
      )
    );

  const isBrave = searchService === 'brave' || url.includes('brave.com');

  return (
    <section className="surface">
      <h2>Web research</h2>
      <p>
        Search queries go to your configured search service. Search-result
        excerpts are then sent to the AI to help answer the question.
      </p>
      <p className="muted">
        Connect either <strong>Brave Search API</strong> (2,000 free searches/month with zero hosting) or a private <strong>SearXNG</strong> JSON service.
      </p>

      {/* Search Provider Selector Tabs */}
      <div style={{ display: 'flex', gap: '10px', marginBottom: '20px', flexWrap: 'wrap' }}>
        <button
          type="button"
          className={isBrave ? 'primary' : ''}
          onClick={() => {
            setSearchService('brave');
            setUrl('https://api.search.brave.com/res/v1/web/search');
          }}
        >
          🦁 Brave Search API (Recommended)
        </button>
        <button
          type="button"
          className={!isBrave ? 'primary' : ''}
          onClick={() => {
            setSearchService('searxng');
            if (url.includes('brave.com') || !url) setUrl('http://searxng:8080/search');
          }}
        >
          🔍 Private SearXNG JSON
        </button>
      </div>

      {isBrave && (
        <div className="provider-policy-card policy-allowed" style={{ marginBottom: '16px' }}>
          <strong>Brave Search API: </strong>
          <span>Provides independent web index with zero tracking. Free tier includes 2,000 free queries per month.</span>
          <p className="policy-links" style={{ margin: '8px 0 0 0' }}>
            <a href="https://brave.com/search/api/" target="_blank" rel="noopener noreferrer">
              Get free Brave Search API key at brave.com/search/api ↗
            </a>
          </p>
        </div>
      )}

      <form
        id="research-settings"
        onSubmit={(e) => {
          e.preventDefault();
          void action.run(async () => {
            if (isBrave && enabled && !key && !dashboard.providerSettings.hasSearchApiKey) {
              throw new Error('Please enter your Brave Search API key to enable web search.');
            }
            await api('/parent/providers/config', 'PUT', {
              searchApiUrl: url,
              searchApiKey: key || undefined,
            });
            setKey('');
            if (enabled) {
              const test = await api('/parent/search/test', 'POST');
              if (!test.ok) throw new Error(test.message);
            }
            await api('/parent/policy', 'PUT', {
              allowExternalSearch: enabled,
            });
            await onRefresh();
            action.setMessage(
              enabled
                ? 'Web search tested and enabled successfully.'
                : 'Web search disabled. Research uses the limited local library.'
            );
          });
        }}
      >
        <Field
          label={
            isBrave
              ? 'Brave Search API endpoint'
              : 'Search JSON endpoint'
          }
          hint={
            isBrave
              ? 'Default: https://api.search.brave.com/res/v1/web/search'
              : 'SearXNG JSON endpoint (e.g. http://searxng:8080/search or your cloud instance).'
          }
        >
          <input
            type="url"
            required={enabled}
            value={url}
            onChange={(e) => setUrl(e.target.value)}
          />
        </Field>
        <Field
          label={
            isBrave
              ? 'Brave Search subscription token (API key)'
              : 'Search API key or token'
          }
          hint={
            dashboard.providerSettings.hasSearchApiKey
              ? 'A key is saved. Leave blank to keep it.'
              : isBrave
                ? 'Required: Paste your Brave Search API key (from brave.com/search/api).'
                : 'Optional: Leave blank if your SearXNG instance does not require authentication.'
          }
        >
          <input
            type="password"
            autoComplete="off"
            placeholder={
              dashboard.providerSettings.hasSearchApiKey
                ? '••••••••••••••••'
                : 'BSA...'
            }
            value={key}
            onChange={(e) => setKey(e.target.value)}
          />
        </Field>
        <label className="check">
          <input
            type="checkbox"
            checked={enabled}
            onChange={(e) => setEnabled(e.target.checked)}
          />
          Allow web search in Research
        </label>
        <Feedback action={action} />
        <Submit busy={action.busy}>
          {enabled ? 'Test & save web search' : 'Save research settings'}
        </Submit>
      </form>
    </section>
  );
}
