/**
 * Fixed Safety Indicator Categories & Protocol (Item 4)
 * Defines the standardized categories, their definitions, child-facing immediate
 * support interventions, and parent dashboard visibility rules.
 */

export type SafetyCategoryKey =
  | 'self_harm'
  | 'abuse_unsafe_contact'
  | 'sexual_content'
  | 'illicit_weapons'
  | 'violence_weapons'
  | 'dangerous_activities'
  | 'pii_shared';

export interface SafetyCategoryDefinition {
  key: SafetyCategoryKey;
  label: string;
  definition: string;
  severity: 'low' | 'medium' | 'high';
  childImmediateSupport: {
    message: string;
    helplineInfo?: {
      title: string;
      contacts: Array<{ region: string; detail: string }>;
    };
  };
  parentVisibility: {
    recordedFields: string;
    notificationLevel: 'dashboard' | 'priority_alert';
    explanation: string;
  };
}

const WEAPONS_DEF: SafetyCategoryDefinition = {
  key: 'illicit_weapons',
  label: 'Violence or weapons',
  definition: 'Instructions for fabricating weapons, explosives, or severe threats of violence against others.',
  severity: 'high',
  childImmediateSupport: {
    message:
      'I cannot assist with instructions for manufacturing weapons or dangerous explosives.',
  },
  parentVisibility: {
    recordedFields: 'Category, Mode, and Timestamp only.',
    notificationLevel: 'priority_alert',
    explanation: 'Logged with timestamp and mode. No transcript is stored or exposed.',
  },
};

export const SAFETY_CATEGORIES: Record<SafetyCategoryKey, SafetyCategoryDefinition> = {
  self_harm: {
    key: 'self_harm',
    label: 'Self-harm or suicide',
    definition: 'Expressions of self-injury, suicide ideation, or profound despair.',
    severity: 'high',
    childImmediateSupport: {
      message:
        'If you or someone you know is feeling unsafe, overwhelmed, or having thoughts of self-harm, please talk with your parent, a trusted adult at home or school, or call/text your local crisis helpline right now. Help is always available.',
      helplineInfo: {
        title: 'Free, confidential support is available 24/7:',
        contacts: [
          { region: 'US & Canada', detail: 'Call or text 988 (Suicide & Crisis Lifeline)' },
          { region: 'UK', detail: 'Call 111 (NHS) or 0800 1111 (Childline)' },
          { region: 'India', detail: 'Call 14416 (Tele-MANAS) or 1098 (Childline)' },
          { region: 'International', detail: 'Visit https://findahelpline.com for support worldwide' },
        ],
      },
    },
    parentVisibility: {
      recordedFields: 'Category, Mode, and Timestamp only (No prompt or conversation text).',
      notificationLevel: 'priority_alert',
      explanation:
        'High-priority indicator. Recorded on the parent overview with category and time so you can gently check in with your child in person.',
    },
  },
  abuse_unsafe_contact: {
    key: 'abuse_unsafe_contact',
    label: 'Abuse or unsafe contact',
    definition: 'Indications of physical harm, neglect, exploitation, or unsafe adult contact.',
    severity: 'high',
    childImmediateSupport: {
      message:
        'If someone is hurting you, making you feel unsafe, or asking you to keep secrets that make you uncomfortable, please tell a trusted adult at home or school right away.',
      helplineInfo: {
        title: 'Confidential helplines for children & young people:',
        contacts: [
          { region: 'US', detail: 'Call or text 1-800-422-4453 (Childhelp)' },
          { region: 'UK', detail: 'Call 0800 1111 (Childline UK)' },
          { region: 'India', detail: 'Call 1098 (National Childline India)' },
          { region: 'Emergency', detail: 'Call your local emergency number (911 / 999 / 112)' },
        ],
      },
    },
    parentVisibility: {
      recordedFields: 'Category, Mode, and Timestamp only (No prompt or conversation text).',
      notificationLevel: 'priority_alert',
      explanation:
        'High-priority indicator. Signals that the child mentioned a potential safety or contact concern, without logging conversation content.',
    },
  },
  sexual_content: {
    key: 'sexual_content',
    label: 'Sexually explicit content',
    definition: 'Requests for sexually explicit material, erotica, or age-inappropriate sexual themes.',
    severity: 'medium',
    childImmediateSupport: {
      message:
        'This workspace cannot answer questions or create stories involving adult or sexually explicit themes.',
    },
    parentVisibility: {
      recordedFields: 'Category, Mode, and Timestamp only.',
      notificationLevel: 'dashboard',
      explanation: 'Logged as an operational safety category on the parent overview.',
    },
  },
  illicit_weapons: WEAPONS_DEF,
  violence_weapons: { ...WEAPONS_DEF, key: 'violence_weapons' },
  dangerous_activities: {
    key: 'dangerous_activities',
    label: 'Dangerous activities',
    definition: 'Instructions for hazardous physical stunts, ingesting toxins, or immediate self-endangerment.',
    severity: 'medium',
    childImmediateSupport: {
      message:
        'I cannot give advice or instructions for dangerous physical stunts or consuming harmful substances.',
    },
    parentVisibility: {
      recordedFields: 'Category, Mode, and Timestamp only.',
      notificationLevel: 'dashboard',
      explanation: 'Logged on the parent dashboard without recording user text.',
    },
  },
  pii_shared: {
    key: 'pii_shared',
    label: 'Personal information shared',
    definition: 'Sensitive personal identifiers (phone numbers, home addresses, school names) entered in prompts.',
    severity: 'low',
    childImmediateSupport: {
      message:
        'A reminder: for your privacy, avoid entering personal details like your phone number, home address, or school name.',
    },
    parentVisibility: {
      recordedFields: 'Category, Mode, and Timestamp only.',
      notificationLevel: 'dashboard',
      explanation:
        'Indicates that the built-in PII filter detected and masked personal information in a prompt before transmission.',
    },
  },
};
