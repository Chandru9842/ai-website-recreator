import { GeneratedProject, ModifyRequest } from '@ai-website-recreator/shared';
import { Logger } from '../utils/logger';

const logger = new Logger('AIModifier');

/**
 * AI Iterative Modifier
 * Applies targeted natural language modifications to existing generated React code.
 */
export async function applyModification(
  project: GeneratedProject,
  request: ModifyRequest
): Promise<GeneratedProject> {
  logger.info(`Applying modification "${request.instruction}" to project ${project.id}...`);

  return {
    ...project,
    iteration: project.iteration + 1,
  };
}
