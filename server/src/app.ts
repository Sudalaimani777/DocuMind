import express, { type Express, type Request, type Response } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import { unifiedConfig } from './core/config/unifiedConfig.js';
import { errorHandler } from './core/middleware/errorHandler.js';
import { generalLimiter } from './core/middleware/rateLimiter.js';
import { DrizzleUserRepository } from './features/auth/user.repository.js';
import { AuthService } from './features/auth/auth.service.js';
import { AuthController } from './features/auth/auth.controller.js';
import { createAuthRouter } from './features/auth/auth.routes.js';
import { DrizzleProcessingJobRepository } from './features/processing/job.repository.js';
import { JobService } from './features/processing/job.service.js';
import { JobController } from './features/processing/job.controller.js';
import { documentProcessingQueue } from './features/processing/queue.js';
import { sseService as defaultSseService, type SseService } from './features/processing/sse.service.js';
import {
  createJobsRouter,
  createProcessingRouter,
} from './features/processing/processing.routes.js';
import { cloudinaryService } from './features/storage/cloudinary.service.js';
import {
  DeduplicationService,
  DrizzleDocumentDeduplicationRepository,
} from './features/storage/deduplication.service.js';
import { DrizzleDocumentRepository } from './features/documents/document.repository.js';
import { DocumentService } from './features/documents/document.service.js';
import { DocumentController } from './features/documents/document.controller.js';
import { createDocumentsRouter } from './features/documents/document.routes.js';
import { createAIProvider } from './features/ai/ai.factory.js';
import { DrizzleSearchRepository } from './features/search/search.repository.js';
import { LexicalSearchService } from './features/search/lexical.service.js';
import { SemanticSearchService } from './features/search/semantic.service.js';
import { HybridSearchService } from './features/search/hybrid.service.js';
import { SearchService } from './features/search/search.service.js';
import { SearchController } from './features/search/search.controller.js';
import { createSearchRouter } from './features/search/search.routes.js';

export interface AppDependencies {
  authService?: AuthService;
  jobService?: JobService;
  documentService?: DocumentService;
  searchService?: SearchService;
  sseService?: SseService;
}

function createDefaultSearchService(): SearchService {
  const searchRepo = new DrizzleSearchRepository();
  const lexicalService = new LexicalSearchService(searchRepo);
  const semanticService = new SemanticSearchService(searchRepo, createAIProvider());
  const hybridService = new HybridSearchService(lexicalService, semanticService);
  return new SearchService(lexicalService, semanticService, hybridService);
}

/**
 * Creates and configures the Express application instance.
 */
export function createApp(deps: AppDependencies = {}): Express {
  const app = express();

  app.use(helmet());

  app.use(
    cors({
      origin: unifiedConfig.server.clientUrl,
      credentials: true,
    })
  );

  app.use(cookieParser());
  app.use(express.json({ limit: '1mb' }));
  app.use(express.urlencoded({ extended: true, limit: '1mb' }));

  app.use('/api', generalLimiter);

  app.get('/health', (_req: Request, res: Response) => {
    res.json({
      status: 'ok',
      service: 'documind-server',
      timestamp: new Date().toISOString(),
    });
  });

  app.get('/api', (_req: Request, res: Response) => {
    res.json({
      message: 'Welcome to DocuMind API',
      version: '1.0.0',
      security: {
        rateLimiting: 'active',
        helmet: 'active',
        cors: 'active',
        cookieAuth: 'active',
      },
    });
  });

  const authService = deps.authService ?? new AuthService(new DrizzleUserRepository());
  const authController = new AuthController(authService);
  app.use('/api/v1/auth', createAuthRouter(authController));

  const sseService = deps.sseService ?? defaultSseService;
  const jobService =
    deps.jobService ??
    new JobService(
      new DrizzleProcessingJobRepository(),
      documentProcessingQueue,
      sseService
    );
  const jobController = new JobController(jobService, sseService);
  app.use('/api/v1/processing', createProcessingRouter(jobController));
  app.use('/api/v1/jobs', createJobsRouter(jobController));

  const documentService =
    deps.documentService ??
    new DocumentService(
      new DrizzleDocumentRepository(),
      new DeduplicationService(new DrizzleDocumentDeduplicationRepository()),
      cloudinaryService,
      documentProcessingQueue,
      sseService
    );
  const documentController = new DocumentController(documentService);
  app.use('/api/v1/documents', createDocumentsRouter(documentController));

  const searchService = deps.searchService ?? createDefaultSearchService();
  const searchController = new SearchController(searchService);
  app.use('/api/v1/search', createSearchRouter(searchController));

  app.use(errorHandler);

  return app;
}

export const app = createApp();
