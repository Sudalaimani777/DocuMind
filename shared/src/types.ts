export type DocumentFormat = 'pdf' | 'docx' | 'xlsx' | 'pptx';

export type DocumentStatus = 'pending' | 'processing' | 'completed' | 'failed';

export type JobStatus = 'queued' | 'active' | 'completed' | 'failed';

export type JobStage =
  | 'QUEUED'
  | 'EXTRACTING'
  | 'CHUNKING'
  | 'EMBEDDING'
  | 'COMPLETED'
  | 'FAILED';

export interface UserDTO {
  id: string;
  name: string;
  organization: string;
  email: string;
  createdAt: string;
}

export interface DocumentDTO {
  id: string;
  userId: string;
  title: string;
  originalFilename: string;
  fileType: string;
  fileSize: number;
  status: string;
  chunkCount: number;
  storageUrl: string;
  createdAt: string;
}

export interface CoordinatesDTO {
  pageNumber?: number;
  sheetName?: string;
  rowStart?: number;
  rowEnd?: number;
  slideNumber?: number;
}

export interface DocumentChunkDTO {
  id: string;
  documentId: string;
  chunkIndex: number;
  content: string;
  coordinates: CoordinatesDTO;
}

export interface ProcessingJobDTO {
  id: string;
  documentId: string;
  status: string;
  stage: string;
  progress: number;
  attemptCount: number;
  errorLog?: string;
}

export interface ApiResponse<T> {
  success: true;
  data: T;
  message?: string;
  timestamp: string;
}

export interface ApiErrorResponse {
  success: false;
  error: {
    code: string;
    message: string;
    details?: unknown;
  };
  timestamp: string;
}
