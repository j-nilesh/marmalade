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
  'eleven', 'twelve', 'ten', 'nine', 'eight', 'seven', 'six', 'five', 'years', 'old',
  'maybe', 'later', 'soon', 'song', 'crazy', 'tomorrow', 'tonight', 'yesterday', 'again'
]);

const GENERIC_SCHOOL_WORDS = new Set([
  'in', 'at', 'what', 'why', 'how', 'when', 'is', 'the', 'a', 'an',
  'about', 'junior', 'senior', 'musical', 'elementary', 'middle', 'high',
  'my', 'your', 'our', 'their', 'some', 'any', 'every', 'each', 'all',
  'good', 'bad', 'new', 'old', 'local', 'public', 'private', 'online'
]);

const LITERATURE_MEDIA_WORDS = new Set([
  'poem', 'book', 'novel', 'play', 'story', 'song', 'track', 'album',
  'quote', 'directed', 'illustrated', 'written', 'authored', 'composed',
  'piece', 'reading', 'chapter', 'excerpt', 'passage', 'article', 'biography',
  'tragedy', 'comedy', 'tale', 'ode', 'sonnet'
]);

// Regexes for identifying common PII patterns
const createEmailRegex = () =>
  /\b[A-Za-z0-9._%+-]+\s*(?:@|\(at\)|\[at\]|\bat\b)\s*[A-Za-z0-9.-]+\s*(?:\.|\(dot\)|\[dot\]|\bdot\b)\s*[A-Za-z]{2,}\b|\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/gi;

const createPhoneRegex = () =>
  /(?:\+1[-.\s]?)?\(?\d{3}\)?[-.\s]\d{3}[-.\s]\d{4}\b|(?:\+1\d{10}\b)|\(\d{3}\)\s?\d{3}[-.\s]?\d{4}\b|(?:\+44\s?|\b0)(?:[12378]\d{1,3}|\(0\)[12378]\d{1,3})\s?\d{3,4}\s?\d{3,4}\b|(?:\+?91[\s-]?)?[6-9]\d{4}[\s-]\d{5}\b|(?:\+91[\s-]?[6-9]\d{9}\b)|(\b(?:call(?:\s+me)?(?:\s+at)?|phone(?:\s+number)?(?:\s+is)?|mobile(?:\s+is)?|cell(?:\s+is)?|tel|whatsapp|reach\s+me(?:\s+at)?|dial|sms|text\s+me(?:\s+at)?|number(?:\s+is)?)\s*:?\s*)([6-9]\d{9}\b)/gi;

const createAddressRegex = () =>
  /\b\d{1,5}[A-Za-z]?(?!\s+(?:BC|BCE|AD|CE)\b)(?:\s+(?!(?:in|the|at|on|by|of|from|bc|ad|bce|ce)\b)[A-Za-z0-9'-]+){1,4}\s+(?:Street|St\.?|Avenue|Ave\.?|Road|Rd\.?|Boulevard|Blvd\.?|Drive|Dr\.?|Lane|Ln\.?|Court|Ct\.?|Way|Highway|Hwy\.?|Circle|Cir\.?|Terrace|Ter\.?|Place|Pl\.?|Square|Sq\.?|Trail|Trl\.?|Parkway|Pkwy\.?)\b|\b(?:Apt|Apartment|Flat|Unit|Suite)\s+#?[0-9A-Za-z-]+,?\s+\d{1,5}[A-Za-z]?(?:\s+(?!(?:in|the|at|on|by|of|from|bc|ad|bce|ce)\b)[A-Za-z0-9'-]+){1,4}\b/gi;

/**
 * School patterns: requires explicit attendance/enrollment lead-in OR capitalized proper school name,
 * avoiding false positives on generic phrases like "What do kids learn in high school?" or "High School Musical".
 */
