import { exec } from 'child_process';
import { promisify } from 'util';
import * as path from 'path';
import { GeneratedProject } from './types';
import { Logger } from '../utils/logger';

const execAsync = promisify(exec);
const logger = new Logger('BuildValidator');

export async function validateProjectBuild(project: GeneratedProject): Promise<GeneratedProject> {
  if (!project.projectDir) {
    throw new Error('Cannot validate project build: projectDir is not set.');
  }

  const projectDir = path.resolve(project.projectDir);
  logger.info(`Validating build for project "${project.siteName}" in: ${projectDir}`);

  // Find root node_modules/.bin
  const rootBinDir = path.resolve(__dirname, '../../../node_modules/.bin');
  const pathEnv = `${rootBinDir}${path.delimiter}${process.env.PATH}`;

  try {
    // 1. Run tsc type-check
    logger.info('Running TypeScript compilation check (tsc --noEmit)...');
    const tscCmd = process.platform === 'win32' ? 'tsc.cmd --noEmit' : 'tsc --noEmit';
    await execAsync(tscCmd, {
      cwd: projectDir,
      env: { ...process.env, PATH: pathEnv },
      timeout: 30000,
    });

    // 2. Run vite production bundle
    logger.info('Running Vite production bundle (vite build)...');
    const viteCmd = process.platform === 'win32' ? 'vite.cmd build' : 'vite build';
    const { stdout, stderr } = await execAsync(viteCmd, {
      cwd: projectDir,
      env: { ...process.env, PATH: pathEnv },
      timeout: 45000,
    });

    logger.info(`Build SUCCESS for "${project.siteName}"! Output:\n${stdout.slice(0, 300)}`);

    return {
      ...project,
      buildStatus: 'passed',
      buildOutput: stdout,
      buildErrors: [],
    };
  } catch (error: any) {
    const errorDetails = error.stdout || error.stderr || error.message;
    logger.error(`Build FAILED for "${project.siteName}"`, { error: errorDetails });

    return {
      ...project,
      buildStatus: 'failed',
      buildOutput: error.stdout,
      buildErrors: [errorDetails],
    };
  }
}
