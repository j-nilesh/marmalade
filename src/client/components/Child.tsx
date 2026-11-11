import React, { useEffect, useRef, useState } from 'react';
import { api, ApiError } from '../api';
import { Brand, Modal } from './Common';
import { SavedReader } from './SavedReader';
import { getWorkspaceTitle } from '../../shared/branding';
import { Feedback, Field, Submit, minutes, useAction } from './Common';
import type {
  ActivityMode,
  PolicyConfig,
  QuotaStatusSummary,
  UserPublic,
} from '../../shared/types';
import { AskActivity } from './AskActivity';
import { ResearchActivity } from './ResearchActivity';
import { SchoolworkActivity } from './SchoolworkActivity';
import { PlayActivity } from './PlayActivity';
import { GingerCat } from './Cat';
import {
  LineIcons,
  ChestIcon,
  LanternIcon,
  MapIcon,
  NoteArt,
  TreasureChestArt,
  roomArt,
} from './Illustrations';
type Session = any;
type Note = {
  id: number;
  subject: string;
  summary: string;
  concepts: string[];
  uncertainties: string[];
};
type Work = { id: number; title: string; content: string; mode: ActivityMode };
type View = ActivityMode | 'saved' | 'home';

/** Room names for the treehouse map. Internal modes and API paths are unchanged. */
export const ROOMS: Record<
  ActivityMode | 'saved',
  { name: string; short: string; tag: string; intro: string }
> = {
  ask: {
    name: 'The Question Room',
    short: 'Question Room',
    tag: 'Wonder about anything',
    intro:
      'Ask about anything you’re curious about. Short answers, room for your own ideas.',
  },
  research: {
    name: 'The Field Guide',
    short: 'Field Guide',
    tag: 'Find out, with proof',
    intro:
      'Look something up and see where the answer came from, so you can check it yourself.',
  },
  schoolwork: {
    name: 'The Study Nook',
    short: 'Study Nook',
    tag: 'Your ideas come first',
    intro:
      'Bring your homework and what you’ve tried. We’ll work out the next step together — you do the thinking.',
  },
  play: {
    name: 'The Game Loft',
    short: 'Game Loft',
    tag: 'Trivia, guessing & stories',
    intro: 'Quick games and stories with a beginning and an ending.',
  },
  saved: {
    name: 'The Treasure Chest',
    short: 'Treasure Chest',
    tag: 'Things you chose to keep',
    intro: 'Everything you put in the chest. Read it again, change it, or take a copy.',
  },
};
const MODES: ActivityMode[] = ['ask', 'research', 'schoolwork', 'play'];
const WARN_SECONDS = 5 * 60;

