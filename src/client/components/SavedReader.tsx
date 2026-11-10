import React, { useState } from 'react';
import { Field, Feedback, RichText, Submit, useAction } from './Common';
type Note = {
  id: number;
  subject: string;
  summary: string;
  concepts: string[];
  uncertainties: string[];
};
type Work = { id: number; title: string; content: string; mode: string };
export function SavedReader({
  item,
  kind,
  onBack,
  onSave,
}: {
  item: Note | Work;
  kind: 'note' | 'work';
  onBack: () => void;
  onSave: (data: any) => Promise<void>;
}) {
  const note = item as Note,
    work = item as Work,
    action = useAction(),
    [editing, setEditing] = useState(false),
    [title, setTitle] = useState(kind === 'note' ? note.subject : work.title),
    [content, setContent] = useState(
      kind === 'note' ? note.summary : work.content
    );
  return (
    <section className="saved-reader">
      <button onClick={onBack}>← Back to the chest</button>
      <h2>{title}</h2>
      {editing ? (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void action.run(async () => {
              await onSave(
                kind === 'note'
                  ? {
                      subject: title,
                      summary: content,
                      concepts: note.concepts,
                      uncertainties: note.uncertainties,
                    }
                  : { title, content }
              );
              setEditing(false);
              action.setMessage('Changes saved.');
            });
          }}
        >
          <Field label="Title">
            <input
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
          </Field>
          <Field label="Content">
            <textarea
              required
              rows={10}
              value={content}
              onChange={(e) => setContent(e.target.value)}
            />
          </Field>
          <Submit busy={action.busy}>Save changes</Submit>
          <button
            type="button"
            onClick={() => {
              setEditing(false);
              setTitle(kind === 'note' ? note.subject : work.title);
              setContent(kind === 'note' ? note.summary : work.content);
            }}
          >
            Cancel
          </button>
        </form>
      ) : (
        <>
          <RichText text={content} />
          <button onClick={() => setEditing(true)}>Edit</button>
          <a
            className="button-link"
            href={
              kind === 'note'
                ? '/api/ledger/export'
                : `/api/artifacts/${item.id}/export`
            }
          >
            Download a copy
          </a>
        </>
      )}
      <Feedback action={action} />
    </section>
  );
}
