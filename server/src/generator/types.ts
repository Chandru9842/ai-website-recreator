import { UISpecification, ValidationResult } from '@ai-website-recreator/shared';

export interface GeneratedProject {
  id: string;
  siteName: string;
  sourceUrl: string;
  createdAt: string;
  files: Record<string, string>;
  projectDir?: string;
  buildStatus: 'untested' | 'passed' | 'failed';
  buildOutput?: string;
  buildErrors?: string[];
  validation?: ValidationResult;
}

export interface GeneratorOptions {
  outputDir?: string;
  validateBuild?: boolean;
}
