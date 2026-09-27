import { ExtractedWebsiteData, UISpecification } from '@ai-website-recreator/shared';

export interface AIProvider {
  readonly name: string;
  generateUISpecification(data: ExtractedWebsiteData): Promise<UISpecification>;
}

export interface SpecGenerationOptions {
  providerName?: 'gemini' | 'grounded' | 'auto';
  temperature?: number;
}
