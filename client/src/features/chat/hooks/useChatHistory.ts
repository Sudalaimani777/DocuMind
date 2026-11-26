import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  deleteChatSession,
  fetchChatMessages,
  fetchChatSessions,
  type ListChatSessionsParams,
} from '../api/chat.api';

export const chatQueryKeys = {
  all: ['chat'] as const,
  sessions: (params?: ListChatSessionsParams) =>
    params
      ? ([...chatQueryKeys.all, 'sessions', params] as const)
      : ([...chatQueryKeys.all, 'sessions'] as const),
  messages: (sessionId: string) => [...chatQueryKeys.all, 'messages', sessionId] as const,
};

/**
 * TanStack Query hook to list persisted chat sessions for the current user.
 */
export function useChatSessions(params?: ListChatSessionsParams) {
  return useQuery({
    queryKey: chatQueryKeys.sessions(params),
    queryFn: () => fetchChatSessions(params),
  });
}

/**
 * TanStack Query hook to load messages for an active chat session.
 */
export function useChatMessages(sessionId: string | null) {
  return useQuery({
    queryKey: chatQueryKeys.messages(sessionId ?? ''),
    queryFn: () => fetchChatMessages(sessionId!),
    enabled: Boolean(sessionId),
  });
}

/**
 * TanStack Query mutation to delete a chat session and invalidate cached history.
 */
export function useDeleteChatSession() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (sessionId: string) => deleteChatSession(sessionId),
    onSuccess: (_data, sessionId) => {
      void queryClient.invalidateQueries({ queryKey: chatQueryKeys.sessions() });
      queryClient.removeQueries({ queryKey: chatQueryKeys.messages(sessionId) });
    },
  });
}
