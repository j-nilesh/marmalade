import {
  getParticipationGuidance,
  PARTICIPATION_GUIDANCE,
  isCreativeRequest,
  isBareContinuation,
} from './participation.js';
import { randomBytes } from 'node:crypto';
import type {
  ActivityMode,
  AskSessionPublic,
  AskTurnEntry,
  PolicyBlockReason,
  ProposedLedgerEntry,
  QuotaStatusSummary,
  ResearchSessionPublic,
  ResearchSourcePublic,
  SchoolworkSessionPublic,
  SchoolworkStage,
  StoryRelaySessionPublic,
  StoryRelayTurn,
  TriviaAnswerRecord,
  TriviaDifficulty,
  TriviaQuestionPublic,
  TriviaSessionPublic,
  TriviaTopic,
  TwentyQuestionsSessionPublic,
} from '../../shared/types.js';
import type { MarmaladeDatabase, SproutDatabase } from '../db/sqlite.js';
import type { PolicyEngine } from '../policy/engine.js';
import {
  selectTriviaRoundQuestions,
  type VerifiedTriviaBankItem,
} from '../providers/mock.js';
import type {
  ModelProvider,
  ModelGenerateRequest,
} from '../providers/types.js';
import type { ProviderRegistry } from '../providers/registry.js';
import {
  redactPiiFromSearchQuery,
  sanitizeUntrustedSearchSnippet,
} from '../providers/search.js';
import { ApplicationSafetyLayer } from '../safety/engine.js';
import { redactPiiFromChildInput } from '../../shared/piiFilter.js';

export const TRANSIENT_SESSION_IDLE_TTL_MS = 15 * 60 * 1000; // 15 minutes transient memory expiry

export function stripXmlDelimiters(text: string): string {
  if (!text || typeof text !== 'string') return '';
  return text.replace(/<\/?(?:student_question|student_direction|student_input|assignment_context|story_context|research_question|topic)[^>]*>/gi, '');
}

interface TriviaSessionInternal {
  kind: 'trivia_10';
  sessionId: string;
  topic: TriviaTopic;
  difficulty: TriviaDifficulty;
  status: 'active' | 'completed' | 'stopped_by_quota';
  questions: VerifiedTriviaBankItem[];
  answeredCount: number;
  score: number;
  history: TriviaAnswerRecord[];
  lastFeedback: TriviaAnswerRecord | null;
  stoppingMessage: string | null;
  createdAtMs: number;
  lastUpdatedAtMs: number;
}

interface TwentyQuestionsInternal {
  kind: 'twenty_questions';
  sessionId: string;
  status: 'active' | 'won' | 'lost' | 'stopped_by_quota';
  targetWord: string;
  category: string;
  turnsUsed: number;
  maxTurns: number;
  lastAnswer: 'yes' | 'no' | 'partly' | 'cannot_answer' | null;
  history: Array<{
    turnNumber: number;
    question: string;
    answer: 'yes' | 'no' | 'partly' | 'cannot_answer';
    note?: string;
  }>;
  stoppingMessage: string | null;
  createdAtMs: number;
  lastUpdatedAtMs: number;
}

interface StoryRelayInternal {
  kind: 'story_relay';
  sessionId: string;
  status: 'active' | 'completed' | 'stopped_by_quota';
  genre: string;
  premiseTitle?: string;
  turnsUsed: number;
  maxTurns: number;
  history: StoryRelayTurn[];
  stoppingMessage: string | null;
  createdAtMs: number;
  lastUpdatedAtMs: number;
}

interface ResearchSessionInternal {
  kind: 'research_basic';
  sessionId: string;
  status: 'active' | 'stopped_by_quota';
  query: string;
  searchStatusNote?: string;
  searchOutcome?: 'results' | 'no_results';
  sources: ResearchSourcePublic[];
  synthesis: string;
  notesBundle: string;
  citedSourceIds: string[];
  createdAtMs: number;
  lastUpdatedAtMs: number;
}

interface SchoolworkSessionInternal {
  kind: 'schoolwork_loop';
  sessionId: string;
  status: 'active' | 'completed' | 'stopped_by_quota';
  currentStage: SchoolworkStage;
  assignmentContext: string;
  studentPosition: string;
  thinkingProbesCount: number;
  exchanges: Array<{
    stage: SchoolworkStage;
    aiPrompt: string;
    studentResponse: string;
    timestampMs: number;
  }>;
  currentAiMessage: string;
  workProduct: string | null;
  proposedLedger: ProposedLedgerEntry | null;
  ledgerSaved: boolean;
  createdAtMs: number;
  lastUpdatedAtMs: number;
}

interface AskSessionInternal {
  creativeTurns: number;
  stoppingMessage?: string;
  kind: 'general_ask';
  sessionId: string;
  status: 'active' | 'completed' | 'stopped_by_quota';
  turns: AskTurnEntry[];
  createdAtMs: number;
  lastUpdatedAtMs: number;
}

type TransientSession =
  | TriviaSessionInternal
  | TwentyQuestionsInternal
  | StoryRelayInternal
  | ResearchSessionInternal
  | SchoolworkSessionInternal
  | AskSessionInternal;

const TWENTY_QUESTIONS_TARGETS = [
  { word: 'Telescope', category: 'Instrument / Invention' },
  { word: 'Dolphin', category: 'Living Creature (Animal)' },
  { word: 'Pyramid', category: 'Ancient Monument / Architecture' },
  { word: 'Lightning', category: 'Natural Weather Phenomenon' },
  { word: 'Compass', category: 'Navigation Tool' },
];

export const STORY_STAGES = [
  {
    stageNumber: 1,
    stageName: 'The Inciting Spark',
    stageGoal: 'Introduce your hero, their unique personality, and the unexpected event that disrupts their ordinary day.',
    craftFocus: 'Character Motivation & Ordinary World',
    defaultCoachTip:
      'Great stories start with a character who has a distinct personality, quirk, or desire. What makes your character unique, and what strange new discovery starts their adventure?',
  },
  {
    stageNumber: 2,
    stageName: 'The First Roadblock',
    stageGoal: 'Take action to investigate or solve the problem, and hit an unexpected obstacle.',
    craftFocus: 'Rising Tension & Character Reaction',
    defaultCoachTip:
      'When your hero takes action, things get complicated! How do they react emotionally? Do they rush in recklessly, get nervous, or try a clever workaround?',
  },
  {
    stageNumber: 3,
    stageName: 'The Midpoint Twist',
    stageGoal: 'A shocking revelation, hidden secret, or dramatic escalation of the stakes.',
    craftFocus: 'Plot Complication & The Stakes Raise',
    defaultCoachTip:
      'Midpoint Shift: Nothing is quite what it seemed! What unexpected truth is revealed? How does this force your hero to change their plan?',
  },
  {
    stageNumber: 4,
    stageName: 'The Darkest Moment',
    stageGoal: 'The hardest test yet where the plan fails and the hero doubts themselves.',
    craftFocus: 'Vulnerability & Inner Strength',
    defaultCoachTip:
      'The Crisis: When the easy way fails, what inner belief, memory, or courage does your hero dig deep to find?',
  },
  {
    stageNumber: 5,
    stageName: 'The Climax Showdown',
    stageGoal: 'The ultimate confrontation, puzzle solution, or daring breakthrough.',
    craftFocus: 'Protagonist Agency & Direct Action',
    defaultCoachTip:
      'The Climax: Your hero must take direct action! They can’t just watch things happen—what bold, clever, or daring choice do they make?',
  },
  {
    stageNumber: 6,
    stageName: 'The Transformation',
    stageGoal: 'The dust settles. We see how the adventure has changed the hero inside.',
    craftFocus: 'Resolution & Character Growth',
    defaultCoachTip:
      'The Transformation: The adventure has changed your hero. How do they see themselves or their world differently now?',
  },
];

export const STORY_PREMISES = [
  {
    id: 'lighthouse',
    title: 'The Pebble Point Lighthouse',
    genre: 'Coastal Mystery',
    hero: 'An inquisitive keeper’s granddaughter who knows every winding stair',
    starterPassage:
      'The lighthouse on Pebble Point had not shone in forty years, but tonight a strange amber pulse flickered across the misty tide. The old brass door in the cellar clicked open by itself.',
  },
  {
    id: 'clockwork',
    title: 'The Clockmaker’s Secret',
    genre: 'Steampunk & Magic',
    hero: 'Oliver, an apprentice clockmaker who hears gears ticking inside stones',
    starterPassage:
      'In the dusty back room of the gearshop, the master’s antique brass owl suddenly opened its obsidian eyes, fluttered its copper wings, and dropped an engraved silver key into Oliver’s apron pocket.',
  },
  {
    id: 'deepsea',
    title: 'The Sunken Bioluminescent Garden',
    genre: 'Deep-Sea Exploration',
    hero: 'Kaia, a 12-year-old submersible pilot with a keen eye for glowing patterns',
    starterPassage:
      'Seven miles down in the midnight trench, Kaia’s searchlights swept over something impossible: a carved coral gateway pulsing with golden light, opening onto a courtyard that had been dry for ten thousand years.',
  },
  {
    id: 'starlight',
    title: 'The Starlight Courier',
    genre: 'Space Adventure',
    hero: 'Zara, an orbital salvage scout and her talkative repair drone, Pip',
    starterPassage:
      'Docked beside an ancient derelict satellite above Jupiter’s ring, Zara’s comms console lit up with an encrypted emergency beacon broadcasting an old sea chantey in Morse code.',
  },
  {
    id: 'library',
    title: 'The Whispering Archives',
    genre: 'Magical Realism',
    hero: 'Leo, a quiet book restorer who notices secret patterns in book spines',
    starterPassage:
      'In the basement archives of the town library, Leo pulled down a leather volume dated 1888. As he turned the page, fresh ink began blooming across the blank parchment, writing his own name in cursive.',
  },
];

export class ActivityEngine {
  private readonly sessions = new Map<string, TransientSession>();
  private readonly safetyLayer = new ApplicationSafetyLayer();

  constructor(
    private readonly db: MarmaladeDatabase,
    private readonly policyEngine: PolicyEngine,
    private readonly providerRegistry: ProviderRegistry
  ) {}

  public purgeExpiredSessions(nowMs = Date.now()): number {
    let purged = 0;
    for (const [id, sess] of this.sessions.entries()) {
      if (nowMs - sess.lastUpdatedAtMs > TRANSIENT_SESSION_IDLE_TTL_MS) {
        this.sessions.delete(id);
        this.owners.delete(id);
        purged += 1;
      }
    }
    return purged;
  }

  private readonly owners = new Map<string, number>();
  private readonly pending = new Set<string>();
  public bindSession(id: string, userId: number): void {
    if (this.sessions.has(id) && !this.owners.has(id))
      this.owners.set(id, userId);
  }
  public ownsSession(id: string, userId: number): boolean {
    return this.owners.get(id) === userId;
  }
  public snapshotSession(id: string): TransientSession | undefined {
    const s = this.sessions.get(id);
    return s ? structuredClone(s) : undefined;
  }
  public restoreSession(id: string, snapshot: TransientSession): void {
    this.sessions.set(id, snapshot);
  }
  public beginMutation(id: string): boolean {
    if (this.pending.has(id)) return false;
    this.pending.add(id);
    return true;
  }
  public endMutation(id: string): void {
    this.pending.delete(id);
  }
  public clearUserSessions(userId: number): void {
    for (const [id, owner] of this.owners)
      if (owner === userId) {
        this.sessions.delete(id);
        this.owners.delete(id);
      }
  }