export function ChildWorkspace({
  user,
  initial,
  onSignOut,
}: {
  user: UserPublic;
  initial: { quota: QuotaStatusSummary; policy: PolicyConfig };
  onSignOut: () => Promise<void>;
}) {
  const storageKey = `marmalade-workspace-${user.id}`;
  const legacyStorageKey = `sprout-workspace-${user.id}`;
  const [view, setView] = useState<View>('home'),
    [play, setPlay] = useState('trivia'),
    [sessions, setSessions] = useState<Record<string, Session>>({}),
    [quota, setQuota] = useState(initial.quota),
    [policy, setPolicy] = useState(initial.policy);
  const [artifacts, setArtifacts] = useState<Work[]>([]),
    [notes, setNotes] = useState<Note[]>([]),
    [requests, setRequests] = useState<any[]>([]),
    [recovery, setRecovery] = useState(''),
    [recovered, setRecovered] = useState(false);
  const action = useAction();
  const [filter, setFilter] = useState<ActivityMode | 'all' | 'notes'>('all');
  const [save, setSave] = useState<{
      title: string;
      content: string;
      mode: ActivityMode;
      activityType: string;
    } | null>(null),
    [extra, setExtra] = useState(false),
    [extraMode, setExtraMode] = useState<ActivityMode | 'global'>('ask'),
    [extraMinutes, setExtraMinutes] = useState(15),
    [reason, setReason] = useState('');
  const [reviewNote, setReviewNote] = useState<{
      subject: string;
      summary: string;
    } | null>(null),
    [opened, setOpened] = useState<{
      kind: 'note' | 'work';
      id: number;
    } | null>(null),
    [deletion, setDeletion] = useState<{
      kind: 'note' | 'work';
      id: number;
      title: string;
    } | null>(null);
  const [showParentVisibility, setShowParentVisibility] = useState(false);
  const [showFirstRunExplainer, setShowFirstRunExplainer] = useState(
    Boolean(user && !user.seenFirstRunExplainer)
  );
  const interacted = useRef(false);
  const mainRef = useRef<HTMLElement>(null);
  async function refresh() {
    const [q, l] = await Promise.all([api('/quota'), api('/ledger')]);
    setQuota(q.quota);
    setPolicy(q.policy);
    setArtifacts(q.artifacts);
    setRequests(q.extensionRequests);
    setNotes(l.ledger);
  }
  useEffect(() => {
    void action.run(async () => {
      await refresh();
      let stored: any;
      try {
        stored = JSON.parse(
          sessionStorage.getItem(storageKey) ||
            sessionStorage.getItem(legacyStorageKey) ||
            'null'
        );
      } catch {
        sessionStorage.removeItem(storageKey);
        sessionStorage.removeItem(legacyStorageKey);
      }
      if (stored) {
        if (
          ['home', 'ask', 'research', 'schoolwork', 'play', 'saved'].includes(
            stored.view
          )
        )
          setView(stored.view);
        if (['trivia', '20q', 'story'].includes(stored.play))
          setPlay(stored.play);
        const restored: Record<string, Session> = {};
        for (const [key, id] of Object.entries(stored.ids || {})) {
          try {
            const result = await api(
              `/sessions/${encodeURIComponent(String(id))}`
            );
            restored[key] = result.session;
          } catch (e) {
            if (e instanceof ApiError && e.status === 404)
              setRecovery(
                'Your last unfinished activity had a nap and closed — rooms tidy up after 15 quiet minutes. Anything in your treasure chest is safe.'
              );
            else throw e;
          }
        }
        setSessions(restored);
      }
      setRecovered(true);
    });
  }, []);
  useEffect(() => {
    if (recovered)
      sessionStorage.setItem(
        storageKey,
        JSON.stringify({
          view,
          play,
          ids: Object.fromEntries(
            Object.entries(sessions).map(([key, s]) => [key, s.sessionId])
          ),
        })
      );
  }, [view, play, sessions, recovered]);
  useEffect(() => {
    // Activity time is only counted inside a room, never on the map or in the chest.
    if (view === 'saved' || view === 'home') return;
    const mark = () => {
      interacted.current = true;
    };
    window.addEventListener('pointerdown', mark);
    window.addEventListener('keydown', mark);
    const timer = setInterval(() => {
      if (document.visibilityState !== 'visible') return;
      const userInteracted = interacted.current;
      interacted.current = false;
      void api('/quota/heartbeat', 'POST', {
        mode: view,
        userInteracted,
      })
        .then((q) => setQuota(q.quota))
        .catch(() => {});
    }, 15000);
    return () => {
      clearInterval(timer);
      window.removeEventListener('pointerdown', mark);
      window.removeEventListener('keydown', mark);
    };
  }, [view]);
  const key = view === 'play' ? play : view,
    session = sessions[key];
  function change(next: View) {
    setView(next);
    setOpened(null);
    action.clear();
    setRecovery('');
    setReviewNote(null);
    requestAnimationFrame(() => {
      window.scrollTo({ top: 0 });
      mainRef.current?.focus({ preventScroll: true });
    });
  }
  function accept(result: any, sessionKey = key) {
    if (result.quota) setQuota(result.quota);
    if (result.session)
      setSessions((s) => ({ ...s, [sessionKey]: result.session }));
    if (result.ledger) setNotes(result.ledger);
  }
  async function turn(path: string, body?: unknown, sessionKey = key) {
    try {
      const r = await api(path, 'POST', body);
      accept(r, sessionKey);
      return r;
    } catch (error) {
      if (error instanceof ApiError && error.payload?.quota)
        setQuota(error.payload.quota);
      if (error instanceof ApiError && error.status === 404) {
        setSessions((current) => {
          const next = { ...current };
          delete next[sessionKey];
          return next;
        });
        setRecovery(
          'This activity closed after a quiet spell. Start a new one whenever you like — your treasure chest is safe.'
        );
      }
      throw error;
    }
  }
  function clearActivity() {
    setSessions((s) => {
      const next = { ...s };
      delete next[key];
      return next;
    });
    setReviewNote(null);
    action.clear();
  }
  const inRoom = view !== 'saved' && view !== 'home';
  const mode: ActivityMode = inRoom ? (view as ActivityMode) : 'ask';
  const modeQuota = quota.modes[mode];
  const breakAt = quota.cooldownEndsAtMs
    ? new Date(quota.cooldownEndsAtMs).toLocaleTimeString([], {
        hour: 'numeric',
        minute: '2-digit',
      })
    : null;
  function blockFor(m: ActivityMode): string | null {
    const mq = quota.modes[m];
    return !recovered
      ? 'Opening the treehouse…'
      : !mq.enabled
        ? 'This room is closed for now — a grown-up turned it off. You can still visit your treasure chest.'
        : quota.globalRemainingSeconds <= 0
          ? 'That’s all your treehouse time for today. You can still save what you made, or ask for a little more.'
          : mq.remainingSeconds <= 0
            ? `That’s all your ${ROOMS[m].short} time for today. You can still save what you made, or ask for a little more.`
            : quota.continuousRemainingSeconds <= 0
              ? `Stretch break! Time to climb down for ${quota.cooldownMinutes} minutes. ${breakAt ? `Come back at ${breakAt}.` : 'The rooms open again after the break.'} You can still read and save.`
              : null;
  }
  const block = blockFor(mode);
  const canRequest = quota.continuousRemainingSeconds > 0;
  function requestTime(m: ActivityMode | 'global' = mode) {
    setExtraMode(m);
    setExtra(true);
  }
  const requestHandler = canRequest ? () => requestTime() : undefined;

  const ask = sessions.ask,
    research = sessions.research,
    school = sessions.schoolwork;
  function waiting(m: ActivityMode): boolean {
    if (m === 'play')
      return ['trivia', '20q', 'story'].some(
        (k) => sessions[k] && sessions[k].status === 'active'
      );
    const s = sessions[m];
    if (!s) return false;
    if (m === 'research') return true;
    return s.status ? s.status === 'active' : true;
  }
  const filteredArtifacts = artifacts.filter(
    (work) => filter === 'all' || work.mode === filter
  );
  const openedNote =
      opened?.kind === 'note'
        ? notes.find((n) => n.id === opened.id)
        : undefined,
    openedWork =
      opened?.kind === 'work'
        ? artifacts.find((w) => w.id === opened.id)
        : undefined;
  function saveWork(title: string, content: string) {
    setSave({ title, content, mode, activityType: key });
  }
  const pendingRequest = requests.find((r) => r.status === 'pending');
  const firstName = user.displayName?.trim() || 'explorer';
  const Art = view !== 'home' ? roomArt[view] : null;
  return (
    <div className="treehouse th-modern">
      <header className="canopy">
        <div className="canopy-left">
          <button
            type="button"
            className="brand-button"
            onClick={() => change('home')}
            aria-label="Back to the treehouse map"
          >
            <Brand />
          </button>
          {view !== 'home' && (
            <button
              type="button"
              className="map-button"
              onClick={() => change('home')}
            >
              <MapIcon /> Map
            </button>
          )}
        </div>
        <Lantern
          quota={quota}
          mode={inRoom ? mode : null}
          block={inRoom ? block : null}
          pendingRequest={Boolean(pendingRequest)}
          modern
          onRequest={canRequest ? requestTime : undefined}
          onRefresh={() => action.run(refresh)}
        />
        <details className="canopy-menu">
          <summary aria-label="More options">
            <span aria-hidden="true">☰</span>
            <span className="canopy-menu-name">{firstName}</span>
          </summary>
          <div className="canopy-menu-panel">
            <p className="muted">
              {getWorkspaceTitle(policy.instanceDisplayName, user.displayName)}
            </p>
            <button type="button" onClick={() => setShowParentVisibility(true)}>
              What can my grown-up see?
            </button>
            <button type="button" onClick={() => action.run(onSignOut)}>
              Sign out
            </button>
          </div>
        </details>
      </header>
      <main
        className={`room room-${view}`}
        id="main-content"
        ref={mainRef}
        tabIndex={-1}
      >
        {policy.activeProvider === 'mock' && (
          <p className="demo-label">
            Practice mode · These are pretend example answers, not a real AI.
          </p>
        )}
        {recovery && (
          <p role="status" className="notice">
            {recovery}
          </p>
        )}
        <Feedback action={action} />
        {!recovered && action.error && (
          <button onClick={() => window.location.reload()}>
            Try opening the treehouse again
          </button>
        )}

        {view === 'home' && (
          <>
            <header className="map-heading">
              <p className="eyebrow">
                {getWorkspaceTitle(policy.instanceDisplayName, user.displayName)}
              </p>
              <h1>Hi {firstName}! Where to today?</h1>
              <p className="muted">Pick a room. You can come back to the map any time.</p>
              <GingerCat treasures={artifacts.length + notes.length} />
            </header>
            <ul className="room-grid" aria-label="Treehouse rooms">
              {MODES.map((m) => {
                const RoomIcon = LineIcons[m];
                const closed = !quota.modes[m].enabled;
                const isWaiting = waiting(m);
                return (
                  <li key={m}>
                    <button
                      type="button"
                      className={`room-card room-card-${m}`}
                      onClick={() => change(m)}
                      aria-describedby={`room-${m}-tag`}
                    >
                      <span className="room-card-icon">
                        <RoomIcon size={30} />
                      </span>
                      <span className="room-card-arrow" aria-hidden="true">
                        <LineIcons.arrow size={20} />
                      </span>
                      <span className="room-card-name">{ROOMS[m].name}</span>
                      <span className="room-card-tag" id={`room-${m}-tag`}>
                        {ROOMS[m].tag}
                        {isWaiting && (
                          <span className="sr-only">
                            {' '}
                            · Still waiting in here
                          </span>
                        )}
                        {closed && <span className="sr-only"> · Closed for now</span>}
                      </span>
                      {isWaiting && (
                        <span className="waiting-badge" aria-hidden="true">
                          Still waiting in here
                        </span>
                      )}
                      {closed && (
                        <span className="closed-badge" aria-hidden="true">
                          Closed for now
                        </span>
                      )}
                    </button>
                  </li>
                );
              })}
              <li className="room-grid-chest">
                <button
                  type="button"
                  className="room-card room-card-saved"
                  onClick={() => change('saved')}
                  aria-describedby="room-saved-tag"
                >
                  <span className="room-card-icon">
                    <LineIcons.saved size={30} />
                  </span>
                  <span className="room-card-arrow" aria-hidden="true">
                    <LineIcons.arrow size={20} />
                  </span>
                  <span className="room-card-name">{ROOMS.saved.name}</span>
                  <span className="room-card-tag" id="room-saved-tag">
                    {artifacts.length + notes.length === 0
                      ? 'Empty for now — fill it with good finds'
                      : `${artifacts.length + notes.length} treasure${artifacts.length + notes.length === 1 ? '' : 's'} inside`}
                  </span>
                </button>
              </li>
            </ul>
          </>
        )}

        {view !== 'home' && Art && (
          <header className="room-heading">
            <Art className="room-heading-art" />
            <div>
              <h1>{ROOMS[view].name}</h1>
              <p className="muted">{ROOMS[view].intro}</p>
              {inRoom && (
                <p className="ai-honest">
                  <span aria-hidden="true">✦ </span>
                  Answers here come from an AI, not a person. It can get things
                  wrong, so check anything important with a grown-up or a book.
                </p>
              )}
            </div>
          </header>
        )}

        {view === 'ask' && (
          <AskActivity
            ask={ask}
            block={block}
            turn={turn}
            saveWork={saveWork}
            onClear={clearActivity}
            setPlay={setPlay}
            change={change}
            onRequestTime={requestHandler}
          />
        )}
        {view === 'research' && (
          <ResearchActivity
            research={research}
            policy={policy}
            block={block}
            turn={turn}
            saveWork={saveWork}
            onRequestTime={requestHandler}
          />
        )}
        {view === 'schoolwork' && (
          <SchoolworkActivity
            school={school}
            block={block}
            turn={turn}
            saveWork={saveWork}
            onClear={clearActivity}
            setReviewNote={setReviewNote}
            onRequestTime={requestHandler}
          />
        )}
        {view === 'play' && (
          <PlayActivity
            play={play}
            setPlay={setPlay}
            session={session}
            sessions={sessions}
            block={block}
            turn={turn}
            saveWork={saveWork}
            onClear={clearActivity}
            onRequestTime={requestHandler}
          />
        )}
        {view === 'saved' && (
          <>
            {openedNote || openedWork ? (
              <SavedReader
                item={openedNote || openedWork!}
                kind={openedNote ? 'note' : 'work'}
                onBack={() => setOpened(null)}
                onSave={async (data) => {
                  await api(
                    openedNote
                      ? `/ledger/${openedNote.id}`
                      : `/artifacts/${openedWork!.id}`,
                    'PUT',
                    data
                  );
                  await refresh();
                }}
              />
            ) : (
              <>
                <div
                  className="chip-row"
                  role="group"
                  aria-label="Show treasures from"
                >
                  {(
                    [
                      ['all', 'Everything'],
                      ...MODES.map((m) => [m, ROOMS[m].short]),
                      ['notes', 'Learning notes'],
                    ] as Array<[typeof filter, string]>
                  ).map(([id, label]) => (
                    <button
                      key={id}
                      type="button"
                      className="chip"
                      aria-pressed={filter === id}
                      onClick={() => setFilter(id)}
                    >
                      {label}
                    </button>
                  ))}
                </div>
                {(filter === 'all' || filter === 'notes') && (
                  <section aria-labelledby="notes-heading">
                    <div className="section-heading">
                      <h2 id="notes-heading">Learning notes</h2>
                      {notes.length > 0 && (
                        <a className="button-link" href="/api/ledger/export">
                          Download my notes
                        </a>
                      )}
                    </div>
                    {!notes.length ? (
                      <EmptyChest>
                        No learning notes yet. After a Study Nook session you
                        can choose to keep one here.
                      </EmptyChest>
                    ) : (
                      <ul className="treasure-grid">
                        {notes.map((n) => (
                          <TreasureCard
                            key={`n${n.id}`}
                            kind="note"
                            title={n.subject}
                            label="Learning note"
                            snippet={n.summary}
                            onOpen={() => setOpened({ kind: 'note', id: n.id })}
                            onDelete={() =>
                              setDeletion({
                                kind: 'note',
                                id: n.id,
                                title: n.subject,
                              })
                            }
                          />
                        ))}
                      </ul>
                    )}
                  </section>
                )}
                {filter !== 'notes' && (
                  <section aria-labelledby="works-heading">
                    <h2 id="works-heading">Answers, finds, and creations</h2>
                    {!filteredArtifacts.length ? (
                      <EmptyChest>
                        {filter === 'all'
                          ? 'Nothing in here yet. When you get a great answer or finish a story, press “Put this in the chest”.'
                          : `Nothing from the ${ROOMS[filter as ActivityMode].short} yet.`}
                      </EmptyChest>
                    ) : (
                      <ul className="treasure-grid">
                        {filteredArtifacts.map((w) => (
                          <TreasureCard
                            key={`w${w.id}`}
                            kind={w.mode}
                            title={w.title}
                            label={ROOMS[w.mode]?.short ?? w.mode}
                            snippet={w.content}
                            onOpen={() => setOpened({ kind: 'work', id: w.id })}
                            onDelete={() =>
                              setDeletion({
                                kind: 'work',
                                id: w.id,
                                title: w.title,
                              })
                            }
                          />
                        ))}
                      </ul>
                    )}
                  </section>
                )}
              </>
            )}
            <details className="soft-details">
              <summary>My extra-time asks</summary>
              {requests.length ? (
                requests.map((r) => (
                  <p key={r.id}>
                    +{r.requestedMinutes} min ·{' '}
                    {r.requestedMode === 'global'
                      ? 'whole treehouse'
                      : ROOMS[r.requestedMode as ActivityMode]?.short ??
                        r.requestedMode}{' '}
                    ·{' '}
                    {r.status === 'pending'
                      ? 'waiting for a grown-up'
                      : r.status === 'approved'
                        ? 'yes!'
                        : r.status === 'denied'
                          ? 'not this time'
                          : r.status}
                  </p>
                ))
              ) : (
                <p>No asks yet.</p>
              )}
            </details>
          </>
        )}
        {save && (
          <Modal title="Put this in your treasure chest" onClose={() => setSave(null)}>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                void action.run(async () => {
                  await api('/artifacts', 'POST', save);
                  await refresh();
                  setSave(null);
                  action.setMessage(
                    'Tucked into your treasure chest! Find it from the map any time.'
                  );
                });
              }}
            >
              <Field label="Give it a name">
                <input
                  autoFocus
                  required
                  value={save.title}
                  onChange={(e) => setSave({ ...save, title: e.target.value })}
                />
              </Field>
              <Field label="What’s inside (you can change it)">
                <textarea
                  required
                  rows={8}
                  value={save.content}
                  onChange={(e) =>
                    setSave({ ...save, content: e.target.value })
                  }
                />
              </Field>
              <Feedback action={action} />
              <Submit busy={action.busy}>
                <ChestIcon /> Put it in the chest
              </Submit>
            </form>
          </Modal>
        )}
        {reviewNote && school && (
          <Modal
            title="Keep a learning note?"
            onClose={() => setReviewNote(null)}
          >
            <p>Only keep it if it feels useful. You can change or remove it later.</p>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                void action.run(async () => {
                  accept(
                    await api(
                      `/schoolwork/${school.sessionId}/approve-ledger`,
                      'POST',
                      reviewNote
                    )
                  );
                  setSessions((s) => ({
                    ...s,
                    schoolwork: { ...s.schoolwork, ledgerSaved: true },
                  }));
                  setReviewNote(null);
                  action.setMessage('Learning note is in your treasure chest.');
                });
              }}
            >
              <Field label="Subject">
                <input
                  required
                  value={reviewNote.subject}
                  onChange={(e) =>
                    setReviewNote({ ...reviewNote, subject: e.target.value })
                  }
                />
              </Field>
              <Field label="What I learned">
                <textarea
                  required
                  value={reviewNote.summary}
                  onChange={(e) =>
                    setReviewNote({ ...reviewNote, summary: e.target.value })
                  }
                />
              </Field>
              <Feedback action={action} />
              <Submit busy={action.busy}>
                <ChestIcon /> Keep my note
              </Submit>
            </form>
          </Modal>
        )}
        {extra && (
          <Modal title="Ask for more time" onClose={() => setExtra(false)}>
            <p className="muted">
              This sends a little note to your grown-up. They can say yes from
              their side.
            </p>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                void action.run(async () => {
                  await api('/extensions/request', 'POST', {
                    requestedMode: extraMode,
                    requestedMinutes: extraMinutes,
                    reasonNote: reason,
                  });
                  await refresh();
                  setExtra(false);
                  setReason('');
                  action.setMessage(
                    'Sent! Your grown-up will see your ask. The lantern lights up when there’s news.'
                  );
                });
              }}
            >
              <Field label="More time for">
                <select
                  value={extraMode}
                  onChange={(e) => setExtraMode(e.target.value as any)}
                >
                  {MODES.map((id) => (
                    <option value={id} key={id}>
                      {ROOMS[id].name}
                    </option>
                  ))}
                  <option value="global">The whole treehouse today</option>
                </select>
              </Field>
              <fieldset className="minute-picker">
                <legend>How much?</legend>
                {[15, 30].map((m) => (
                  <label key={m} className="minute-option">
                    <input
                      type="radio"
                      name="extra-minutes"
                      value={m}
                      checked={extraMinutes === m}
                      onChange={() => setExtraMinutes(m)}
                    />
                    {m} minutes
                  </label>
                ))}
              </fieldset>
              <Field label="Why? (only if you want to say)">
                <input
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  maxLength={200}
                  placeholder="I’m almost done with my story!"
                />
              </Field>
              <Feedback action={action} />
              <Submit busy={action.busy}>Send my ask</Submit>
            </form>
          </Modal>
        )}
        {deletion && (
          <Modal
            title="Take this out of the chest?"
            onClose={() => setDeletion(null)}
          >
            <p>
              “{deletion.title}” will be gone for good — there’s no undo.
            </p>
            <Feedback action={action} />
            <div className="button-row">
              <button
                className="danger"
                disabled={action.busy}
                onClick={() =>
                  action.run(async () => {
                    await api(
                      `/${deletion.kind === 'note' ? 'ledger' : 'artifacts'}/${deletion.id}`,
                      'DELETE'
                    );
                    await refresh();
                    setDeletion(null);
                  })
                }
              >
                Yes, delete it
              </button>
              <button type="button" onClick={() => setDeletion(null)}>
                Keep it
              </button>
            </div>
          </Modal>
        )}
        {showParentVisibility && (
          <Modal
            title="What your grown-up can see"
            onClose={() => setShowParentVisibility(false)}
          >
            <div className="transparency-modal-content">
              <p>The treehouse is your space. Here’s exactly how it works:</p>
              <ul className="transparency-points">
                <li>
                  <strong>They set the time.</strong> Your grown-up chooses how
                  long you can spend here each day and which rooms are open.
                </li>
                <li>
                  <strong>They see the clock, not the words.</strong> They can
                  see how many minutes you spent in each room today and about
                  how much it cost.
                </li>
                <li>
                  <strong>They can’t read your conversations.</strong> Your
                  questions, stories, and chats are <strong>not</strong> shown to
                  them. There’s no way for them to scroll through what you
                  wrote.
                </li>
                <li>
                  <strong>If you might be in danger, they get a short alert.</strong>{' '}
                  If you write about something that sounds unsafe (like being
                  hurt or a stranger contacting you), they get a note saying
                  what kind of thing it was and when —{' '}
                  <em>never what you wrote</em>.
                </li>
              </ul>
              <button
                className="primary"
                type="button"
                onClick={() => setShowParentVisibility(false)}
              >
                Got it
              </button>
            </div>
          </Modal>
        )}
        {showFirstRunExplainer && (
          <Modal
            title="Welcome to the treehouse!"
            onClose={() => {
              setShowFirstRunExplainer(false);
              void api('/child/ack-explainer', 'POST');
            }}
          >
            <div className="first-run-explainer-content">
              <p>Three things to know before you climb up:</p>
              <ol className="explainer-ordered-list">
                <li>
                  <strong>You’ll be talking with an AI,</strong> a computer
                  program — not a person.
                </li>
                <li>
                  <strong>It can be wrong.</strong> Even when it sounds very
                  sure, it can make mistakes. Check important things with a
                  book, a teacher, or a grown-up you trust.
                </li>
                <li>
                  <strong>Your treehouse is private.</strong> Your grown-up
                  sets the time, but they don’t read your questions or
                  conversations.
                </li>
              </ol>
              <button
                className="primary"
                type="button"
                onClick={() => {
                  setShowFirstRunExplainer(false);
                  void api('/child/ack-explainer', 'POST');
                }}
              >
                Got it — let’s explore!
              </button>
            </div>
          </Modal>
        )}
      </main>
    </div>
  );
}

