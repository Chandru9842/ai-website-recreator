import * as path from 'path';
import * as fs from 'fs';
import { BuildDiagnostic, ValidationResult, UISpecification } from '@ai-website-recreator/shared';
import { runBuildValidation } from './compilerRunner';
import { parseBuildDiagnostics } from './diagnosticParser';
import { repairProjectFiles } from './autoFixer';
import { Logger } from '../utils/logger';

const logger = new Logger('ValidatorEngine');

export interface ValidateOptions {
  maxAttempts?: number;
  spec?: UISpecification;
}

/**
 * Validates a generated React project and runs auto-healing if compilation/bundling fails.
 *
 * Pipeline:
 * Generated Project
 *      ↓
 *  Validator (tsc + vite)
 *      ↓
 * Build Success → Return Success
 *      ↓
 * Build Failure → Diagnostic Extraction
 *      ↓
 *   AI / Rule Fix
 *      ↓
 * Regenerate/Modify
 *      ↓
 * Validate Again (up to maxAttempts)
 */
export async function validateAndHealProject(
  projectDir: string,
  options: ValidateOptions = {}
): Promise<ValidationResult> {
  const resolvedDir = path.resolve(projectDir);
  const maxAttempts = options.maxAttempts ?? 3;
  const spec = options.spec;

  if (!fs.existsSync(resolvedDir)) {
    throw new Error(`Project directory does not exist: ${resolvedDir}`);
  }

  logger.info(`Starting validation & auto-healing engine for: ${resolvedDir} (Max attempts: ${maxAttempts})`);

  let currentAttempt = 0;
  let lastDiagnostics: BuildDiagnostic[] = [];
  let accumulatedFixedFiles: string[] = [];
  let lastBuildOutput = '';

  while (currentAttempt < maxAttempts) {
    currentAttempt++;
    logger.info(`▶️ Validation Attempt ${currentAttempt}/${maxAttempts}...`);

    // 1. Run safe predefined build check (tsc --noEmit followed by vite build)
    const buildResult = await runBuildValidation(resolvedDir);
    lastBuildOutput = buildResult.combinedOutput;

    // 2. If build passed cleanly
    if (buildResult.success) {
      logger.info(`✅ Build Validation PASSED on attempt ${currentAttempt}/${maxAttempts}!`);
      return {
        success: true,
        attempts: currentAttempt,
        diagnostics: [],
        fixedFiles: accumulatedFixedFiles,
        buildOutput: lastBuildOutput,
        healed: accumulatedFixedFiles.length > 0,
      };
    }

    // 3. Build failed: parse structured compiler diagnostics
    lastDiagnostics = parseBuildDiagnostics(buildResult.combinedOutput);
    logger.warn(
      `❌ Build validation failed on attempt ${currentAttempt}. Extracted ${lastDiagnostics.length} structured diagnostics.`
    );

    // Log diagnostic summary
    for (const diag of lastDiagnostics) {
      logger.warn(`   [${diag.errorType.toUpperCase()}] ${diag.file || 'unknown'}:${diag.line || '?'}: ${diag.message}`);
    }

    // 4. Auto-healing if within retry limits
    if (currentAttempt < maxAttempts) {
      logger.info(`🔧 Triggering auto-healing for attempt ${currentAttempt}...`);
      const repairResult = await repairProjectFiles(resolvedDir, lastDiagnostics, spec);

      if (repairResult.fixedFiles.length > 0) {
        accumulatedFixedFiles.push(...repairResult.fixedFiles);
        accumulatedFixedFiles = Array.from(new Set(accumulatedFixedFiles));
        logger.info(
          `Auto-healing repaired ${repairResult.fixedFiles.length} file(s): ${repairResult.fixedFiles.join(', ')}. Retrying validation...`
        );
        // Loop will re-run validation on next iteration
        continue;
      } else {
        logger.warn('Auto-healing could not determine actionable code fixes. Terminating retry loop.');
        break;
      }
    }
  }

  // Max attempts reached or unrepairable failure
  logger.error(`Validation and auto-healing failed after ${currentAttempt} attempts.`);
  return {
    success: false,
    attempts: currentAttempt,
    diagnostics: lastDiagnostics,
    fixedFiles: accumulatedFixedFiles,
    buildOutput: lastBuildOutput,
    healed: false,
  };
}

/**
 * Convenience single-pass validator without auto-healing.
 */
export async function validateProject(projectDir: string): Promise<ValidationResult> {
  return validateAndHealProject(projectDir, { maxAttempts: 1 });
}

export * from './compilerRunner';
export * from './diagnosticParser';
export * from './autoFixer';
