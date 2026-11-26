import type { LLMProvider } from '../ai/llm.provider.js';
import { createLLMProvider } from '../ai/provider.factory.js';
import type { ChatHistoryService } from '../chat-history/history.service.js';
import type { IDocumentRepository } from '../documents/document.repository.js';
import type { SearchService } from '../search/search.service.js';
import { NotFoundError } from '../../core/errors/AppError.js';
import { CitationTracker } from './citation.service.js';
import { buildGroundedPrompt, type PromptHistoryMessage } from './prompt.builder.js';
import type { RagSseDoneData, RagSseEmitFn } from './sse.emitter.js';

const GROUNDED_FALLBACK_MESSAGE =
  'The provided documents do not contain information to answer this question.';
const RAG_RETRIEVAL_LIMIT = 6;
const RAG_HISTORY_LIMIT = 6;

export interface RagExecutionParams {
  userId: string;
  query: string;
  sessionId?: string;
  documentId?: string;
  signal?: AbortSignal;
  onStreamStart?: () => void;
  emit: RagSseEmitFn;
}

/**
 * Orchestrates RAG context retrieval, prompt grounding, streaming LLM generation,
 * real-time citation tracking, and chat history persistence.
 */
export class ContextOrchestrator {
  constructor(
    private readonly searchService: Pick<SearchService, 'search'>,
    private readonly historyService: ChatHistoryService,
    private readonly documentRepository: Pick<IDocumentRepository, 'findByIdForUser'>,
    private readonly llmProviderFactory: () => LLMProvider = () => createLLMProvider()
  ) {}

  async execute(params: RagExecutionParams): Promise<void> {
    const { userId, query, sessionId, documentId, signal, onStreamStart, emit } = params;

    let resolvedSessionId: string;
    let lockedDocumentId: string | undefined = documentId;
    let history: PromptHistoryMessage[] = [];

    if (sessionId) {
      const session = await this.historyService.getOwnedSession(userId, sessionId);
      resolvedSessionId = session.id;
      if (session.documentId) {
        lockedDocumentId = session.documentId;
      } else if (documentId) {
        const doc = await this.documentRepository.findByIdForUser(documentId, userId);
        if (!doc) {
          throw new NotFoundError('Document not found.');
        }
        lockedDocumentId = documentId;
      }
      history = await this.historyService.getRecentHistory(
        userId,
        resolvedSessionId,
        RAG_HISTORY_LIMIT
      );
    } else {
      if (documentId) {
        const doc = await this.documentRepository.findByIdForUser(documentId, userId);
        if (!doc) {
          throw new NotFoundError('Document not found.');
        }
      }
      const created = await this.historyService.createSession(userId, {
        query,
        documentId: documentId ?? null,
      });
      resolvedSessionId = created.id;
    }

    onStreamStart?.();

    if (signal?.aborted) {
      return;
    }

    const ragMinSimilarity = lockedDocumentId ? 0.25 : 0.35;
    const searchResponse = await this.searchService.search(
      userId,
      {
        q: query,
        mode: 'hybrid',
        limit: RAG_RETRIEVAL_LIMIT,
        documentId: lockedDocumentId,
      },
      { minSimilarity: ragMinSimilarity }
    );

    if (signal?.aborted) {
      return;
    }

    let chunks = searchResponse.results;

    // When scoped to a specific document, fall back to top-K nearest chunks if thresholds returned 0.
    if (chunks.length === 0 && lockedDocumentId) {
      try {
        const fallbackResponse = await this.searchService.search(
          userId,
          {
            q: query,
            mode: 'semantic',
            limit: RAG_RETRIEVAL_LIMIT,
            documentId: lockedDocumentId,
          },
          { minSimilarity: 0 }
        );
        chunks = fallbackResponse.results;
      } catch {
        // Embedding provider unavailable; fall through to grounded fallback message.
      }
    }

    if (signal?.aborted) {
      return;
    }

    if (chunks.length === 0) {
      emit('token', { text: GROUNDED_FALLBACK_MESSAGE });
      const exchange = await this.historyService.appendExchange(userId, resolvedSessionId, {
        userMessage: query,
        assistantMessage: GROUNDED_FALLBACK_MESSAGE,
        citations: [],
      });
      const donePayload: RagSseDoneData = {
        complete: true,
        sessionId: resolvedSessionId,
        messageId: exchange.assistantMessage.id,
      };
      emit('done', donePayload);
      return;
    }

    const prompt = buildGroundedPrompt({
      query,
      chunks,
      history,
      maxHistoryMessages: RAG_HISTORY_LIMIT,
    });

    const tracker = new CitationTracker(chunks);
    const llmProvider = this.llmProviderFactory();

    const assistantAnswer = await llmProvider.streamCompletion(
      prompt,
      (delta) => {
        if (signal?.aborted) {
          return;
        }
        emit('token', { text: delta });
        const newCitations = tracker.processDelta(delta);
        for (const citation of newCitations) {
          emit('citation', citation);
        }
      },
      signal
    );

    if (signal?.aborted) {
      return;
    }

    const exchange = await this.historyService.appendExchange(userId, resolvedSessionId, {
      userMessage: query,
      assistantMessage: assistantAnswer,
      citations: tracker.getEmittedCitations(),
    });

    const donePayload: RagSseDoneData = {
      complete: true,
      sessionId: resolvedSessionId,
      messageId: exchange.assistantMessage.id,
    };
    emit('done', donePayload);
  }
}
