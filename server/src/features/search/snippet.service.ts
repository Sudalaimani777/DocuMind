import DOMPurify from 'isomorphic-dompurify';

/**
 * Sanitizes PostgreSQL ts_headline HTML, allowing only <mark> highlight tags.
 */
export function sanitizeSnippet(rawHtml: string): string {
  return DOMPurify.sanitize(rawHtml, {
    ALLOWED_TAGS: ['mark'],
    ALLOWED_ATTR: [],
  }).trim();
}

/**
 * Generates a plain-text excerpt for semantic-only matches without <mark> highlights.
 */
export function buildFallbackExcerpt(content: string, maxLength = 220): string {
  const normalized = content.replace(/\s+/g, ' ').trim();
  if (normalized.length <= maxLength) {
    return normalized;
  }
  return `${normalized.slice(0, maxLength).trimEnd()}...`;
}