const schoolLeadInRegex = () =>
  /\b(attending|enrolled at|my school is|i go to|student at|goes to)\s+([\p{L}0-9.'\s]{2,40}?(?:Elementary(?:\s+School)?|Middle School|High School|Grammar School|Charter School|Preparatory School|Academy|Prep|School))\b/giu;

const schoolProperRegex = () =>
  /\b([\p{Lu}][\p{L}0-9.'-]+(?:\s+[\p{Lu}][\p{L}0-9.'-]+){0,3}\s+(?:Elementary(?:\s+School)?|Middle School|High School|Grammar School|Charter School|Preparatory School))(?!\s+Musical\b)\b/gu;

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

  // 4. Mask school names (with enrollment lead-in or capitalized proper school name)
  let schoolMatched = false;
  const leadIn = schoolLeadInRegex();
  if (leadIn.test(result)) {
    schoolMatched = true;
    result = result.replace(
      schoolLeadInRegex(),
      (_match, prefix) => prefix + ' [removed: school name]'
    );
  }

  const properSchool = schoolProperRegex();
  if (properSchool.test(result)) {
    result = result.replace(schoolProperRegex(), (match, school) => {
      const firstWord = school.trim().split(/\s+/)[0].toLowerCase();
      if (GENERIC_SCHOOL_WORDS.has(firstWord)) return match;
      schoolMatched = true;
      return '[removed: school name]';
    });
  }

  if (schoolMatched) {
    detectedTypes.push('school');
  }

  // 5. Mask full name self-introductions without mangling ordinary sentences
  let nameMatched = false;

  // A) Explicit introduction: 'my name is <name>', 'call me <name>' (supports unicode \p{L} for accented names)
  result = result.replace(
    /\b(my name is|call me)\s+([\p{L}'-]+(?:\s+[\p{L}'-]+){0,2})\b/giu,
    (match, prefix, nameGroup) => {
      const words = nameGroup.trim().split(/\s+/);
      if (words.length === 0) return match;
      if (COMMON_NON_NAME_WORDS.has(words[0].toLowerCase())) return match;
      nameMatched = true;
      return prefix + ' [removed: full name]';
    }
  );

  // B) 'I am' or 'I\'m' followed by 1-3 capitalized proper words (supports unicode \p{Lu}\p{Ll})
  result = result.replace(
    /\b(I\s+am|I'm|i\s+am|i'm)\s+([\p{Lu}][\p{Ll}'-]+(?:\s+[\p{Lu}][\p{Ll}'-]+){0,2})\b/gu,
    (match, prefix, nameGroup) => {
      const words = nameGroup.trim().split(/\s+/);
      if (words.length === 0) return match;
      if (COMMON_NON_NAME_WORDS.has(words[0].toLowerCase())) return match;
      nameMatched = true;
      return prefix + ' [removed: full name]';
    }
  );

  // C) Authorship / student headers:
  // 1. Explicit student headers: 'student: <Name>', 'by student: <Name>', 'homework by <Name>', 'report by <Name>'
  result = result.replace(
    /\b(student:?|by student:?|author is student:?|homework by|report by|project by|assignment by)\s+([\p{Lu}][\p{Ll}'-]+\s+([\p{Lu}][\p{Ll}'-]+))\b/giu,
    (match, prefix, nameGroup) => {
      const words = nameGroup.trim().split(/\s+/);
      if (words.length === 0) return match;
      if (COMMON_NON_NAME_WORDS.has(words[0].toLowerCase())) return match;
      nameMatched = true;
      return prefix + ' [removed: full name]';
    }
  );

  // 2. Generic 'by <First Last>', but exclude literature/media references (e.g. 'poem by Robert Frost', 'book by Roald Dahl')
  result = result.replace(
    /(?:(\b[\p{L}]+)\s+)?\bby\s+([\p{Lu}][\p{Ll}'-]+(?:\s+[\p{Lu}][\p{Ll}'-]+)+)\b/gu,
    (match, prevWord, nameGroup) => {
      if (prevWord && LITERATURE_MEDIA_WORDS.has(prevWord.toLowerCase())) {
        return match;
      }
      const words = nameGroup.trim().split(/\s+/);
      if (words.length === 0) return match;
      if (COMMON_NON_NAME_WORDS.has(words[0].toLowerCase())) return match;
      nameMatched = true;
      return (prevWord ? prevWord + ' ' : '') + 'by [removed: full name]';
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
