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

const STORY_PREMISES = [
  {
    id: 'lighthouse',
    icon: '🏰',
    title: 'The Pebble Point Lighthouse',
    genre: 'Coastal Mystery',
    hero: 'An inquisitive keeper’s granddaughter who knows every hidden stair',
    desc: 'The abandoned watchtower suddenly lights up with a pulsing amber beacon at midnight.',
  },
  {
    id: 'clockwork',
    icon: '🦉',
    title: 'The Clockmaker’s Secret',
    genre: 'Steampunk & Magic',
    hero: 'Oliver, an apprentice clockmaker who hears gears ticking inside stones',
    desc: 'An antique brass owl blinks its obsidian eyes and drops an engraved silver key.',
  },
  {
    id: 'deepsea',
    icon: '🌊',
    title: 'The Sunken Bioluminescent Garden',
    genre: 'Deep-Sea Exploration',
    hero: 'Kaia, a 12-year-old submersible pilot with a keen eye for glowing patterns',
    desc: 'Seven miles down in the midnight trench, a glowing carved courtyard appears in the rocks.',
  },
  {
    id: 'starlight',
    icon: '🌌',
    title: 'The Starlight Courier',
    genre: 'Space Adventure',
    hero: 'Zara and her talkative repair drone, Pip',
    desc: 'An encrypted emergency SOS broadcasts an old sea chantey across planetary frequencies.',
  },
  {
    id: 'library',
    icon: '🗝️',
    title: 'The Whispering Archives',
    genre: 'Magical Realism',
    hero: 'Leo, a quiet book restorer who notices secret patterns in book spines',
    desc: 'In a 100-year-old book, words begin writing themselves in real time, spelling your name.',
  },
  {
    id: 'custom',
    icon: '✨',
    title: 'Create My Own Hero & World',
    genre: 'Original Fiction',
    hero: 'Your own original hero',
    desc: 'Design your own character, setting, and the mysterious event that starts the adventure.',
  },
];

const STORY_ARC_STAGES = [
  { num: 1, name: 'The Spark', label: '1. Spark' },
  { num: 2, name: 'The Roadblock', label: '2. Roadblock' },
  { num: 3, name: 'The Twist', label: '3. Midpoint' },
  { num: 4, name: 'The Crisis', label: '4. Darkest Hour' },
  { num: 5, name: 'The Climax', label: '5. Climax' },
  { num: 6, name: 'Transformation', label: '6. Resolution' },
];

