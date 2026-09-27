import { ProjectMetadata, ProjectVersion, ValidationResult } from '@ai-website-recreator/shared';

export { ProjectMetadata, ProjectVersion };

export interface CreateProjectOptions {
  id?: string;
  name: string;
  originalUrl?: string;
  projectPath?: string;
  previewUrl?: string;
  status?: 'passed' | 'failed' | 'generating' | 'healing';
  files?: Record<string, string>;
}

export interface UpdateProjectOptions {
  name?: string;
  status?: 'passed' | 'failed' | 'generating' | 'healing';
  previewUrl?: string;
}

export interface RestoreVersionResult {
  success: boolean;
  project?: ProjectMetadata;
  diagnostics?: any[];
  error?: string;
}

export interface SnapshotManifest {
  projectId: string;
  version: number;
  instruction: string;
  timestamp: number;
  files: string[];
}
