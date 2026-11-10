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
export function AskActivity({
  ask,
  block,
  turn,
  saveWork,
  onClear,
  setPlay,
  change,
  onRequestTime,
}: {
  ask: any;
  block: string | null;
  turn: (path: string, body?: unknown) => Promise<any>;
  saveWork: (title: string, content: string) => void;
  onClear: () => void;
  setPlay: (value: string) => void;
  change: (view: 'play') => void;
  onRequestTime?: () => void;
}) {
  const action = useAction(),
    [question, setQuestion] = useState('');
  const clearActivity = () => {
    onClear();
    setQuestion('');
    action.clear();
  };
  const saveConversation = () => {
    if (!ask?.turns?.length) return;
    saveWork(
      ask.turns[0].userPrompt.slice(0, 90),
      ask.turns
        .map(
          (t: any) => `**Me:** ${t.userPrompt}\n\n${t.assistantResponse}`
        )
        .join('\n\n')
    );
  };
  const left = ask
    ? (ask.repliesRemaining ?? Math.max(0, 8 - ask.turns.length))
    : 8;
  return (
    <>
      <Feedback action={action} />
      {ask && (
        <ol className="conversation" aria-label="Your conversation">
          {ask.turns.map((t: any) => (
            <li key={t.id} className="exchange">
              <div className="message yours">
                <span className="speaker">You</span>
                <p>{t.userPrompt}</p>
              </div>
              <div className="message answer">
                <span className="speaker">AI helper</span>
                <RichText text={t.assistantResponse} />
                <div className="message-actions">
                  <button
                    className="chest-button"
                    onClick={() =>
                      saveWork(
                        t.userPrompt.slice(0, 90),
                        `${t.userPrompt}\n\n${t.assistantResponse}`
                      )
                    }
                  >
                    <ChestIcon /> Put this in the chest
                  </button>
                  {t.suggestPlayHandoff && (
                    <button
                      onClick={() => {
                        setPlay(
                          t.suggestPlayHandoff.suggestedActivity ===
                            'story_relay'
                            ? 'story'
                            : t.suggestPlayHandoff.suggestedActivity ===
                                'twenty_questions'
                              ? '20q'
                              : 'trivia'
                        );
                        change('play');
                      }}
                    >
                      Carry on in the Game Loft
                    </button>
                  )}
                </div>
              </div>
            </li>
          ))}
        </ol>
      )}
      {ask && ask.status !== 'completed' && (
        <p role="status" className="replies-left">
          <span className="reply-dots" aria-hidden="true">
            {Array.from({ length: 8 }, (_, i) => (
              <span key={i} className={i < 8 - left ? 'used' : ''} />
            ))}
          </span>
          {left === 1
            ? 'One more reply in this conversation — make it a good one!'
            : `${left} replies left in this conversation.`}
        </p>
      )}
      {ask?.status === 'completed' && (
        <section className="ending-card" aria-labelledby="ask-ending">
          <h2 id="ask-ending">That’s the end of this conversation</h2>
          <p>
            {ask.stoppingMessage ||
              'Conversations here stay short so there’s room for your own thinking.'}
          </p>
          <p className="muted">
            Want to keep it? It’ll wait for you in your treasure chest.
          </p>
          <div className="button-row">
            <button className="primary chest-cta" onClick={saveConversation}>
              <ChestIcon /> Put the whole conversation in the chest
            </button>
            <button onClick={clearActivity}>Ask something new</button>
          </div>
        </section>
      )}
      {ask?.status !== 'completed' && (
        <form
          className="composer"
          onSubmit={(e) => {
            e.preventDefault();
            void action.run(async () => {
              await turn('/ask/turn', {
                prompt: question,
                sessionId: ask?.sessionId,
              });
              setQuestion('');
            });
          }}
        >
          <Field label={ask ? 'Ask a follow-up' : 'What are you wondering?'}>
            <textarea
              rows={3}
              required
              value={question}
              maxLength={12000}
              onChange={(e) => setQuestion(e.target.value)}
              placeholder="No question is too small."
            />
          </Field>
          <BlockNote block={block} onRequestTime={onRequestTime} />
          <div className="button-row">
            <Submit busy={action.busy} disabled={!!block}>
              Ask
            </Submit>
            {ask && (
              <button type="button" onClick={clearActivity}>
                Start a new question
              </button>
            )}
          </div>
        </form>
      )}
      {!ask && (
        <div className="examples">
          <span>Need an idea? Try one:</span>
          {[
            'Why does the Moon change shape?',
            'How do bees help plants?',
            'What makes a good mystery story?',
          ].map((q) => (
            <button key={q} onClick={() => setQuestion(q)}>
              {q}
            </button>
          ))}
        </div>
      )}
    </>
  );
}
