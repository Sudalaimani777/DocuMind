const DEFAULT_SESSION_TITLE = 'New Document Chat';
const MAX_TITLE_WORDS = 6;
const MAX_TITLE_LENGTH = 255;

/**
 * Generates a concise chat session title from the user's opening query.
 * Strips punctuation and extra whitespace, caps at 6 words and 255 characters,
 * and falls back to "New Document Chat" when no alphanumeric words remain.
 */
export function generateSessionTitle(query: string): string {
  const cleaned = query
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .trim()
    .replace(/\s+/g, ' ');

  if (!cleaned) {
    return DEFAULT_SESSION_TITLE;
  }

  const words = cleaned.split(' ').slice(0, MAX_TITLE_WORDS);
  const title = words.length > 0 ? words.join(' ') : DEFAULT_SESSION_TITLE;
  return title.slice(0, MAX_TITLE_LENGTH);
}
