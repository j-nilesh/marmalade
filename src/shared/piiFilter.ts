/**
 * Client & Server PII Filtering Module (Item 3)
 * Strips or masks obvious personal identifiers (emails, phone numbers,
 * home addresses, school names, full names) before prompts reach cloud providers.
 */

export interface PiiFilterResult {
  redactedText: string;
  hasPii: boolean;
  detectedTypes: string[];
}

const COMMON_NON_NAME_WORDS = new Set([
  'not', 'just', 'so', 'very', 'wondering', 'reading', 'happy', 'sad', 'stuck',
  'doing', 'trying', 'here', 'ready', 'sure', 'sorry', 'fine', 'good', 'bad',
  'going', 'looking', 'working', 'hoping', 'writing', 'learning', 'asking',
  'making', 'thinking', 'feeling', 'excited', 'confused', 'tired', 'curious',
  'interested', 'planning', 'building', 'playing', 'studying', 'searching',
  'practicing', 'an', 'a', 'the', 'in', 'at', 'from', 'with', 'only', 'also',
  'still', 'always', 'already', 'currently', 'now', 'new', 'old', 'little',
  'big', 'all', 'done', 'finished', 'about', 'able', 'afraid', 'proud', 'back',
  'eleven', 'twelve', 'ten', 'nine', 'eight', 'seven', 'six', 'five', 'years', 'old'
]);

// Regexes for identifying common PII patterns
const createEmailRegex = () =>
  /\b[A-Za-z0-9._%+-]+\s*(?:@|\(at\)|\[at\]|\bat\b)\s*[A-Za-z0-9.-]+\s*(?:\.|\(dot\)|\[dot\]|\bdot\b)\s*[A-Za-z]{2,}\b|\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/gi;

const createPhoneRegex = () =>
  /(?:\+1[-.\s]?)?\(?\d{3}\)?[-.\s]\d{3}[-.\s]\d{4}\b|(?:\+1\d{10}\b)|\(\d{3}\)\s?\d{3}[-.\s]?\d{4}\b|(?:\+44\s?|\b0)(?:[12378]\d{1,3}|\(0\)[12378]\d{1,3})\s?\d{3,4}\s?\d{3,4}\b|(?:\+?91[\s-]?)?[6-9]\d{4}[\s-]\d{5}\b|(?:\+91[\s-]?[6-9]\d{9}\b)|(\b(?:call(?:\s+me)?(?:\s+at)?|phone(?:\s+number)?(?:\s+is)?|mobile(?:\s+is)?|cell(?:\s+is)?|tel|whatsapp|reach\s+me(?:\s+at)?|dial|sms|text\s+me(?:\s+at)?|number(?:\s+is)?)\s*:?\s*)([6-9]\d{9}\b)/gi;

const createAddressRegex = () =>
  /\b\d{1,5}[A-Za-z]?(?!\s+(?:BC|BCE|AD|CE)\b)(?:\s+(?!(?:in|the|at|on|by|of|from|bc|ad|bce|ce)\b)[A-Za-z0-9'-]+){1,4}\s+(?:Street|St\.?|Avenue|Ave\.?|Road|Rd\.?|Boulevard|Blvd\.?|Drive|Dr\.?|Lane|Ln\.?|Court|Ct\.?|Way|Highway|Hwy\.?|Circle|Cir\.?|Terrace|Ter\.?|Place|Pl\.?|Square|Sq\.?|Trail|Trl\.?|Parkway|Pkwy\.?)\b|\b(?:Apt|Apartment|Flat|Unit|Suite)\s+#?[0-9A-Za-z-]+,?\s+\d{1,5}[A-Za-z]?(?:\s+(?!(?:in|the|at|on|by|of|from|bc|ad|bce|ce)\b)[A-Za-z0-9'-]+){1,4}\b/gi;

