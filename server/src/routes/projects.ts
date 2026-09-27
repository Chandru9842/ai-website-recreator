import { Router, Request, Response } from 'express';
import * as fs from 'fs';
import * as path from 'path';
import { ProjectManager } from '../projects';
import { Logger } from '../utils/logger';

const router = Router();
const logger = new Logger('ProjectsRoute');

function loadProjectSourceFiles(projectDir: string): Record<string, string> {
  const files: Record<string, string> = {};
  if (!projectDir || !fs.existsSync(projectDir)) return files;

  function walk(current: string, rel: string) {
    if (!fs.existsSync(current)) return;
    const entries = fs.readdirSync(current, { withFileTypes: true });
    for (const e of entries) {
      if (e.name === 'node_modules' || e.name === 'dist' || e.name === '.git') continue;
      const fullPath = path.join(current, e.name);
      const relPath = rel ? `${rel}/${e.name}` : e.name;
      if (e.isDirectory()) {
        walk(fullPath, relPath);
      } else if (e.isFile()) {
        if (
          relPath.startsWith('src/') ||
          relPath === 'package.json' ||
          relPath === 'index.html' ||
          relPath === 'tailwind.config.js' ||
          relPath === 'vite.config.ts' ||
          relPath === 'tsconfig.json'
        ) {
          try {
            files[relPath] = fs.readFileSync(fullPath, 'utf-8');
          } catch {}
        }
      }
    }
  }

  walk(projectDir, '');
  return files;
}

/**
 * GET /api/projects
 * Lists all registered projects sorted by last updated descending.
 */
router.get('/', (req: Request, res: Response) => {
  try {
    const projects = ProjectManager.getAllProjects();
    res.json({
      success: true,
      data: projects,
      count: projects.length,
    });
  } catch (error: any) {
    logger.error('Failed to list projects', { error: error.message });
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /api/projects/:id
 * Retrieves metadata, full version history, and source files for a project.
 */
router.get('/:id', (req: Request, res: Response) => {
  try {
    const rawId = req.params.id;
    const id = Array.isArray(rawId) ? rawId[0] : String(rawId || '');

    const project = ProjectManager.getProject(id);
    if (!project) {
      res.status(404).json({ success: false, error: `Project not found: "${id}"` });
      return;
    }

    const files = loadProjectSourceFiles(project.projectPath);

    res.json({
      success: true,
      data: {
        ...project,
        files,
      },
    });
  } catch (error: any) {
    logger.error('Failed to get project', { error: error.message });
    const status = error.message.includes('Security Error') ? 400 : 500;
    res.status(status).json({ success: false, error: error.message });
  }
});

/**
 * POST /api/projects
 * Explicitly creates or registers a project.
 */
router.post('/', (req: Request, res: Response) => {
  try {
    const { name, originalUrl, id, projectPath, previewUrl, status, files } = req.body;

    if (!name || typeof name !== 'string') {
      res.status(400).json({ success: false, error: 'Project "name" is required as a string' });
      return;
    }

    const project = ProjectManager.createProject({
      id,
      name,
      originalUrl,
      projectPath,
      previewUrl,
      status,
      files,
    });

    res.status(201).json({
      success: true,
      data: project,
    });
  } catch (error: any) {
    logger.error('Failed to create project', { error: error.message });
    const status = error.message.includes('Security Error') ? 400 : 500;
    res.status(status).json({ success: false, error: error.message });
  }
});

/**
 * PATCH /api/projects/:id
 * Updates project name or status.
 */
router.patch('/:id', (req: Request, res: Response) => {
  try {
    const rawId = req.params.id;
    const id = Array.isArray(rawId) ? rawId[0] : String(rawId || '');
    const { name, status } = req.body;

    const updated = ProjectManager.updateProject(id, { name, status });
    res.json({
      success: true,
      data: updated,
    });
  } catch (error: any) {
    logger.error('Failed to update project', { error: error.message });
    const statusCode = error.message.includes('does not exist') ? 404 : error.message.includes('Security Error') ? 400 : 500;
    res.status(statusCode).json({ success: false, error: error.message });
  }
});

/**
 * POST /api/projects/:id/duplicate
 * Duplicates a project with independent directory, snapshots, and versioning.
 */
router.post('/:id/duplicate', (req: Request, res: Response) => {
  try {
    const rawId = req.params.id;
    const id = Array.isArray(rawId) ? rawId[0] : String(rawId || '');
    const { name } = req.body || {};

    const duplicated = ProjectManager.duplicateProject(id, name);
    res.status(201).json({
      success: true,
      data: duplicated,
    });
  } catch (error: any) {
    logger.error('Failed to duplicate project', { error: error.message });
    const statusCode = error.message.includes('does not exist') ? 404 : error.message.includes('Security Error') ? 400 : 500;
    res.status(statusCode).json({ success: false, error: error.message });
  }
});

/**
 * POST /api/projects/:id/restore/:version
 * Restores a snapshot version with Module 4 build validation and auto-rollback on failure.
 */
router.post('/:id/restore/:version', async (req: Request, res: Response) => {
  try {
    const rawId = req.params.id;
    const id = Array.isArray(rawId) ? rawId[0] : String(rawId || '');

    const rawVer = req.params.version;
    const versionStr = Array.isArray(rawVer) ? rawVer[0] : String(rawVer || '');
    const verNumber = parseInt(versionStr, 10);

    if (isNaN(verNumber) || verNumber < 1) {
      res.status(400).json({ success: false, error: `Invalid version parameter: "${versionStr}"` });
      return;
    }

    const result = await ProjectManager.restoreVersion(id, verNumber);

    if (!result.success) {
      res.status(422).json({
        success: false,
        error: result.error || 'Build validation failed after restoring version',
        diagnostics: result.diagnostics,
      });
      return;
    }

    const files = loadProjectSourceFiles(result.project?.projectPath || '');

    res.json({
      success: true,
      data: {
        ...result.project,
        files,
      },
      message: `Successfully restored project to version v${verNumber}`,
    });
  } catch (error: any) {
    logger.error('Failed to restore project version', { error: error.message });
    const statusCode = error.message.includes('does not exist') ? 404 : error.message.includes('Security Error') ? 400 : 500;
    res.status(statusCode).json({ success: false, error: error.message });
  }
});

/**
 * DELETE /api/projects/:id
 * Safely deletes a project directory, its snapshot records, and registry record.
 */
router.delete('/:id', (req: Request, res: Response) => {
  try {
    const rawId = req.params.id;
    const id = Array.isArray(rawId) ? rawId[0] : String(rawId || '');

    const result = ProjectManager.deleteProject(id);
    res.json(result);
  } catch (error: any) {
    logger.error('Failed to delete project', { error: error.message });
    const statusCode = error.message.includes('Security Error') ? 400 : 500;
    res.status(statusCode).json({ success: false, error: error.message });
  }
});

export default router;