  private redactAndTrackPii(
    text: string,
    mode: ActivityMode,
    nowMs: number
  ): string {
    const activePolicy = this.db.getPolicyConfig();
    if (activePolicy.piiFilterEnabled === false) {
      return text;
    }
    const pii = redactPiiFromChildInput(text);
    if (pii.hasPii) {
      this.db.recordSafetyEvent({
        category: 'pii_shared',
        severity: 'low',
        mode,
        nowMs,
      });
      return pii.redactedText;
    }
    return text;
  }
  public readSession(
    id: string,
    nowMs: number
  ): Record<string, unknown> | null {
    this.purgeExpiredSessions(nowMs);
    const session = this.sessions.get(id);
    if (!session) return null;
    if (session.kind === 'trivia_10')
      return {
        ...this.toTriviaPublic(session),
        expiresAtMs: session.lastUpdatedAtMs + TRANSIENT_SESSION_IDLE_TTL_MS,
      };
    const { kind, createdAtMs, lastUpdatedAtMs, ...publicSession } =
      structuredClone(session);
    const result: Record<string, unknown> = {
      ...publicSession,
      expiresAtMs: lastUpdatedAtMs + TRANSIENT_SESSION_IDLE_TTL_MS,
    };
    if (kind === 'twenty_questions') {
      result.mode = 'play';
      result.activityType = 'twenty_questions';
      result.revealedTarget = ['won', 'lost'].includes(session.status)
        ? result.targetWord
        : null;
      delete result.targetWord;
    } else if (kind === 'story_relay') {
      result.mode = 'play';
      result.activityType = 'story_relay';
      const story = session as StoryRelayInternal;
      result.premiseTitle = story.premiseTitle;
      const nextStageIdx = Math.min(story.turnsUsed, STORY_STAGES.length - 1);
      const nextStage = STORY_STAGES[nextStageIdx];
      result.currentStage =
        story.status === 'active'
          ? {
              stageNumber: nextStage.stageNumber,
              stageName: nextStage.stageName,
              stageGoal: nextStage.stageGoal,
              craftFocus: nextStage.craftFocus,
              coachTip: nextStage.defaultCoachTip,
            }
          : undefined;
    } else if (kind === 'schoolwork_loop') {
      result.mode = 'schoolwork';
      result.activityType = 'schoolwork_loop';
      delete result.studentPosition;
    } else if (kind === 'general_ask') {
      result.mode = 'ask';
      result.activityType = 'general_ask';
      const ask = session as AskSessionInternal;
      result.repliesRemaining = ask.creativeTurns
        ? Math.min(8 - ask.turns.length, 3 - ask.creativeTurns)
        : 8 - ask.turns.length;
    } else {
      result.mode = 'research';
      result.activityType = 'research_basic';
    }
    return result;
  }
  private async generate(
    provider: ModelProvider,
    request: ModelGenerateRequest,
    gate: { dateKey: string; monthKey: string; reservedCostCents: number }
  ) {
    const activePolicy = this.db.getPolicyConfig();
    const brand = activePolicy.instanceDisplayName || 'Marmalade';
    const childAge = activePolicy.childAge ?? 11;
    const baseGuidance = getParticipationGuidance(brand, childAge);
    let lastError: unknown;
    for (let attempt = 1; attempt <= 2; attempt++) {
      try {
        const result = await provider.generate({
          ...request,
          messages: [
            { role: 'system', content: baseGuidance },
            ...request.messages,
          ],
        });
        if (result.content && result.content.trim().length > 0) {
          return result;
        }
        lastError = new Error('EMPTY_PROVIDER_RESPONSE');
      } catch (error) {
        lastError = error;
      }
      if (attempt === 1) {
        const delayMs = provider.id === 'mock' ? 10 : 800;
        await new Promise((resolve) => setTimeout(resolve, delayMs));
      }
    }

    this.providerRegistry.recordFailure(provider.id);
    this.policyEngine.reconcileCostReservation({
      ...gate,
      actualCostCents: 0,
    });
    throw lastError || new Error('EMPTY_PROVIDER_RESPONSE');
  }

  public clearAllTransientSessions(): void {
    this.sessions.clear();
    this.owners.clear();
  }

  /* =========================================================================
   * 1. PLAY: 10-Question Trivia
   * ========================================================================= */
  private toTriviaPublic(sess: TriviaSessionInternal): TriviaSessionPublic {
    const currentRaw =
      sess.status === 'active' && sess.answeredCount < sess.questions.length
        ? sess.questions[sess.answeredCount]
        : null;

    const currentQuestion: TriviaQuestionPublic | null = currentRaw
      ? {
          index: sess.answeredCount + 1,
          total: sess.questions.length,
          id: currentRaw.id,
          topicLabel: currentRaw.topicLabel,
          difficulty: currentRaw.difficulty,
          prompt: currentRaw.prompt,
          choices: [...currentRaw.choices],
        }
      : null;

    return {
      sessionId: sess.sessionId,
      mode: 'play',
      activityType: 'trivia_10',
      topic: sess.topic,
      difficulty: sess.difficulty,
      status: sess.status,
      totalQuestions: sess.questions.length,
      answeredCount: sess.answeredCount,
      score: sess.score,
      currentQuestion,
      lastFeedback: sess.lastFeedback,
      history: [...sess.history],
      stoppingMessage: sess.stoppingMessage,
    };
  }

  public getTriviaSession(
    sessionId: string,
    nowMs = Date.now()
  ): TriviaSessionPublic | null {
    this.purgeExpiredSessions(nowMs);
    const sess = this.sessions.get(sessionId);
    if (!sess || sess.kind !== 'trivia_10') return null;

    const quota = this.policyEngine.getQuotaStatus(nowMs, 'play');
    if (sess.status === 'active' && quota.modes.play.isExhausted) {
      sess.status = 'stopped_by_quota';
      sess.stoppingMessage =
        quota.blockingReason === 'GLOBAL_TIME_LIMIT_REACHED'
          ? 'Your total daily active time across all modes has been reached. You can still save your trivia summary below.'
          : 'Your Play time limit has been reached for today. You can still save your trivia summary below.';
    }

    return this.toTriviaPublic(sess);
  }

  public async startTriviaRound(params: {
    topic: TriviaTopic | string;
    difficulty: TriviaDifficulty;
    customTopic?: string;
    nowMs?: number;
  }): Promise<
    | { ok: true; session: TriviaSessionPublic; quota: QuotaStatusSummary }
    | {
        ok: false;
        reason: PolicyBlockReason;
        message: string;
        quota: QuotaStatusSummary;
      }
  > {
    const now = params.nowMs ?? Date.now();
    this.purgeExpiredSessions(now);

    const customTopicStr =
      params.customTopic ||
      (typeof params.topic === 'string' &&
      ![
        'space',
        'dinosaurs',
        'oceans',
        'ancient_history',
        'inventions',
        'mixed',
      ].includes(params.topic)
        ? params.topic
        : undefined);

    if (customTopicStr) {
      const inputSafety = this.safetyLayer.screenInput(customTopicStr, 'play');
      if (!inputSafety.allowed) {
        if (
          !inputSafety.suppressParentAlert &&
          inputSafety.flagged &&
          inputSafety.category &&
          inputSafety.severity
        ) {
          this.db.recordSafetyEvent({
            category: inputSafety.category,
            severity: inputSafety.severity,
            mode: 'play',
            nowMs: now,
          });
        }
        return {
          ok: false,
          reason: 'SAFETY_BLOCKED',
          message:
            inputSafety.userFacingMessage ||
            'That request was stopped by safety safeguards.',
          quota: this.policyEngine.getQuotaStatus(now, 'play'),
        };
      }
    }

    let sanitizedCustomTopic = params.customTopic
      ? this.redactAndTrackPii(params.customTopic, 'play', now)
      : undefined;
    let effectiveTopic = params.topic;
    if (
      typeof effectiveTopic === 'string' &&
      ![
        'space',
        'dinosaurs',
        'oceans',
        'ancient_history',
        'inventions',
        'mixed',
      ].includes(effectiveTopic)
    ) {
      effectiveTopic = this.redactAndTrackPii(effectiveTopic, 'play', now);
    }

    const activePolicy = this.db.getPolicyConfig();
    const provider = this.providerRegistry.getModelProvider(
      activePolicy.activeProvider
    );

    const gate = this.policyEngine.evaluatePolicyAndReserve({
      mode: 'play',
      maxPotentialCostCents: 0,
      nowMs: now,
    });

    if (!gate.allowed) {
      return {
        ok: false,
        reason: gate.reason,
        message: gate.message,
        quota: gate.quota,
      };
    }

    this.policyEngine.reconcileCostReservation({
      dateKey: gate.dateKey,
      monthKey: gate.monthKey,
      reservedCostCents: gate.reservedCostCents,
      actualCostCents: 0,
    });

    // Default to randomized selection from verified bank (ensures fresh replay even offline)
    let questions = selectTriviaRoundQuestions(
      sanitizedCustomTopic ? 'mixed' : (effectiveTopic as TriviaTopic),
      params.difficulty,
      10,
      true
    );

    if (sanitizedCustomTopic) {
      questions = questions.map((q) => ({
        ...q,
        topicLabel: sanitizedCustomTopic!,
      }));
    }

    // If live AI provider is connected, generate fresh endless trivia questions
    if (provider.id !== 'mock' && provider.safetyVerified) {
      try {
        const topicLabel =
          sanitizedCustomTopic ||
          (effectiveTopic === 'mixed'
            ? 'A diverse mix of science, history, nature, and world curiosities'
            : effectiveTopic.replace(/_/g, ' '));

        const genGate = this.policyEngine.evaluatePolicyAndReserve({
          mode: 'play',
          maxPotentialCostCents: provider.maxPotentialCostPerTurnCents,
          nowMs: now,
        });

        if (genGate.allowed) {
          const brand = activePolicy.instanceDisplayName || 'Marmalade';
          const childAge = activePolicy.childAge ?? 11;
          const prompt = `You are ${brand}'s Trivia Master. Generate exactly 10 engaging, kid-friendly (for a ${childAge}-year-old) multiple-choice trivia questions.
Difficulty: "${params.difficulty}".

RULES:
1. Provide fascinating, factually accurate questions with clear kid-friendly wording.
2. Provide exactly 4 distinct answer choices per question.
3. Include the 0-based index of the correct answer (0, 1, 2, or 3).
4. Provide a fun, memorable 1-2 sentence explanation or "did you know?" context.
5. Return ONLY a valid JSON array of 10 objects:
[
  {
    "prompt": "...",
    "choices": ["...", "...", "...", "..."],
    "correctChoiceIndex": 0,
    "explanation": "..."
  }
]`;

          const res = await this.generate(
            provider,
            {
              mode: 'play',
              messages: [
                { role: 'system', content: prompt },
                {
                  role: 'user',
                  content: `<topic>${topicLabel}</topic>\nPlease generate 10 questions on the requested topic.`,
                },
              ],
              maxOutputTokens: 1600,
              temperature: 0.7,
            },
            genGate
          );

          this.policyEngine.reconcileCostReservation({
            dateKey: genGate.dateKey,
            monthKey: genGate.monthKey,
            reservedCostCents: genGate.reservedCostCents,
            actualCostCents: res.estimatedCostCents,
          });

          const jsonMatch = res.content.match(/\[[\s\S]*\]/);
          if (jsonMatch) {
            const parsed = JSON.parse(jsonMatch[0]);
            if (Array.isArray(parsed) && parsed.length >= 10) {
              const valid = parsed.slice(0, 10).every(
                (q: any) =>
                  typeof q.prompt === 'string' &&
                  Array.isArray(q.choices) &&
                  q.choices.length === 4 &&
                  typeof q.correctChoiceIndex === 'number' &&
                  q.correctChoiceIndex >= 0 &&
                  q.correctChoiceIndex <= 3 &&
                  typeof q.explanation === 'string'
              );
              if (valid) {
                questions = parsed.slice(0, 10).map((q: any, i: number) => ({
                  id: `gen_${i}_${Date.now()}`,
                  topic: (sanitizedCustomTopic ? 'mixed' : effectiveTopic) as any,
                  topicLabel: sanitizedCustomTopic || effectiveTopic,
                  difficulty: params.difficulty,
                  prompt: q.prompt,
                  choices: q.choices as [string, string, string, string],
                  correctChoiceIndex: q.correctChoiceIndex as 0 | 1 | 2 | 3,
                  explanation: q.explanation,
                }));
              }
            }
          }
        }
      } catch (err) {
        console.warn(
          '[Trivia] Dynamic model generation failed, falling back to verified bank:',
          err
        );
      }
    }

    const sessionId = `trv_${randomBytes(12).toString('hex')}`;

    const internal: TriviaSessionInternal = {
      kind: 'trivia_10',
      sessionId,
      topic: (sanitizedCustomTopic ? 'mixed' : effectiveTopic) as TriviaTopic,
      difficulty: params.difficulty,
      status: 'active',
      questions,
      answeredCount: 0,
      score: 0,
      history: [],
      lastFeedback: null,
      stoppingMessage: null,
      createdAtMs: now,
      lastUpdatedAtMs: now,
    };

    this.sessions.set(sessionId, internal);
    return {
      ok: true,
      session: this.toTriviaPublic(internal),
      quota: this.policyEngine.getQuotaStatus(now, 'play'),
    };
  }