export function PlayActivity({
  play,
  setPlay,
  session,
  sessions = {},
  block,
  turn,
  saveWork,
  onClear,
  onRequestTime,
}: {
  play: string;
  setPlay: (value: string) => void;
  session: any;
  sessions?: Record<string, any>;
  block: string | null;
  turn: (path: string, body?: unknown) => Promise<any>;
  saveWork: (title: string, content: string) => void;
  onClear: () => void;
  onRequestTime?: () => void;
}) {
  const action = useAction(),
    [topic, setTopic] = useState('mixed'),
    [customTopic, setCustomTopic] = useState(''),
    [direction, setDirection] = useState(''),
    [guess, setGuess] = useState(''),
    [feedback, setFeedback] = useState(false),
    [chosenPremise, setChosenPremise] = useState('lighthouse'),
    [customHero, setCustomHero] = useState(''),
    [customPremiseText, setCustomPremiseText] = useState(''),
    [streakScore, setStreakScore] = useState(0),
    [streakTotal, setStreakTotal] = useState(0);

  const canSend = !action.busy && !block;

  const clearActivity = () => {
    onClear();
    setDirection('');
    setGuess('');
    setFeedback(false);
    action.clear();
  };

  const handleStartTrivia = async (overrideTopic?: string) => {
    const activeTopic = overrideTopic || topic;
    await turn('/play/trivia/start', {
      topic: activeTopic,
      customTopic: activeTopic === 'custom' ? customTopic : undefined,
    });
    setFeedback(false);
  };

  const handlePlayAnotherTriviaRound = async () => {
    if (session?.score !== undefined) {
      setStreakScore((prev) => prev + (session.score || 0));
      setStreakTotal((prev) => prev + (session.totalQuestions || 10));
    }
    await handleStartTrivia();
  };

  const handleStartStory = async () => {
    const isCustom = chosenPremise === 'custom';
    const premiseObj = STORY_PREMISES.find((p) => p.id === chosenPremise);
    await turn('/play/story/start', {
      premiseId: isCustom ? undefined : chosenPremise,
      genre: isCustom ? 'Original Adventure' : premiseObj?.genre,
      customPremise: isCustom ? customPremiseText : undefined,
      heroDescription: isCustom ? customHero : undefined,
    });
    setDirection('');
  };

  return (
    <>
      <Feedback action={action} />
      <nav className="activity-tabs" aria-label="Play activities">
        {[
          ['trivia', 'Trivia Arcade'],
          ['20q', 'Twenty Questions'],
          ['story', 'Story Relay Studio'],
        ].map(([id, label]) => (
          <button
            key={id}
            aria-current={play === id ? 'page' : undefined}
            onClick={() => {
              setPlay(id);
              action.clear();
              setFeedback(false);
            }}
          >
            {label}
            {sessions[id]?.status === 'active' && play !== id && (
              <span className="tab-dot"> · in progress</span>
            )}
          </button>
        ))}
      </nav>

      {/* =========================================================================
       * 1. TRIVIA ARCADE (Endless supply with dynamic AI & expanded banks)
       * ========================================================================= */}
      {play === 'trivia' && (
        <>
          {!session ? (
            <form
              className="trivia-start-card"
              onSubmit={(e) => {
                e.preventDefault();
                void action.run(() => handleStartTrivia());
              }}
            >
              <h2>Trivia Arcade · Discover Something Amazing</h2>
              <p className="activity-intro">
                Choose a topic or challenge the treehouse with your own topic.
                Every round delivers 10 fresh, curious questions!
              </p>

              <Field label="Choose a Topic">
                <select
                  value={topic}
                  onChange={(e) => setTopic(e.target.value)}
                >
                  <option value="mixed">🌟 A Bit of Everything (Surprise Mix)</option>
                  <option value="space_science">🚀 Space & Astrophysics</option>
                  <option value="mythology_history">🏛️ Mythology & Ancient Empires</option>
                  <option value="nature_animals">🐾 Wild Animals & Deep Oceans</option>
                  <option value="inventions_tech">💡 Inventions & Everyday Science</option>
                  <option value="world_geography">🌍 World Wonders & Geography</option>
                  <option value="literature">📚 Classic Stories & Legends</option>
                  <option value="custom">✏️ Custom Topic (Type your own!)</option>
                </select>
              </Field>

              {topic === 'custom' && (
                <Field
                  label="What topic should we test?"
                  hint="e.g. Dinosaurs, Marine Biology, Volcanoes, Robotics, Ancient Rome..."
                >
                  <input
                    required
                    value={customTopic}
                    onChange={(e) => setCustomTopic(e.target.value)}
                    placeholder="Type any topic you love..."
                  />
                </Field>
              )}

              <BlockNote block={block} onRequestTime={onRequestTime} />
              <Submit busy={action.busy} disabled={!!block}>
                Start 10 Questions 🚀
              </Submit>
            </form>
          ) : (
            <section className="trivia-active-card">
              {feedback && session.lastFeedback ? (
                <div className="answer-feedback">
                  <div className="feedback-badge">
                    {session.lastFeedback.isCorrect ? '✨ Spot On!' : '💡 Neat Fact to Learn'}
                  </div>
                  <h2>
                    {session.lastFeedback.isCorrect
                      ? 'That’s right!'
                      : 'Not quite, but here’s why:'}
                  </h2>
                  <p className="feedback-answer">
                    The answer is{' '}
                    <strong>{session.lastFeedback.correctChoiceText}</strong>.
                  </p>
                  <div className="feedback-fact">
                    <RichText text={session.lastFeedback.explanation} />
                  </div>
                  <button
                    className="primary"
                    autoFocus
                    onClick={() => setFeedback(false)}
                  >
                    {session.status === 'completed'
                      ? 'See Round Summary'
                      : 'Next Question ➜'}
                  </button>
                </div>
              ) : session.status === 'active' && session.currentQuestion ? (
                <>
                  <div className="trivia-header-row">
                    <span className="eyebrow">
                      Question {session.currentQuestion.index} of 10
                    </span>
                    <span className="trivia-score-pill">
                      ⭐ {session.score} correct
                    </span>
                  </div>
                  <h2 className="trivia-question-prompt">
                    {session.currentQuestion.prompt}
                  </h2>
                  <div className="choices trivia-choices">
                    {session.currentQuestion.choices.map(
                      (choice: string, i: number) => (
                        <button
                          disabled={!canSend}
                          key={`${choice}_${i}`}
                          className="trivia-choice-button"
                          onClick={() =>
                            action.run(async () => {
                              await turn(
                                `/play/trivia/${session.sessionId}/answer`,
                                { choiceIndex: i }
                              );
                              setFeedback(true);
                            })
                          }
                        >
                          <span className="choice-number">
                            {String.fromCharCode(65 + i)}
                          </span>
                          <span className="choice-text">{choice}</span>
                        </button>
                      )
                    )}
                  </div>
                </>
              ) : (
                <div className="round-complete-card">
                  <div className="complete-banner">
                    <h2>Round Complete!</h2>
                    <p className="complete-score">
                      You scored <strong>{session.score} of 10</strong> on this round!
                    </p>
                    {streakTotal > 0 && (
                      <p className="complete-streak">
                        Total Arcade Streak:{' '}
                        <strong>
                          {streakScore + (session.score || 0)} /{' '}
                          {streakTotal + 10}
                        </strong>
                      </p>
                    )}
                  </div>

                  <p className="stopping-msg">{session.stoppingMessage}</p>

                  <div className="button-row trivia-next-actions">
                    <button
                      className="primary trivia-play-again"
                      onClick={() => action.run(handlePlayAnotherTriviaRound)}
                    >
                      Play Next 10 Questions 🚀
                    </button>
                    <button
                      className="chest-button"
                      onClick={() =>
                        saveWork(
                          `Trivia: ${session.score} of 10 (${session.topic})`,
                          session.history
                            .map(
                              (h: any) =>
                                `**Q: ${h.prompt}**\n- Your answer: ${h.selectedChoiceText}\n- Correct: ${h.correctChoiceText}\n- *Did you know:* ${h.explanation}`
                            )
                            .join('\n\n')
                        )
                      }
                    >
                      <ChestIcon /> Save this round to chest
                    </button>
                    <button onClick={clearActivity}>
                      Change topic
                    </button>
                  </div>

                  <h3 className="review-heading">Review all 10 questions & answers</h3>
                  <div className="trivia-review-list">
                    {session.history.map((h: any, idx: number) => (
                      <details key={h.questionIndex || idx} className="trivia-review-item">
                        <summary>
                          <span className={h.isCorrect ? 'status-tag correct' : 'status-tag review'}>
                            {h.isCorrect ? '✓ Correct' : '✕ Review'}
                          </span>{' '}
                          {h.prompt}
                        </summary>
                        <div className="review-content">
                          <p>
                            <strong>Answer:</strong> {h.correctChoiceText}
                          </p>
                          <p className="review-fact">{h.explanation}</p>
                        </div>
                      </details>
                    ))}
                  </div>
                </div>
              )}
            </section>
          )}
        </>
      )}

      {/* =========================================================================
       * 2. TWENTY QUESTIONS (Fixed Target Deduction)
       * ========================================================================= */}
      {play === '20q' && (
        <>
          {!session ? (
            <section>
              <h2>Twenty Questions</h2>
              <p>
                The treehouse has chosen a secret mystery object. Can you deduce
                what it is in twenty yes-or-no questions?
              </p>
              <BlockNote block={block} onRequestTime={onRequestTime} />
              <button
                className="primary"
                disabled={!canSend}
                onClick={() =>
                  action.run(async () => {
                    await turn('/play/20q/start');
                  })
                }
              >
                Start Twenty Questions
              </button>
            </section>
          ) : (
            <section>
              <div className="twenty-q-header">
                <span className="eyebrow">
                  Question {session.turnsUsed} of {session.maxTurns}
                </span>
                <span className="category-pill">
                  Category: {session.category}
                </span>
              </div>

              {session.status === 'active' ? (
                <>
                  {session.history.length > 0 && (
                    <div className="last-answer-callout">
                      <p>
                        <strong>Last Answer: </strong>
                        <span className={`answer-badge answer-${session.lastAnswer}`}>
                          {session.lastAnswer?.toUpperCase()}
                        </span>
                      </p>
                      {session.history.at(-1)?.note && (
                        <p className="answer-note">
                          {session.history.at(-1)?.note}
                        </p>
                      )}
                    </div>
                  )}

                  <form
                    onSubmit={(e) => {
                      e.preventDefault();
                      void action.run(async () => {
                        await turn(`/play/20q/${session.sessionId}/ask`, {
                          question: guess,
                          isGuess: false,
                        });
                        setGuess('');
                      });
                    }}
                  >
                    <Field label="Ask a yes-or-no question">
                      <input
                        required
                        value={guess}
                        onChange={(e) => setGuess(e.target.value)}
                        placeholder="e.g. Is it bigger than a backpack? Is it man-made?"
                      />
                    </Field>
                    <BlockNote block={block} onRequestTime={onRequestTime} />
                    <div className="button-row">
                      <Submit busy={action.busy} disabled={!canSend}>
                        Ask Question
                      </Submit>
                      <button
                        type="button"
                        className="guess-button"
                        disabled={!canSend || !guess.trim()}
                        onClick={() =>
                          action.run(async () => {
                            await turn(`/play/20q/${session.sessionId}/ask`, {
                              question: guess,
                              isGuess: true,
                            });
                            setGuess('');
                          })
                        }
                      >
                        Make a Direct Guess!
                      </button>
                    </div>
                  </form>

                  {session.history.length > 1 && (
                    <details className="history-details">
                      <summary>
                        Previous questions ({session.history.length - 1})
                      </summary>
                      <ol className="twenty-q-history">
                        {session.history.slice(0, -1).map((h: any) => (
                          <li key={h.turnNumber}>
                            <span className="history-q">"{h.question}"</span>
                            <span className={`answer-tag answer-${h.answer}`}>
                              {h.answer?.toUpperCase()}
                            </span>
                            {h.note && <span className="history-note"> — {h.note}</span>}
                          </li>
                        ))}
                      </ol>
                    </details>
                  )}
                </>
              ) : (
                <div className="twenty-q-result">
                  <h2>
                    {session.status === 'won'
                      ? '🎉 Brilliant Deduction!'
                      : 'The Secret is Out!'}
                  </h2>
                  <p>{session.stoppingMessage}</p>
                  <button onClick={clearActivity}>Play Another Round</button>
                </div>
              )}
            </section>
          )}
        </>
      )}

      {/* =========================================================================
       * 3. STORY RELAY STUDIO (Technical 6-Scene Narrative Arc & Active Writing)
       * ========================================================================= */}
      {play === 'story' && (
        <>
          {!session ? (
            <section className="story-launcher">
              <h2>Story Relay Studio · Co-Author an Adventure</h2>
              <p className="activity-intro">
                Write a 6-scene adventure together with Marmalade! You steer the narrative
                choices, develop characters, and craft plot twists through a classical
                storytelling arc.
              </p>

              <h3 className="premise-heading">Choose a Starting Premise</h3>
              <div className="premise-grid">
                {STORY_PREMISES.map((p) => (
                  <button
                    type="button"
                    key={p.id}
                    className={`premise-card ${chosenPremise === p.id ? 'selected' : ''}`}
                    onClick={() => setChosenPremise(p.id)}
                  >
                    <span className="premise-icon">{p.icon}</span>
                    <span className="premise-title">{p.title}</span>
                    <span className="premise-genre">{p.genre}</span>
                    <p className="premise-desc">{p.desc}</p>
                  </button>
                ))}
              </div>

              {chosenPremise === 'custom' && (
                <div className="custom-story-fields">
                  <Field label="Hero Name & Quirky Trait" hint="e.g. Maya, a 12-year-old gadget inventor who is scared of heights">
                    <input
                      required
                      value={customHero}
                      onChange={(e) => setCustomHero(e.target.value)}
                      placeholder="Name your hero and their personality..."
                    />
                  </Field>
                  <Field label="The Inciting Incident" hint="What strange thing happens on an otherwise normal day?">
                    <input
                      required
                      value={customPremiseText}
                      onChange={(e) => setCustomPremiseText(e.target.value)}
                      placeholder="e.g. A glowing golden egg washes up on the riverbank during a storm..."
                    />
                  </Field>
                </div>
              )}

              <BlockNote block={block} onRequestTime={onRequestTime} />
              <button
                className="primary story-begin-btn"
                disabled={!canSend}
                onClick={() => action.run(handleStartStory)}
              >
                Begin 6-Scene Story Relay ✍️
              </button>
            </section>
          ) : (
            <section className="story-active-studio">
              {/* Story Arc Progression Tracker */}
              <div className="story-arc-tracker" aria-label="Story narrative arc">
                <div className="arc-label-row">
                  <span className="arc-title">
                    Narrative Arc: Scene {session.turnsUsed} of 6
                  </span>
                  <span className="arc-genre">
                    {session.premiseTitle || session.genre}
                  </span>
                </div>
                <div className="arc-steps">
                  {STORY_ARC_STAGES.map((st) => {
                    const isPast = st.num < session.turnsUsed;
                    const isCurrent = st.num === session.turnsUsed;
                    return (
                      <div
                        key={st.num}
                        className={`arc-step ${isCurrent ? 'current' : ''} ${isPast ? 'past' : ''}`}
                      >
                        <span className="arc-step-num">
                          {isPast ? '✓' : st.num}
                        </span>
                        <span className="arc-step-name">{st.label}</span>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Latest Story Scene */}
              {session.history.slice(-1).map((h: any) => (
                <article className="story-current" key={h.turnNumber}>
                  <div className="scene-badge">
                    Scene {h.turnNumber} · {h.stageName || 'The Adventure'}
                  </div>
                  <RichText text={h.passageText} />
                </article>
              ))}

              {/* Full Story So Far */}
              {session.history.length > 1 && (
                <details className="story-history-drawer">
                  <summary>
                    📖 Read the full story so far ({session.history.length} scenes)
                  </summary>
                  <div className="story-chronology">
                    {session.history.map((h: any) => (
                      <div key={h.turnNumber} className="chronology-scene">
                        <span className="scene-marker">
                          Scene {h.turnNumber}: {h.stageName || 'Act'}
                        </span>
                        {h.turnNumber > 1 && (
                          <p className="student-steer">
                            <strong>Your Direction:</strong> "{h.childDirection}"
                          </p>
                        )}
                        <RichText text={h.passageText} />
                      </div>
                    ))}
                  </div>
                </details>
              )}

              {session.status === 'active' ? (
                <>
                  {/* Technical Story Craft Coach Box */}
                  <div className="story-coach-box">
                    <div className="coach-header">
                      <span className="coach-icon">💡</span>
                      <strong>
                        Writer’s Craft Focus ·{' '}
                        {session.currentStage?.stageName || 'Next Scene'}
                      </strong>
                    </div>
                    {session.currentStage?.stageGoal && (
                      <p className="coach-goal">
                        <strong>Stage Mission:</strong> {session.currentStage.stageGoal}
                      </p>
                    )}
                    <p className="coach-tip">
                      {session.currentStage?.coachTip ||
                        session.history.at(-1)?.coachTip ||
                        'Think about how your hero’s personality and flaws shape their choices!'}
                    </p>
                  </div>

                  {/* Active Direction Composer (No passive clickable options!) */}
                  <form
                    className="story-composer-form"
                    onSubmit={(e) => {
                      e.preventDefault();
                      void action.run(async () => {
                        await turn(`/play/story/${session.sessionId}/turn`, {
                          childDirection: direction,
                        });
                        setDirection('');
                      });
                    }}
                  >
                    <Field
                      label={`What does your character do next in Scene ${session.turnsUsed + 1}?`}
                      hint="Describe their actions, dialogue, or reaction. Push the story forward!"
                    >
                      <textarea
                        rows={3}
                        required
                        value={direction}
                        onChange={(e) => setDirection(e.target.value)}
                        placeholder="e.g. Maya hesitates because of the height, then ties her scarf around the gear and leaps across..."
                      />
                    </Field>
                    <BlockNote block={block} onRequestTime={onRequestTime} />
                    <div className="button-row">
                      <Submit busy={action.busy} disabled={!canSend || direction.trim().length < 3}>
                        Add to Story ✍️
                      </Submit>
                      <button type="button" onClick={clearActivity}>
                        Start a different story
                      </button>
                    </div>
                  </form>
                </>
              ) : (
                <div className="story-completed-card">
                  <h2>🎉 Chapter Complete!</h2>
                  <p className="completed-intro">
                    You and Marmalade finished an entire 6-scene collaborative story
                    with a full narrative arc from Inciting Spark to Resolution.
                  </p>

                  <div className="story-craft-summary">
                    <h3>Story Craft Breakdown</h3>
                    <div className="craft-tags">
                      <span className="craft-pill">✓ 6 Complete Scenes</span>
                      <span className="craft-pill">✓ Clear Narrative Arc</span>
                      <span className="craft-pill">✓ Character Growth</span>
                      <span className="craft-pill">✓ Active Resolution</span>
                    </div>
                  </div>

                  <div className="complete-story-book">
                    <h3>"{session.premiseTitle || 'Our Adventure'}"</h3>
                    {session.history.map((h: any) => (
                      <div key={h.turnNumber} className="book-passage">
                        <h4>Scene {h.turnNumber}: {h.stageName}</h4>
                        <RichText text={h.passageText} />
                      </div>
                    ))}
                  </div>

                  <div className="button-row story-final-actions">
                    <button
                      className="primary chest-cta"
                      onClick={() =>
                        saveWork(
                          session.premiseTitle || 'My Collaborative Story',
                          session.history
                            .map(
                              (h: any) =>
                                `### Scene ${h.turnNumber}: ${h.stageName || 'Act'}\n\n${h.passageText}`
                            )
                            .join('\n\n---\n\n')
                        )
                      }
                    >
                      <ChestIcon /> Save Story to Treasure Chest
                    </button>
                    <button onClick={clearActivity}>
                      Start a New Story Adventure
                    </button>
                  </div>
                </div>
              )}
            </section>
          )}
        </>
      )}
    </>
  );
}
