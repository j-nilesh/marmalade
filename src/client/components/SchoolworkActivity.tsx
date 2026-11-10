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
export function SchoolworkActivity({
  school,
  block,
  turn,
  saveWork,
  onClear,
  setReviewNote,
  onRequestTime,
}: {
  school: any;
  block: string | null;
  turn: (path: string, body?: unknown) => Promise<any>;
  saveWork: (title: string, content: string) => void;
  onClear: () => void;
  setReviewNote: (note: { subject: string; summary: string }) => void;
  onRequestTime?: () => void;
}) {
  const action = useAction(),
    [assignment, setAssignment] = useState(''),
    [thinking, setThinking] = useState('');
  const clearActivity = () => {
    onClear();
    setAssignment('');
    setThinking('');
    action.clear();
  };
  return (
    <>
      <Feedback action={action} />
      {!school ? (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void action.run(async () => {
              await turn('/schoolwork/session', { assignment });
              setAssignment('');
            });
          }}
        >
          <Field label="What are you working on?">
            <textarea
              required
              rows={4}
              value={assignment}
              onChange={(e) => setAssignment(e.target.value)}
              placeholder="Paste your assignment or describe where you need help."
            />
          </Field>
          <BlockNote block={block} onRequestTime={onRequestTime} />
          <Submit busy={action.busy} disabled={!!block}>
            Let’s work it out
          </Submit>
        </form>
      ) : (
        <>
          <div className="task-context">
            <span className="eyebrow">Your task</span>
            <p>{school.assignmentContext}</p>
          </div>
          <div className="study-layout">
            <section>
              <h2>Study Coach</h2>
              <RichText
                text={
                  school.currentAiMessage === school.workProduct
                    ? 'Here is a working outline based on your thinking. What would you like to explore next?'
                    : school.currentAiMessage
                }
              />
              <p role="status">
                {school.exchanges.length >= 8
                  ? 'A good place to pause and try it yourself. You can still save your work below.'
                  : `${8 - school.exchanges.length} coaching replies left. Stop whenever you have enough to try it yourself.`}
              </p>
              {school.exchanges.length < 8 && (
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    void action.run(async () => {
                      await turn(
                        `/schoolwork/${school.sessionId}/${school.currentStage === 'think' ? 'step' : 'followup'}`,
                        { studentInput: thinking }
                      );
                      setThinking('');
                    });
                  }}
                >
                  <Field
                    label={
                      school.currentStage === 'think'
                        ? 'Your thoughts, research, or questions:'
                        : 'What would you like to work on next?'
                    }
                  >
                    <textarea
                      required
                      rows={3}
                      value={thinking}
                      onChange={(e) => setThinking(e.target.value)}
                      placeholder={
                        school.currentStage === 'think'
                          ? "Share what you've found, your ideas, or where you'd like help..."
                          : "Ask for wording ideas, another slide, or questions to practice..."
                      }
                    />
                  </Field>
                  <BlockNote block={block} onRequestTime={onRequestTime} />
                  <Submit busy={action.busy} disabled={!!block}>
                    {school.currentStage === 'think'
                      ? 'Send to Coach 🌿'
                      : 'Ask Coach 🌿'}
                  </Submit>
                </form>
              )}
            </section>
            {school.workProduct && (
              <section className="work-product">
                <h2>Your working outline</h2>
                <RichText text={school.workProduct} />
                <button
                  className="chest-button"
                  onClick={() =>
                    saveWork(
                      `Schoolwork: ${school.assignmentContext.slice(0, 70)}`,
                      school.workProduct
                    )
                  }
                >
                  <ChestIcon /> Put my outline in the chest
                </button>
                {school.proposedLedger && !school.ledgerSaved && (
                  <>
                    <p>
                      You can keep a short note about what you learned. This is
                      optional.
                    </p>
                    <button
                      onClick={() =>
                        setReviewNote({
                          subject: school.proposedLedger.subject,
                          summary: school.proposedLedger.summary,
                        })
                      }
                    >
                      Review a learning note
                    </button>
                  </>
                )}
                {school.ledgerSaved && (
                  <p role="status">Your learning note is in the treasure chest.</p>
                )}
              </section>
            )}
          </div>
          <button onClick={clearActivity}>Start another task</button>
        </>
      )}
    </>
  );
}
