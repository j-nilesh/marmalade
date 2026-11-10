import React, { useState } from 'react';
import {
  BlockNote,
  Field,
  Feedback,
  RichText,
  Submit,
  useAction,
} from './Common';
import { ChestIcon } from './Illustrations';
export function ResearchActivity({
  research,
  policy,
  block,
  turn,
  saveWork,
  onRequestTime,
}: {
  research: any;
  policy: { allowExternalSearch: boolean };
  block: string | null;
  turn: (path: string, body?: unknown) => Promise<any>;
  saveWork: (title: string, content: string) => void;
  onRequestTime?: () => void;
}) {
  const action = useAction(),
    [question, setQuestion] = useState('');
  return (
    <>
      <Feedback action={action} />
      <p className="scope-label">
        {policy.allowExternalSearch
          ? 'Web search is on. Your question goes to the family search helper to find web pages.'
          : 'Small library only. Web search is switched off, so lots of topics won’t have sources yet.'}
      </p>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          void action.run(async () => {
            await turn('/research/query', { query: question });
            setQuestion('');
          });
        }}
      >
        <Field label="What do you want to find out?">
          <input
            required
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
          />
        </Field>
        <BlockNote block={block} onRequestTime={onRequestTime} />
        <Submit busy={action.busy} disabled={!!block}>
          Search the field guide
        </Submit>
      </form>
      {research && (
        <section className="research-answer">
          <h2>{research.query}</h2>
          <p className="muted">{research.searchStatusNote}</p>
          <RichText text={research.synthesis} sources={research.sources} />
          {research.sources.length === 0 ? (
            <div className="empty-sources-notice" role="status">
              <p><strong>No sources turned up this time.</strong></p>
              <p>Things you could try:</p>
              <ul>
                <li>Ask it a different way, with simpler words</li>
                <li>Head to the <strong>Question Room</strong> to talk the topic through</li>
                <li>Ask a grown-up or teacher to help find a book or a trusted website</li>
              </ul>
            </div>
          ) : (
            <>
              <div className="section-heading">
                <h2>Where this came from</h2>
                <button
                  className="chest-button"
                  onClick={() =>
                    saveWork(
                      `Research: ${research.query}`,
                      research.notesBundle
                    )
                  }
                >
                  <ChestIcon /> Put these notes in the chest
                </button>
              </div>
              <div className="sources">
                {research.sources.map((s: any) => (
                  <article
                    tabIndex={-1}
                    className="source"
                    id={s.sourceId}
                    key={s.sourceId}
                  >
                    <span className="eyebrow">
                      Source {s.sourceId.replace('src_', '')} · {s.domain}
                    </span>
                    <h3>
                      <a href={s.url} target="_blank" rel="noopener noreferrer">
                        {s.title} ↗
                      </a>
                    </h3>
                    <p>{s.snippet}</p>
                  </article>
                ))}
              </div>
            </>
          )}
        </section>
      )}
    </>
  );
}
