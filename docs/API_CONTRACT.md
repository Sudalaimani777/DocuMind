# API Contract & Endpoint Specification — DocuMind

> **Base URL**: `http://localhost:5000/api`  
> **Protocol**: HTTP/1.1 (REST) + Server-Sent Events (SSE)  
> **Content-Type**: `application/json` (except multipart uploads and text/event-stream)

---

## 1. Global Response & Error Schemas

### Standard Success Envelope
```json
{
  "success": true,
  "data": { ... },
  "message": "Optional user-friendly message",
  "timestamp": "2026-11-24T10:00:00.000Z"
}
```

### Standard Error Envelope
```json
{
  "success": false,
  "error": {
    "code": "BAD_REQUEST",
    "message": "Validation failed on input parameters.",
    "details": [
      { "field": "q", "message": "Query string must not be empty" }
    ]
  },
  "timestamp": "2026-11-24T10:00:00.000Z"
}
```

---

## 2. Document Management Endpoints

### 2.1 Upload Document
* **Endpoint**: `POST /api/documents/upload`
* **Content-Type**: `multipart/form-data`
* **Rate Limit**: 10 requests / minute
* **Request Payload**:
  * `files`: Binary document file (PDF, DOCX, XLSX, PPTX, max 25MB per file).
* **Success Response (`202 Accepted`)**:
```json
{
  "success": true,
  "data": {
    "documentId": "4a7b9c1d-2e3f-4a5b-6c7d-8e9f0a1b2c3d",
    "jobId": "9f8e7d6c-5b4a-3f2e-1d0c-ba9876543210",
    "originalFilename": "Quarterly_Financial_Report.xlsx",
    "fileType": "xlsx",
    "fileSize": 451200,
    "status": "pending"
  },
  "message": "File accepted and queued for background ingestion."
}
```
* **Error Response (`409 Conflict` - Duplicate Detection)**:
```json
{
  "success": false,
  "error": {
    "code": "DUPLICATE_DOCUMENT",
    "message": "This file has already been uploaded. SHA-256 hash match found.",
    "existingDocumentId": "1b2c3d4e-5f6a-7b8c-9d0e-1f2a3b4c5d6e"
  }
}
```

---

### 2.2 List Documents
* **Endpoint**: `GET /api/documents`
* **Query Parameters**:
  * `page` (optional, default `1`): Page number.
  * `limit` (optional, default `20`): Page size.
  * `fileType` (optional): Filter by `'pdf'`, `'docx'`, `'xlsx'`, `'pptx'`.
  * `status` (optional): Filter by `'completed'`, `'processing'`, `'failed'`.
* **Success Response (`200 OK`)**:
```json
{
  "success": true,
  "data": {
    "items": [
      {
        "id": "4a7b9c1d-2e3f-4a5b-6c7d-8e9f0a1b2c3d",
        "title": "Quarterly Financial Report",
        "originalFilename": "Quarterly_Financial_Report.xlsx",
        "fileType": "xlsx",
        "fileSize": 451200,
        "status": "completed",
        "chunkCount": 38,
        "createdAt": "2026-11-24T09:30:00.000Z"
      }
    ],
    "pagination": {
      "totalItems": 1,
      "totalPages": 1,
      "currentPage": 1,
      "limit": 20
    }
  }
}
```

---

### 2.3 Delete Document
* **Endpoint**: `DELETE /api/documents/:id`
* **Description**: Permanently deletes the document record, cascading to delete all associated chunks and vector embeddings, and deletes the binary asset from Cloudinary.
* **Success Response (`200 OK`)**:
```json
{
  "success": true,
  "data": { "deletedId": "4a7b9c1d-2e3f-4a5b-6c7d-8e9f0a1b2c3d" },
  "message": "Document and all associated vector embeddings successfully deleted."
}
```

---

## 3. Intelligent Search Endpoints

