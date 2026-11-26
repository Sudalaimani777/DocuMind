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

export type SearchMode = 'hybrid' | 'semantic' | 'keyword';

export type SearchMatchType = 'lexical' | 'semantic' | 'hybrid';

export interface SearchResultItemDTO {
  chunkId: string;
  documentId: string;
  documentTitle: string;
  originalFilename: string;
  fileType: DocumentFormat;
  storageUrl: string;
  chunkIndex: number;
  content: string;
  snippet: string;
  coordinates: CoordinatesDTO;
  score: number;
  lexicalScore?: number;
  semanticScore?: number;
  matchType: SearchMatchType;
}

export interface SearchResponseDTO {
  query: string;
  mode: SearchMode;
  activeMode: SearchMode;
  degraded: boolean;
  totalResults: number;
  tookMs: number;
  results: SearchResultItemDTO[];
}

export type ChatRole = 'user' | 'assistant';

export interface CitationDTO {
  index: number;
  badge: string;
  chunkId: string;
  documentId: string;
  documentTitle: string;
  fileType: string;
  similarity: number;
  coordinates: CoordinatesDTO;
  excerpt: string;
}

export interface ChatSessionDTO {
  id: string;
  userId: string;
  documentId: string | null;
  documentTitle: string | null;
  title: string;
  messageCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface ChatMessageDTO {
  id: string;
  sessionId: string;
  role: ChatRole;
  content: string;
  citations: CitationDTO[];
  createdAt: string;
}
