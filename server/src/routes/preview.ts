import { Router, Request, Response, NextFunction } from 'express';
import * as path from 'path';
import * as fs from 'fs';
import express from 'express';
import { Logger } from '../utils/logger';

const router = Router();
const logger = new Logger('PreviewRoute');

/**
 * Resolves the dist/ directory for a given project name.
 */
function findProjectDist(projectName: string): string | null {
  const sanitized = path.basename(projectName);
  const searchRoots = [
    path.resolve(__dirname, '../../../output/generated_projects', sanitized, 'dist'),
    path.resolve(__dirname, '../../../output/test_projects', sanitized, 'dist'),
    path.resolve(__dirname, '../../../output', sanitized, 'dist'),
    path.resolve(__dirname, '../../../output/generated_projects', sanitized),
    path.resolve(__dirname, '../../../output/test_projects', sanitized),
  ];

  for (const candidate of searchRoots) {
    if (fs.existsSync(candidate)) {
      if (fs.existsSync(path.join(candidate, 'index.html'))) {
        return candidate;
      }
      const nestedDist = path.join(candidate, 'dist');
      if (fs.existsSync(path.join(nestedDist, 'index.html'))) {
        return nestedDist;
      }
    }
  }

  // Case-insensitive / prefix matching in output/generated_projects
  const genBase = path.resolve(__dirname, '../../../output/generated_projects');
  if (fs.existsSync(genBase)) {
    const entries = fs.readdirSync(genBase);
    for (const entry of entries) {
      if (
        entry.toLowerCase() === sanitized.toLowerCase() ||
        entry.toLowerCase().includes(sanitized.toLowerCase())
      ) {
        const candidate = path.join(genBase, entry, 'dist');
        if (fs.existsSync(path.join(candidate, 'index.html'))) {
          return candidate;
        }
      }
    }
  }

  return null;
}

// Serve project dist files under /preview/:projectName/*
router.use('/:projectName', (req: Request, res: Response, next: NextFunction) => {
  const rawProjectName = req.params.projectName;
  const projectName = Array.isArray(rawProjectName) ? rawProjectName[0] : String(rawProjectName || '');

  // Path traversal guard
  if (!projectName || projectName.includes('..') || projectName.includes('/') || projectName.includes('\\')) {
    res.status(400).send('Invalid project name: path traversal characters rejected');
    return;
  }

  // Redirect /preview/:projectName (no trailing slash) to /preview/:projectName/
  const originalPath = req.originalUrl.split('?')[0];
  if (originalPath === `/preview/${projectName}`) {
    res.redirect(301, `/preview/${encodeURIComponent(projectName)}/`);
    return;
  }

  const distDir = findProjectDist(projectName);
  if (!distDir) {
    logger.warn(`Preview dist directory not found for project "${projectName}"`);
    res.status(404).send(
      `Project preview not found for "${projectName}". Ensure the project has been generated and validated with a dist/ build.`
    );
    return;
  }

  // If requesting index.html or root '/', normalize asset paths to relative for iframe safety
  if (req.path === '/' || req.path === '/index.html') {
    const indexPath = path.join(distDir, 'index.html');
    if (fs.existsSync(indexPath)) {
      let html = fs.readFileSync(indexPath, 'utf-8');
      // Normalize any absolute /assets/ paths to ./assets/ so sub-path iframe resolution is 100% reliable
      html = html.replace(/(href|src)=["']\/assets\//g, '$1="./assets/');
      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
      res.send(html);
      return;
    }
  }

  // Serve static assets from distDir
  express.static(distDir, {
    index: 'index.html',
    maxAge: 0,
    setHeaders: (res) => {
      res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    },
  })(req, res, next);
});

export default router;
