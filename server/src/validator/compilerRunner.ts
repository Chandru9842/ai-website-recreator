import { exec } from 'child_process';
import { promisify } from 'util';
import * as path from 'path';
import * as fs from 'fs';
import { Logger } from '../utils/logger';

const execAsync = promisify(exec);
const logger = new Logger('CompilerRunner');

export interface CommandExecutionResult {
  command: string;
  exitCode: number;
  stdout: string;
  stderr: string;
  success: boolean;
  rawOutput: string;
}

/**
 * Predefined Safe Commands Whitelist
 * Strictly ensures no arbitrary shell execution is allowed.
 */
const SAFE_COMMANDS = {
  tsc: process.platform === 'win32' ? 'tsc.cmd --noEmit' : 'tsc --noEmit',
  viteBuild: process.platform === 'win32' ? 'vite.cmd build' : 'vite build',
} as const;

/**
 * Resolves the node_modules/.bin path for executing build tools.
 */
function getBinPath(projectDir: string): string {
  // Search upward from projectDir or use monorepo root
  const candidates = [
    path.resolve(projectDir, 'node_modules/.bin'),
    path.resolve(projectDir, '../node_modules/.bin'),
    path.resolve(projectDir, '../../node_modules/.bin'),
    path.resolve(__dirname, '../../../node_modules/.bin'),
  ];

  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) {
      return candidate;
    }
  }

  // Fallback to monorepo root
  return path.resolve(__dirname, '../../../node_modules/.bin');
}

/**
 * Executes a strictly whitelisted build command in the target project directory.
 */
async function executeSafeCommand(
  commandType: 'tsc' | 'viteBuild',
  projectDir: string,
  timeoutMs: number = 45000
): Promise<CommandExecutionResult> {
  const command = SAFE_COMMANDS[commandType];
  const binDir = getBinPath(projectDir);
  const pathEnv = `${binDir}${path.delimiter}${process.env.PATH || ''}`;

  logger.info(`Executing safe build command: [${commandType}] in ${projectDir}`);

  try {
    const { stdout, stderr } = await execAsync(command, {
      cwd: projectDir,
      env: {
        ...process.env,
        PATH: pathEnv,
        FORCE_COLOR: '0', // Keep clean output without ANSI escape codes
      },
      timeout: timeoutMs,
      maxBuffer: 10 * 1024 * 1024,
    });

    const combinedOutput = `${stdout || ''}\n${stderr || ''}`.trim();
    return {
      command,
      exitCode: 0,
      stdout: stdout || '',
      stderr: stderr || '',
      success: true,
      rawOutput: combinedOutput,
    };
  } catch (error: any) {
    const exitCode = typeof error.code === 'number' ? error.code : 1;
    const stdout = error.stdout || '';
    const stderr = error.stderr || error.message || '';
    const combinedOutput = `${stdout}\n${stderr}`.trim();

    logger.warn(`Build command [${commandType}] failed with exit code ${exitCode}`);

    return {
      command,
      exitCode,
      stdout,
      stderr,
      success: false,
      rawOutput: combinedOutput,
    };
  }
}

/**
 * Runs full validation on a project:
 * 1. TypeScript type-check & JSX validation (`tsc --noEmit`)
 * 2. Vite production bundle (`vite build`)
 */
export async function runBuildValidation(projectDir: string): Promise<{
  success: boolean;
  exitCode: number;
  stdout: string;
  stderr: string;
  combinedOutput: string;
  failedStep?: 'tsc' | 'vite';
}> {
  // Step 1: TypeScript validation
  logger.info('Step 1/2: Running TypeScript validation (tsc --noEmit)...');
  const tscResult = await executeSafeCommand('tsc', projectDir, 35000);

  if (!tscResult.success) {
    return {
      success: false,
      exitCode: tscResult.exitCode,
      stdout: tscResult.stdout,
      stderr: tscResult.stderr,
      combinedOutput: tscResult.rawOutput,
      failedStep: 'tsc',
    };
  }

  // Step 2: Vite production build
  logger.info('Step 2/2: Running Vite production build (vite build)...');
  const viteResult = await executeSafeCommand('viteBuild', projectDir, 45000);

  if (!viteResult.success) {
    return {
      success: false,
      exitCode: viteResult.exitCode,
      stdout: viteResult.stdout,
      stderr: viteResult.stderr,
      combinedOutput: viteResult.rawOutput,
      failedStep: 'vite',
    };
  }

  return {
    success: true,
    exitCode: 0,
    stdout: `${tscResult.stdout}\n${viteResult.stdout}`.trim(),
    stderr: `${tscResult.stderr}\n${viteResult.stderr}`.trim(),
    combinedOutput: `${tscResult.rawOutput}\n${viteResult.rawOutput}`.trim(),
  };
}