### 3.1 Execute Multi-Mode Search
* **Endpoint**: `GET /api/search`
* **Rate Limit**: 60 requests / minute
* **Query Parameters**:
  * `q` *(required)*: Search query string.
  * `mode` *(optional, default `'hybrid'`)*: `'hybrid'`, `'keyword'`, or `'semantic'`.
  * `format` *(optional)*: Filter by file format (`'pdf'`, `'docx'`, `'xlsx'`, `'pptx'`).
  * `limit` *(optional, default `10`)*: Number of top results to return.
* **Success Response (`200 OK`)**:
```json
{
  "success": true,
  "data": {
    "query": "Q3 EBITDA margins",
    "mode": "hybrid",
    "totalMatches": 4,
    "results": [
      {
        "chunkId": "8f7e6d5c-4b3a-2f1e-0d9c-ba8765432109",
        "documentId": "4a7b9c1d-2e3f-4a5b-6c7d-8e9f0a1b2c3d",
        "documentTitle": "Quarterly Financial Report",
        "fileType": "xlsx",
        "score": 0.0328,
        "coordinates": {
          "sheetName": "Summary",
          "rowRange": "A14:D18"
        },
        "highlightedContent": "Operating income was $12.4M with <mark>Q3 EBITDA margins</mark> expanding 240bps to 18.2%...",
        "rawContent": "Operating income was $12.4M with Q3 EBITDA margins expanding 240bps to 18.2%..."
      }
    ]
  }
}
```

---

## 4. Grounded RAG Assistant Endpoints

### 4.1 RAG Chat with Streaming Citations
* **Endpoint**: `POST /api/chat/rag`
* **Content-Type**: `application/json`
* **Rate Limit**: 30 requests / minute
* **Request Payload**:
```json
{
  "query": "What were the Q3 EBITDA margins and what drove the growth?",
  "documentId": "4a7b9c1d-2e3f-4a5b-6c7d-8e9f0a1b2c3d", // optional, null for cross-document search
  "conversationHistory": [
    { "role": "user", "content": "Hello" },
    { "role": "assistant", "content": "How can I help you analyze your documents?" }
  ]
}
```
* **Response**: `text/event-stream` (Server-Sent Events)
```text
event: token
data: {"text": "In Q3, EBITDA margins "}

event: token
data: {"text": "reached 18.2%, driven by "}

event: citation
data: {"badge": "[Citation: Quarterly Financial Report, Sheet: Summary, Rows A14:D18]", "chunkId": "8f7e6d5c-4b3a-2f1e-0d9c-ba8765432109"}

event: done
data: {"complete": true}
```

---

## 5. Background Ingestion & Observability Endpoints

### 5.1 Real-Time Job Progress Stream (SSE)
* **Endpoint**: `GET /api/jobs/:id/progress`
* **Response**: `text/event-stream`
```text
event: progress
data: {"stage": "QUEUED", "progress": 0, "status": "queued"}

event: progress
data: {"stage": "EXTRACTING", "progress": 25, "status": "processing"}

event: progress
data: {"stage": "CHUNKING", "progress": 50, "status": "processing"}

event: progress
data: {"stage": "EMBEDDING", "progress": 75, "status": "processing"}

event: progress
data: {"stage": "COMPLETED", "progress": 100, "status": "completed"}
```

---

### 5.2 Retry Failed Ingestion Job
* **Endpoint**: `POST /api/jobs/:id/retry`
* **Success Response (`200 OK`)**:
```json
{
  "success": true,
  "data": { "jobId": "9f8e7d6c-5b4a-3f2e-1d0c-ba9876543210", "status": "queued" },
  "message": "Job re-queued for background extraction."
}
```

---

## 6. System Healthcheck
* **Endpoint**: `GET /api/health`
* **Success Response (`200 OK`)**:
```json
{
  "status": "healthy",
  "database": "connected (PostgreSQL 16.2 with pgvector 0.7.0)",
  "redis": "connected (Redis 7.2)",
  "aiProvider": "Google Gemini (text-embedding-004 / 768-dim)",
  "uptimeSeconds": 1420
}
```
