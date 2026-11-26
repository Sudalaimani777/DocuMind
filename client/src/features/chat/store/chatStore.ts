import { create } from 'zustand';
import type { ChatMessageDTO, CitationDTO } from '@documind/shared';

interface ChatState {
  activeSessionId: string | null;
  scopedDocumentId: string | null;
  messages: ChatMessageDTO[];
  isStreaming: boolean;
  streamingContent: string;
  streamingCitations: CitationDTO[];
  activeCitation: CitationDTO | null;
  streamError: string | null;
  setActiveSessionId: (sessionId: string | null) => void;
  setMessages: (messages: ChatMessageDTO[]) => void;
  startStream: (userQuery: string) => void;
  appendToken: (token: string) => void;
  addCitation: (citation: CitationDTO) => void;
  finishStream: (sessionId: string) => void;
  failStream: (errorMessage: string) => void;
  setActiveCitation: (citation: CitationDTO | null) => void;
  resetForScope: (documentId: string | null) => void;
}

/**
 * Zustand store managing client-side RAG chat streaming state, active session,
 * document scope, and the Citation Inspector Drawer selection.
 */
export const useChatStore = create<ChatState>((set) => ({
  activeSessionId: null,
  scopedDocumentId: null,
  messages: [],
  isStreaming: false,
  streamingContent: '',
  streamingCitations: [],
  activeCitation: null,
  streamError: null,

  setActiveSessionId: (activeSessionId) => set({ activeSessionId }),

  setMessages: (messages) => set({ messages }),

  startStream: (userQuery) =>
    set((state) => {
      const optimisticUserMessage: ChatMessageDTO = {
        id: crypto.randomUUID(),
        sessionId: state.activeSessionId ?? 'pending',
        role: 'user',
        content: userQuery,
        citations: [],
        createdAt: new Date().toISOString(),
      };

      return {
        messages: [...state.messages, optimisticUserMessage],
        isStreaming: true,
        streamingContent: '',
        streamingCitations: [],
        streamError: null,
      };
    }),

  appendToken: (token) =>
    set((state) => ({
      streamingContent: state.streamingContent + token,
    })),

  addCitation: (citation) =>
    set((state) => {
      const alreadyExists = state.streamingCitations.some(
        (existing) => existing.index === citation.index
      );
      if (alreadyExists) {
        return state;
      }
      return {
        streamingCitations: [...state.streamingCitations, citation],
      };
    }),

  finishStream: (sessionId) =>
    set((state) => {
      const assistantMessage: ChatMessageDTO = {
        id: crypto.randomUUID(),
        sessionId,
        role: 'assistant',
        content: state.streamingContent,
        citations: state.streamingCitations,
        createdAt: new Date().toISOString(),
      };

      return {
        activeSessionId: sessionId,
        messages: [...state.messages, assistantMessage],
        isStreaming: false,
        streamingContent: '',
        streamingCitations: [],
      };
    }),

  failStream: (errorMessage) =>
    set({
      isStreaming: false,
      streamingContent: '',
      streamingCitations: [],
      streamError: errorMessage,
    }),

  setActiveCitation: (activeCitation) => set({ activeCitation }),

  resetForScope: (scopedDocumentId) =>
    set({
      scopedDocumentId,
      activeSessionId: null,
      messages: [],
      isStreaming: false,
      streamingContent: '',
      streamingCitations: [],
      activeCitation: null,
      streamError: null,
    }),
}));
