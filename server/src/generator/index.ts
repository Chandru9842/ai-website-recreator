import { UISpecification } from '@ai-website-recreator/shared';
import { GeneratedProject, GeneratorOptions } from './types';
import { scaffoldReactProject, writeProjectToDisk } from './projectScaffolder';
import { validateProjectBuild } from './buildValidator';
import { Logger } from '../utils/logger';

const logger = new Logger('ReactGenerator');

/**
 * React + Tailwind Code Generator - Master Entry Point
 * Transforms a validated UISpecification into a real, runnable React project.
 */
export async function generateReactProject(
  spec: UISpecification,
  options: GeneratorOptions = {}
): Promise<GeneratedProject> {
  logger.info(`Starting React + Tailwind code generation for "${spec.metadata.title}"`);

  // 1. Programmatically scaffold files
  let project = scaffoldReactProject(spec);

  // 2. Write to disk if outputDir is specified
  if (options.outputDir) {
    await writeProjectToDisk(project, options.outputDir);

    // 3. Build Validation if requested
    if (options.validateBuild) {
      project = await validateProjectBuild(project);
      if (project.buildStatus === 'failed') {
        throw new Error(
          `Project build validation failed for "${spec.metadata.title}":\n${project.buildErrors?.join('\n')}`
        );
      }
    }
  }

  logger.info(`React project generated successfully (${Object.keys(project.files).length} files, buildStatus: ${project.buildStatus})`);
  return project;
}

export * from './types';
export * from './projectScaffolder';
export * from './buildValidator';
export * from './styleConfigurator';
export * from './componentTemplates';
export * from './sectionGenerators';
export * from './appGenerator';