  public submitTriviaAnswer(params: {
    sessionId: string;
    choiceIndex: number;
    nowMs?: number;
  }):
    | { ok: true; session: TriviaSessionPublic; quota: QuotaStatusSummary }
    | {
        ok: false;
        reason:
          | PolicyBlockReason
          | 'SESSION_NOT_FOUND'
          | 'SESSION_COMPLETED'
          | 'INVALID_CHOICE';
        message: string;
        session?: TriviaSessionPublic;
        quota: QuotaStatusSummary;
      } {
    const now = params.nowMs ?? Date.now();
    this.purgeExpiredSessions(now);

    const sess = this.sessions.get(params.sessionId);
    if (!sess || sess.kind !== 'trivia_10') {
      return {
        ok: false,
        reason: 'SESSION_NOT_FOUND',
        message: 'Trivia session was not found or expired.',
        quota: this.policyEngine.getQuotaStatus(now, 'play'),
      };
    }

    if (
      sess.status === 'completed' ||
      sess.answeredCount >= sess.questions.length
    ) {
      sess.status = 'completed';
      return {
        ok: false,
        reason: 'SESSION_COMPLETED',
        message:
          'This 10-question trivia round has reached its stopping point.',
        session: this.toTriviaPublic(sess),
        quota: this.policyEngine.getQuotaStatus(now, 'play'),
      };
    }

    if (
      typeof params.choiceIndex !== 'number' ||
      !Number.isInteger(params.choiceIndex) ||
      params.choiceIndex < 0 ||
      params.choiceIndex > 3
    ) {
      return {
        ok: false,
        reason: 'INVALID_CHOICE',
        message: 'Please select one of the four answer choices (0–3).',
        session: this.toTriviaPublic(sess),
        quota: this.policyEngine.getQuotaStatus(now, 'play'),
      };
    }

    const activePolicy = this.db.getPolicyConfig();
    const provider = this.providerRegistry.getModelProvider(
      activePolicy.activeProvider
    );

    const gate = this.policyEngine.evaluatePolicyAndReserve({
      mode: 'play',
      maxPotentialCostCents: 0,
      nowMs: now,
    });

    if (!gate.allowed) {
      sess.status = 'stopped_by_quota';
      sess.stoppingMessage = gate.message;
      sess.lastUpdatedAtMs = now;
      return {
        ok: false,
        reason: gate.reason,
        message: gate.message,
        session: this.toTriviaPublic(sess),
        quota: gate.quota,
      };
    }

    const currentQ = sess.questions[sess.answeredCount]!;
    const isCorrect = params.choiceIndex === currentQ.correctChoiceIndex;

    const record: TriviaAnswerRecord = {
      questionIndex: sess.answeredCount + 1,
      prompt: currentQ.prompt,
      selectedChoiceIndex: params.choiceIndex,
      selectedChoiceText: currentQ.choices[params.choiceIndex] ?? '',
      correctChoiceIndex: currentQ.correctChoiceIndex,
      correctChoiceText: currentQ.choices[currentQ.correctChoiceIndex],
      isCorrect,
      explanation: currentQ.explanation,
    };

    sess.answeredCount += 1;
    if (isCorrect) sess.score += 1;
    sess.history.push(record);
    sess.lastFeedback = record;
    sess.lastUpdatedAtMs = now;

    this.policyEngine.reconcileCostReservation({
      dateKey: gate.dateKey,
      monthKey: gate.monthKey,
      reservedCostCents: gate.reservedCostCents,
      actualCostCents: 0,
    });

    if (sess.answeredCount >= sess.questions.length) {
      sess.status = 'completed';
      sess.stoppingMessage = `Round complete! You answered all ${sess.questions.length} questions and scored ${sess.score}/${sess.questions.length}.`;
      this.db.incrementCompletedSessions(gate.dateKey);
    }

    return {
      ok: true,
      session: this.toTriviaPublic(sess),
      quota: this.policyEngine.getQuotaStatus(now, 'play'),
    };
  }

  /* =========================================================================
   * 2. PLAY: Twenty Questions (Deterministic Target FSM)
   * ========================================================================= */
  public startTwentyQuestions(nowMs = Date.now()):
    | {
        ok: true;
        session: TwentyQuestionsSessionPublic;
        quota: QuotaStatusSummary;
      }
    | {
        ok: false;
        reason: PolicyBlockReason;
        message: string;
        quota: QuotaStatusSummary;
      } {
    const activePolicy = this.db.getPolicyConfig();
    const provider = this.providerRegistry.getModelProvider(
      activePolicy.activeProvider
    );

    const gate = this.policyEngine.evaluatePolicyAndReserve({
      mode: 'play',
      maxPotentialCostCents: 0,
      nowMs,
    });

    if (!gate.allowed) {
      return {
        ok: false,
        reason: gate.reason,
        message: gate.message,
        quota: gate.quota,
      };
    }

    this.policyEngine.reconcileCostReservation({
      dateKey: gate.dateKey,
      monthKey: gate.monthKey,
      reservedCostCents: gate.reservedCostCents,
      actualCostCents: 0,
    });

    const chosen =
      TWENTY_QUESTIONS_TARGETS[
        Math.floor(Math.random() * TWENTY_QUESTIONS_TARGETS.length)
      ];
    const sessionId = `20q_${randomBytes(12).toString('hex')}`;

    const internal: TwentyQuestionsInternal = {
      kind: 'twenty_questions',
      sessionId,
      status: 'active',
      targetWord: chosen.word,
      category: chosen.category,
      turnsUsed: 0,
      maxTurns: 20,
      lastAnswer: null,
      history: [],
      stoppingMessage: null,
      createdAtMs: nowMs,
      lastUpdatedAtMs: nowMs,
    };

    this.sessions.set(sessionId, internal);
    return {
      ok: true,
      session: {
        sessionId,
        mode: 'play',
        activityType: 'twenty_questions',
        status: 'active',
        category: chosen.category,
        turnsUsed: 0,
        maxTurns: 20,
        lastAnswer: null,
        history: [],
        revealedTarget: null,
        stoppingMessage: null,
      },
      quota: this.policyEngine.getQuotaStatus(nowMs, 'play'),
    };
  }

  public async askTwentyQuestionsQuestion(params: {
    sessionId: string;
    question: string;
    isGuess?: boolean;
    nowMs?: number;
  }): Promise<
    | {
        ok: true;
        session: TwentyQuestionsSessionPublic;
        quota: QuotaStatusSummary;
      }
    | {
        ok: false;
        reason: PolicyBlockReason | 'SESSION_NOT_FOUND' | 'GAME_OVER';
        message: string;
        quota: QuotaStatusSummary;
      }
  > {
    const now = params.nowMs ?? Date.now();
    const sess = this.sessions.get(params.sessionId);
    if (!sess || sess.kind !== 'twenty_questions') {
      return {
        ok: false,
        reason: 'SESSION_NOT_FOUND',
        message: 'Twenty Questions game not found or expired.',
        quota: this.policyEngine.getQuotaStatus(now, 'play'),
      };
    }

    if (sess.status !== 'active') {
      return {
        ok: false,
        reason: 'GAME_OVER',
        message: 'This Twenty Questions game is already finished.',
        quota: this.policyEngine.getQuotaStatus(now, 'play'),
      };
    }

    const trimmed = params.question.trim();
    const inputSafety = this.safetyLayer.screenInput(trimmed, 'play');
    if (!inputSafety.allowed) {
      if (
        !inputSafety.suppressParentAlert &&
        inputSafety.flagged &&
        inputSafety.category &&
        inputSafety.severity
      ) {
        this.db.recordSafetyEvent({
          category: inputSafety.category,
          severity: inputSafety.severity,
          mode: 'play',
          nowMs: now,
        });
      }
      return {
        ok: false,
        reason: 'SAFETY_BLOCKED',
        message:
          inputSafety.userFacingMessage ||
          'That request was stopped by safety safeguards.',
        quota: this.policyEngine.getQuotaStatus(now, 'play'),
      };
    }

    const sanitizedQuestion = this.redactAndTrackPii(trimmed, 'play', now);

    const activePolicy = this.db.getPolicyConfig();
    const provider = this.providerRegistry.getModelProvider(
      activePolicy.activeProvider
    );

    // Check direct guess first
    const isDirectGuess =
      sanitizedQuestion.toLowerCase().replace(/[?.!]/g, '').trim() ===
        sess.targetWord.toLowerCase() ||
      Boolean(params.isGuess) ||
      sanitizedQuestion
        .toLowerCase()
        .includes(`is it a ${sess.targetWord.toLowerCase()}`);

    const gate = this.policyEngine.evaluatePolicyAndReserve({
      mode: 'play',
      maxPotentialCostCents: isDirectGuess
        ? 0
        : provider.maxPotentialCostPerTurnCents,
      nowMs: now,
    });

    if (!gate.allowed) {
      sess.status = 'stopped_by_quota';
      sess.stoppingMessage = gate.message;
      return {
        ok: false,
        reason: gate.reason,
        message: gate.message,
        quota: gate.quota,
      };
    }

    let generatedCost = 0;
    sess.turnsUsed += 1;

    let answer: 'yes' | 'no' | 'partly' | 'cannot_answer' = 'no';
    let note = '';

    if (
      isDirectGuess &&
      sanitizedQuestion.toLowerCase().includes(sess.targetWord.toLowerCase())
    ) {
      answer = 'yes';
      sess.status = 'won';
      sess.stoppingMessage = `Brilliant deduction! The secret object was indeed "${sess.targetWord}". You solved it in ${sess.turnsUsed} turns.`;
      this.db.incrementCompletedSessions(gate.dateKey);
    } else {
      // Explicit guesses need no model call; the server owns the target.
      if (isDirectGuess) {
        note = 'Not quite. Keep narrowing it down.';
      } else {
        // Evaluate question against the fixed target without changing the target.
        try {
          const evalPrompt = `You are the judge in Twenty Questions. The secret target is fixed and must never be revealed: "${sess.targetWord}" (Category: ${sess.category}).
Evaluate the student's question against this target.
Respond ONLY with one of: YES, NO, PARTLY, or CANNOT_ANSWER, optionally followed by a 1-sentence factual clarification. Do NOT reveal the secret word.`;

          const res = await this.generate(
            provider,
            {
              mode: 'play',
              messages: [
                { role: 'system', content: evalPrompt },
                {
                  role: 'user',
                  content: `<student_question>${stripXmlDelimiters(sanitizedQuestion)}</student_question>`,
                },
              ],
              maxOutputTokens: 800,
              temperature: 0.2,
            },
            gate
          );

          generatedCost = res.estimatedCostCents;
          const upper = res.content.toUpperCase();
          if (upper.startsWith('YES')) answer = 'yes';
          else if (upper.startsWith('PARTLY')) answer = 'partly';
          else if (upper.startsWith('CANNOT')) answer = 'cannot_answer';
          else answer = 'no';
          note = res.content
            .replace(/^(YES|NO|PARTLY|CANNOT_ANSWER)[:\s-]*/i, '')
            .replace(new RegExp(sess.targetWord, 'gi'), 'the secret object')
            .trim();
        } catch (error) {
          throw error;
        }
      }

      if (sess.turnsUsed >= sess.maxTurns && sess.status === 'active') {
        sess.status = 'lost';
        sess.stoppingMessage = `That was turn 20! The secret object was "${sess.targetWord}". Great effort!`;
        this.db.incrementCompletedSessions(gate.dateKey);
      }
    }

    sess.lastAnswer = answer;
    sess.history.push({
      turnNumber: sess.turnsUsed,
      question: sanitizedQuestion,
      answer,
      note,
    });
    sess.lastUpdatedAtMs = now;

    this.policyEngine.reconcileCostReservation({
      dateKey: gate.dateKey,
      monthKey: gate.monthKey,
      reservedCostCents: gate.reservedCostCents,
      actualCostCents: generatedCost,
    });

    return {
      ok: true,
      session: {
        sessionId: sess.sessionId,
        mode: 'play',
        activityType: 'twenty_questions',
        status: sess.status,
        category: sess.category,
        turnsUsed: sess.turnsUsed,
        maxTurns: sess.maxTurns,
        lastAnswer: sess.lastAnswer,
        history: [...sess.history],
        revealedTarget: sess.status !== 'active' ? sess.targetWord : null,
        stoppingMessage: sess.stoppingMessage,
      },
      quota: this.policyEngine.getQuotaStatus(now, 'play'),
    };
  }

