import { Router, Request, Response } from 'express';
import { generateUISpecification } from '../ai';
import { ExtractedWebsiteData } from '@ai-website-recreator/shared';
import { Logger } from '../utils/logger';

const router = Router();
const logger = new Logger('SpecRoute');

/**
 * POST /api/spec
 * Body: { data: ExtractedWebsiteData, provider?: 'gemini' | 'grounded' | 'auto' }
 */
router.post('/', async (req: Request, res: Response) => {
  try {
    const { data, provider } = req.body;

    if (!data || !data.metadata || !Array.isArray(data.sections)) {
      res.status(400).json({
        success: false,
        error: 'Invalid request: Body must contain valid ExtractedWebsiteData with metadata and sections',
      });
      return;
    }

    logger.info(`Received UI specification request for "${data.metadata.title}"`);

    const spec = await generateUISpecification(data as ExtractedWebsiteData, {
      providerName: provider,
    });

    res.json({
      success: true,
      data: spec,
    });
  } catch (error: any) {
    logger.error('Error generating UI specification', { error: error.message });
    res.status(500).json({
      success: false,
      error: error.message || 'UI specification generation failed',
    });
  }
});

export default router;
