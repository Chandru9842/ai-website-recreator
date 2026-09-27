import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import analyzeRouter from './routes/analyze';
import specRouter from './routes/spec';

dotenv.config();

export function createApp() {
  const app = express();

  // Middleware
  app.use(cors());
  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ extended: true, limit: '10mb' }));

  // Health check
  app.get('/api/health', (req, res) => {
    res.json({
      status: 'ok',
      service: 'ai-website-recreator-server',
      timestamp: new Date().toISOString(),
    });
  });

  // API Routes
  app.use('/api/analyze', analyzeRouter);
  app.use('/api/spec', specRouter);

  // Fallback 404
  app.use((req, res) => {
    res.status(404).json({ error: `Route ${req.method} ${req.path} not found` });
  });

  return app;
}