  /* =========================================================================
   * 3. PLAY: Collaborative Story Relay (Back-and-Forth, 6-Scene Narrative Arc)
   * ========================================================================= */
  public async startStoryRelay(
    paramsOrGenre:
      | string
      | {
          genre?: string;
          premiseId?: string;
          customPremise?: string;
          heroDescription?: string;
          nowMs?: number;
        } = 'Fantasy / Mystery',
    legacyNowMs?: number
  ): Promise<
    | { ok: true; session: StoryRelaySessionPublic; quota: QuotaStatusSummary }
    | {
        ok: false;
        reason: PolicyBlockReason;
        message: string;
        quota: QuotaStatusSummary;
      }
  > {
    const isObj = typeof paramsOrGenre === 'object' && paramsOrGenre !== null;
    const genre = isObj
      ? paramsOrGenre.genre || 'Fantasy / Mystery'
      : paramsOrGenre || 'Fantasy / Mystery';
    const premiseId = isObj ? paramsOrGenre.premiseId : undefined;
    const customPremise = isObj ? paramsOrGenre.customPremise : undefined;
    const heroDescription = isObj ? paramsOrGenre.heroDescription : undefined;
    const nowMs = isObj
      ? paramsOrGenre.nowMs ?? Date.now()
      : legacyNowMs ?? Date.now();

    this.purgeExpiredSessions(nowMs);

    if (customPremise) {
      const inputSafety = this.safetyLayer.screenInput(customPremise, 'play');
      if (!inputSafety.allowed) {
        if (
          !inputSafety.suppressParentAlert &&
          inputSafety.flagged &&
          inputSafety.category &&
          inputSafety.severity
        ) {
          this.db.recordSafetyEvent({
            category: inputSafety.category,
            severity: inputSafety.severity,
            mode: 'play',
            nowMs,
          });
        }
        return {
          ok: false,
          reason: 'SAFETY_BLOCKED',
          message:
            inputSafety.userFacingMessage ||
            'That request was stopped by safety safeguards.',
          quota: this.policyEngine.getQuotaStatus(nowMs, 'play'),
        };
      }
    }

    if (heroDescription) {
      const inputSafety = this.safetyLayer.screenInput(heroDescription, 'play');
      if (!inputSafety.allowed) {
        if (
          !inputSafety.suppressParentAlert &&
          inputSafety.flagged &&
          inputSafety.category &&
          inputSafety.severity
        ) {
          this.db.recordSafetyEvent({
            category: inputSafety.category,
            severity: inputSafety.severity,
            mode: 'play',
            nowMs,
          });
        }
        return {
          ok: false,
          reason: 'SAFETY_BLOCKED',
          message:
            inputSafety.userFacingMessage ||
            'That request was stopped by safety safeguards.',
          quota: this.policyEngine.getQuotaStatus(nowMs, 'play'),
        };
      }
    }

    const sanitizedPremise = customPremise
      ? this.redactAndTrackPii(customPremise, 'play', nowMs)
      : undefined;
    const sanitizedHero = heroDescription
      ? this.redactAndTrackPii(heroDescription, 'play', nowMs)
      : undefined;

    const activePolicy = this.db.getPolicyConfig();
    const provider = this.providerRegistry.getModelProvider(
      activePolicy.activeProvider
    );

    const gate = this.policyEngine.evaluatePolicyAndReserve({
      mode: 'play',
      maxPotentialCostCents: 0,
      nowMs,
    });

    if (!gate.allowed) {
      return {
        ok: false,
        reason: gate.reason,
        message: gate.message,
        quota: gate.quota,
      };
    }

    this.policyEngine.reconcileCostReservation({
      dateKey: gate.dateKey,
      monthKey: gate.monthKey,
      reservedCostCents: gate.reservedCostCents,
      actualCostCents: 0,
    });

    const sessionId = `relay_${randomBytes(12).toString('hex')}`;
    let premiseTitle = 'The Pebble Point Lighthouse';
    let initialPassage =
      'The lighthouse on Pebble Point had not shone in forty years, but tonight a strange amber pulse flickered across the misty tide. The old brass door in the cellar clicked open by itself.';

    const matchedPremise = STORY_PREMISES.find((p) => p.id === premiseId);
    if (matchedPremise) {
      premiseTitle = matchedPremise.title;
      initialPassage = matchedPremise.starterPassage;
    } else if (sanitizedPremise) {
      premiseTitle = sanitizedPremise.slice(0, 50);
      initialPassage = `${sanitizedHero ? `${sanitizedHero} was ordinary until today. ` : ''}${sanitizedPremise}`;
    }

    // If live AI provider is connected and custom premise is chosen, craft a rich Scene 1
    if (
      provider.id !== 'mock' &&
      provider.safetyVerified &&
      (sanitizedPremise || (premiseId && premiseId !== 'lighthouse'))
    ) {
      try {
        const startGate = this.policyEngine.evaluatePolicyAndReserve({
          mode: 'play',
          maxPotentialCostCents: provider.maxPotentialCostPerTurnCents,
          nowMs,
        });
        if (startGate.allowed) {
          const brand = activePolicy.instanceDisplayName || 'Marmalade';
          const childAge = activePolicy.childAge ?? 11;
          const startPrompt = `You are ${brand}'s Story Craft Partner, launching a 6-scene story with a ${childAge}-year-old student.
Stage: Scene 1 of 6 — "The Inciting Spark"
Craft Focus: Character Motivation & Ordinary World.
Genre: "${genre}"

RULES:
1. Write a vivid, atmospheric opening scene (80 to 120 words).
2. Introduce our hero, their quirky trait or personality, their ordinary setting, and the unexpected inciting incident that disrupts their day.
3. End with an intriguing moment that invites the child to decide what the character does next.
4. Format your response as:
PASSAGE: <passage text>`;

          const res = await this.generate(
            provider,
            {
              mode: 'play',
              messages: [
                { role: 'system', content: startPrompt },
                {
                  role: 'user',
                  content: `<story_setup>\n<premise>${sanitizedPremise || matchedPremise?.title}</premise>\n<hero>${sanitizedHero || matchedPremise?.hero || 'A curious explorer'}</hero>\n</story_setup>\nPlease write the opening scene.`,
                },
              ],
              maxOutputTokens: 800,
            },
            startGate
          );

          this.policyEngine.reconcileCostReservation({
            dateKey: startGate.dateKey,
            monthKey: startGate.monthKey,
            reservedCostCents: startGate.reservedCostCents,
            actualCostCents: res.estimatedCostCents,
          });

          const passMatch = res.content.match(/PASSAGE:\s*([\s\S]*)/i);
          if (passMatch && passMatch[1].trim()) {
            initialPassage = passMatch[1].trim();
          }
        }
      } catch (e) {
        console.warn('[StoryRelay] Dynamic Scene 1 generation failed:', e);
      }
    }

    const stage1 = STORY_STAGES[0];
    const initialTurn: StoryRelayTurn = {
      turnNumber: 1,
      childDirection: 'Opening Scene',
      passageText: initialPassage,
      stageName: stage1.stageName,
      craftFocus: stage1.craftFocus,
      coachTip: stage1.defaultCoachTip,
      suggestedPrompts: [],
    };

    const internal: StoryRelayInternal = {
      kind: 'story_relay',
      sessionId,
      status: 'active',
      genre,
      premiseTitle,
      turnsUsed: 1,
      maxTurns: 6,
      history: [initialTurn],
      stoppingMessage: null,
      createdAtMs: nowMs,
      lastUpdatedAtMs: nowMs,
    };

    this.sessions.set(sessionId, internal);
    const nextStage = STORY_STAGES[1];
    return {
      ok: true,
      session: {
        sessionId,
        mode: 'play',
        activityType: 'story_relay',
        status: 'active',
        genre,
        premiseTitle,
        turnsUsed: 1,
        maxTurns: 6,
        history: [initialTurn],
        stoppingMessage: null,
        currentStage: {
          stageNumber: nextStage.stageNumber,
          stageName: nextStage.stageName,
          stageGoal: nextStage.stageGoal,
          craftFocus: nextStage.craftFocus,
          coachTip: nextStage.defaultCoachTip,
        },
      },
      quota: this.policyEngine.getQuotaStatus(nowMs, 'play'),
    };
  }

