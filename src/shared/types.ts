export type ActivityMode = 'ask' | 'research' | 'schoolwork' | 'play';

export type UserRole = 'parent' | 'child';

export type ProviderId =
  | 'mock'
  | 'gemini'
  | 'local_ollama'
  | 'openai'
  | 'anthropic';

export interface UserPublic {
  id: number;
  username: string;
  displayName: string;
  role: UserRole;
  seenFirstRunExplainer?: boolean;
}

export interface PolicyConfig {
  timezone: string;
  instanceDisplayName?: string;
  childAge?: number;
  piiFilterEnabled?: boolean;
  openaiUnder13Confirmed?: boolean;
  anthropicConditionsConfirmed?: boolean;
  globalDailyMinutes: number;
  maxContinuousSessionMinutes: number;
  sessionCooldownMinutes: number;
  modes: {
    ask: { enabled: boolean; dailyMinutes: number };
    research: { enabled: boolean; dailyMinutes: number };
    schoolwork: { enabled: boolean; dailyMinutes: number };
    play: { enabled: boolean; dailyMinutes: number };
  };
  dailySpendCapCents: number;
  monthlySpendCapCents: number;
  monthlyResetDay: number;
  activeProvider: ProviderId;
  allowExternalSearch: boolean;
  updatedAtMs: number;
}

export interface ModeQuotaStatus {
  mode: ActivityMode;
  enabled: boolean;
  dailyLimitSeconds: number;
  bonusSeconds: number;
  usedSeconds: number;
  remainingSeconds: number;
  effectiveRemainingSeconds: number;
  isExhausted: boolean;
}

export interface QuotaStatusSummary {
  dateKey: string;
  monthKey: string;
  timezone: string;
  globalDailyLimitSeconds: number;
  globalBonusSeconds: number;
  globalUsedSeconds: number;
  globalRemainingSeconds: number;
  continuousLimitSeconds: number;
  continuousUsedSeconds: number;
  continuousRemainingSeconds: number;
  cooldownMinutes: number;
  cooldownEndsAtMs?: number | null;
  dailySpendCapCents: number;
  dailySpentCents: number;
  dailyReservedCents: number;
  monthlySpendCapCents: number;
  monthlySpentCents: number;
  monthlyReservedCents: number;
  interactionLeaseActive: boolean;
  interactionLeaseUntilMs: number;
  modes: Record<ActivityMode, ModeQuotaStatus>;
  blockingReason: PolicyBlockReason | null;
}

export type PolicyBlockReason =
  | 'MODE_DISABLED'
  | 'GLOBAL_TIME_LIMIT_REACHED'
  | 'MODE_TIME_LIMIT_REACHED'
  | 'CONTINUOUS_SESSION_LIMIT_REACHED'
  | 'DAILY_SPEND_CAP_REACHED'
  | 'MONTHLY_SPEND_CAP_REACHED'
  | 'PROVIDER_NOT_SAFETY_VERIFIED'
  | 'PROVIDER_NOT_ALLOWED_FOR_MINORS'
  | 'SAFETY_BLOCKED';

export type TriviaTopic =
  | 'mythology_history'
  | 'space_science'
  | 'literature'
  | 'nature_animals'
  | 'inventions_tech'
  | 'world_geography'
  | 'custom'
  | 'mixed';
export type TriviaDifficulty = 'standard' | 'challenging';

export interface TriviaQuestionPublic {
  index: number;
  total: number;
  id: string;
  topicLabel: string;
  difficulty: TriviaDifficulty;
  prompt: string;
  choices: string[];
}

export interface TriviaAnswerRecord {
  questionIndex: number;
  prompt: string;
  selectedChoiceIndex: number;
  selectedChoiceText: string;
  correctChoiceIndex: number;
  correctChoiceText: string;
  isCorrect: boolean;
  explanation: string;
}

export interface TriviaSessionPublic {
  sessionId: string;
  mode: 'play';
  activityType: 'trivia_10';
  topic: TriviaTopic;
  difficulty: TriviaDifficulty;
  status: 'active' | 'completed' | 'stopped_by_quota';
  totalQuestions: number;
  answeredCount: number;
  score: number;
  currentQuestion: TriviaQuestionPublic | null;
  lastFeedback: TriviaAnswerRecord | null;
  history: TriviaAnswerRecord[];
  stoppingMessage: string | null;
}

// Twenty Questions
export interface TwentyQuestionsSessionPublic {
  sessionId: string;
  mode: 'play';
  activityType: 'twenty_questions';
  status: 'active' | 'won' | 'lost' | 'stopped_by_quota';
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
  revealedTarget: string | null;
  stoppingMessage: string | null;
}

// Story Relay
export interface StoryRelayTurn {
  turnNumber: number;
  childDirection: string;
  passageText: string;
  suggestedPrompts: string[];
  stageName?: string;
  craftFocus?: string;
  coachTip?: string;
}

export interface StoryRelaySessionPublic {
  sessionId: string;
  mode: 'play';
  activityType: 'story_relay';
  status: 'active' | 'completed' | 'stopped_by_quota';
  genre: string;
  turnsUsed: number;
  maxTurns: number;
  history: StoryRelayTurn[];
  stoppingMessage: string | null;
  premiseTitle?: string;
  currentStage?: {
    stageNumber: number;
    stageName: string;
    stageGoal: string;
    craftFocus: string;
    coachTip: string;
  };
}

