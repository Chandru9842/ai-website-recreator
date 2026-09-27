import { ValidationResult, UISpecification } from '@ai-website-recreator/shared';

export type ModificationOperation = 'modify' | 'create' | 'delete';

export interface FileChangeInstruction {
  file: string; // Relative path inside the project e.g. "src/sections/Navbar.tsx"
  operation: ModificationOperation;
  reason: string;
  instructions?: string;
  updatedContent?: string;
}

export interface ModificationPlan {
  intent: string;
  reasoning: string;
  changes: FileChangeInstruction[];
}

export interface ModificationRecord {
  id: string;
  instruction: string;
  timestamp: string;
  modifiedFiles: string[];
  validation: ValidationResult;
  success: boolean;
  message?: string;
}

export interface ModifyOptions {
  spec?: UISpecification;
  maxValidationAttempts?: number;
}
