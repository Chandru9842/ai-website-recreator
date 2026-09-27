import { Router, Request, Response } from 'express';
import * as path from 'path';
import { generateReactProject } from '../generator';
import { UISpecification } from '@ai-website-recreator/shared';
import { Logger } from '../utils/logger';

import { ProjectManager } from '../projects';

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

    // Safe output directory: derive or validate confinement within generated_projects
    const defaultDir = path.resolve(
      __dirname,
      '../../../output/generated_projects',
      (spec.metadata.title || 'project').toLowerCase().replace(/[^a-z0-9]+/g, '_')
    );
    const targetDir = outputDir ? ProjectManager.resolveSafePath(outputDir) : defaultDir;

    const project = await generateReactProject(spec as UISpecification, {
      outputDir: targetDir,
      validateBuild: validateBuild !== false, // default true
    });

    const projectName = path.basename(project.projectDir || targetDir);
    project.previewUrl = `/preview/${encodeURIComponent(projectName)}/`;
    project.id = projectName;

    // Automatically register project in Project Registry
    try {
      const meta = ProjectManager.createProject({
        id: projectName,
        name: spec.metadata.title || projectName,
        originalUrl: spec.metadata.url || '',
        projectPath: project.projectDir || targetDir,
        previewUrl: project.previewUrl,
        status: project.validation?.success ? 'passed' : 'failed',
        files: project.files,
      });
      (project as any).metadata = meta;
    } catch (regErr: any) {
      logger.warn(`Project registration notice: ${regErr.message}`);
    }

    res.json({
      success: true,
      data: project,
      validation: project.validation,
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
