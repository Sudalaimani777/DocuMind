import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { AlertCircle, Loader2 } from 'lucide-react';
import type { CitationDTO } from '@documind/shared';
import { useAuthStore } from '../../../core/store/authStore';
import { useDocumentsQuery } from '../../documents/hooks/useDocuments';
import { streamRagChat } from '../api/chat.api';
import { chatQueryKeys, useChatMessages } from '../hooks/useChatHistory';
import { useChatStore } from '../store/chatStore';
import { ChatHeader } from '../components/ChatHeader';
import { ChatTurnItem } from '../components/ChatTurnItem';
import { ChatComposer } from '../components/ChatComposer';
import { SourceVerificationPanel } from '../components/SourceVerificationPanel';

interface ConversationTurn {
  id: string;
  userPrompt: string;
  assistantContent: string | null;
  citations: CitationDTO[];
  isStreaming: boolean;
  timestampLabel: string;
}

function formatTurnTime(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  if (!Number.isFinite(diffMs) || diffMs < 60_000) return 'Just now';
  const mins = Math.floor(diffMs / 60_000);
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return new Date(iso).toLocaleDateString();
}

/**
 * Grounded RAG AI Document Assistant view matching the Stitch two-column editorial layout,
 * supporting `/chat`, `/chat/:documentId`, and `?sessionId=` resumption.
 */
