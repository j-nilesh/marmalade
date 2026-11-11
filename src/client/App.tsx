import React, { useEffect, useState } from 'react';
import { api, setCsrf } from './api';
import {
  Brand,
  Field,
  Feedback,
  PageHeading,
  Submit,
  useAction,
} from './components/Common';
import { ParentWorkspace } from './components/Parent';
import { ChildWorkspace } from './components/Child';
import { LandingPage } from './components/LandingPage';
import { BRANDING } from '../shared/branding';
import type { UserPublic } from '../shared/types';

type Bootstrap = {
  initialized: boolean;
  user: UserPublic | null;
  csrfToken: string | null;
  policy: any;
  quota: any;
};
export function App() {
  const [boot, setBoot] = useState<Bootstrap | null>(null),
    [error, setError] = useState(''),
    [expired, setExpired] = useState(false);
  const [fresh, setFresh] = useState(false);
  const [landingView, setLandingView] = useState<'signin' | 'about'>(() => {
    if (typeof window !== 'undefined') {
      const hash = window.location.hash.toLowerCase();
      const search = window.location.search.toLowerCase();
      if (
        hash === '#about' ||
        hash === '#manifesto' ||
        search.includes('about')
      ) {
        return 'about';
      }
    }
    return 'signin';
  });
  async function load() {
    try {
      const b = await api<Bootstrap>('/bootstrap');
      setCsrf(b.csrfToken || '');
      setBoot(b);
      setError('');
    } catch (e) {
      setError((e as Error).message);
    }
  }
  useEffect(() => {
    void load();
    const expire = () => setExpired(true);
    window.addEventListener('marmalade-session-expired', expire);
    window.addEventListener('sprout-session-expired', expire);
    return () => {
      window.removeEventListener('marmalade-session-expired', expire);
      window.removeEventListener('sprout-session-expired', expire);
    };
  }, []);
  async function signOut() {
    await api('/auth/logout', 'POST');
    if (boot?.user) {
      sessionStorage.removeItem(`marmalade-workspace-${boot.user.id}`);
      sessionStorage.removeItem(`sprout-workspace-${boot.user.id}`);
    }
    setExpired(false);
    setFresh(false);
    await load();
  }
  async function authenticated(isSetup = false) {
    setExpired(false);
    setFresh(isSetup);
    await load();
  }
  if (!boot)
    return (
      <main className="auth-shell th-modern">
        <PageHeading title={BRANDING.productName}>
          A treehouse for big questions.
        </PageHeading>
        {error ? (
          <>
            <p role="alert">{error}</p>
            <button onClick={load}>Try again</button>
          </>
        ) : (
          <p role="status">Opening the treehouse…</p>
        )}
      </main>
    );
  if (landingView === 'about') {
    return (
      <LandingPage
        onSignIn={() => setLandingView('signin')}
        instanceName={boot.policy?.instanceDisplayName || undefined}
      />
    );
  }
  if (!boot.initialized)
    return (
      <div className="auth-shell setup-shell th-modern">
        <div className="auth-nav">
          <Brand />
        </div>
        <FamilySetup onDone={() => authenticated(true)} />
      </div>
    );
  if (!boot.user)
    return (
      <div className="auth-shell signin-shell th-modern">
        <div className="auth-nav">
          <Brand
            name={boot.policy?.instanceDisplayName || undefined}
          />
          <button
            type="button"
            className="button-link"
            onClick={() => setLandingView('about')}
          >
            What is {boot.policy?.instanceDisplayName || BRANDING.productName}?
          </button>
        </div>
        <div className="signin-grid">
          <SignIn onDone={() => authenticated()} />
        </div>
      </div>
    );
  return (
    <>
      <a className="skip-link" href="#main-content">
        Skip to main content
      </a>
      <div inert={expired ? true : undefined}>
        {boot.user.role === 'parent' ? (
          <ParentWorkspace
            key={boot.user.id}
            user={boot.user}
            fresh={fresh}
            onSignOut={signOut}
          />
        ) : (
          <ChildWorkspace
            key={boot.user.id}
            user={boot.user}
            initial={boot}
            onSignOut={signOut}
          />
        )}
      </div>
      {expired && (
        <div className="modal-backdrop">
          <section
            className="modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="expired-title"
          >
            <h1 id="expired-title">Sign in to continue</h1>
            <p>
              Your session locked. Your unsaved settings are still on this
              screen.
            </p>
            <SignIn onDone={() => authenticated()} />
          </section>
        </div>
      )}
    </>
  );
}
function SignIn({ onDone }: { onDone: () => Promise<void> }) {
  const action = useAction();
  const [username, setUsername] = useState(''),
    [password, setPassword] = useState(''),
    [show, setShow] = useState(false);
  return (
    <section>
      <PageHeading title="Welcome back!">
        Sign in with your own name and password.
      </PageHeading>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          void action.run(async () => {
            await api('/auth/login', 'POST', { username, password });
            await onDone();
          });
        }}
      >
        <Field label="Username">
          <input
            autoFocus
            autoComplete="username"
            required
            value={username}
            onChange={(e) => setUsername(e.target.value)}
          />
        </Field>
        <Field label="Password">
          <input
            type={show ? 'text' : 'password'}
            autoComplete="current-password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </Field>
        <label className="check">
          <input
            type="checkbox"
            checked={show}
            onChange={(e) => setShow(e.target.checked)}
          />
          Show password
        </label>
        <Feedback action={action} />
        <Submit busy={action.busy}>Sign in</Submit>
      </form>
    </section>
  );
}
function FamilySetup({ onDone }: { onDone: () => Promise<void> }) {
  const action = useAction();
  const [data, setData] = useState({
    parentUsername: 'parent',
    parentDisplayName: 'Parent',
    parentPassword: '',
    childUsername: 'explorer',
    childDisplayName: '',
    childPassword: '',
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
  });
  function input(key: keyof typeof data) {
    return {
      value: data[key],
      onChange: (e: React.ChangeEvent<HTMLInputElement>) =>
        setData({ ...data, [key]: e.target.value }),
    };
  }
  return (
    <section>
      <PageHeading
        eyebrow="Family setup · 1 of 5"
        title="A space to explore, together"
      >
        Create separate logins for you and your child. Next, we’ll connect AI
        and choose sensible limits.
      </PageHeading>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          void action.run(async () => {
            if (data.timezone) {
              try {
                new Intl.DateTimeFormat(undefined, { timeZone: data.timezone.trim() });
              } catch {
                throw new Error(
                  `"${data.timezone}" is not a recognized time zone (e.g. America/New_York, Europe/London, Asia/Kolkata).`
                );
              }
            }
            await api('/setup', 'POST', data);
            await onDone();
          });
        }}
      >
        <div className="form-columns">
          <fieldset>
            <legend>Your parent account</legend>
            <Field label="Username">
              <input
                required
                autoComplete="username"
                {...input('parentUsername')}
              />
            </Field>
            <Field label="Your name">
              <input required {...input('parentDisplayName')} />
            </Field>
            <Field label="Password" hint="At least 8 characters">
              <input
                type="password"
                minLength={8}
                required
                autoComplete="new-password"
                {...input('parentPassword')}
              />
            </Field>
          </fieldset>
          <fieldset>
            <legend>Your child’s account</legend>
            <Field label="Username">
              <input required {...input('childUsername')} />
            </Field>
            <Field label="Nickname">
              <input required {...input('childDisplayName')} />
            </Field>
            <Field label="Password" hint="At least 6 characters">
              <input
                type="password"
                minLength={6}
                required
                autoComplete="new-password"
                {...input('childPassword')}
              />
            </Field>
          </fieldset>
        </div>
        <Field
          label="Family time zone"
          hint="Daily allowances reset at midnight here."
        >
          <input required {...input('timezone')} />
        </Field>
        <p className="privacy-note">
          Your household settings and saved work stay on this installation. If
          you choose cloud AI or web search, submitted content is sent to those
          services. We’ll explain that before you connect.
        </p>
        <Feedback action={action} />
        <Submit busy={action.busy}>Create family accounts</Submit>
      </form>
    </section>
  );
}
