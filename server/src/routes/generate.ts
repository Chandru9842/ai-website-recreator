import { Router, Request, Response } from 'express';
import { generateReactProject } from '../generator';
import { UISpecification } from '@ai-website-recreator/shared';
import { Logger } from '../utils/logger';

const router = Router();
const logger = new Logger('GenerateRoute');

/**
 * POST /api/generate
 * Body: { spec: UISpecification, outputDir?: string, validateBuild?: boolean }
 */
router.post('/', async (req: Request, res: Response) => {
  try {
    const { spec, outputDir, validateBuild } = req.body;

    if (!spec || !spec.metadata || !Array.isArray(spec.sections)) {
      res.status(400).json({
        success: false,
        error: 'Invalid request: Body must contain a valid UISpecification with metadata and sections',
      });
      return;
    }

    logger.info(`Received React generation request for "${spec.metadata.title}"`);

    const project = await generateReactProject(spec as UISpecification, {
      outputDir,
      validateBuild: Boolean(validateBuild),
    });

    res.json({
      success: true,
      data: project,
    });
  } catch (error: any) {
    logger.error('Error during React project generation', { error: error.message });
    res.status(500).json({
      success: false,
      error: error.message || 'React code generation failed',
    });
  }
});

export default router;
