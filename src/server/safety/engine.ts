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
// while not blocking legitimate school literature or history topics.
const IMMEDIATE_SELF_HARM =
  /\b(?:how to commit suicide|suicide methods|cutting my wrists|cut myself|cutting myself|want to (?:die|end my life)|thinking about suicide|think about suicide|hang myself|hurt myself|kill myself(?!\s+(?:laughing|trying|working|eating)))\b/i;

const IMMEDIATE_ABUSE_CONTACT =
  /\b(?:someone is hurting me|hitting me at home|abusing me|touched me inappropriately|adult asked to meet in secret|afraid of my parents hurting me|my dad hits me|my mom hits me|being hit at home|physical abuse at home|parents are hurting me)\b/i;

const PARENTAL_DOMESTIC_ABUSE_PATTERN =
  /\b(?:dad|father|mom|mother|stepdad|stepmom|parents|at home|family)\b/i;

const IMMEDIATE_WEAPONS_EXPLOSIVES =
  /\b(?:how to (?:make|build|assemble|cook) (?:a\s+)?(?:(?:pipe\s+)?bomb|explosives|tnt|chemical weapon|poison gas|poison|lethal poison)|pipe bomb|mass shooting instructions)\b/i;

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
    // If the disclosure indicates parental/domestic abuse, show the child helplines immediately,
    // but suppress alerting the parent dashboard to avoid endangering the child.
    if (IMMEDIATE_ABUSE_CONTACT.test(trimmed)) {
      const isDomesticParental = PARENTAL_DOMESTIC_ABUSE_PATTERN.test(trimmed);
      return {
        allowed: false,
        flagged: true,
        category: 'abuse_unsafe_contact',
        severity: 'high',
        suppressParentAlert: isDomesticParental,
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