const createSchoolRegex = () =>
  /\b(?:(?:attending|at|goes to|go to|enrolled at|my school is|i go to|for|from|behind|near|of)\s+)?([A-Za-z0-9.'\s]{2,35}(?:Elementary(?:\s+School)?|Middle School|High School|Grammar School|Charter School|Preparatory School))\b|\b(?:attending|at|goes to|go to|enrolled at|my school is|i go to)\s+([A-Za-z0-9.'\s]{2,35}(?:School|Academy|Prep|College|Campus))\b/gi;

/**
 * Redacts personal identifiers from user prompts.
 */
export function redactPiiFromChildInput(input: string): PiiFilterResult {
  if (!input || typeof input !== 'string') {
    return { redactedText: input ?? '', hasPii: false, detectedTypes: [] };
  }

  const detectedTypes: string[] = [];
  let result = input;

  // 1. Mask emails (including obfuscated forms like name (at) domain dot com)
  const emailRegex = createEmailRegex();
  if (emailRegex.test(result)) {
    detectedTypes.push('email');
    result = result.replace(createEmailRegex(), '[removed: email address]');
  }

  // 2. Mask phone numbers (US/CA, UK, India, and common international 10-digit formats)
  const phoneRegex = createPhoneRegex();
  if (phoneRegex.test(result)) {
    detectedTypes.push('phone');
    result = result.replace(createPhoneRegex(), (match, prefix, digits) => {
      if (digits) {
        return prefix + '[removed: phone number]';
      }
      return '[removed: phone number]';
    });
  }

  // 3. Mask street addresses & apartments
  const addressRegex = createAddressRegex();
  if (addressRegex.test(result)) {
    detectedTypes.push('address');
    result = result.replace(createAddressRegex(), '[removed: address]');
  }

  // 4. Mask school names
  const schoolRegex = createSchoolRegex();
  if (schoolRegex.test(result)) {
    detectedTypes.push('school');
    result = result.replace(
      createSchoolRegex(),
      (_match, p1, p2) => _match.replace(p1 || p2, '[removed: school name]')
    );
  }

  // 5. Mask full name self-introductions without mangling ordinary sentences
  let nameMatched = false;

  // A) Explicit introduction: 'my name is <name>', 'call me <name>'
  result = result.replace(
    /\b(my name is|call me)\s+([A-Za-z'-]+(?:\s+[A-Za-z'-]+){0,2})\b/gi,
    (match, prefix, nameGroup) => {
      const words = nameGroup.trim().split(/\s+/);
      if (words.length === 0) return match;
      if (COMMON_NON_NAME_WORDS.has(words[0].toLowerCase())) return match;
      nameMatched = true;
      return prefix + ' [removed: full name]';
    }
  );

  // B) 'I am' or 'I\'m' followed by 1-3 capitalized proper words
  result = result.replace(
    /\b(I\s+am|I'm|i\s+am|i'm)\s+([A-Z][a-z'-]+(?:\s+[A-Z][a-z'-]+){0,2})\b/g,
    (match, prefix, nameGroup) => {
      const words = nameGroup.trim().split(/\s+/);
      if (words.length === 0) return match;
      if (COMMON_NON_NAME_WORDS.has(words[0].toLowerCase())) return match;
      nameMatched = true;
      return prefix + ' [removed: full name]';
    }
  );

  // C) Authorship / student headers: 'by <Name>', 'author: <Name>', 'student: <Name>'
  result = result.replace(
    /\b(by|author:?|student:?)\s+([A-Z][a-z'-]+\s+[A-Z][a-z'-]+)\b/g,
    (match, prefix, nameGroup) => {
      const words = nameGroup.trim().split(/\s+/);
      if (words.length === 0) return match;
      if (COMMON_NON_NAME_WORDS.has(words[0].toLowerCase())) return match;
      nameMatched = true;
      return prefix + ' [removed: full name]';
    }
  );

  if (nameMatched) {
    detectedTypes.push('full_name');
  }

  return {
    redactedText: result,
    hasPii: detectedTypes.length > 0,
    detectedTypes,
  };
}
