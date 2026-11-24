# Pluggable AI Integration Specification — DocuMind Server

> **Package**: `server/src/ai/`  
> **Standard Dimension**: 768  
> **Providers Supported**: Local Ollama + Cloud Google Gemini

---

## 1. Pluggable AI Architectural Contracts

DocuMind enforces a strict interface separation so that the ingestion worker and RAG controllers are agnostic to the active AI provider:

```typescript
export interface DocumentChunkExcerpt {
  documentTitle: string;
  coordinates: {
    pageNumber?: number;
    sheetName?: string;
    rowRange?: string;
    slideNumber?: number;
  };
  content: string;
}

export interface EmbeddingProvider {
  readonly providerName: 'ollama' | 'gemini';
  readonly dimensions: 768;
  generateEmbedding(text: string): Promise<number[]>;
  generateBatchEmbeddings(texts: string[]): Promise<number[][]>;
}

export interface ChatProvider {
  readonly providerName: 'ollama' | 'gemini';
  generateGroundedStream(
    userQuery: string,
    contextChunks: DocumentChunkExcerpt[],
    conversationHistory: { role: 'user' | 'assistant'; content: string }[]
  ): AsyncIterable<string>;
}
```

---

## 2. Provider Implementations

### 2.1 Local AI: Ollama Adapter (`ollama.adapter.ts`)
* **Endpoint**: `http://localhost:11434`
* **Embedding Model**: `nomic-embed-text` (Outputs **768-dimensional** vector).
* **Generation Model**: `llama3` (or `mistral`).
* **Benefits**: 100% offline, free, zero data leaves local hardware.

```typescript
export class OllamaAdapter implements EmbeddingProvider, ChatProvider {
  readonly providerName = 'ollama';
  readonly dimensions = 768;

  async generateEmbedding(text: string): Promise<number[]> {
    const response = await axios.post(`${process.env.OLLAMA_BASE_URL}/api/embeddings`, {
      model: 'nomic-embed-text',
      prompt: text,
    });
    return response.data.embedding; // 768 numbers
  }

  async generateBatchEmbeddings(texts: string[]): Promise<number[][]> {
    const limit = pLimit(5);
    return Promise.all(texts.map((t) => limit(() => this.generateEmbedding(t))));
  }

  async *generateGroundedStream(userQuery: string, contextChunks: DocumentChunkExcerpt[]): AsyncIterable<string> {
    const prompt = buildGroundedPrompt(userQuery, contextChunks);
    const response = await axios.post(
      `${process.env.OLLAMA_BASE_URL}/api/generate`,
      { model: 'llama3', prompt, stream: true },
      { responseType: 'stream' }
    );
    // Yield tokens from stream...
  }
}
```

### 2.2 Cloud AI: Google Gemini Adapter (`gemini.adapter.ts`)
* **SDK**: Google Gemini API client
* **Embedding Model**: `text-embedding-004` (Native **768-dimensional** vector).
* **Generation Model**: `gemini-1.5-flash` (Ultra-low latency streaming, 1M context window).
* **Benefits**: Blazing fast, zero local GPU/RAM requirement, ideal for cloud deployments.

```typescript
import { GoogleGenerativeAI } from '@google/generative-ai';

export class GeminiAdapter implements EmbeddingProvider, ChatProvider {
  readonly providerName = 'gemini';
  readonly dimensions = 768;
  private genAI: GoogleGenerativeAI;

  constructor() {
    this.genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);
  }

  async generateEmbedding(text: string): Promise<number[]> {
    const model = this.genAI.getGenerativeModel({ model: 'text-embedding-004' });
    const result = await model.embedContent(text);
    return result.embedding.values; // 768 numbers
  }

  async generateBatchEmbeddings(texts: string[]): Promise<number[][]> {
    const limit = pLimit(5);
    return Promise.all(texts.map((t) => limit(() => this.generateEmbedding(t))));
  }

  async *generateGroundedStream(userQuery: string, contextChunks: DocumentChunkExcerpt[]): AsyncIterable<string> {
    const model = this.genAI.getGenerativeModel({ 
      model: 'gemini-1.5-flash',
      generationConfig: { temperature: 0.1 } // Low temperature to maximize factual grounding
    });
    const prompt = buildGroundedPrompt(userQuery, contextChunks);
    const result = await model.generateContentStream(prompt);
    for await (const chunk of result.stream) {
      yield chunk.text();
    }
  }
}
```

---

## 3. Anti-Hallucination Prompt Engineering

```typescript
export function buildGroundedPrompt(query: string, chunks: DocumentChunkExcerpt[]): string {
  const formattedContext = chunks
    .map((chunk, index) => {
      const coordStr = chunk.coordinates.pageNumber
        ? `Page ${chunk.coordinates.pageNumber}`
        : chunk.coordinates.sheetName
        ? `Sheet ${chunk.coordinates.sheetName}, Rows ${chunk.coordinates.rowRange}`
        : chunk.coordinates.slideNumber
        ? `Slide ${chunk.coordinates.slideNumber}`
        : 'General';

      return `[Excerpt ${index + 1}] Source: "${chunk.documentTitle}" | Location: ${coordStr}\nContent: ${chunk.content}`;
    })
    .join('\n\n---\n\n');

  return `
SYSTEM INSTRUCTION:
You are DocuMind's Document Intelligence Assistant.
Your task is to answer the User Query STRICTLY AND SOLELY using the provided Context Excerpts below.

CRITICAL RULES:
1. Every single factual statement, number, or claim must cite its source in brackets:
   Format: [Citation: <DocName>, <Page X / Sheet Y>]
2. If the excerpts do not contain sufficient evidence to answer, state:
   "I cannot find this information in the provided documents." Do NOT extrapolate.
3. NEVER assume facts not present in the excerpts.

CONTEXT EXCERPTS:
${formattedContext}

USER QUERY:
${query}

GROUNDED ANSWER:
`;
}
```

---

## 4. Concurrency & Rate Limiting (`p-limit`)

To prevent API throttling (HTTP 429) during bulk ingestion:
* Chunks are embedded in controlled concurrency windows using `p-limit(5)`.
* Exponential backoff retry handler catches 429 errors and retries with a randomized jitter (1s, 2s, 4s).
