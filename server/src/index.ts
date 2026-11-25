import express, { Request, Response } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import dotenv from 'dotenv';
import { generalLimiter } from './core/middleware/rateLimiter.js';

dotenv.config();

const app = express();
const port = process.env.PORT || 5000;

// 1. Perimeter Security Headers via Helmet
app.use(helmet());

// 2. Strict CORS with Credentials Support
app.use(
  cors({
    origin: process.env.CLIENT_URL || 'http://localhost:5173',
    credentials: true,
  })
);

// 3. HTTP-Only Cookie Parser
app.use(cookieParser());

// 4. Bounded Payload Body Parsers (Prevents memory flooding)
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true, limit: '1mb' }));

// 5. Global Rate Limiter for API Routes
app.use('/api', generalLimiter);

// Healthcheck Endpoint
app.get('/health', (_req: Request, res: Response) => {
  res.json({
    status: 'ok',
    service: 'documind-server',
    timestamp: new Date().toISOString(),
  });
});

// API Root Information
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

app.listen(port, () => {
  console.log(`[DocuMind Server] running on http://localhost:${port}`);
});
