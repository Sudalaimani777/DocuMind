const BOUNDARY_TAG_PATTERN = /<(\/?(?:document_context|conversation_history|system)\b[^>]*)>/gi;

/**
 * Escapes prompt boundary tags in untrusted text so user queries, conversation
 * history, or document excerpts cannot break out of structured prompt sections.
 */
export function sanitizePromptInput(input: string): string {
  return input.replace(BOUNDARY_TAG_PATTERN, '&lt;$1&gt;');
}