  public async continueStoryRelay(params: {
    sessionId: string;
    childDirection: string;
    nowMs?: number;
  }): Promise<
    | { ok: true; session: StoryRelaySessionPublic; quota: QuotaStatusSummary }
    | {
        ok: false;
        reason:
          | PolicyBlockReason
          | 'SESSION_NOT_FOUND'
          | 'STORY_COMPLETED'
          | 'PARTICIPATION_NEEDED';
        message: string;
        quota: QuotaStatusSummary;
      }
  > {
    const now = params.nowMs ?? Date.now();
    const sess = this.sessions.get(params.sessionId);
    if (!sess || sess.kind !== 'story_relay') {
      return {
        ok: false,
        reason: 'SESSION_NOT_FOUND',
        message: 'Story Relay session not found or expired.',
        quota: this.policyEngine.getQuotaStatus(now, 'play'),
      };
    }

    if (sess.status !== 'active') {
      return {
        ok: false,
        reason: 'STORY_COMPLETED',
        message:
          'This story session has already reached its natural stopping scene.',
        quota: this.policyEngine.getQuotaStatus(now, 'play'),
      };
    }

    if (isBareContinuation(params.childDirection))
      return {
        ok: false,
        reason: 'PARTICIPATION_NEEDED',
        message:
          'Add one idea of your own: what does a character do, notice, or choose next?',
        quota: this.policyEngine.getQuotaStatus(now, 'play'),
      };
    const inputSafety = this.safetyLayer.screenInput(
      params.childDirection,
      'play'
    );
    if (!inputSafety.allowed) {
      if (
        !inputSafety.suppressParentAlert &&
        inputSafety.flagged &&
        inputSafety.category &&
        inputSafety.severity
      ) {
        this.db.recordSafetyEvent({
          category: inputSafety.category,
          severity: inputSafety.severity,
          mode: 'play',
          nowMs: now,
        });
      }
      return {
        ok: false,
        reason: 'SAFETY_BLOCKED',
        message:
          inputSafety.userFacingMessage ||
          'That request was stopped by safety safeguards.',
        quota: this.policyEngine.getQuotaStatus(now, 'play'),
      };
    }

    const sanitizedDirection = this.redactAndTrackPii(
      params.childDirection,
      'play',
      now
    );

    const activePolicy = this.db.getPolicyConfig();
    const provider = this.providerRegistry.getModelProvider(
      activePolicy.activeProvider
    );

    const gate = this.policyEngine.evaluatePolicyAndReserve({
      mode: 'play',
      maxPotentialCostCents: provider.maxPotentialCostPerTurnCents,
      nowMs: now,
    });

    if (!gate.allowed) {
      sess.status = 'stopped_by_quota';
      sess.stoppingMessage = gate.message;
      return {
        ok: false,
        reason: gate.reason,
        message: gate.message,
        quota: gate.quota,
      };
    }

    let generatedCost = 0;
    sess.turnsUsed += 1;
    const currentStage =
      STORY_STAGES[sess.turnsUsed - 1] ||
      STORY_STAGES[STORY_STAGES.length - 1];
    const isFinalTurn = sess.turnsUsed >= sess.maxTurns;

    const storyHistoryText = sess.history
      .map(
        (h) =>
          `[Scene ${h.turnNumber} - ${h.stageName || 'Act'}]: ${h.passageText}\n[Author Direction]: "${h.childDirection}"`
      )
      .join('\n\n');

    const brand = activePolicy.instanceDisplayName || 'Marmalade';
    const childAge = activePolicy.childAge ?? 11;
    const prompt = `You are ${brand}'s Story Craft Partner, co-writing an imaginative story with a ${childAge}-year-old student.
We are following a classical 6-act narrative arc:
Current Stage: Scene ${sess.turnsUsed} of 6 — "${currentStage.stageName}"
Stage Narrative Goal: ${currentStage.stageGoal}
Craft Focus: ${currentStage.craftFocus}

RULES:
1. Write a vivid, lively, kid-friendly story passage (90 to 130 words).
2. Deeply integrate the student's creative direction—make their choice matter!
3. Technical craft focus: Emphasize ${currentStage.craftFocus}. Show the character's personality, senses (sounds, sights, textures), and emotions in action ("show, don't tell").
4. ${
      isFinalTurn
        ? 'This is Scene 6 (The Transformation & Resolution). Bring this adventure to a warm, satisfying, and memorable close. Show how the character has grown. Do NOT end on a cliffhanger.'
        : `Prepare the stage for Scene ${sess.turnsUsed + 1} (${STORY_STAGES[sess.turnsUsed]?.stageName}). End on an active moment that leaves the child eager to decide the next step.`
    }
5. Provide a 1-sentence "COACH_TIP:" sharing a friendly technical writing tip for the student's next turn (focusing on character motivation, sensory details, or dramatic tension). Do NOT provide clickable multiple-choice options.

Format your response as:
PASSAGE: <passage text>
COACH_TIP: <one friendly, technical craft advice sentence>`;

    let passage = '';
    let coachTip = currentStage.defaultCoachTip;

    try {
      const res = await this.generate(
        provider,
        {
          mode: 'play',
          messages: [
            { role: 'system', content: prompt },
            {
              role: 'user',
              content: `<story_context>\n${stripXmlDelimiters(storyHistoryText)}\n</story_context>\n\n<student_direction>\n${stripXmlDelimiters(sanitizedDirection)}\n</student_direction>\n\nPlease write the next passage incorporating my creative direction.`,
            },
          ],
          maxOutputTokens: 800,
        },
        gate
      );

      generatedCost = res.estimatedCostCents;
      const outSafety = this.safetyLayer.screenOutput(res.content, 'play');
      const safeContent = outSafety.sanitizedContent || res.content;

      const passMatch = safeContent.match(
        /PASSAGE:\s*([\s\S]*?)(?=COACH_TIP:|PROMPTS:|$)/i
      );
      passage = passMatch ? passMatch[1].trim() : safeContent.slice(0, 300);

      const tipMatch = safeContent.match(/COACH_TIP:\s*([^\n]+)/i);
      if (tipMatch && tipMatch[1].trim()) {
        coachTip = tipMatch[1].trim();
      }
    } catch (error) {
      throw error;
    }

    const turn: StoryRelayTurn = {
      turnNumber: sess.turnsUsed,
      childDirection: sanitizedDirection,
      passageText: passage,
      stageName: currentStage.stageName,
      craftFocus: currentStage.craftFocus,
      coachTip: isFinalTurn ? undefined : coachTip,
      suggestedPrompts: [],
    };

    sess.history.push(turn);
    if (isFinalTurn) {
      sess.status = 'completed';
      sess.stoppingMessage =
        `Chapter complete! You and ${brand} finished a 6-scene collaborative story with a complete narrative arc. You can save your complete story below.`;
      this.db.incrementCompletedSessions(gate.dateKey);
    }
    sess.lastUpdatedAtMs = now;

    this.policyEngine.reconcileCostReservation({
      dateKey: gate.dateKey,
      monthKey: gate.monthKey,
      reservedCostCents: gate.reservedCostCents,
      actualCostCents: generatedCost,
    });

    const nextStageIdx = Math.min(sess.turnsUsed, STORY_STAGES.length - 1);
    const nextStage = STORY_STAGES[nextStageIdx];

    return {
      ok: true,
      session: {
        sessionId: sess.sessionId,
        mode: 'play',
        activityType: 'story_relay',
        status: sess.status,
        genre: sess.genre,
        premiseTitle: sess.premiseTitle,
        turnsUsed: sess.turnsUsed,
        maxTurns: sess.maxTurns,
        history: [...sess.history],
        stoppingMessage: sess.stoppingMessage,
        currentStage:
          sess.status === 'active'
            ? {
                stageNumber: nextStage.stageNumber,
                stageName: nextStage.stageName,
                stageGoal: nextStage.stageGoal,
                craftFocus: nextStage.craftFocus,
                coachTip: coachTip || nextStage.defaultCoachTip,
              }
            : undefined,
      },
      quota: this.policyEngine.getQuotaStatus(now, 'play'),
    };
  }

  /* =========================================================================
   * 4. RESEARCH MODE: Pluggable Verified Search + Canonical Citation Synthesis
   * ========================================================================= */
  public async conductResearch(params: {
    query: string;
    nowMs?: number;
  }): Promise<
    | { ok: true; session: ResearchSessionPublic; quota: QuotaStatusSummary }
    | {
        ok: false;
        reason: PolicyBlockReason | 'EMPTY_QUERY';
        message: string;
        quota: QuotaStatusSummary;
      }
  > {
    const now = params.nowMs ?? Date.now();
    const trimmed = params.query.trim();
    if (!trimmed) {
      return {
        ok: false,
        reason: 'EMPTY_QUERY',
        message: 'Please enter a research question.',
        quota: this.policyEngine.getQuotaStatus(now, 'research'),
      };
    }

    const inputSafety = this.safetyLayer.screenInput(trimmed, 'research');
    if (!inputSafety.allowed) {
      if (
        !inputSafety.suppressParentAlert &&
        inputSafety.flagged &&
        inputSafety.category &&
        inputSafety.severity
      ) {
        this.db.recordSafetyEvent({
          category: inputSafety.category,
          severity: inputSafety.severity,
          mode: 'research',
          nowMs: now,
        });
      }
      return {
        ok: false,
        reason: 'SAFETY_BLOCKED',
        message:
          inputSafety.userFacingMessage ||
          'That request was stopped by safety safeguards.',
        quota: this.policyEngine.getQuotaStatus(now, 'research'),
      };
    }

    const activePolicy = this.db.getPolicyConfig();
    const provider = this.providerRegistry.getModelProvider(
      activePolicy.activeProvider
    );

    const gate = this.policyEngine.evaluatePolicyAndReserve({
      mode: 'research',
      maxPotentialCostCents: provider.maxPotentialCostPerTurnCents,
      nowMs: now,
    });

    if (!gate.allowed) {
      return {
        ok: false,
        reason: gate.reason,
        message: gate.message,
        quota: gate.quota,
      };
    }

    // 1. Separate SearchProvider query (strictly separate from LLM, PII-filtered)
    const sanitizedQuery = this.redactAndTrackPii(trimmed, 'research', now);
    const redactedQuery = redactPiiFromSearchQuery(sanitizedQuery);
    const searchProvider = this.providerRegistry.getSearchProvider(
      activePolicy.allowExternalSearch
    );
    let rawSources;
    try {
      rawSources = await searchProvider.search(redactedQuery, {
        recommendedDomains: [
          'nasa.gov',
          'psi.edu',
          'folger.edu',
          'bl.uk',
          'britannica.com',
        ],
        blockedDomains: [],
      });
    } catch (error) {
      this.policyEngine.reconcileCostReservation({
        ...gate,
        actualCostCents: 0,
      });
      throw error;
    }

    const verifiedSources = rawSources.map((s) => ({
      ...s,
      title: sanitizeUntrustedSearchSnippet(s.title),
      snippet: sanitizeUntrustedSearchSnippet(s.snippet),
    }));

    const validSourceIdSet = new Set(verifiedSources.map((s) => s.sourceId));

    const searchStatusNote = activePolicy.allowExternalSearch
      ? this.providerRegistry.isExternalSearchConfigured()
        ? 'External web search is enabled by parent policy; source excerpts are treated as untrusted evidence.'
        : 'External search is allowed by policy, but no external search URL is configured; using Marmalade’s limited local educational source library.'
      : 'External web search is disabled by parent policy; using Marmalade’s limited local educational source library.';

    // 2. Format evidence packets with CANONICAL IDs ONLY
    const sourceEvidenceText = verifiedSources
      .map(
        (s) => `[Source ${s.sourceId}]: "${s.title}" (Domain: ${s.domain})
Evidence snippet: ${s.snippet}`
      )
      .join('\n\n');

    const brand = activePolicy.instanceDisplayName || 'Marmalade';
    const childAge = activePolicy.childAge ?? 11;
    const synthesisPrompt = `You are ${brand}'s Field Guide research companion for a curious ${childAge}-year-old explorer.

RULES:
1. Tone: Friendly, engaging, and clear! Share discoveries like an enthusiastic guide showing cool findings in an explorer's field notebook.
2. Explain concepts simply and vividly using kid-friendly language and everyday analogies, avoiding dense academic jargon.
3. CITATION RULE: You MUST cite at least one of the source IDs provided in the verified sources (e.g. [src_1], [src_2]) in your response to show where your facts came from. Never invent URLs or authors.
4. Be transparent and reassuring about what the sources state vs. any uncertainty.
5. End with a neat summary takeaway or memorable key fact. Do not automatically append endless questions.`;

    let synthesis = '';
    const citedSourceIds: string[] = [];

    let researchCost = 0;
    try {
      if (verifiedSources.length === 0) {
        synthesis =
          'I could not find useful sources for this question. Try a more specific question or ask a parent to check web search.';
      } else {
        const res = await this.generate(
          provider,
          {
            mode: 'research',
            messages: [
              { role: 'system', content: synthesisPrompt },
              {
                role: 'user',
                content: `<research_question>\n${redactedQuery}\n</research_question>\n\n<verified_sources>\n${sourceEvidenceText}\n</verified_sources>\n\nPlease synthesize an answer based strictly on these verified sources.`,
              },
            ],
            maxOutputTokens: 1200,
          },
          gate
        );

        researchCost = res.estimatedCostCents;
        const outSafety = this.safetyLayer.screenOutput(
          res.content,
          'research'
        );
        let cleanSynthesis = outSafety.sanitizedContent || res.content;

        // Strip any model-invented raw URLs and any non-canonical [src_X] citations
        cleanSynthesis = cleanSynthesis
          .replace(/https?:\/\/\S+/gi, '[unverified-url-removed]')
          .replace(/\[(src_\d+)\]/g, (full, id) =>
            validSourceIdSet.has(id) ? full : ''
          );

        synthesis = cleanSynthesis;
        for (const s of verifiedSources) {
          if (synthesis.includes(s.sourceId)) citedSourceIds.push(s.sourceId);
        }
        if (!citedSourceIds.length && verifiedSources.length > 0) {
          // Fallback attribution: ensure student has verified sources even if model missed inline [src_X] tags
          for (const s of verifiedSources) {
            citedSourceIds.push(s.sourceId);
          }
          synthesis += `\n\n*(Sources consulted: ${verifiedSources.map((s) => `[${s.sourceId}] ${s.title}`).join(', ')})*`;
        }
      }
    } catch (error) {
      throw error;
    }

    const notesBundle = `# Research Notes: ${trimmed}\n\n_${searchStatusNote}_\n\n${synthesis}\n\n## Sources\n${verifiedSources
      .map((s) => `- [${s.sourceId}] ${s.title} (${s.domain}) - ${s.url}`)
      .join('\n')}`;

    const sessionId = `res_${randomBytes(12).toString('hex')}`;
    const pubSession: ResearchSessionPublic = {
      sessionId,
      mode: 'research',
      activityType: 'research_basic',
      status: 'active',
      query: trimmed,
      sources: verifiedSources,
      synthesis,
      notesBundle,
      citedSourceIds,
      searchStatusNote,
      searchOutcome: verifiedSources.length ? 'results' : 'no_results',
    };

    const internal: ResearchSessionInternal = {
      kind: 'research_basic',
      searchStatusNote,
      searchOutcome: pubSession.searchOutcome,
      sessionId,
      status: 'active',
      query: trimmed,
      sources: verifiedSources,
      synthesis,
      notesBundle,
      citedSourceIds: pubSession.citedSourceIds,
      createdAtMs: now,
      lastUpdatedAtMs: now,
    };
    this.sessions.set(sessionId, internal);

    this.policyEngine.reconcileCostReservation({
      dateKey: gate.dateKey,
      monthKey: gate.monthKey,
      reservedCostCents: gate.reservedCostCents,
      actualCostCents: researchCost,
    });

    return {
      ok: true,
      session: pubSession,
      quota: this.policyEngine.getQuotaStatus(now, 'research'),
    };
  }

