import type { ActivityMode, ProviderId } from '../../shared/types.js';

export interface ProviderCapabilities {
  structuredOutput: boolean;
  toolUse: boolean;
  maxContextTokens: number;
  imageInput: boolean;
  fileInput: boolean;
  inputModeration: boolean;
  outputModeration: boolean;
  zeroDataRetentionVerified: boolean;
}

export interface ModelMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface ModelGenerateRequest {
  mode: ActivityMode;
  messages: ModelMessage[];
  maxOutputTokens: number;
  allowedTools?: string[];
  temperature?: number;
}

export interface ModelGenerateResult {
  content: string;
  tokenUsage: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
  estimatedCostCents: number;
  safetyFlagged?: {
    category: string;
    severity: 'low' | 'medium' | 'high';
  };
  suggestPlayHandoff?: {
    suggestedActivity: 'story_relay' | 'trivia_10' | 'twenty_questions';
    reason: string;
  };
}

export interface CompatibilityCheckResult {
  ok: boolean;
  reachable: boolean;
  modelFound: boolean;
  details: string;
  capabilities: Partial<ProviderCapabilities>;
}

export interface ModelProvider {
  readonly id: ProviderId;
  readonly displayName: string;
  readonly isLocal: boolean;
  readonly safetyVerified: boolean;
  readonly statusNote: string;
  readonly capabilities: ProviderCapabilities;
  readonly maxPotentialCostPerTurnCents: number;
  generate(request: ModelGenerateRequest): Promise<ModelGenerateResult>;
  checkCompatibility?(): Promise<CompatibilityCheckResult>;
}

export interface DomainPolicy {
  recommendedDomains: string[];
  blockedDomains: string[];
}

export interface VerifiedSourceRecord {
  sourceId: string; // e.g. 'src_1'
  title: string;
  url: string;
  domain: string;
  isCurated: boolean;
  snippet: string;
}

export interface SearchProvider {
  readonly id: string;
  readonly displayName: string;
  search(query: string, domainPolicy: DomainPolicy): Promise<VerifiedSourceRecord[]>;
}