function TreasureCard({
  kind,
  title,
  label,
  snippet,
  onOpen,
  onDelete,
}: {
  kind: ActivityMode | 'note';
  title: string;
  label: string;
  snippet: string;
  onOpen: () => void;
  onDelete: () => void;
}) {
  const Art = kind === 'note' ? NoteArt : roomArt[kind] ?? NoteArt;
  const clean = snippet.replace(/[#*\[\]]/g, '').replace(/\s+/g, ' ').trim();
  return (
    <li className={`treasure-card treasure-${kind}`}>
      <button type="button" className="treasure-open" onClick={onOpen}>
        <Art className="treasure-art" />
        <span className="treasure-label">{label}</span>
        <span className="treasure-title">{title}</span>
        <span className="treasure-snippet">
          {clean.length > 120 ? `${clean.slice(0, 120)}…` : clean}
        </span>
      </button>
      <button
        type="button"
        className="treasure-delete"
        aria-label={`Delete ${title}`}
        onClick={onDelete}
      >
        Delete
      </button>
    </li>
  );
}

function EmptyChest({ children }: { children: React.ReactNode }) {
  return (
    <div className="empty-chest">
      <TreasureChestArt className="empty-chest-art" />
      <p>{children}</p>
    </div>
  );
}

/**
 * The lantern: one small time widget. It stays quiet (a glow and a short label)
 * until a threshold is near, then speaks up with the reason and the extra-time
 * ask right there. Details live in a disclosure for anyone who wants them.
 */
function Lantern({
  quota,
  mode,
  block,
  pendingRequest,
  onRequest,
  onRefresh,
  modern = false,
}: {
  quota: QuotaStatusSummary;
  mode: ActivityMode | null;
  block: string | null;
  pendingRequest: boolean;
  onRequest?: (m?: ActivityMode | 'global') => void;
  onRefresh: () => void;
  modern?: boolean;
}) {
  const modeLeft = mode ? quota.modes[mode].remainingSeconds : Infinity;
  const soonest = Math.min(
    quota.continuousRemainingSeconds,
    quota.globalRemainingSeconds,
    modeLeft
  );
  const onBreak = quota.continuousRemainingSeconds <= 0;
  const out =
    quota.globalRemainingSeconds <= 0 || (mode !== null && modeLeft <= 0);
  const warn = !onBreak && !out && soonest <= WARN_SECONDS;
  const state = onBreak ? 'break' : out ? 'out' : warn ? 'warn' : 'calm';
  const breakSoonest =
    quota.continuousRemainingSeconds <=
    Math.min(quota.globalRemainingSeconds, modeLeft);
  const short =
    state === 'break'
      ? 'Stretch break'
      : state === 'out'
        ? 'Time’s up for today'
        : state === 'warn'
          ? breakSoonest
            ? `Break in ${minutes(soonest)}`
            : `${minutes(soonest)} left`
          : pendingRequest
            ? 'Ask sent'
            : 'Lots of time';
  const announce =
    state === 'warn'
      ? breakSoonest
        ? `About ${minutes(soonest)} until a stretch break. A good moment to save anything you like.`
        : `About ${minutes(soonest)} of time left. A good moment to save anything you like.`
      : state === 'calm'
        ? ''
        : block || short;
  return (
    <div className={`lantern lantern-${state}`}>
      <details>
        <summary>
          {modern ? (
            <LineIcons.clock size={18} />
          ) : (
            <LanternIcon lit={state !== 'out' && state !== 'break'} />
          )}
          <span className="lantern-label">{short}</span>
          <span className="sr-only">· time details</span>
        </summary>
        <div className="lantern-panel">
          <p>
            <strong>{minutes(quota.globalRemainingSeconds)}</strong> left in the
            treehouse today
            {mode && (
              <>
                {' '}
                · <strong>{minutes(modeLeft)}</strong> in the{' '}
                {ROOMS[mode].short}
              </>
            )}
          </p>
          <p>
            {onBreak
              ? 'On a stretch break right now.'
              : `Next stretch break in ${minutes(quota.continuousRemainingSeconds)}.`}
          </p>
          {pendingRequest && <p>Your extra-time ask is waiting for a grown-up.</p>}
          <div className="button-row">
            {onRequest && (
              <button type="button" onClick={() => onRequest()}>
                Ask for more time
              </button>
            )}
            <button type="button" onClick={onRefresh}>
              Check again
            </button>
          </div>
        </div>
      </details>
      <div className="lantern-speech-wrap" role="status" aria-live="polite">
        {(state === 'warn' || (state !== 'calm' && !mode)) && (
          <div className="lantern-speech">
            <p>{announce}</p>
            {onRequest && state !== 'break' && (
              <button
                type="button"
                className="sunset"
                onClick={() => onRequest()}
              >
                Ask for more time
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
