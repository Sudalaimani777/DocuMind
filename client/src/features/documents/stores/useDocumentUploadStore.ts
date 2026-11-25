import { create } from 'zustand';
import type { DocumentDTO, JobStage } from '@documind/shared';

export interface ActiveIngestionItem {
  id: string;
  filename: string;
  fileSize: number;
  jobId?: string;
  documentId?: string;
  stage: JobStage | 'UPLOADING';
  progress: number;
  errorMessage?: string;
}

export interface DuplicateConflictNotice {
  filename: string;
  message: string;
  existingDocumentId?: string;
}

interface DocumentUploadUiState {
  queue: ActiveIngestionItem[];
  duplicateNotice: DuplicateConflictNotice | null;
  inspectedDocumentId: string | null;
  deleteTarget: DocumentDTO | null;
  enqueueUploading: (files: File[]) => string[];
  updateUploadProgress: (localIds: string[], progress: number) => void;
  attachServerJobs: (
    localIds: string[],
    uploaded: Array<{ jobId: string; documentId: string; originalFilename: string }>
  ) => void;
  markLocalFailure: (localIds: string[], errorMessage: string) => void;
  applySseEvent: (event: {
    jobId: string;
    documentId: string;
    stage: JobStage;
    progress: number;
    errorLog?: string;
  }) => void;
  dismissQueueItem: (id: string) => void;
  setDuplicateNotice: (notice: DuplicateConflictNotice | null) => void;
  openInspector: (documentId: string) => void;
  closeInspector: () => void;
  openDeleteDialog: (doc: DocumentDTO) => void;
  closeDeleteDialog: () => void;
}

export const useDocumentUploadStore = create<DocumentUploadUiState>((set) => ({
  queue: [],
  duplicateNotice: null,
  inspectedDocumentId: null,
  deleteTarget: null,

  enqueueUploading: (files) => {
    const ids: string[] = [];
    const items: ActiveIngestionItem[] = files.map((file, idx) => {
      const id = `upload-${Date.now()}-${idx}-${file.name}`;
      ids.push(id);
      return {
        id,
        filename: file.name,
        fileSize: file.size,
        stage: 'UPLOADING',
        progress: 0,
      };
    });

    set((state) => ({
      queue: [...items, ...state.queue].slice(0, 10),
    }));
    return ids;
  },

  updateUploadProgress: (localIds, progress) =>
    set((state) => ({
      queue: state.queue.map((item) =>
        localIds.includes(item.id) ? { ...item, progress } : item
      ),
    })),

  attachServerJobs: (localIds, uploaded) =>
    set((state) => ({
      queue: state.queue.map((item) => {
        const idx = localIds.indexOf(item.id);
        if (idx === -1 || !uploaded[idx]) return item;
        return {
          ...item,
          jobId: uploaded[idx].jobId,
          documentId: uploaded[idx].documentId,
          filename: uploaded[idx].originalFilename,
          stage: 'QUEUED',
          progress: 5,
        };
      }),
    })),

  markLocalFailure: (localIds, errorMessage) =>
    set((state) => ({
      queue: state.queue.map((item) =>
        localIds.includes(item.id)
          ? { ...item, stage: 'FAILED', errorMessage }
          : item
      ),
    })),

  applySseEvent: (event) =>
    set((state) => {
      const exists = state.queue.some(
        (item) => item.jobId === event.jobId || item.documentId === event.documentId
      );
      if (!exists) return state;

      return {
        queue: state.queue.map((item) =>
          item.jobId === event.jobId || item.documentId === event.documentId
            ? {
                ...item,
                stage: event.stage,
                progress: event.progress,
                errorMessage: event.errorLog,
              }
            : item
        ),
      };
    }),

  dismissQueueItem: (id) =>
    set((state) => ({
      queue: state.queue.filter((item) => item.id !== id),
    })),

  setDuplicateNotice: (notice) => set({ duplicateNotice: notice }),
  openInspector: (documentId) => set({ inspectedDocumentId: documentId }),
  closeInspector: () => set({ inspectedDocumentId: null }),
  openDeleteDialog: (doc) => set({ deleteTarget: doc }),
  closeDeleteDialog: () => set({ deleteTarget: null }),
}));
