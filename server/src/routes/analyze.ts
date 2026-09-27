import { Router, Request, Response } from 'express';
import { analyzeWebsite } from '../analyzer';
import { isValidHttpUrl, normalizeUrl } from '../utils/urlHelper';
import { AnalysisProgressEvent } from '@ai-website-recreator/shared';
import { Logger } from '../utils/logger';

const router = Router();
const logger = new Logger('AnalyzeRoute');

// In-memory progress event emitter map for SSE clients
const clientListeners = new Map<string, (event: AnalysisProgressEvent) => void>();

/**
 * SSE endpoint for live analysis progress streaming
 */
router.get('/events', (req: Request, res: Response) => {
  const clientId = req.query.clientId as string;
  if (!clientId) {
    res.status(400).json({ error: 'clientId query parameter required' });
    return;
  }

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders?.();

  const listener = (event: AnalysisProgressEvent) => {
    res.write(`data: ${JSON.stringify(event)}\n\n`);
  };

  clientListeners.set(clientId, listener);

  req.on('close', () => {
    clientListeners.delete(clientId);
  });
});

/**
 * POST /api/analyze
 * Body: { url: string, clientId?: string }
 */
router.post('/', async (req: Request, res: Response) => {
  try {
    const { url, clientId } = req.body;

    if (!url || typeof url !== 'string') {
      res.status(400).json({ success: false, error: 'Valid URL is required' });
      return;
    }

    const normalized = normalizeUrl(url);
    if (!isValidHttpUrl(normalized)) {
      res.status(400).json({ success: false, error: 'Invalid HTTP or HTTPS URL provided' });
      return;
    }

    logger.info(`Received analysis request for ${normalized} (clientId: ${clientId})`);

    const result = await analyzeWebsite(normalized, {
      onProgress: (event) => {
        if (clientId && clientListeners.has(clientId)) {
          clientListeners.get(clientId)!(event);
        }
      },
    });

    res.json({
      success: true,
      data: result,
    });
  } catch (error: any) {
    logger.error('Error during analysis endpoint execution', { error: error.message });
    res.status(500).json({
      success: false,
      error: error.message || 'Website analysis failed',
    });
  }
});

export default router;
