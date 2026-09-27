import { Router, Request, Response } from 'express';
import * as path from 'path';
import * as fs from 'fs';
import { validateAndHealProject } from '../validator';
import { Logger } from '../utils/logger';

const router = Router();
const logger = new Logger('ValidateRoute');

/**
 * POST /api/validate
 * Input: { projectPath: string } or { projectDir: string }
 * Output: Structured validation result:
 * {
 *   success: boolean,
 *   attempts: number,
 *   diagnostics: BuildDiagnostic[],
 *   fixedFiles: string[],
 *   buildOutput: string
 * }
 */
router.post('/', async (req: Request, res: Response) => {
  try {
    const rawPath = req.body.projectPath || req.body.projectDir || req.body.path;

    if (!rawPath || typeof rawPath !== 'string') {
      res.status(400).json({
        success: false,
        error: 'Invalid request: Body must include "projectPath" or "projectDir" as a string',
      });
      return;
    }

    const resolvedPath = path.resolve(rawPath);
    const authorizedRoot = path.resolve(__dirname, '../../../output');
    if (!resolvedPath.startsWith(authorizedRoot)) {
      res.status(400).json({
        success: false,
        error: `Security Error: Project directory must be within authorized output folder: "${resolvedPath}"`,
      });
      return;
    }

    if (!fs.existsSync(resolvedPath)) {
      res.status(404).json({
        success: false,
        error: `Project directory not found: ${resolvedPath}`,
      });
      return;
    }

    // Safety: ensure it is a directory
    const stats = fs.statSync(resolvedPath);
    if (!stats.isDirectory()) {
      res.status(400).json({
        success: false,
        error: `Path is not a directory: ${resolvedPath}`,
      });
      return;
    }

    logger.info(`Received validation request for: ${resolvedPath}`);

    const maxAttempts = typeof req.body.maxAttempts === 'number' ? req.body.maxAttempts : 3;
    const result = await validateAndHealProject(resolvedPath, { maxAttempts });

    res.json({
      success: result.success,
      attempts: result.attempts,
      diagnostics: result.diagnostics,
      fixedFiles: result.fixedFiles,
      buildOutput: result.buildOutput,
      healed: result.healed,
    });
  } catch (error: any) {
    logger.error('Error during project validation', { error: error.message });
    res.status(500).json({
      success: false,
      error: error.message || 'Project validation encountered an internal error',
    });
  }
});

export default router;
