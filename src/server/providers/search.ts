import type {
  DomainPolicy,
  SearchProvider,
  VerifiedSourceRecord,
} from './types.js';

/**
 * Redacts personal details (emails, phone numbers, SSNs, or self-identifying phrases)
 * before a search query leaves the server (Roadmap Section 5.2).
 */
export function redactPiiFromSearchQuery(query: string): string {
  return query
    .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, '[redacted-email]')
    .replace(
      /\b(?:\+?\d{1,3}[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}\b/g,
      '[redacted-phone]'
    )
    .replace(/\bmy name is\s+[a-z]+\b/gi, '')
    .replace(/\bi live at\s+[^,.!?]+/gi, '')
    .trim();
}

/**
 * Sanitizes untrusted external search snippets against prompt injection
 * so retrieved web content is treated strictly as data (Roadmap Section 5.5).
 */
export function sanitizeUntrustedSearchSnippet(raw: string): string {
  return raw
    .replace(
      /ignore\s+(all\s+)?(previous|prior|above)\s+instructions?/gi,
      '[filtered-directive]'
    )
    .replace(
      /\b(system\s*prompt|system\s*override|developer\s*mode|jailbreak)\b/gi,
      '[filtered]'
    )
    .replace(/https?:\/\/\S+/gi, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 260);
}

export class SyntheticSearchProvider implements SearchProvider {
  readonly id = 'synthetic_search' as const;
  readonly displayName =
    'Synthetic Verified Search Adapter (Curated Educational Sources)';

  private readonly curatedDatabase: VerifiedSourceRecord[] = [
    {
      sourceId: 'src_1',
      title: 'Planetary Science Institute — The Unique Axial Tilt of Uranus',
      url: 'https://www.psi.edu/education/uranus-axial-tilt',
      domain: 'psi.edu',
      isCurated: true,
      snippet:
        'Uranus has an extreme axial tilt of 97.77 degrees, meaning it rotates almost entirely on its side compared to the plane of the Solar System.',
    },
    {
      sourceId: 'src_2',
      title: 'NASA Solar System Exploration — Titan Overview and Atmosphere',
      url: 'https://science.nasa.gov/saturn/moons/titan/',
      domain: 'science.nasa.gov',
      isCurated: true,
      snippet:
        'Titan is the only moon in our solar system known to have a substantial atmosphere composed primarily of nitrogen, with liquid hydrocarbon surface lakes.',
    },
    {
      sourceId: 'src_3',
      title:
        'Folger Shakespeare Library — Julius Caesar Rhetoric and Antony’s Speech',
      url: 'https://www.folger.edu/explore/shakespeares-works/julius-caesar/antony-funeral-oration',
      domain: 'folger.edu',
      isCurated: true,
      snippet:
        'In Act 3, Scene 2, Mark Antony repeats "For Brutus is an honourable man" to subtly question the conspirators’ justification for the assassination.',
    },
    {
      sourceId: 'src_4',
      title:
        'British Library — The Epistolary Architecture of Bram Stoker’s Dracula',
      url: 'https://www.bl.uk/romantics-and-victorians/articles/dracula-composition-and-context',
      domain: 'bl.uk',
      isCurated: true,
      snippet:
        'Stoker composed Dracula entirely through modern documentary evidence: journal entries, phonograph recordings, ship captain logs, and newspaper reports.',
    },
    {
      sourceId: 'src_5',
      title:
        'Encyclopedia Britannica — The Indus Valley Civilization and Mohenjo-daro',
      url: 'https://www.britannica.com/topic/Indus-civilization',
      domain: 'britannica.com',
      isCurated: true,
      snippet:
        'The Indus Valley civilization flourished around 2500 BCE, notable for urban sanitation systems, standardized brick proportions, and grid-planned settlements.',
    },
  ];

  async search(
    query: string,
    domainPolicy: DomainPolicy
  ): Promise<VerifiedSourceRecord[]> {
    const qLower = query.toLowerCase();
    const stopWords = new Set([
      'the',
      'and',
      'why',
      'how',
      'what',
      'does',
      'about',
      'tell',
      'with',
      'for',
      'are',
      'can',
      'you',
      'matter',
      'need',
    ]);
    const queryTokens =
      qLower
        .match(/[a-z0-9]+/g)
        ?.filter((t) => t.length > 2 && !stopWords.has(t)) || [];

    // Filter against domain blocked list first
    const eligibleSources = this.curatedDatabase.filter((rec) => {
      if (
        domainPolicy.blockedDomains.some(
          (b) =>
            rec.domain === b.toLowerCase() ||
            rec.domain.endsWith('.' + b.toLowerCase())
        )
      ) {
        return false;
      }
      return true;
    });

    const matches = eligibleSources.filter((rec) => {
      const text = `${rec.title} ${rec.snippet} ${rec.domain}`.toLowerCase();
      return queryTokens.some((tok) => text.includes(tok));
    });

    // If query matches, return them with verified source IDs; otherwise return top 2 general curated sources
    const results = matches.length > 0 ? matches : [];
    return results;
  }
}