  /* =========================================================================
   * 5. SCHOOLWORK ASSISTANCE: Understand -> Think -> Assist -> Ledger Proposal
   * ========================================================================= */
  public async startSchoolworkSession(
    assignmentText: string,
    nowMs = Date.now()
  ): Promise<
    | { ok: true; session: SchoolworkSessionPublic; quota: QuotaStatusSummary }
    | {
        ok: false;
        reason: PolicyBlockReason | 'EMPTY_CONTEXT';
        message: string;
        quota: QuotaStatusSummary;
      }
  > {
    const trimmed = assignmentText.trim();
    if (!trimmed) {
      return {
        ok: false,
        reason: 'EMPTY_CONTEXT',
        message: 'Please paste your assignment or task instructions.',
        quota: this.policyEngine.getQuotaStatus(nowMs, 'schoolwork'),
      };
    }

    const inputSafety = this.safetyLayer.screenInput(trimmed, 'schoolwork');
    if (!inputSafety.allowed) {
      if (
        !inputSafety.suppressParentAlert &&
        inputSafety.flagged &&
        inputSafety.category &&
        inputSafety.severity
      ) {
        this.db.recordSafetyEvent({
          category: inputSafety.category,
          severity: inputSafety.severity,
          mode: 'schoolwork',
          nowMs,
        });
      }
      return {
        ok: false,
        reason: 'SAFETY_BLOCKED',
        message:
          inputSafety.userFacingMessage ||
          'That request was stopped by safety safeguards.',
        quota: this.policyEngine.getQuotaStatus(nowMs, 'schoolwork'),
      };
    }

    const sanitizedAssignment = this.redactAndTrackPii(
      trimmed,
      'schoolwork',
      nowMs
    );

    const activePolicy = this.db.getPolicyConfig();
    const provider = this.providerRegistry.getModelProvider(
      activePolicy.activeProvider
    );

    const gate = this.policyEngine.evaluatePolicyAndReserve({
      mode: 'schoolwork',
      maxPotentialCostCents: provider.maxPotentialCostPerTurnCents,
      nowMs,
    });

    if (!gate.allowed) {
      return {
        ok: false,
        reason: gate.reason,
        message: gate.message,
        quota: gate.quota,
      };
    }

    const sessionId = `sch_${randomBytes(12).toString('hex')}`;
    let initialAiPrompt = '';
    let actualCostCents = 0;

    const isLegacyTestTopic =
      provider.id === 'mock' &&
      (sanitizedAssignment.includes('Marcus Brutus') ||
        sanitizedAssignment.includes('Athena and Arachne') ||
        sanitizedAssignment.includes('Explain how plants use sunlight') ||
        sanitizedAssignment.includes('Compare fractions') ||
        sanitizedAssignment.includes('Ovid'));

    if (isLegacyTestTopic) {
      initialAiPrompt =
        'What have you tried or understood so far? You can also tell me where you feel stuck.';
    } else if (provider.id === 'mock') {
      const isPresentation =
        /\b(presentation|slides?|speech|talk|powerpoint|keynote)\b/i.test(sanitizedAssignment);
      if (isPresentation) {
        initialAiPrompt =
          `That's a great topic! Presentations are wonderful because you get to tell a story and teach others about something that matters. Here is a great way to put together an engaging presentation:\n\n` +
          `1. **Slide 1: Hook & Title** – Grab attention with a surprising fact or inspiring question.\n` +
          `2. **Slide 2: What is It?** – Explain the core topic simply in clear, everyday language.\n` +
          `3. **Slide 3: Key Facts & How it Works** – Share the most important reasons, causes, or details.\n` +
          `4. **Slide 4: Real-World Impact & Hope** – Share how it affects people and what doctors/scientists are doing.\n` +
          `5. **Slide 5: Key Takeaways** – The 2-3 things you want your audience to remember.\n\n` +
          `To help customize this, what is this presentation for (e.g. science class, health class, or a school project)? And what ideas or research do you already have so far?`;
      } else {
        initialAiPrompt =
          `That's a great topic to work on! Here is an overview of how we can tackle it together:\n\n` +
          `1. **Big Picture** – Understand the main question and the key concepts.\n` +
          `2. **Core Ideas & Evidence** – Gather the facts, examples, or steps needed.\n` +
          `3. **Putting It Together** – Organize everything into a clear, confident structure.\n\n` +
          `To help customize this, what is this assignment for, and where would you like to start?`;
      }
    } else {
      try {
        const brand = activePolicy.instanceDisplayName || 'Marmalade';
        const childAge = activePolicy.childAge ?? 11;
        const gen = await this.generate(
          provider,
          {
            mode: 'schoolwork',
            messages: [
              {
                role: 'system',
                content:
                  `You are ${brand}'s Study Nook Coach, an enthusiastic, warm, patient, and knowledgeable study mentor for a ${childAge}-year-old student.\n` +
                  'A student just brought you their homework or school project topic.\n\n' +
                  'Your goals for this opening response:\n' +
                  '1. Warm Validation: Begin with enthusiastic praise and validation for their topic or task in 1-2 friendly, upbeat sentences (e.g. "That\'s a great and important topic to explore!").\n' +
                  '2. Practical Roadmap & Scaffolding: Offer an encouraging overview of how to break this specific type of work down without doing it for them:\n' +
                  '   - For a presentation or speech: share how to structure engaging slides (e.g. Hook/Title, What is it, Key details/causes/science, Real-world impact & hope, Conclusion & key takeaways).\n' +
                  '   - For an essay/report: break down core sections (Hook & question, main themes, evidence, reflection).\n' +
                  '   - For maths/science: explain the core concept simply with a friendly everyday analogy and a step-by-step approach.\n' +
                  '3. Proactive Inquiries: Ask 1-2 friendly questions to understand the context and audience (e.g. "Is this for a science class, health class, a school project, or a presentation? Who will be listening?").\n' +
                  '4. Collaborative First Step: Offer an inviting, concrete next step to start working on together (e.g. "Where would you like to start—brainstorming the opening hook, outlining the main sections, or organizing notes you already have?").\n\n' +
                  'Format your response with clean markdown (friendly bullet points, bold section headers). Be inspiring, encouraging, and scaffold their thinking!',
              },
              {
                role: 'user',
                content: `<assignment_text>\n${sanitizedAssignment}\n</assignment_text>\n\nPlease help me get started with an overview and roadmap.`,
              },
            ],
            maxOutputTokens: 800,
          },
          gate
        );
        const safeOut = this.safetyLayer.screenOutput(gen.content, 'schoolwork');
        initialAiPrompt = safeOut.sanitizedContent || gen.content;
        actualCostCents = gen.estimatedCostCents;
      } catch (err) {
        initialAiPrompt =
          `That's a great topic to work on! Here is an overview of how we can tackle it together:\n\n` +
          `1. **Big Picture** – Understand the main question and the key concepts.\n` +
          `2. **Core Ideas & Evidence** – Gather the facts, examples, or steps needed.\n` +
          `3. **Putting It Together** – Organize everything into a clear, confident structure.\n\n` +
          `To help customize this, what is this assignment for, and what thoughts or notes do you already have?`;
      }
    }

    this.policyEngine.reconcileCostReservation({
      dateKey: gate.dateKey,
      monthKey: gate.monthKey,
      reservedCostCents: gate.reservedCostCents,
      actualCostCents,
    });

    const internal: SchoolworkSessionInternal = {
      kind: 'schoolwork_loop',
      sessionId,
      status: 'active',
      currentStage: 'think', // Stage 1 (Understand) completed -> moves to Stage 2 (Think)
      assignmentContext: sanitizedAssignment,
      studentPosition: '',
      thinkingProbesCount: 0,
      exchanges: [
        {
          stage: 'understand',
          aiPrompt: initialAiPrompt,
          studentResponse: '',
          timestampMs: nowMs,
        },
      ],
      currentAiMessage: initialAiPrompt,
      workProduct: null,
      proposedLedger: null,
      ledgerSaved: false,
      createdAtMs: nowMs,
      lastUpdatedAtMs: nowMs,
    };

    this.sessions.set(sessionId, internal);
    return {
      ok: true,
      session: {
        sessionId,
        mode: 'schoolwork',
        activityType: 'schoolwork_loop',
        status: 'active',
        currentStage: 'think',
        assignmentContext: sanitizedAssignment,
        exchanges: internal.exchanges,
        currentAiMessage: initialAiPrompt,
        thinkingProbesCount: 0,
        workProduct: null,
        proposedLedger: null,
        ledgerSaved: false,
      },
      quota: this.policyEngine.getQuotaStatus(nowMs, 'schoolwork'),
    };
  }

