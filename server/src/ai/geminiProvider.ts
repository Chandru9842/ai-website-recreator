import { GoogleGenerativeAI } from '@google/generative-ai';
import { ExtractedWebsiteData, UISpecification } from '@ai-website-recreator/shared';
import { AIProvider } from './types';
import { buildSystemPrompt, buildUserPrompt } from './prompts';
import { extractJsonFromText, validateAndRepairUISpec } from './validator';
import { GroundedHeuristicProvider } from './groundedProvider';
import { Logger } from '../utils/logger';

const logger = new Logger('GeminiAIProvider');

export class GeminiProvider implements AIProvider {
  readonly name = 'GeminiProvider';
  private apiKey?: string;
  private modelName: string;
  private fallbackProvider: GroundedHeuristicProvider;

  constructor(apiKey?: string, modelName?: string) {
    this.apiKey = apiKey || process.env.GEMINI_API_KEY;
    this.modelName = modelName || process.env.GEMINI_MODEL || 'gemini-1.5-flash';
    this.fallbackProvider = new GroundedHeuristicProvider();
  }

  async generateUISpecification(data: ExtractedWebsiteData): Promise<UISpecification> {
    if (!this.apiKey) {
      logger.warn('No GEMINI_API_KEY detected in environment. Delegating to Grounded Heuristic Engine.');
      return this.fallbackProvider.generateUISpecification(data);
    }

    logger.info(`Invoking Gemini LLM (${this.modelName}) for UI specification synthesis...`);

    try {
      const genAI = new GoogleGenerativeAI(this.apiKey);
      const model = genAI.getGenerativeModel({
        model: this.modelName,
        systemInstruction: buildSystemPrompt(),
        generationConfig: {
          responseMimeType: 'application/json',
          temperature: 0.1, // Low temperature for maximum grounding fidelity
        },
      });

      const userPrompt = buildUserPrompt(data);
      logger.info(`Sending prompt to Gemini (${userPrompt.length} chars)...`);

      const result = await model.generateContent(userPrompt);
      const responseText = result.response.text();

      logger.info(`Received Gemini response (${responseText.length} chars). Extracting JSON...`);
      const cleanedJson = extractJsonFromText(responseText);

      let parsed: any;
      try {
        parsed = JSON.parse(cleanedJson);
      } catch (parseErr: any) {
        logger.warn('Gemini returned malformed JSON, triggering structured repair...', { error: parseErr.message });
        parsed = {};
      }

      const outcome = validateAndRepairUISpec(parsed, data);
      if (outcome.isValid && outcome.data) {
        logger.info(`Gemini specification successfully verified and compliant! Preserved ${outcome.data.sections.length} sections.`);
        return outcome.data;
      }

      logger.warn('Gemini output could not be validated after repair. Falling back to Grounded Engine.');
      return this.fallbackProvider.generateUISpecification(data);
    } catch (apiErr: any) {
      logger.error('Gemini API call encountered an error. Falling back to Grounded Engine.', {
        error: apiErr.message,
      });
      return this.fallbackProvider.generateUISpecification(data);
    }
  }
}