export function ChatView() {
  const { documentId: routeDocumentId } = useParams<{ documentId?: string }>();
  const [searchParams, setSearchParams] = useSearchParams();
  const sessionIdParam = searchParams.get('sessionId');
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const userName = useAuthStore((s) => s.user?.name) ?? 'You';
  const abortControllerRef = useRef<AbortController | null>(null);
  const resumedSessionIdRef = useRef<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);

  const [scopeMode, setScopeMode] = useState<'global' | 'single'>(
    routeDocumentId ? 'single' : 'global'
  );

  const activeSessionId = useChatStore((s) => s.activeSessionId);
  const scopedDocumentId = useChatStore((s) => s.scopedDocumentId);
  const messages = useChatStore((s) => s.messages);
  const isStreaming = useChatStore((s) => s.isStreaming);
  const streamingContent = useChatStore((s) => s.streamingContent);
  const streamingCitations = useChatStore((s) => s.streamingCitations);
  const activeCitation = useChatStore((s) => s.activeCitation);
  const streamError = useChatStore((s) => s.streamError);

  const setActiveSessionId = useChatStore((s) => s.setActiveSessionId);
  const setMessages = useChatStore((s) => s.setMessages);
  const startStream = useChatStore((s) => s.startStream);
  const appendToken = useChatStore((s) => s.appendToken);
  const addCitation = useChatStore((s) => s.addCitation);
  const finishStream = useChatStore((s) => s.finishStream);
  const failStream = useChatStore((s) => s.failStream);
  const setActiveCitation = useChatStore((s) => s.setActiveCitation);
  const resetForScope = useChatStore((s) => s.resetForScope);

  const documentsQuery = useDocumentsQuery({ page: 1, limit: 100 });
  const indexedDocuments = useMemo(
    () => (documentsQuery.data?.items ?? []).filter((doc) => doc.status === 'completed'),
    [documentsQuery.data?.items]
  );

  useEffect(() => {
    const normalizedRouteDocId = routeDocumentId ?? null;
    setScopeMode(normalizedRouteDocId ? 'single' : 'global');
    if (normalizedRouteDocId !== useChatStore.getState().scopedDocumentId) {
      resetForScope(normalizedRouteDocId);
    }
  }, [routeDocumentId, resetForScope]);

  const chatMessagesQuery = useChatMessages(sessionIdParam);

  useEffect(() => {
    if (sessionIdParam) {
      resumedSessionIdRef.current = sessionIdParam;
      setActiveSessionId(sessionIdParam);
      return;
    }

    if (resumedSessionIdRef.current) {
      resumedSessionIdRef.current = null;
      resetForScope(routeDocumentId ?? null);
    }
  }, [sessionIdParam, routeDocumentId, setActiveSessionId, resetForScope]);

  useEffect(() => {
    if (sessionIdParam && chatMessagesQuery.data) {
      setMessages(chatMessagesQuery.data);
    }
  }, [sessionIdParam, chatMessagesQuery.data, setMessages]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView?.({ behavior: 'smooth' });
  }, [messages.length, streamingContent]);

  useEffect(() => {
    return () => {
      abortControllerRef.current?.abort();
    };
  }, []);

  const turns = useMemo<ConversationTurn[]>(() => {
    const result: ConversationTurn[] = [];

    for (let i = 0; i < messages.length; i += 1) {
      const current = messages[i];
      if (current.role === 'user') {
        const next = messages[i + 1];
        if (next && next.role === 'assistant') {
          result.push({
            id: current.id,
            userPrompt: current.content,
            assistantContent: next.content,
            citations: next.citations,
            isStreaming: false,
            timestampLabel: formatTurnTime(current.createdAt),
          });
          i += 1;
        } else {
          const isLastUser = i === messages.length - 1;
          result.push({
            id: current.id,
            userPrompt: current.content,
            assistantContent: isLastUser && isStreaming ? streamingContent : null,
            citations: isLastUser && isStreaming ? streamingCitations : [],
            isStreaming: isLastUser && isStreaming,
            timestampLabel: formatTurnTime(current.createdAt),
          });
        }
      }
    }

    return result;
  }, [messages, isStreaming, streamingContent, streamingCitations]);

  const allCitations = useMemo<CitationDTO[]>(() => {
    const combined = [
      ...messages.flatMap((m) => m.citations),
      ...(isStreaming ? streamingCitations : []),
    ];
    const seen = new Set<string>();
    const deduped: CitationDTO[] = [];
    for (const c of combined) {
      const key = `${c.chunkId}:${c.index}`;
      if (!seen.has(key)) {
        seen.add(key);
        deduped.push(c);
      }
    }
    return deduped;
  }, [messages, isStreaming, streamingCitations]);

  const handleSelectGlobal = () => {
    setScopeMode('global');
    if (scopedDocumentId !== null || activeSessionId !== null) {
      abortControllerRef.current?.abort();
      resumedSessionIdRef.current = null;
      resetForScope(null);
      navigate('/chat');
    }
  };

  const handleSelectSingleMode = () => {
    setScopeMode('single');
    if (!scopedDocumentId && indexedDocuments.length > 0) {
      const firstId = indexedDocuments[0].id;
      abortControllerRef.current?.abort();
      resumedSessionIdRef.current = null;
      resetForScope(firstId);
      navigate(`/chat/${firstId}`);
    }
  };

  const handleSelectDocument = (nextDocumentId: string) => {
    abortControllerRef.current?.abort();
    resumedSessionIdRef.current = null;
    const normalizedDocId = nextDocumentId || null;
    resetForScope(normalizedDocId);
    navigate(normalizedDocId ? `/chat/${normalizedDocId}` : '/chat');
  };

  const handleNewChat = () => {
    abortControllerRef.current?.abort();
    resumedSessionIdRef.current = null;
    resetForScope(scopedDocumentId);
    if (sessionIdParam) {
      setSearchParams({});
    }
  };

  const handleStop = () => {
    const controller = abortControllerRef.current;
    abortControllerRef.current = null;
    controller?.abort();

    const state = useChatStore.getState();
    const hasPartialContent = state.streamingContent.trim().length > 0;

    if (hasPartialContent) {
      if (state.activeSessionId) {
        finishStream(state.activeSessionId);
      } else {
        useChatStore.setState({
          messages: [
            ...state.messages,
            {
              id: crypto.randomUUID(),
              sessionId: 'pending',
              role: 'assistant',
              content: state.streamingContent,
              citations: state.streamingCitations,
              createdAt: new Date().toISOString(),
            },
          ],
          isStreaming: false,
          streamingContent: '',
          streamingCitations: [],
          streamError: null,
        });
      }
      return;
    }

    useChatStore.setState({
      isStreaming: false,
      streamingContent: '',
      streamingCitations: [],
      streamError: null,
    });
  };

  const handleSubmit = async (query: string) => {
    abortControllerRef.current?.abort();
    const controller = new AbortController();
    abortControllerRef.current = controller;

    startStream(query);

    try {
      await streamRagChat(
        {
          query,
          sessionId: activeSessionId ?? undefined,
          documentId: scopedDocumentId ?? undefined,
        },
        {
          onToken: (token) => {
            if (!controller.signal.aborted) {
              appendToken(token);
            }
          },
          onCitation: (citation) => {
            if (!controller.signal.aborted) {
              addCitation(citation);
            }
          },
          onError: (message) => {
            if (!controller.signal.aborted) {
              failStream(message);
            }
          },
          onDone: (payload) => {
            if (!controller.signal.aborted) {
              finishStream(payload.sessionId);
              void queryClient.invalidateQueries({ queryKey: chatQueryKeys.sessions() });
            }
          },
        },
        controller.signal
      );
    } catch (err) {
      if (controller.signal.aborted || (err instanceof DOMException && err.name === 'AbortError')) {
        return;
      }
      if (useChatStore.getState().isStreaming) {
        failStream(err instanceof Error ? err.message : 'Failed to stream response.');
      }
    } finally {
      if (abortControllerRef.current === controller) {
        abortControllerRef.current = null;
      }
    }
  };

  return (
    <div className="flex flex-col gap-20 max-w-6xl w-full mx-auto">
      <ChatHeader
        scopeMode={scopeMode}
        scopedDocumentId={scopedDocumentId}
        indexedDocuments={indexedDocuments}
        hasActiveConversation={messages.length > 0 || Boolean(activeSessionId)}
        onSelectGlobal={handleSelectGlobal}
        onSelectSingleMode={handleSelectSingleMode}
        onSelectDocument={handleSelectDocument}
        onNewChat={handleNewChat}
      />

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-32 items-start">
        <div className="lg:col-span-7 flex flex-col gap-32">
          <section
            id="chat-stream"
            aria-label="Conversation Stream"
            className="flex flex-col gap-32"
            aria-live="polite"
          >
            {chatMessagesQuery.isLoading && sessionIdParam ? (
              <div className="py-32 flex items-center justify-center gap-2 font-t04 text-t04 text-on-surface-variant">
                <Loader2 className="w-5 h-5 animate-spin text-secondary" aria-hidden="true" />
                <span>Loading conversation history...</span>
              </div>
            ) : turns.length === 0 ? (
              <div className="bg-surface-subtle/50 border border-outline rounded-card p-20 flex flex-col gap-1 max-w-prose">
                <h2 className="font-t03 text-t03 text-on-surface">
                  Grounded Q&amp;A with Verifiable Citations
                </h2>
                <p className="font-t04 text-t04 text-on-surface-variant">
                  Ask a question below or pick a starter prompt. Every assertion links directly to
                  its source coordinates in the inspector.
                </p>
              </div>
            ) : (
              turns.map((turn, idx) => (
                <ChatTurnItem
                  key={turn.id}
                  userName={userName}
                  userPrompt={turn.userPrompt}
                  assistantContent={turn.assistantContent}
                  citations={turn.citations}
                  timestampLabel={turn.timestampLabel}
                  isStreaming={turn.isStreaming}
                  isFirst={idx === 0}
                  onSelectCitation={setActiveCitation}
                />
              ))
            )}

            {streamError ? (
              <div
                role="alert"
                className="flex items-center gap-2 p-15 rounded-md border border-status-failed-border bg-status-failed-bg text-status-failed-text font-t04 text-t04"
              >
                <AlertCircle className="w-4 h-4 shrink-0" aria-hidden="true" />
                <span>{streamError}</span>
              </div>
            ) : null}

            <div ref={messagesEndRef} />
          </section>

          <ChatComposer
            isStreaming={isStreaming}
            onSubmit={(q) => void handleSubmit(q)}
            onStop={handleStop}
          />
        </div>

        <SourceVerificationPanel
          citations={allCitations}
          activeCitation={activeCitation}
          onSelectCitation={setActiveCitation}
        />
      </div>
    </div>
  );
}

export default ChatView;
