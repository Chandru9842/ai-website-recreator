import { AIProvider, SpecGenerationOptions } from './types';
import { GeminiProvider } from './geminiProvider';
import { GroundedHeuristicProvider } from './groundedProvider';
import { Logger } from '../utils/logger';

const logger = new Logger('AIProviderFactory');

export function getAIProvider(options?: SpecGenerationOptions): AIProvider {
  const chosen = options?.providerName || (process.env.AI_PROVIDER as any) || 'auto';

  if (chosen === 'grounded') {
    logger.info('Using GroundedHeuristicProvider (explicitly requested)');
    return new GroundedHeuristicProvider();
  }

  if (chosen === 'gemini') {
    logger.info('Using GeminiProvider (explicitly requested)');
    return new GeminiProvider();
  }

  // Auto-selection mode
  if (process.env.GEMINI_API_KEY) {
    logger.info('Auto-selected GeminiProvider (GEMINI_API_KEY detected)');
    return new GeminiProvider();
  }

  logger.info('Auto-selected GroundedHeuristicProvider (Zero-cost, 100% deterministic grounding)');
  return new GroundedHeuristicProvider();
}
