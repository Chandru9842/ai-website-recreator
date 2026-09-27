import * as path from 'path';
import * as fs from 'fs';
import { GeneratedProject } from './types';
import { UISpecification } from '@ai-website-recreator/shared';
import { validateAndHealProject } from '../validator';
import { Logger } from '../utils/logger';

const logger = new Logger('BuildValidator');

export async function validateProjectBuild(
  project: GeneratedProject,
  spec?: UISpecification
): Promise<GeneratedProject> {
  if (!project.projectDir) {
    throw new Error('Cannot validate project build: projectDir is not set.');
  }

  const projectDir = path.resolve(project.projectDir);
  logger.info(`Running build validation and auto-healing for "${project.siteName}" in: ${projectDir}`);

  // Invoke Module 4 Validation & Auto-Healing Engine
  const valResult = await validateAndHealProject(projectDir, { maxAttempts: 3, spec });

  // Update in-memory project.files if any files were repaired
  const updatedFiles = { ...project.files };
  if (valResult.fixedFiles.length > 0) {
    for (const fixedRelPath of valResult.fixedFiles) {
      const fixedAbsPath = path.resolve(projectDir, fixedRelPath);
      if (fs.existsSync(fixedAbsPath)) {
        updatedFiles[fixedRelPath] = fs.readFileSync(fixedAbsPath, 'utf-8');
      }
    }
  }

  if (valResult.success) {
    logger.info(`Build validation PASSED for "${project.siteName}" (attempts: ${valResult.attempts})`);
    return {
      ...project,
      files: updatedFiles,
      buildStatus: 'passed',
      buildOutput: valResult.buildOutput,
      buildErrors: [],
      validation: valResult,
    };
  } else {
    logger.error(`Build validation FAILED for "${project.siteName}" after ${valResult.attempts} attempts.`);
    return {
      ...project,
      files: updatedFiles,
      buildStatus: 'failed',
      buildOutput: valResult.buildOutput,
      buildErrors: valResult.diagnostics.map(
        (d) => `[${d.errorType}] ${d.file || 'unknown'}:${d.line || '?'}: ${d.message}`
      ),
      validation: valResult,
    };
  }
}