function meaningfulTerms(query: string): string[] {
  const ignored = new Set([
    'the',
    'and',
    'why',
    'how',
    'what',
    'does',
    'about',
    'tell',
    'with',
    'for',
    'are',
    'can',
    'you',
    'matter',
    'need',
    'please',
    'find',
    'sources',
    'research',
    'explain',
  ]);
  return (query.toLowerCase().match(/[a-z0-9]+/g) || [])
    .filter((word) => word.length > 2 && !ignored.has(word))
    .map((word) => (word.length > 3 ? word.replace(/s$/, '') : word));
}

export class PluggableWebSearchProvider implements SearchProvider {
  readonly id = 'external_searxng' as const;
  readonly displayName = 'Web Search Adapter (SearXNG / Brave Search)';

  private readonly searchApiUrl: string;
  private readonly searchApiKey?: string;

  constructor(options: { searchApiUrl?: string; searchApiKey?: string } = {}) {
    this.searchApiUrl =
      options.searchApiUrl || process.env.SEARCH_API_URL || '';
    this.searchApiKey = options.searchApiKey || process.env.SEARCH_API_KEY;
  }

  async search(
    query: string,
    domainPolicy: DomainPolicy
  ): Promise<VerifiedSourceRecord[]> {
    const safeQuery = redactPiiFromSearchQuery(query);
    if (!this.searchApiUrl) {
      // An unconfigured live adapter is not a local-library result.
      throw new Error('SEARCH_UNAVAILABLE');
    }

    try {
      const isBrave = this.searchApiUrl.toLowerCase().includes('brave.com');
      const headers: Record<string, string> = { Accept: 'application/json' };
      if (this.searchApiKey) {
        if (isBrave) {
          headers['X-Subscription-Token'] = this.searchApiKey;
        } else {
          headers['Authorization'] = `Bearer ${this.searchApiKey}`;
        }
      }

      const url = new URL(this.searchApiUrl);
      url.searchParams.set('q', safeQuery);
      if (isBrave) {
        url.searchParams.set('safesearch', 'strict');
        url.searchParams.set('count', '5');
      } else {
        url.searchParams.set('format', 'json');
        url.searchParams.set('safesearch', '2');
      }

      const res = await fetch(url.toString(), {
        headers,
        signal: AbortSignal.timeout(6000),
      });

      if (!res.ok) {
        throw new Error(`Search provider returned HTTP ${res.status}`);
      }

      const data = await res.json();
      const rawResults: any[] = Array.isArray(data.web?.results)
        ? data.web.results.map((r: any) => ({
            title: r.title,
            url: r.url,
            content:
              r.description ||
              (Array.isArray(r.extra_snippets) ? r.extra_snippets.join(' ') : ''),
          }))
        : Array.isArray(data.results)
          ? data.results
          : [];

      let index = 1;
      const verifiedRecords: VerifiedSourceRecord[] = [];

      for (const item of rawResults) {
        if (!item.url || !item.title) continue;
        let domain = '',
          normalizedUrl = '';
        const evidence =
          `${item.title} ${item.content || item.snippet || ''}`.toLowerCase();
        const terms = meaningfulTerms(safeQuery);
        if (terms.length && !terms.some((term) => evidence.includes(term)))
          continue;
        try {
          const parsed = new URL(item.url);
          if (!['http:', 'https:'].includes(parsed.protocol)) continue;
          parsed.hash = '';
          normalizedUrl = parsed.href;
          domain = parsed.hostname.replace(/^www\./, '');
          if (verifiedRecords.some((record) => record.url === normalizedUrl))
            continue;
        } catch {
          continue;
        }

        // Apply blocked domains policy
        if (
          domainPolicy.blockedDomains.some(
            (b) =>
              domain === b.toLowerCase() ||
              domain.endsWith('.' + b.toLowerCase())
          )
        ) {
          continue;
        }

        const isCurated = domainPolicy.recommendedDomains.some(
          (r) =>
            domain === r.toLowerCase() || domain.endsWith('.' + r.toLowerCase())
        );

        verifiedRecords.push({
          sourceId: `src_${index++}`,
          title: sanitizeUntrustedSearchSnippet(String(item.title)),
          url: normalizedUrl,
          domain,
          isCurated,
          snippet: sanitizeUntrustedSearchSnippet(
            String(item.content || item.snippet || '')
          ),
        });

        if (verifiedRecords.length >= 5) break;
      }

      return verifiedRecords;
    } catch {
      // Preserve failure rather than substituting unrelated local records.
      throw new Error('SEARCH_UNAVAILABLE');
    }
  }
}