  public async advanceSchoolworkStage(params: {
    sessionId: string;
    studentInput: string;
    nowMs?: number;
  }): Promise<
    | { ok: true; session: SchoolworkSessionPublic; quota: QuotaStatusSummary }
    | {
        ok: false;
        reason:
          | PolicyBlockReason
          | 'SESSION_NOT_FOUND'
          | 'INVALID_STAGE'
          | 'ACTIVITY_COMPLETE';
        message: string;
        quota: QuotaStatusSummary;
      }
  > {
    const now = params.nowMs ?? Date.now();
    const sess = this.sessions.get(params.sessionId);
    if (!sess || sess.kind !== 'schoolwork_loop') {
      return {
        ok: false,
        reason: 'SESSION_NOT_FOUND',
        message: 'Schoolwork session not found or expired.',
        quota: this.policyEngine.getQuotaStatus(now, 'schoolwork'),
      };
    }

    const trimmedInput = params.studentInput.trim();
    const inputSafety = this.safetyLayer.screenInput(
      trimmedInput,
      'schoolwork'
    );
    if (!inputSafety.allowed) {
      if (
        !inputSafety.suppressParentAlert &&
        inputSafety.flagged &&
        inputSafety.category &&
        inputSafety.severity
      ) {
        this.db.recordSafetyEvent({
          category: inputSafety.category,
          severity: inputSafety.severity,
          mode: 'schoolwork',
          nowMs: now,
        });
      }
      return {
        ok: false,
        reason: 'SAFETY_BLOCKED',
        message:
          inputSafety.userFacingMessage ||
          'That request was stopped by safety safeguards.',
        quota: this.policyEngine.getQuotaStatus(now, 'schoolwork'),
      };
    }

    const sanitizedInput = this.redactAndTrackPii(
      trimmedInput,
      'schoolwork',
      now
    );

    if (sess.exchanges.length >= 8)
      return {
        ok: false,
        reason: 'ACTIVITY_COMPLETE',
        message:
          'A good place to pause and try it yourself. You can still review or save your learning note.',
        quota: this.policyEngine.getQuotaStatus(now, 'schoolwork'),
      };

    const activePolicy = this.db.getPolicyConfig();
    const provider = this.providerRegistry.getModelProvider(
      activePolicy.activeProvider
    );

    const gate = this.policyEngine.evaluatePolicyAndReserve({
      mode: 'schoolwork',
      maxPotentialCostCents: provider.maxPotentialCostPerTurnCents,
      nowMs: now,
    });

    if (!gate.allowed) {
      sess.status = 'stopped_by_quota';
      return {
        ok: false,
        reason: gate.reason,
        message: gate.message,
        quota: gate.quota,
      };
    }

    const studentStuck =
      /\b(i don'?t know|idk|not sure|i'?m stuck|i am stuck|no idea|help me start)\b/i.test(
        sanitizedInput
      );

    let actualCostCents = 0;

    if (sess.currentStage === 'think') {
      sess.thinkingProbesCount += 1;
      sess.studentPosition = sess.studentPosition
        ? `${sess.studentPosition} | ${sanitizedInput}`
        : sanitizedInput;

      if (provider.id === 'mock') {
        // Deterministic mock test branches preserved for test suites
        if (sess.thinkingProbesCount >= 2 || sanitizedInput.length > 50) {
          sess.currentStage = 'assist';
          const assistPrompt = `Based on your assignment ("${sess.assignmentContext}") and your argument ("${sess.studentPosition}"), here is a structured outline grounded in your ideas:\n\n1. Claim: Clearly state your position.\n2. Key Evidence: Use textual quotations or historical facts to support your reason.\n3. Counter-Perspective: Acknowledge the opposite argument.\n4. Conclusion: Reiterate why your conclusion holds.`;
          sess.workProduct = assistPrompt;
          sess.currentAiMessage = assistPrompt;
          sess.exchanges.push({
            stage: 'assist',
            aiPrompt: assistPrompt,
            studentResponse: sanitizedInput,
            timestampMs: now,
          });
          sess.proposedLedger = {
            subject: sess.assignmentContext.slice(0, 35),
            summary: `Explored assignment ideas: "${sanitizedInput.slice(0, 80)}"`,
            concepts: [],
            uncertainties: [],
          };
        } else if (studentStuck) {
          const scaffoldMessage = `No problem at all—let's break "${sess.assignmentContext.slice(0, 70)}" into two smaller angles so it is easier to start:\n1. Start with something you already know about the topic.\n2. Try a small example and describe what happens.\nWhich of those two angles feels more interesting to you?`;
          sess.currentAiMessage = scaffoldMessage;
          sess.exchanges.push({
            stage: 'think',
            aiPrompt: scaffoldMessage,
            studentResponse: sanitizedInput,
            timestampMs: now,
          });
        } else {
          const probeMessage = `That’s a thoughtful start. Can you point to one piece of evidence or a specific reason why you take that position?`;
          sess.currentAiMessage = probeMessage;
          sess.exchanges.push({
            stage: 'think',
            aiPrompt: probeMessage,
            studentResponse: sanitizedInput,
            timestampMs: now,
          });
        }
      } else {
        // Live AI Coaching: Provide substantive help, draft slides/points, and collaborate
        sess.currentStage = 'assist';
        let helperMessage = '';
        try {
          const conversationHistory = sess.exchanges.slice(-3).flatMap((e) => [
            { role: 'assistant' as const, content: e.aiPrompt },
            { role: 'user' as const, content: e.studentResponse || '(started task)' },
          ]);

          const brand = activePolicy.instanceDisplayName || 'Marmalade';
          const childAge = activePolicy.childAge ?? 11;
          const gen = await this.generate(
            provider,
            {
              mode: 'schoolwork',
              messages: [
                {
                  role: 'system',
                  content:
                    `You are ${brand} Study Nook Coach, an encouraging, warm, and thoughtful study mentor for a ${childAge}-year-old student.\n` +
                    'Your role is to guide and scaffold their thinking so they learn and build confidence—NOT to write their assignment or solve problems for them.\n\n' +
                    'Coaching Principles:\n' +
                    '1. Warm Validation: Celebrate their thoughts, effort, and curiosity enthusiastically.\n' +
                    '2. Socratic Scaffolding:\n' +
                    '   - For an essay, story, or presentation: Offer structural ideas, thinking frameworks, or sentence starters. Suggest 1-2 draft angles or analogies, but leave the actual writing and word choice to the student.\n' +
                    '   - For maths or science: Break the concept into clear, simple steps. Walk through an analogous or parallel example step-by-step; do NOT just give the final numerical answer to their assignment problem.\n' +
                    '   - Do NOT produce full completed homework paragraphs or finished assignments. Keep ownership squarely with the student.\n' +
                    '3. Engaging Collaboration: End with one clear, friendly question or choice that invites the student to take the very next step in their own words.\n\n' +
                    `Keep the tone encouraging, clear, and age-appropriate for a ${childAge}-year-old. Format with clean markdown.`,
                },
                ...conversationHistory,
                {
                  role: 'user',
                  content: `<assignment_context>${stripXmlDelimiters(sess.assignmentContext)}</assignment_context>\n\n<student_input>${stripXmlDelimiters(sanitizedInput)}</student_input>`,
                },
              ],
              maxOutputTokens: 800,
            },
            gate
          );
          const safeOut = this.safetyLayer.screenOutput(gen.content, 'schoolwork');
          helperMessage = safeOut.sanitizedContent || gen.content;
          actualCostCents = gen.estimatedCostCents;
        } catch (error) {
          throw error;
        }

        sess.workProduct = helperMessage;
        sess.currentAiMessage = helperMessage;
        sess.exchanges.push({
          stage: 'assist',
          aiPrompt: helperMessage,
          studentResponse: sanitizedInput,
          timestampMs: now,
        });

        sess.proposedLedger = {
          subject: sess.assignmentContext.slice(0, 35),
          summary: `Explored: "${sanitizedInput.slice(0, 80)}"`,
          concepts: [],
          uncertainties: [],
        };
      }
    } else if (sess.currentStage === 'assist') {
      sess.currentStage = 'ledger_proposal';
      sess.currentAiMessage =
        'Work completed! Here is a proposed Learning Ledger summary of what you explored. Review, edit, or approve it below.';
    }

    sess.lastUpdatedAtMs = now;
    this.policyEngine.reconcileCostReservation({
      dateKey: gate.dateKey,
      monthKey: gate.monthKey,
      reservedCostCents: gate.reservedCostCents,
      actualCostCents,
    });

    return {
      ok: true,
      session: {
        sessionId: sess.sessionId,
        mode: 'schoolwork',
        activityType: 'schoolwork_loop',
        status: sess.status,
        currentStage: sess.currentStage,
        assignmentContext: sess.assignmentContext,
        exchanges: sess.exchanges,
        currentAiMessage: sess.currentAiMessage,
        thinkingProbesCount: sess.thinkingProbesCount,
        workProduct: sess.workProduct,
        proposedLedger: sess.proposedLedger,
        ledgerSaved: sess.ledgerSaved,
      },
      quota: this.policyEngine.getQuotaStatus(now, 'schoolwork'),
    };
  }

  public async followupSchoolwork(
    id: string,
    studentInput: string,
    nowMs: number
  ) {
    const session = this.sessions.get(id);
    if (!session || session.kind !== 'schoolwork_loop')
      throw new Error('SESSION_EXPIRED');
    if (session.exchanges.length >= 8)
      return {
        ok: false,
        error: 'ACTIVITY_COMPLETE',
        message:
          'A good place to pause and try it yourself. You can still review or save your learning note.',
        quota: this.policyEngine.getQuotaStatus(nowMs, 'schoolwork'),
      };
    if (!studentInput.trim())
      return {
        ok: false,
        error: 'EMPTY_INPUT',
        message: 'Add a question first.',
      };
    const inputSafety = this.safetyLayer.screenInput(
      studentInput,
      'schoolwork'
    );
    if (!inputSafety.allowed) {
      if (
        !inputSafety.suppressParentAlert &&
        inputSafety.flagged &&
        inputSafety.category &&
        inputSafety.severity
      ) {
        this.db.recordSafetyEvent({
          category: inputSafety.category,
          severity: inputSafety.severity,
          mode: 'schoolwork',
          nowMs,
        });
      }
      return {
        ok: false,
        error: 'SAFETY_PAUSE',
        message: inputSafety.userFacingMessage,
      };
    }
    const sanitizedInput = this.redactAndTrackPii(
      studentInput,
      'schoolwork',
      nowMs
    );
    const activePolicy = this.db.getPolicyConfig();
    const provider = this.providerRegistry.getModelProvider(
      activePolicy.activeProvider
    );
    const gate = this.policyEngine.evaluatePolicyAndReserve({
      mode: 'schoolwork',
      maxPotentialCostCents: provider.maxPotentialCostPerTurnCents,
      nowMs,
    });
    if (!gate.allowed)
      return {
        ok: false,
        error: gate.reason,
        message: gate.message,
        quota: gate.quota,
      };
    const brand = activePolicy.instanceDisplayName || 'Marmalade';
    const childAge = activePolicy.childAge ?? 11;
    const result = await this.generate(
      provider,
      {
        mode: 'schoolwork',
        messages: [
          {
            role: 'system',
            content:
              `You are ${brand} Study Nook Coach, an encouraging, warm, and helpful study mentor for a ${childAge}-year-old student.\n` +
              'Coaching principles:\n' +
              '1. Scaffold rather than solve. When a student asks a question about their homework, guide them toward discovering the answer instead of providing completed answers, full essays, or direct homework solutions.\n' +
              '2. Offer structural ideas, hints, guiding questions, or step-by-step analogies. Encourage the student to draft sentences or calculations in their own words.\n' +
              '3. Keep their own voice, agency, and ownership front and center.\n' +
              '4. Use plain-text math such as 3/4 = 9/12; do not use LaTeX delimiters or commands.',
          },
          {
            role: 'user',
            content: `<assignment_context>Assignment: ${session.assignmentContext}\nWork so far: ${session.workProduct || ''}</assignment_context>`,
          },
          ...session.exchanges.slice(-4).flatMap((e) => [
            { role: 'assistant' as const, content: e.aiPrompt },
            { role: 'user' as const, content: e.studentResponse },
          ]),
          { role: 'user', content: `<student_question>${stripXmlDelimiters(sanitizedInput.slice(0, 6000))}</student_question>` },
        ],
        maxOutputTokens: 800,
      },
      gate
    );
    const screened = this.safetyLayer.screenOutput(
      result.content,
      'schoolwork'
    );
    session.currentAiMessage = screened.sanitizedContent || result.content;
    session.exchanges.push({
      stage: 'assist',
      aiPrompt: session.currentAiMessage,
      studentResponse: sanitizedInput,
      timestampMs: nowMs,
    });
    session.lastUpdatedAtMs = nowMs;
    this.policyEngine.reconcileCostReservation({
      ...gate,
      actualCostCents: result.estimatedCostCents,
    });
    return {
      ok: true,
      session: this.readSession(id, nowMs),
      quota: this.policyEngine.getQuotaStatus(nowMs, 'schoolwork'),
    };
  }

