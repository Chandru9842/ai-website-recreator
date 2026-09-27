import { Router, Request, Response } from 'express';
import * as path from 'path';
import * as fs from 'fs';
import { modifyProject } from '../modifier';
import { ProjectManager } from '../projects';
import { Logger } from '../utils/logger';

const router = Router();
const logger = new Logger('ModifyRoute');

/**
 * POST /api/modify
 * Request: { projectPath: string, instruction: string }
 * Response: { success: boolean, modifiedFiles: string[], validation: ValidationResult, message: string, history: ModificationRecord[], previewUrl: string, projectVersion?: ProjectVersion }
 */
router.post('/', async (req: Request, res: Response) => {
  try {
    const { projectPath, instruction } = req.body;

    if (!projectPath || typeof projectPath !== 'string') {
      res.status(400).json({
        success: false,
        error: 'Invalid request: "projectPath" is required as a string',
      });
      return;
    }

    if (!instruction || typeof instruction !== 'string' || instruction.trim().length === 0) {
      res.status(400).json({
        success: false,
        error: 'Invalid request: "instruction" is required as a non-empty string',
      });
      return;
    }

    const resolvedDir = path.resolve(projectPath);
    const authorizedRoot = path.resolve(__dirname, '../../../output');
    if (!resolvedDir.startsWith(authorizedRoot)) {
      res.status(400).json({
        success: false,
        error: `Security Error: Project directory must be within authorized output folder: "${resolvedDir}"`,
      });
      return;
    }

    if (!fs.existsSync(resolvedDir)) {
      res.status(404).json({
        success: false,
        error: `Project directory not found: "${resolvedDir}"`,
      });
      return;
    }

    logger.info(`Processing natural language modification for ${resolvedDir}: "${instruction}"`);

    const result = await modifyProject(resolvedDir, instruction.trim());
    const projectName = path.basename(resolvedDir);
    const previewUrl = `/preview/${encodeURIComponent(projectName)}/`;

    let versionInfo = undefined;
    if (result.success) {
      try {
        let project = ProjectManager.getProjectByPath(resolvedDir);
        if (!project) {
          project = ProjectManager.createProject({
            id: projectName,
            name: projectName,
            projectPath: resolvedDir,
            previewUrl,
            status: 'passed',
          });
        }
        versionInfo = ProjectManager.createVersion(
          project.id,
          instruction.trim(),
          result.modifiedFiles,
          {
            success: true,
            diagnosticsCount: result.validation?.diagnostics?.length || 0,
          }
        );
      } catch (verErr: any) {
        logger.warn(`Could not create version record in ProjectManager: ${verErr.message}`);
      }
    }

    res.json({
      success: result.success,
      modifiedFiles: result.modifiedFiles,
      validation: result.validation,
      message: result.message,
      history: result.history,
      previewUrl,
      projectVersion: versionInfo,
    });
  } catch (error: any) {
    logger.error('Error during project modification', { error: error.message });
    res.status(500).json({
      success: false,
      error: error.message || 'Frontend modification encountered an internal error',
    });
  }
});

export default router;
