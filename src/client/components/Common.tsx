import React, { useState, useRef, useEffect } from 'react';
import { BRANDING } from '../../shared/branding';
export function useAction() {
  const pending = useRef(false);
  const [busy, setBusy] = useState(false),
    [error, setError] = useState(''),
    [message, setMessage] = useState('');
  useEffect(() => {
    if (!message) return;
    const timer = setTimeout(() => setMessage(''), 6000);
    return () => clearTimeout(timer);
  }, [message]);
  async function run(task: () => Promise<void>) {
    if (pending.current) return;
    pending.current = true;
    setBusy(true);
    setError('');
    setMessage('');
    try {
      await task();
    } catch (e) {
      setError(
        e instanceof Error ? e.message : 'Something went wrong. Try again.'
      );
    } finally {
      pending.current = false;
      setBusy(false);
    }
  }
  return {
    busy,
    error,
    message,
    run,
    setMessage,
    clear: () => {
      setError('');
      setMessage('');
    },
  };
}
export function Feedback({ action }: { action: ReturnType<typeof useAction> }) {
  return (
    <>
      <div role="alert">
        {action.error && <p className="notice error">{action.error}</p>}
      </div>
      <div role="status">
        {action.message && <p className="notice success">{action.message}</p>}
        {action.busy && <p className="working">Working…</p>}
      </div>
    </>
  );
}
export function Field({
  label,
  children,
  hint,
}: {
  label: string;
  children: React.ReactElement;
  hint?: string;
}) {
  const id = React.useId();
  return (
    <div className="field">
      <label htmlFor={id}>{label}</label>
      {React.cloneElement(children as React.ReactElement<any>, { id })}
      {hint && <small>{hint}</small>}
    </div>
  );
}
export function Submit({
  busy,
  disabled = false,
  children,
}: {
  busy: boolean;
  disabled?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button className="primary" disabled={busy || disabled} type="submit">
      {busy ? 'Please wait…' : children}
    </button>
  );
}
export function PageHeading({
  eyebrow,
  title,
  children,
}: {
  eyebrow?: string;
  title: string;
  children?: React.ReactNode;
}) {
  return (
    <header className="page-heading">
      {eyebrow && <p className="eyebrow">{eyebrow}</p>}
      <h1>{title}</h1>
      {children && <p className="muted">{children}</p>}
    </header>
  );
}
// React escapes all text. Only a small Markdown subset is rendered; raw HTML is never interpreted.
export function RichText({
  text,
  sources = [],
}: {
  text: string;
  sources?: Array<{ sourceId: string }>;
}) {
  function inline(line: string) {
    return line.split(/(\*\*[^*]+\*\*|\[src_\d+\])/g).map((part, i) => {
      if (part.startsWith('**'))
        return <strong key={i}>{part.slice(2, -2)}</strong>;
      if (/^\[src_\d+\]$/.test(part)) {
        const id = part.slice(1, -1);
        return sources.some((s) => s.sourceId === id) ? (
          <a
            key={i}
            href={`#${id}`}
            className="citation"
            aria-label={`Read source ${id.replace('src_', '')}`}
          >
            {id.replace('src_', '')}
          </a>
        ) : null;
      }
      return part;
    });
  }
  return (
    <div className="prose">
      {text
        .split('\n')
        .filter(Boolean)
        .map((line, i) =>
          line.startsWith('## ') ? (
            <h3 key={i}>{inline(line.slice(3))}</h3>
          ) : line.startsWith('# ') ? (
            <h2 key={i}>{inline(line.slice(2))}</h2>
          ) : (
            <p key={i}>{inline(line)}</p>
          )
        )}
    </div>
  );
}
export const minutes = (seconds: number) =>
  seconds < 60
    ? `${Math.max(0, Math.ceil(seconds))} sec`
    : `${Math.ceil(seconds / 60)} min`;

export function Modal({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  const ref = useRef<HTMLDialogElement>(null),
    id = React.useId();
  useEffect(() => {
    const dialog = ref.current;
    dialog?.showModal();
    return () => dialog?.close();
  }, []);
  return (
    <dialog
      ref={ref}
      aria-labelledby={id}
      onCancel={onClose}
      // Ignore the stale close event from a dev StrictMode remount; only a
      // dialog that is actually closed should report it.
      onClose={() => {
        if (!ref.current?.open) onClose();
      }}
    >
      <div className="dialog-heading">
        <h2 id={id}>{title}</h2>
        <button
          autoFocus
          className="dialog-close"
          aria-label="Close dialog"
          onClick={onClose}
        >
          Close
        </button>
      </div>
      {children}
    </dialog>
  );
}

export function Brand({ name }: { name?: string } = {}) {
  const displayName = name || BRANDING.shortName;
  return (
    <span className="brand modern-brand">
      <span className="modern-brand-mark" aria-hidden="true">
        <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M11 20A7 7 0 0 1 9.8 6.1C15.5 5 17 4.48 19 2c1 2 2 4.18 2 8 0 5.5-4.78 10-10 10Z" />
          <path d="M2 21c0-3 1.85-5.36 5.08-6C9.5 14.52 12 13 13 12" />
        </svg>
      </span>
      {displayName}
    </span>
  );
}

/**
 * Shown right where a child would act (next to a disabled button) so a blocked
 * composer always explains itself and offers the extra-time request in place.
 */
export function BlockNote({
  block,
  onRequestTime,
}: {
  block: string | null;
  onRequestTime?: () => void;
}) {
  if (!block) return null;
  return (
    <div className="block-note" role="status">
      <p>{block}</p>
      {onRequestTime && (
        <button type="button" className="sunset" onClick={onRequestTime}>
          Ask a grown-up for more time
        </button>
      )}
    </div>
  );
}