// Research Mode
export interface ResearchSourcePublic {
  sourceId: string;
  title: string;
  url: string;
  domain: string;
  isCurated: boolean;
  snippet: string;
}

export interface ResearchSessionPublic {
  sessionId: string;
  mode: 'research';
  activityType: 'research_basic';
  status: 'active' | 'stopped_by_quota';
  query: string;
  sources: ResearchSourcePublic[];
  synthesis: string;
  notesBundle: string;
  citedSourceIds: string[];
  searchStatusNote?: string;
  searchOutcome?: 'results' | 'no_results';
}

// Schoolwork Assistance (Understand -> Think -> Assist -> Ledger Proposal)
export type SchoolworkStage =
  | 'understand'
  | 'think'
  | 'assist'
  | 'ledger_proposal'
  | 'completed';

export interface SchoolworkExchange {
  stage: SchoolworkStage;
  aiPrompt: string;
  studentResponse: string;
  timestampMs: number;
}

export interface ProposedLedgerEntry {
  subject: string;
  summary: string;
  concepts: string[];
  uncertainties: string[];
}

export interface SchoolworkSessionPublic {
  sessionId: string;
  mode: 'schoolwork';
  activityType: 'schoolwork_loop';
  status: 'active' | 'completed' | 'stopped_by_quota';
  currentStage: SchoolworkStage;
  assignmentContext: string;
  exchanges: SchoolworkExchange[];
  currentAiMessage: string;
  thinkingProbesCount: number;
  workProduct: string | null;
  proposedLedger: ProposedLedgerEntry | null;
  ledgerSaved: boolean;
}

export interface AskTurnEntry {
  id: string;
  userPrompt: string;
  assistantResponse: string;
  suggestPlayHandoff?: {
    suggestedActivity: 'story_relay' | 'trivia_10' | 'twenty_questions';
    reason: string;
  };
  createdAtMs: number;
}

export interface AskSessionPublic {
  sessionId: string;
  mode: 'ask';
  activityType: 'general_ask';
  status: 'active' | 'completed' | 'stopped_by_quota';
  stoppingMessage?: string;
  repliesRemaining?: number;
  turns: AskTurnEntry[];
}

export interface SavedArtifact {
  id: number;
  title: string;
  mode: ActivityMode;
  activityType: string;
  content: string;
  createdAtMs: number;
}

export interface LearningLedgerEntry {
  id: number;
  subject: string;
  summary: string;
  concepts: string[];
  uncertainties: string[];
  approvedAtMs: number;
}

export interface TimeExtensionRequest {
  id: number;
  dateKey: string;
  requestedMode: ActivityMode | 'global';
  requestedMinutes: number;
  reasonNote: string;
  status: 'pending' | 'approved' | 'denied';
  grantedMinutes: number;
  createdAtMs: number;
  resolvedAtMs: number | null;
}

export interface SafetyEventSummary {
  id: number;
  category: string;
  severity: 'low' | 'medium' | 'high';
  mode: ActivityMode;
  createdAtMs: number;
  acknowledged: boolean;
}

export interface ProviderSettingsPublic {
  geminiFastModel: string;
  geminiReasoningModel: string;
  hasGeminiApiKey: boolean;
  geminiApiKeyHint: string | null;
  geminiZdrApproved: boolean;
  ollamaBaseUrl: string;
  ollamaModel: string;
  openaiModel: string;
  hasOpenaiApiKey: boolean;
  openaiApiKeyHint: string | null;
  openaiZdrApproved: boolean;
  openaiUnder13Confirmed: boolean;
  anthropicModel: string;
  hasAnthropicApiKey: boolean;
  anthropicApiKeyHint: string | null;
  anthropicZdrApproved: boolean;
  anthropicConditionsConfirmed: boolean;
  piiFilterEnabled: boolean;
  searchApiUrl: string;
  hasSearchApiKey: boolean;
  updatedAtMs: number;
}

export interface ProviderPreflightResult {
  providerId: ProviderId;
  ok: boolean;
  reachable: boolean;
  modelFound: boolean;
  /** Reserved for independent verification; parental review is parentAcknowledged. */
  safetyVerified: boolean;
  structuredOutputVerified: boolean;
  generationVerified?: boolean;
  parentAcknowledged?: boolean;
  checkedAtMs?: number;
  sampleAnswers?: Array<{ mode: ActivityMode; answer: string }>;
  details: string;
}

export interface ParentDashboardSummary {
  policy: PolicyConfig;
  quota: QuotaStatusSummary;
  todayStats: {
    dateKey: string;
    requestCount: number;
    completedSessionsCount: number;
    activeMinutesByMode: Record<ActivityMode, number>;
    totalActiveMinutes: number;
    estimatedSpendTodayCents: number;
    estimatedSpendMonthCents: number;
  };
  pendingExtensions: TimeExtensionRequest[];
  recentExtensions: TimeExtensionRequest[];
  safetyEvents: SafetyEventSummary[];
  providers: Array<{
    id: ProviderId;
    displayName: string;
    isLocal: boolean;
    safetyVerified: boolean;
    parentAcknowledged?: boolean;
    readiness?: ProviderPreflightResult;
    statusNote: string;
  }>;
  providerSettings: ProviderSettingsPublic;
}
