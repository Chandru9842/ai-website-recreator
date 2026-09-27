import * as path from 'path';
import * as fs from 'fs';
import { ValidationResult, ModifyResponse } from '@ai-website-recreator/shared';
import { SafeFileModifier } from './safeFileModifier';
import { planModifications } from './aiModifier';
import { HistoryManager } from './historyManager';
import { validateAndHealProject } from '../validator';
import { ModifyOptions, ModificationRecord } from './types';
import { Logger } from '../utils/logger';

const logger = new Logger('ModificationEngine');

/**
 * Natural Language Frontend Modification Engine
 * Modifies existing generated React project files safely based on user instructions,
 * then validates the build and auto-heals via Module 4.
 */
export async function modifyProject(
  projectDir: string,
  instruction: string,
  options: ModifyOptions = {}
): Promise<ModifyResponse> {
  const resolvedDir = path.resolve(projectDir);

  if (!fs.existsSync(resolvedDir) || !fs.statSync(resolvedDir).isDirectory()) {
    throw new Error(`Project directory does not exist or is not a directory: "${resolvedDir}"`);
  }

  logger.info(`Received natural language modification request for ${resolvedDir}: "${instruction}"`);

  // 1. Plan modifications
  const plan = await planModifications(resolvedDir, instruction, options.spec);

  if (!plan.changes || plan.changes.length === 0) {
    logger.warn(`No changes could be planned for instruction: "${instruction}"`);
    return {
      success: false,
      modifiedFiles: [],
      validation: {
        success: false,
        attempts: 0,
        diagnostics: [],
        fixedFiles: [],
        buildOutput: 'No matching components or files identified for the requested modification.',
        healed: false,
      },
      message: `Could not identify any files to modify for: "${instruction}"`,
      history: HistoryManager.getHistory(resolvedDir),
    };
  }

  // 2. Backup original files before applying changes
  const backups: Record<string, string | null> = {};
  const modifiedFiles: string[] = [];

  try {
    for (const change of plan.changes) {
      // Validate safe path (strictly forbids traversal or outside modifications)
      SafeFileModifier.resolveSafePath(resolvedDir, change.file);

      // Record backup
      if (SafeFileModifier.safeFileExists(resolvedDir, change.file)) {
        backups[change.file] = SafeFileModifier.safeReadFile(resolvedDir, change.file);
      } else {
        backups[change.file] = null; // marks that it didn't exist before
      }

      // Apply modification
      if (change.operation === 'delete') {
        SafeFileModifier.safeDeleteFile(resolvedDir, change.file);
      } else if (change.updatedContent) {
        SafeFileModifier.safeWriteFile(resolvedDir, change.file, change.updatedContent);
      }

      modifiedFiles.push(change.file);
    }
  } catch (secError: any) {
    logger.error(`Security violation during modification: ${secError.message}`);
    // Rollback any touched files
    for (const [relPath, content] of Object.entries(backups)) {
      if (content !== null) {
        SafeFileModifier.safeWriteFile(resolvedDir, relPath, content);
      } else {
        SafeFileModifier.safeDeleteFile(resolvedDir, relPath);
      }
    }
    throw secError;
  }

  // 3. Validation & Auto-Healing Pipeline (Module 4)
  logger.info(`Validating modified project files (${modifiedFiles.join(', ')})...`);
  const maxAttempts = options.maxValidationAttempts ?? 3;
  const validationResult: ValidationResult = await validateAndHealProject(resolvedDir, {
    maxAttempts,
    spec: options.spec,
  });

  // If auto-healing modified any additional files, add them to modifiedFiles
  if (validationResult.fixedFiles.length > 0) {
    for (const fixed of validationResult.fixedFiles) {
      if (!modifiedFiles.includes(fixed)) {
        modifiedFiles.push(fixed);
      }
    }
  }

  // If validation failed permanently, rollback
  if (!validationResult.success) {
    logger.error(`Modified project failed build validation after ${validationResult.attempts} attempts. Rolling back...`);
    for (const [relPath, content] of Object.entries(backups)) {
      if (content !== null) {
        SafeFileModifier.safeWriteFile(resolvedDir, relPath, content);
      } else {
        SafeFileModifier.safeDeleteFile(resolvedDir, relPath);
      }
    }

    return {
      success: false,
      modifiedFiles: [],
      validation: validationResult,
      message: `Modification failed build validation: ${validationResult.diagnostics[0]?.message || 'Compilation error'}`,
      history: HistoryManager.getHistory(resolvedDir),
    };
  }

  // 4. Record History
  const historyEntry: ModificationRecord = {
    id: `mod_${Date.now()}`,
    instruction,
    timestamp: new Date().toISOString(),
    modifiedFiles,
    validation: validationResult,
    success: true,
    message: plan.reasoning,
  };
  HistoryManager.record(resolvedDir, historyEntry);

  logger.info(`Modification "${instruction}" completed successfully! (${modifiedFiles.length} files modified)`);

  return {
    success: true,
    modifiedFiles,
    validation: validationResult,
    message: plan.reasoning || `Successfully modified ${modifiedFiles.join(', ')}`,
    history: HistoryManager.getHistory(resolvedDir),
  };
}

export * from './types';
export * from './safeFileModifier';
export * from './fileSelector';
export * from './aiModifier';
export * from './historyManager';
