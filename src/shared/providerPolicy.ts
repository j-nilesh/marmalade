/**
 * Provider Compliance & Minors Safety Matrix (Item 1 & Item 18)
 * Single source of truth for provider terms, minor eligibility status,
 * and required safeguards across the codebase and documentation.
 */

export type MinorsComplianceStatus =
  | 'allowed'
  | 'allowed_with_conditions'
  | 'not_allowed';

export interface ProviderConditionCheck {
  id: string;
  label: string;
  description: string;
  satisfiedByMarmalade: boolean;
  satisfiedBySprout?: boolean;
  requiredParentAction?: string;
}

export interface ProviderPolicyDefinition {
  providerId: string;
  name: string;
  minorsStatus: MinorsComplianceStatus;
  termsUrl: string;
  guidanceUrl?: string;
  termsEffectiveDate: string;
  summary: string;
  rejectionReason?: string;
  conditionsChecklist: ProviderConditionCheck[];
  lastCheckedDate: string;
}

export const PROVIDER_POLICY_MATRIX: Record<string, ProviderPolicyDefinition> = {
  gemini: {
    providerId: 'gemini',
    name: 'Google Gemini API',
    minorsStatus: 'not_allowed',
    termsUrl: 'https://ai.google.dev/terms',
    termsEffectiveDate: '23 March 2026',
    lastCheckedDate: '4 November 2026',
    summary:
      'Google Gemini API Additional Terms prohibit use by individuals under 18 years of age and prohibit applications directed at or likely to be accessed by minors.',
    rejectionReason:
      'The Google Gemini API Additional Terms (effective 23 March 2026) state: "You must be at least 18 years of age to use the Gemini API... You may not use the Gemini API in connection with any service directed at, or likely to be accessed by, individuals under 18 years of age." Consequently, Gemini cannot be connected to child spaces.',
    conditionsChecklist: [],
  },
  anthropic: {
    providerId: 'anthropic',
    name: 'Anthropic Claude',
    minorsStatus: 'allowed_with_conditions',
    termsUrl: 'https://www.anthropic.com/legal/commercial-terms',
    guidanceUrl: 'https://support.claude.com/en/articles/9307344',
    termsEffectiveDate: 'August 2024 (Guidance updated 2025/2026)',
    lastCheckedDate: '4 November 2026',
    summary:
      'Anthropic permits minors in API services when five specific conditions are met: content moderation & filtering, safety monitoring, clear AI disclosure, child-safety system prompts, and parental authorization under applicable laws.',
    conditionsChecklist: [
      {
        id: 'content_moderation',
        label: 'Content moderation & filtering',
        description:
          'Input screening, rate limits, and output safety checks prevent inappropriate content.',
        satisfiedByMarmalade: true,
        satisfiedBySprout: true,
      },
      {
        id: 'monitoring_reporting',
        label: 'Safety monitoring with parent escalation',
        description:
          'Standardized safety indicators (self-harm, unsafe contact) alert parents without transcript surveillance.',
        satisfiedByMarmalade: true,
        satisfiedBySprout: true,
      },
      {
        id: 'ai_disclosure',
        label: 'Clear AI disclosure in child workspace',
        description:
          'Persistent disclosure line and first-run explainer inform the child they are interacting with an AI.',
        satisfiedByMarmalade: true,
        satisfiedBySprout: true,
      },
      {
        id: 'child_safety_prompt',
        label: 'Anthropic child-safety system prompt composed into calls',
        description:
          'Marmalade automatically injects Anthropic’s minor safety guidelines into the API system prompt.',
        satisfiedByMarmalade: true,
        satisfiedBySprout: true,
      },
      {
        id: 'parental_supervision',
        label: 'Parental supervision and legal authorization',
        description:
          'I confirm that as the supervising parent or guardian, I authorize this instance and accept Anthropic Commercial Terms.',
        satisfiedByMarmalade: false,
        satisfiedBySprout: false,
        requiredParentAction: 'Confirm parental authorization',
      },
    ],
  },
  openai: {
    providerId: 'openai',
    name: 'OpenAI',
    minorsStatus: 'allowed_with_conditions',
    termsUrl: 'https://openai.com/policies/terms-of-use',
    guidanceUrl:
      'https://developers.openai.com/api/docs/guides/safety-checks/under-18-api-guidance',
    termsEffectiveDate: 'February 2025 (Guidance updated 2026)',
    lastCheckedDate: '12 November 2026',
    summary:
      'OpenAI permits under-18 use when age-appropriate filtering, AI disclosure, and safety-aligned models (such as GPT-4o or GPT-4o-mini) are configured. For children under 13, Zero Data Retention (ZDR) must be active on your OpenAI account.',
    conditionsChecklist: [
      {
        id: 'age_filters',
        label: 'Age-appropriate filters and guardrails',
        description:
          'Turn limits, Socratic guidance, and dangerous content screening prevent harmful interactions.',
        satisfiedByMarmalade: true,
        satisfiedBySprout: true,
      },
      {
        id: 'ai_disclosure',
        label: 'AI disclosure to the student',
        description:
          'Persistent notice informs the child they are talking to an AI that can make mistakes.',
        satisfiedByMarmalade: true,
        satisfiedBySprout: true,
      },
      {
        id: 'flagship_model',
        label: 'Safety-aligned model configuration',
        description:
          'Configured to safety-aligned models (e.g., GPT-4o, GPT-4o-mini) with system instructions.',
        satisfiedByMarmalade: true,
        satisfiedBySprout: true,
      },
      {
        id: 'under_13_zdr',
        label: 'Under-13 Zero Data Retention parent acknowledgment',
        description:
          'If the child using this workspace is under 13, Zero Data Retention (ZDR) must be active on your OpenAI account. Marmalade records parent acknowledgment; account retention terms cannot be independently verified via API.',
        satisfiedByMarmalade: false,
        satisfiedBySprout: false,
        requiredParentAction: 'Acknowledge ZDR status for under-13 use',
      },
      {
        id: 'parental_supervision',
        label: 'Parental supervision acknowledgment',
        description:
          'I confirm that as the supervising parent or guardian, I authorize and supervise this connection under OpenAI API Terms of Use.',
        satisfiedByMarmalade: false,
        satisfiedBySprout: false,
        requiredParentAction: 'Confirm supervision under OpenAI terms',
      },
    ],
  },
  mistral: {
    providerId: 'mistral',
    name: 'Mistral AI',
    minorsStatus: 'allowed_with_conditions',
    termsUrl: 'https://legal.mistral.ai/terms/commercial-terms-of-service',
    termsEffectiveDate: '2025',
    lastCheckedDate: '12 November 2026',
    summary:
      'Mistral requires legally adequate parental consent and prohibits transmitting personal information of children under 13 (or local digital consent age) as customer data.',
    conditionsChecklist: [
      {
        id: 'pii_stripping',
        label: 'PII filter enabled for child prompts',
        description:
          'Automatically strip names, addresses, emails, and school details before transmitting queries.',
        satisfiedByMarmalade: true,
        satisfiedBySprout: true,
      },
      {
        id: 'parental_consent',
        label: 'Parental consent acknowledged',
        description:
          'Supervising parent confirms consent to process non-PII queries on Mistral API.',
        satisfiedByMarmalade: false,
        satisfiedBySprout: false,
        requiredParentAction: 'Confirm parental consent',
      },
    ],
  },
  local_ollama: {
    providerId: 'local_ollama',
    name: 'Local Model (Ollama)',
    minorsStatus: 'allowed',
    termsUrl: 'https://ollama.com',
    termsEffectiveDate: 'N/A (Self-hosted)',
    lastCheckedDate: '4 November 2026',
    summary:
      'Runs entirely on your local hardware or home server. No third-party API terms apply; the family maintains full responsibility for model safety.',
    conditionsChecklist: [
      {
        id: 'family_responsibility',
        label: 'Family responsibility for local model behavior',
        description:
          'Open-weights models lack external vendor trust & safety filters; Marmalade application-level filters remain active.',
        satisfiedByMarmalade: false,
        satisfiedBySprout: false,
        requiredParentAction: 'Acknowledge local model responsibility',
      },
    ],
  },
  mock: {
    providerId: 'mock',
    name: 'Demo / Sample Mode',
    minorsStatus: 'allowed',
    termsUrl: '',
    termsEffectiveDate: 'N/A',
    lastCheckedDate: '4 November 2026',
    summary:
      'Built-in deterministic test bank. No live AI, no charges, and no data transmitted.',
    conditionsChecklist: [],
  },
};

/**
 * Checks if a given provider is compliant for minor / child space use.
 */
export function isProviderAllowedForMinors(providerId: string): boolean {
  const policy = PROVIDER_POLICY_MATRIX[providerId];
  return policy ? policy.minorsStatus !== 'not_allowed' : false;
}
