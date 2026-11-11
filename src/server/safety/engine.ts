import type { ActivityMode } from '../../shared/types.js';
import {
  type SafetyCategoryKey,
  SAFETY_CATEGORIES,
} from '../../shared/safety.js';

export interface SafetyCheckResult {
  allowed: boolean;
  flagged: boolean;
  category?: SafetyCategoryKey;
  severity?: 'low' | 'medium' | 'high';
  suppressParentAlert?: boolean;
  sanitizedContent?: string;
  userFacingMessage?: string;
}

// Patterns representing immediate high-risk content calibrated to protect children
// while not blocking legitimate school literature, science, or history topics.
const IMMEDIATE_SELF_HARM =
  /\b(?:how to commit suicide|suicide methods|cutting my wrists|(?:i\s+)?cut(?:ting)?\s+myself(?!\s+(?:on\s+paper|by\s+accident|accidentally|shaving|slicing|cooking))\b|i\s+(?:want to|feel like|plan to|might|going to)\s+hurt\s+myself|i\s+hurt\s+myself\s+on\s+purpose|thinking about suicide|think about suicide|hang myself|kill myself(?!\s+(?:laughing|trying|working|eating))|i\s+(?:really\s+)?want to (?:die|end my life)|makes?\s+me\s+want\s+to\s+die|i\s+(?:feel suicidal|wish i was dead|don't want to be alive anymore))\b/i;

const IMMEDIATE_ABUSE_CONTACT =
  /\b(?:someone is hurting me|hitting me at home|abusing me|touched me inappropriately|adult asked to meet in secret|afraid of my parents hurting me|my (?:dad|mom|stepdad|stepmom|uncle|aunt|brother|sister|parent) (?:hits|beats|touches) me|being hit at home|physical abuse at home|parents are hurting me)\b/i;

const PARENTAL_DOMESTIC_ABUSE_PATTERN =
  /\b(?:dad|father|mom|mother|stepdad|stepmom|parents|at home|family)\b/i;

const IMMEDIATE_WEAPONS_EXPLOSIVES =
  /\b(?:how to (?:make|build|assemble|cook)\s+(?:a\s+)?(?:(?:pipe\s+)?bomb|explosives|tnt|chemical weapon|poison gas|poison(?!\s+(?:ivy|oak|sumac)\b)|lethal poison)|pipe bomb|mass shooting instructions)\b/i;

const EXPLOITATION_SEXUAL =
  /\b(?:csam|child sexual|solicit minor|explicit erotica|hardcore porn|sexual grooming|online grooming|adult grooming|grooming\s+(?:a\s+)?(?:child|minor|kid|teen|me))\b/i;

const DANGEROUS_ACTIVITIES =
  /\b(?:choking game|pass out challenge|drink bleach|ingest poison|swallow razor)\b/i;

// Safe literature / history words to avoid false positives on Hamlet, Dracula, etc.
const LITERATURE_EXCEPTION_WORDS =
  /\b(?:dracula|caesar|brutus|frankenstein|dune|odyssey|iliad|macbeth|hamlet|romeo|juliet|mythology|tragedy|battle of|civil war|revolution)\b/i;

function formatChildSupportMessage(categoryKey: SafetyCategoryKey): string {
  const def = SAFETY_CATEGORIES[categoryKey];
  if (!def) return 'This request was stopped by safety safeguards.';

  let out = def.childImmediateSupport.message;
  if (def.childImmediateSupport.helplineInfo) {
    out += `\n\n${def.childImmediateSupport.helplineInfo.title}\n`;
    for (const c of def.childImmediateSupport.helplineInfo.contacts) {
      out += `• ${c.region}: ${c.detail}\n`;
    }
  }
  return out.trim();
}

export class ApplicationSafetyLayer {
  /**
   * Screen incoming user message before it reaches any model or search provider.
   */
  public screenInput(text: string, _mode: ActivityMode): SafetyCheckResult {
    const trimmed = text.trim();
    if (!trimmed) {
      return { allowed: true, flagged: false };
    }

    // 1. Self-harm / suicide check
    if (IMMEDIATE_SELF_HARM.test(trimmed)) {
      return {
        allowed: false,
        flagged: true,
        category: 'self_harm',
        severity: 'high',
        userFacingMessage: formatChildSupportMessage('self_harm'),
      };
    }

    // 2. Abuse or unsafe contact check
    // When a child discloses abuse, show the child helplines immediately.
    // Suppress alerting the parent dashboard to avoid endangering the child (especially if perpetrator is at home or unknown).
    if (IMMEDIATE_ABUSE_CONTACT.test(trimmed)) {
      return {
        allowed: false,
        flagged: true,
        category: 'abuse_unsafe_contact',
        severity: 'high',
        suppressParentAlert: true,
        userFacingMessage: formatChildSupportMessage('abuse_unsafe_contact'),
      };
    }

    // 3. Severe weapons / explosives check
    if (IMMEDIATE_WEAPONS_EXPLOSIVES.test(trimmed)) {
      return {
        allowed: false,
        flagged: true,
        category: 'illicit_weapons',
        severity: 'high',
        userFacingMessage: formatChildSupportMessage('illicit_weapons'),
      };
    }

    // 4. Severe exploitation / sexual content
    if (EXPLOITATION_SEXUAL.test(trimmed)) {
      return {
        allowed: false,
        flagged: true,
        category: 'sexual_content',
        severity: 'high',
        userFacingMessage: formatChildSupportMessage('sexual_content'),
      };
    }

    // 5. Dangerous physical activities
    if (DANGEROUS_ACTIVITIES.test(trimmed)) {
      return {
        allowed: false,
        flagged: true,
        category: 'dangerous_activities',
        severity: 'medium',
        userFacingMessage: formatChildSupportMessage('dangerous_activities'),
      };
    }

    return { allowed: true, flagged: false };
  }

  /**
   * Screen assistant response content before sending it to the client.
   */
  public screenOutput(content: string, _mode: ActivityMode): SafetyCheckResult {
    if (IMMEDIATE_SELF_HARM.test(content) && !LITERATURE_EXCEPTION_WORDS.test(content)) {
      return {
        allowed: false,
        flagged: true,
        category: 'self_harm',
        severity: 'high',
        sanitizedContent:
          'I cannot provide that response. Please reach out to a parent or trusted adult if you need support.',
      };
    }

    if (IMMEDIATE_WEAPONS_EXPLOSIVES.test(content)) {
      return {
        allowed: false,
        flagged: true,
        category: 'violence_weapons',
        severity: 'high',
        sanitizedContent:
          'I cannot provide instructions for creating weapons or explosives.',
      };
    }

    if (EXPLOITATION_SEXUAL.test(content)) {
      return {
        allowed: false,
        flagged: true,
        category: 'sexual_content',
        severity: 'high',
        sanitizedContent:
          'I cannot produce sexually explicit or exploitative content.',
      };
    }

    return { allowed: true, flagged: false };
  }
}
