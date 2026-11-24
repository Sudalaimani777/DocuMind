import express, { Request, Response } from 'express';
import cors from 'cors';
import dotenv from 'dotenv';

dotenv.config();

const app = express();
const port = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());

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
  });
});

app.listen(port, () => {
  console.log(`[DocuMind Server] running on http://localhost:${port}`);
});
