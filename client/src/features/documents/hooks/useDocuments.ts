import { useEffect } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { AxiosError } from 'axios';
import { toast } from '../../../components/ui/toast';
import type { ApiErrorResponse, JobStage } from '@documind/shared';
import { extractApiErrorMessage } from '../../../core/api/client';
import { useAuthStore } from '../../../core/store/authStore';
import {
  deleteDocument,
  fetchDocumentDetail,
  fetchDocuments,
  uploadDocuments,
  type ListDocumentsParams,
} from '../api/documents.api';
import { useDocumentUploadStore } from '../stores/useDocumentUploadStore';

export const documentQueryKeys = {
  all: ['documents'] as const,
  list: (filters: ListDocumentsParams) =>
    [...documentQueryKeys.all, 'list', filters] as const,
  detail: (id: string) => [...documentQueryKeys.all, 'detail', id] as const,
};

export function useDocumentsQuery(filters: ListDocumentsParams) {
  return useQuery({
    queryKey: documentQueryKeys.list(filters),
    queryFn: () => fetchDocuments(filters),
    staleTime: 0,
    refetchOnMount: 'always',
  });
}

export function useDocumentDetailQuery(documentId: string | null) {
  return useQuery({
    queryKey: documentQueryKeys.detail(documentId ?? ''),
    queryFn: () => fetchDocumentDetail(documentId!),
    enabled: Boolean(documentId),
  });
}

export function useUploadDocumentsMutation() {
  const queryClient = useQueryClient();
  const enqueueUploading = useDocumentUploadStore((s) => s.enqueueUploading);
  const updateUploadProgress = useDocumentUploadStore((s) => s.updateUploadProgress);
  const attachServerJobs = useDocumentUploadStore((s) => s.attachServerJobs);
  const markLocalFailure = useDocumentUploadStore((s) => s.markLocalFailure);
  const setDuplicateNotice = useDocumentUploadStore((s) => s.setDuplicateNotice);

  return useMutation({
    mutationFn: async (files: File[]) => {
      setDuplicateNotice(null);
      const localIds = enqueueUploading(files);

      try {
        const uploaded = await uploadDocuments(files, (percent) => {
          updateUploadProgress(localIds, percent);
        });
        attachServerJobs(localIds, uploaded);
        return uploaded;
      } catch (err) {
        const message = extractApiErrorMessage(err, 'Upload failed.');
        if (err instanceof AxiosError && err.response?.status === 409) {
          const data = err.response.data as Partial<ApiErrorResponse> | undefined;
          const details = data?.error?.details as
            | { existingDocumentId?: string; originalFilename?: string }
            | undefined;
          setDuplicateNotice({
            filename: details?.originalFilename ?? files[0]?.name ?? 'Document',
            message,
            existingDocumentId: details?.existingDocumentId,
          });
          markLocalFailure(localIds, 'Duplicate file skipped');
        } else {
          markLocalFailure(localIds, message);
        }
        throw err;
      }
    },
    onSuccess: (items) => {
      toast.success(
        `${items.length} ${items.length === 1 ? 'file' : 'files'} uploaded and processing.`
      );
      void queryClient.invalidateQueries({ queryKey: documentQueryKeys.all });
    },
    onError: (err) => {
      if (err instanceof AxiosError && err.response?.status === 409) {
        toast.warning('Duplicate document detected.');
        return;
      }
      toast.error(extractApiErrorMessage(err, 'Failed to upload documents.'));
    },
  });
}

export function useDeleteDocumentMutation() {
  const queryClient = useQueryClient();
  const closeDeleteDialog = useDocumentUploadStore((s) => s.closeDeleteDialog);

  return useMutation({
    mutationFn: (documentId: string) => deleteDocument(documentId),
    onSuccess: () => {
      toast.success('Document deleted.');
      closeDeleteDialog();
      void queryClient.invalidateQueries({ queryKey: documentQueryKeys.all });
    },
    onError: (err) => {
      toast.error(extractApiErrorMessage(err, 'Failed to delete document.'));
    },
  });
}

interface SseProgressPayload {
  jobId: string;
  documentId: string;
  stage: JobStage;
  progress: number;
  errorLog?: string;
}

/**
 * Subscribes to /api/v1/processing/events for real-time BullMQ stage updates
 * and invalidates document queries upon completion or failure.
 */
export function useProcessingEvents(): void {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const queryClient = useQueryClient();
  const applySseEvent = useDocumentUploadStore((s) => s.applySseEvent);

  useEffect(() => {
    if (!isAuthenticated || typeof EventSource === 'undefined') {
      return;
    }

    const baseUrl = import.meta.env.VITE_API_URL || '/api/v1';
    const source = new EventSource(`${baseUrl}/processing/events`, {
      withCredentials: true,
    });

    const handleProgress = (evt: MessageEvent<string>) => {
      try {
        const payload = JSON.parse(evt.data) as SseProgressPayload;
        applySseEvent(payload);

        if (payload.stage === 'COMPLETED' || payload.stage === 'FAILED') {
          void queryClient.invalidateQueries({ queryKey: documentQueryKeys.all });
        }
      } catch {
        // Ignore malformed SSE payloads
      }
    };

    source.addEventListener('progress', handleProgress as EventListener);

    return () => {
      source.removeEventListener('progress', handleProgress as EventListener);
      source.close();
    };
  }, [isAuthenticated, applySseEvent, queryClient]);
}
