import type {
  ApiResponse,
  DocumentChunkDTO,
  DocumentDTO,
  DocumentFormat,
  DocumentStatus,
} from '@documind/shared';
import { apiClient } from '../../../core/api/client';

export interface ListDocumentsParams {
  page?: number;
  limit?: number;
  fileType?: DocumentFormat;
  status?: DocumentStatus;
}

export interface PaginatedDocumentsResponse {
  items: DocumentDTO[];
  pagination: {
    totalItems: number;
    totalPages: number;
    currentPage: number;
    limit: number;
  };
}

export interface UploadedDocumentItem {
  documentId: string;
  jobId: string;
  originalFilename: string;
  fileType: string;
  fileSize: number;
  status: string;
}

export interface DocumentDetailResponse {
  document: DocumentDTO;
  chunks: DocumentChunkDTO[];
}

export async function fetchDocuments(
  params: ListDocumentsParams
): Promise<PaginatedDocumentsResponse> {
  const response = await apiClient.get<ApiResponse<PaginatedDocumentsResponse>>(
    '/documents',
    { params }
  );
  return response.data.data;
}

export async function fetchDocumentDetail(
  documentId: string
): Promise<DocumentDetailResponse> {
  const response = await apiClient.get<ApiResponse<DocumentDetailResponse>>(
    `/documents/${documentId}`
  );
  return response.data.data;
}

export async function uploadDocuments(
  files: File[],
  onUploadProgress?: (percent: number) => void
): Promise<UploadedDocumentItem[]> {
  const formData = new FormData();
  for (const file of files) {
    formData.append('files', file);
  }

  const response = await apiClient.post<
    ApiResponse<{ items: UploadedDocumentItem[] }>
  >('/documents/upload', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
    onUploadProgress: (evt) => {
      if (evt.total && evt.total > 0) {
        onUploadProgress?.(Math.round((evt.loaded * 100) / evt.total));
      }
    },
  });

  return response.data.data.items;
}

export async function deleteDocument(documentId: string): Promise<string> {
  const response = await apiClient.delete<ApiResponse<{ deletedId: string }>>(
    `/documents/${documentId}`
  );
  return response.data.data.deletedId;
}

export async function retryProcessingJob(jobId: string): Promise<void> {
  await apiClient.post(`/jobs/${jobId}/retry`);
}