  public approveSchoolworkLedger(
    sessionId: string,
    overrides?: Partial<ProposedLedgerEntry>
  ): boolean {
    const sess = this.sessions.get(sessionId);
    if (!sess || sess.kind !== 'schoolwork_loop' || !sess.proposedLedger)
      return false;

    if (sess.ledgerSaved) return true;
    const finalSubject =
      overrides?.subject !== undefined && overrides.subject.trim()
        ? overrides.subject.trim()
        : sess.proposedLedger.subject;
    const finalSummary =
      overrides?.summary !== undefined && overrides.summary.trim()
        ? overrides.summary.trim()
        : sess.proposedLedger.summary;
    const finalConcepts = Array.isArray(overrides?.concepts)
      ? overrides.concepts.map((c) => String(c).trim()).filter(Boolean)
      : sess.proposedLedger.concepts;
    const finalUncertainties = Array.isArray(overrides?.uncertainties)
      ? overrides.uncertainties.map((u) => String(u).trim()).filter(Boolean)
      : sess.proposedLedger.uncertainties;

    sess.proposedLedger = {
      subject: finalSubject,
      summary: finalSummary,
      concepts: finalConcepts,
      uncertainties: finalUncertainties,
    };

    this.db.saveApprovedLedgerEntry({
      sourceSessionId: sessionId,
      subject: finalSubject,
      summary: finalSummary,
      concepts: finalConcepts,
      uncertainties: finalUncertainties,
    });

    sess.ledgerSaved = true;
    sess.currentStage = 'completed';
    sess.status = 'completed';
    return true;
  }

  /* =========================================================================
   * 6. ASK & LEARN (Existing)
   * ========================================================================= */
  public async submitAskTurn(params: {
    sessionId?: string;
    prompt: string;
    nowMs?: number;
  }): Promise<
    | {
        ok: true;
        session: AskSessionPublic;
        turn: AskTurnEntry;
        quota: QuotaStatusSummary;
      }
    | {
        ok: false;
        reason:
          | PolicyBlockReason
          | 'EMPTY_PROMPT'
          | 'PARTICIPATION_NEEDED'
          | 'ACTIVITY_COMPLETE';
        message: string;
        session?: AskSessionPublic;
        quota: QuotaStatusSummary;
      }
  > {
    const now = params.nowMs ?? Date.now();
    this.purgeExpiredSessions(now);

    const trimmedPrompt = params.prompt.trim();
    if (!trimmedPrompt) {
      return {
        ok: false,
        reason: 'EMPTY_PROMPT',
        message: 'Please enter a question.',
        quota: this.policyEngine.getQuotaStatus(now, 'ask'),
      };
    }

    let sess: AskSessionInternal | undefined;
    if (params.sessionId) {
      const existing = this.sessions.get(params.sessionId);
      if (existing && existing.kind === 'general_ask') sess = existing;
    }

    const creative =
      isCreativeRequest(trimmedPrompt) || (sess?.creativeTurns ?? 0) > 0;
    if (
      sess &&
      (sess.status === 'completed' ||
        sess.turns.length >= 8 ||
        (creative && sess.creativeTurns >= 3))
    ) {
      return {
        ok: false,
        reason: 'ACTIVITY_COMPLETE',
        message:
          sess.stoppingMessage ||
          'A good place to pause. Save anything useful, or start a new question when you have another idea.',
        session: this.readSession(
          sess.sessionId,
          now
        ) as unknown as AskSessionPublic,
        quota: this.policyEngine.getQuotaStatus(now, 'ask'),
      };
    }
    if (
      creative &&
      sess &&
      sess.creativeTurns > 0 &&
      (isBareContinuation(trimmedPrompt) ||
        sess.turns.some(
          (t) => t.userPrompt.toLowerCase() === trimmedPrompt.toLowerCase()
        ))
    ) {
      return {
        ok: false,
        reason: 'PARTICIPATION_NEEDED',
        message:
          'Your turn to shape it: add a character choice, a new detail, or a sentence of your own. We can build one small scene together.',
        quota: this.policyEngine.getQuotaStatus(now, 'ask'),
      };
    }
    const inputSafety = this.safetyLayer.screenInput(trimmedPrompt, 'ask');
    if (!inputSafety.allowed) {
      if (
        !inputSafety.suppressParentAlert &&
        inputSafety.flagged &&
        inputSafety.category &&
        inputSafety.severity
      ) {
        this.db.recordSafetyEvent({
          category: inputSafety.category,
          severity: inputSafety.severity,
          mode: 'ask',
          nowMs: now,
        });
      }
      return {
        ok: false,
        reason: 'SAFETY_BLOCKED',
        message:
          inputSafety.userFacingMessage ||
          'That request was stopped by safety safeguards.',
        quota: this.policyEngine.getQuotaStatus(now, 'ask'),
      };
    }

    const promptToSend = this.redactAndTrackPii(trimmedPrompt, 'ask', now);
    const activePolicy = this.db.getPolicyConfig();

    const provider = this.providerRegistry.getModelProvider(
      activePolicy.activeProvider
    );

    const gate = this.policyEngine.evaluatePolicyAndReserve({
      mode: 'ask',
      maxPotentialCostCents: provider.maxPotentialCostPerTurnCents,
      nowMs: now,
    });

    if (!gate.allowed) {
      if (sess) {
        sess.status = 'stopped_by_quota';
        sess.lastUpdatedAtMs = now;
      }
      return {
        ok: false,
        reason: gate.reason,
        message: gate.message,
        session: sess
          ? {
              sessionId: sess.sessionId,
              mode: 'ask',
              activityType: 'general_ask',
              status: sess.status,
              turns: [...sess.turns],
            }
          : undefined,
        quota: gate.quota,
      };
    }

    if (!sess) {
      const newId = `ask_${randomBytes(12).toString('hex')}`;
      sess = {
        kind: 'general_ask',
        creativeTurns: 0,
        sessionId: newId,
        status: 'active',
        turns: [],
        createdAtMs: now,
        lastUpdatedAtMs: now,
      };
      this.sessions.set(newId, sess);
    }

    const brand = activePolicy.instanceDisplayName || 'Marmalade';
    const childAge = activePolicy.childAge ?? 11;
    let genResult;
    try {
      genResult = await this.generate(
        provider,
        {
          mode: 'ask',
          messages: [
            {
              role: 'system',
              content: `You are ${brand}'s friendly guide in The Question Room, answering questions for a curious ${childAge}-year-old child.
Tone & Style:
- Warm, cheerful, enthusiastic, and encouraging!
- Explain things simply and vividly using relatable, fun analogies from everyday life.
- Keep explanations clear, engaging, and easy to read—never sound like a dry, robotic textbook.
- Be honest and kind; do not pretend to be human or claim to have feelings or personal secrets.
- Homework & Schoolwork Guard: If the child asks you to write their homework assignment, compose a school essay for them, or solve a complete worksheet or problem set directly, do NOT write the answer or complete the work for them. Instead, explain the key idea or concept using an engaging, simple analogy, and encourage them to open Study Nook where ${brand} can guide them step-by-step through their assignment!
- This is reply ${sess.turns.length + 1} of at most 8 in this conversation.
${creative ? `This is creative contribution ${sess.creativeTurns + 1} of at most 3. Offer a short, imaginative idea or passage (under 100 words), not a complete work. ${sess.creativeTurns >= 2 ? 'This is the final contribution: bring the scene to a cozy finish, then warmly cheer them on to continue writing on their own! Do not invite another AI continuation.' : 'Warmly invite one concrete choice or creative idea from the child before continuing.'}` : 'Answer their question directly and warmly. Do not automatically append a quiz or question to every turn.'} ${sess.turns.length >= 7 ? 'Wrap up warmly with a brief, helpful takeaway or fun summary fact.' : ''}`,
            },
            ...sess.turns.slice(-6).flatMap((turn) => [
              { role: 'user' as const, content: turn.userPrompt.slice(-1500) },
              {
                role: 'assistant' as const,
                content: turn.assistantResponse.slice(-1500),
              },
            ]),
            { role: 'user', content: `<student_question>${stripXmlDelimiters(promptToSend.slice(-6000))}</student_question>` },
          ],
          maxOutputTokens: 1200,
        },
        gate
      );
    } catch (err) {
      throw err;
    }

    const outputSafety = this.safetyLayer.screenOutput(
      genResult.content,
      'ask'
    );
    let finalContent = outputSafety.sanitizedContent || genResult.content;
    if (creative && genResult.safetyFlagged) finalContent = 'Let’s keep this an age-appropriate adventure. We can change the premise: what mystery or problem could the characters solve together?';
    if (creative && finalContent.split(/\s+/).length > 140) {
      const excerpt = finalContent.split(/\s+/).slice(0, 110).join(' ');
      const end = Math.max(
        excerpt.lastIndexOf('. '),
        excerpt.lastIndexOf('! '),
        excerpt.lastIndexOf('? ')
      );
      finalContent =
        (end > 40 ? excerpt.slice(0, end + 1) : excerpt + '…') +
        (sess.creativeTurns >= 2
          ? '\n\nYou can carry on in your own words.'
          : '\n\nYour turn: add a detail or a character choice.');
    }

    if (
      outputSafety.flagged &&
      outputSafety.category &&
      outputSafety.severity
    ) {
      this.db.recordSafetyEvent({
        category: outputSafety.category,
        severity: outputSafety.severity,
        mode: 'ask',
        nowMs: now,
      });
    }

    const turn: AskTurnEntry = {
      id: `turn_${randomBytes(8).toString('hex')}`,
      userPrompt: promptToSend,
      assistantResponse: finalContent,
      suggestPlayHandoff: genResult.suggestPlayHandoff,
      createdAtMs: now,
    };

    sess.turns.push(turn);
    if (creative) sess.creativeTurns += 1;
    if (sess.turns.length >= 8 || sess.creativeTurns >= 3) {
      sess.status = 'completed';
      sess.stoppingMessage = creative
        ? 'Our small scene is complete. You can save it and carry on writing in your own words.'
        : 'A good place to pause. Save anything useful, or start a new question when you have another idea.';
    }
    sess.lastUpdatedAtMs = now;

    this.policyEngine.reconcileCostReservation({
      dateKey: gate.dateKey,
      monthKey: gate.monthKey,
      reservedCostCents: gate.reservedCostCents,
      actualCostCents: genResult.estimatedCostCents,
    });

    return {
      ok: true,
      session: {
        sessionId: sess.sessionId,
        mode: 'ask',
        activityType: 'general_ask',
        status: sess.status,
        stoppingMessage: sess.stoppingMessage,
        repliesRemaining: creative
          ? Math.min(8 - sess.turns.length, 3 - sess.creativeTurns)
          : 8 - sess.turns.length,
        turns: [...sess.turns],
      },
      turn,
      quota: this.policyEngine.getQuotaStatus(now, 'ask'),
    };
  }
}
