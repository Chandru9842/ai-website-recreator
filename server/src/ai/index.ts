import { ExtractedWebsiteData, UISpecification } from '@ai-website-recreator/shared';
import { getAIProvider } from './factory';
import { SpecGenerationOptions } from './types';
import { Logger } from '../utils/logger';

const logger = new Logger('AILayer');

/**
 * AI Analysis Layer - Master Entry Point
 * Transforms real ExtractedWebsiteData into a strict, validated UISpecification.
 */
export async function generateUISpecification(
  data: ExtractedWebsiteData,
  options?: SpecGenerationOptions
): Promise<UISpecification> {
  logger.info(`Starting UI specification synthesis for "${data.metadata.title}" (${data.sections.length} source sections)`);

  const provider = getAIProvider(options);
  const spec = await provider.generateUISpecification(data);

  logger.info(`Completed UI specification generation. Sections: ${spec.sections.length}, Assets: ${spec.groundingMetrics.preservedAssetsCount}`);
  return spec;
}

export * from './types';
export * from './factory';
export * from './validator';
export * from './groundedProvider';
export * from './geminiProvider';
export * from './prompts';
