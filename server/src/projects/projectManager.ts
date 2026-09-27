import * as fs from 'fs';
import * as path from 'path';
import {
  ProjectMetadata,
  ProjectVersion,
  CreateProjectOptions,
  UpdateProjectOptions,
  RestoreVersionResult,
} from './types';
import { SnapshotManager } from './snapshotManager';
import { validateAndHealProject } from '../validator';
import { Logger } from '../utils/logger';

const logger = new Logger('ProjectManager');

export class ProjectManager {
  private static readonly REGISTRY_FILE = path.resolve(__dirname, '../../../output/projects.json');
  private static readonly GENERATED_PROJECTS_DIR = path.resolve(__dirname, '../../../output/generated_projects');

  private static projectsMap: Map<string, ProjectMetadata> = new Map();
  private static isInitialized = false;

  /**
   * Initializes the registry by loading output/projects.json and discovering existing projects.
   */
  public static init(): void {
    if (!fs.existsSync(this.GENERATED_PROJECTS_DIR)) {
      fs.mkdirSync(this.GENERATED_PROJECTS_DIR, { recursive: true });
    }

    this.projectsMap.clear();

    if (fs.existsSync(this.REGISTRY_FILE)) {
      try {
        const raw = fs.readFileSync(this.REGISTRY_FILE, 'utf-8');
        const list: ProjectMetadata[] = JSON.parse(raw);
        for (const p of list) {
          if (p && p.id) {
            this.projectsMap.set(p.id, p);
          }
        }
        logger.info(`Loaded ${this.projectsMap.size} projects from ${this.REGISTRY_FILE}`);
      } catch (err: any) {
        logger.warn(`Failed to parse projects.json, recreating: ${err.message}`);
      }
    }

    // Auto-discover existing unindexed folders in output/generated_projects
    this.discoverExistingProjects();
    this.saveRegistry();
    this.isInitialized = true;
  }

  /**
   * Auto-discovers any existing generated projects on disk.
   */
  private static discoverExistingProjects(): void {
    if (!fs.existsSync(this.GENERATED_PROJECTS_DIR)) return;

    const entries = fs.readdirSync(this.GENERATED_PROJECTS_DIR, { withFileTypes: true });
    for (const entry of entries) {
      if (!entry.isDirectory()) continue;
      const folderName = entry.name;
      if (this.projectsMap.has(folderName)) continue;

      const fullPath = path.join(this.GENERATED_PROJECTS_DIR, folderName);
      const isDistBuilt = fs.existsSync(path.join(fullPath, 'dist', 'index.html'));

      const initialVer: ProjectVersion = {
        version: 1,
        instruction: 'Initial generation',
        timestamp: Date.now(),
        modifiedFiles: ['src/App.tsx'],
        validation: {
          success: isDistBuilt,
          diagnosticsCount: 0,
        },
        snapshotPath: '',
      };

      const meta: ProjectMetadata = {
        id: folderName,
        name: this.formatProjectName(folderName),
        originalUrl: `https://${folderName.replace(/_/g, '-')}.com`,
        projectPath: fullPath,
        previewUrl: `/preview/${encodeURIComponent(folderName)}/`,
        createdAt: Date.now(),
        updatedAt: Date.now(),
        currentVersion: 1,
        versions: [initialVer],
        status: isDistBuilt ? 'passed' : 'failed',
      };

      this.projectsMap.set(folderName, meta);
      logger.info(`Auto-discovered existing project: "${folderName}"`);
    }
  }

  /**
   * Persists the projects registry to output/projects.json.
   */
  public static saveRegistry(): void {
    const outputDir = path.dirname(this.REGISTRY_FILE);
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    const list = Array.from(this.projectsMap.values());
    fs.writeFileSync(this.REGISTRY_FILE, JSON.stringify(list, null, 2), 'utf-8');
  }

  /**
   * Retrieves all projects, sorted by last updated descending.
   */
  public static getAllProjects(): ProjectMetadata[] {
    if (!this.isInitialized) this.init();
    return Array.from(this.projectsMap.values()).sort((a, b) => b.updatedAt - a.updatedAt);
  }

  /**
   * Retrieves a single project by ID.
   */
  public static getProject(id: string): ProjectMetadata | null {
    if (!this.isInitialized) this.init();
    const validId = SnapshotManager.validateProjectId(id);
    return this.projectsMap.get(validId) || null;
  }

  /**
   * Registers or creates a new project.
   */
  public static createProject(options: CreateProjectOptions): ProjectMetadata {
    if (!this.isInitialized) this.init();

    if (!options.name || typeof options.name !== 'string') {
      throw new Error('Project name is required');
    }

    const id = options.id
      ? SnapshotManager.validateProjectId(options.id)
      : this.slugify(options.name);

    const safeId = SnapshotManager.validateProjectId(id);
    const targetDir = options.projectPath
      ? this.resolveSafePath(options.projectPath)
      : path.join(this.GENERATED_PROJECTS_DIR, safeId);

    const previewUrl = options.previewUrl || `/preview/${encodeURIComponent(safeId)}/`;
    const now = Date.now();

    const initialVersion: ProjectVersion = {
      version: 1,
      instruction: 'Initial generation',
      timestamp: now,
      modifiedFiles: options.files ? Object.keys(options.files) : [],
      validation: {
        success: options.status !== 'failed',
        diagnosticsCount: 0,
      },
      snapshotPath: '',
    };

    // If directory exists, create snapshot for v1
    if (fs.existsSync(targetDir)) {
      try {
        const snapDir = SnapshotManager.createSnapshot(
          safeId,
          1,
          targetDir,
          'Initial generation',
          options.files ? Object.keys(options.files) : undefined
        );
        initialVersion.snapshotPath = snapDir;
      } catch (err: any) {
        logger.warn(`Could not create initial snapshot for ${safeId}: ${err.message}`);
      }
    }

    const metadata: ProjectMetadata = {
      id: safeId,
      name: options.name,
      originalUrl: options.originalUrl || '',
      projectPath: targetDir,
      previewUrl,
      createdAt: now,
      updatedAt: now,
      currentVersion: 1,
      versions: [initialVersion],
      status: options.status || 'passed',
    };

    this.projectsMap.set(safeId, metadata);
    this.saveRegistry();
    logger.info(`Registered project "${metadata.name}" (${metadata.id})`);

    return metadata;
  }

  /**
   * Updates an existing project's metadata.
   */
  public static updateProject(id: string, updates: UpdateProjectOptions): ProjectMetadata {
    if (!this.isInitialized) this.init();
    const validId = SnapshotManager.validateProjectId(id);
    const project = this.projectsMap.get(validId);

    if (!project) {
      throw new Error(`Project with ID "${validId}" does not exist`);
    }

    if (updates.name && typeof updates.name === 'string') {
      project.name = updates.name.trim();
    }

    if (updates.status) {
      project.status = updates.status;
    }

    if (updates.previewUrl) {
      project.previewUrl = updates.previewUrl;
    }

    project.updatedAt = Date.now();
    this.saveRegistry();
    logger.info(`Updated project "${project.id}"`);

    return project;
  }

  /**
   * Creates a new version after a successful modification.
   */
  public static createVersion(
    projectId: string,
    instruction: string,
    modifiedFiles: string[],
    validation: { success: boolean; diagnosticsCount?: number }
  ): ProjectVersion {
    if (!this.isInitialized) this.init();
    const validId = SnapshotManager.validateProjectId(projectId);
    const project = this.projectsMap.get(validId);

    if (!project) {
      throw new Error(`Project with ID "${validId}" does not exist`);
    }

    if (!validation.success) {
      throw new Error('Cannot create version for failed validation');
    }

    const lastVersionNumber = project.versions.length > 0
      ? Math.max(...project.versions.map((v) => v.version))
      : project.currentVersion;

    const nextVerNumber = lastVersionNumber + 1;

    // Create snapshot
    const snapshotPath = SnapshotManager.createSnapshot(
      validId,
      nextVerNumber,
      project.projectPath,
      instruction,
      modifiedFiles
    );

    const newVersion: ProjectVersion = {
      version: nextVerNumber,
      instruction,
      timestamp: Date.now(),
      modifiedFiles,
      validation: {
        success: true,
        diagnosticsCount: validation.diagnosticsCount || 0,
      },
      snapshotPath,
    };

    project.versions.push(newVersion);
    project.currentVersion = nextVerNumber;
    project.updatedAt = Date.now();
    project.status = 'passed';

    this.saveRegistry();
    logger.info(`Created version v${nextVerNumber} for project "${validId}": "${instruction}"`);

    return newVersion;
  }

  /**
   * Retrieves a project by its filesystem directory or folder name.
   */
  public static getProjectByPath(dirPath: string): ProjectMetadata | null {
    if (!this.isInitialized) this.init();
    const normalized = path.resolve(dirPath);
    for (const p of this.projectsMap.values()) {
      if (path.resolve(p.projectPath) === normalized) {
        return p;
      }
    }
    const folderName = path.basename(normalized);
    if (this.projectsMap.has(folderName)) {
      return this.projectsMap.get(folderName)!;
    }
    return null;
  }

  /**
   * Restores a specific version snapshot with Module 4 build validation and auto-rollback on failure.
   */
  public static async restoreVersion(projectId: string, targetVersion: number): Promise<RestoreVersionResult> {
    if (!this.isInitialized) this.init();
    const validId = SnapshotManager.validateProjectId(projectId);
    const validVer = SnapshotManager.validateVersion(targetVersion);

    const project = this.projectsMap.get(validId);
    if (!project) {
      throw new Error(`Project with ID "${validId}" does not exist`);
    }

    const versionRecord = project.versions.find((v) => v.version === validVer);
    if (!versionRecord) {
      throw new Error(`Version v${validVer} does not exist for project "${validId}"`);
    }

    const projectDir = project.projectPath;
    if (!fs.existsSync(projectDir)) {
      throw new Error(`Project directory does not exist on disk: "${projectDir}"`);
    }

    logger.info(`Starting restore of project "${validId}" to v${validVer}...`);

    // 1. Take a temporary pre-restore backup of project source files for rollback
    const tempBackupDir = path.resolve(
      __dirname,
      '../../../output/.temp_restore_backups',
      `backup_${validId}_${Date.now()}`
    );
    this.copyDirectoryRecursive(projectDir, tempBackupDir);

    try {
      // 2. Restore snapshot files
      SnapshotManager.restoreSnapshot(validId, validVer, projectDir);

      // 3. Run Module 4 build validation on the restored codebase
      logger.info(`Running Module 4 validation on restored project "${validId}"...`);
      const valResult = await validateAndHealProject(projectDir, {
        maxAttempts: 3,
      });

      if (!valResult.success) {
        logger.error(`Validation failed after restoring v${validVer} for project "${validId}". Initiating rollback...`);
        // Rollback from temporary backup
        this.copyDirectoryRecursive(tempBackupDir, projectDir);
        this.removeDirectoryRecursive(tempBackupDir);

        return {
          success: false,
          error: `Validation failed after restore: ${valResult.diagnostics[0]?.message || 'Build errors'}`,
          diagnostics: valResult.diagnostics,
        };
      }

      // 4. Validation PASSED: Clean up temp backup and update registry
      this.removeDirectoryRecursive(tempBackupDir);

      // Record a restore history version entry
      const lastVersionNumber = Math.max(...project.versions.map((v) => v.version));
      const nextVerNumber = lastVersionNumber + 1;

      const restoreEntry: ProjectVersion = {
        version: nextVerNumber,
        instruction: `Restored to v${validVer} (${versionRecord.instruction})`,
        timestamp: Date.now(),
        modifiedFiles: versionRecord.modifiedFiles,
        validation: {
          success: true,
          diagnosticsCount: 0,
        },
        snapshotPath: versionRecord.snapshotPath,
      };

      project.versions.push(restoreEntry);
      project.currentVersion = nextVerNumber;
      project.updatedAt = Date.now();
      project.status = 'passed';

      this.saveRegistry();
      logger.info(`Successfully restored project "${validId}" to v${validVer} (Recorded as v${nextVerNumber})`);

      return {
        success: true,
        project,
      };
    } catch (err: any) {
      // Rollback on unexpected runtime failure
      if (fs.existsSync(tempBackupDir)) {
        this.copyDirectoryRecursive(tempBackupDir, projectDir);
        this.removeDirectoryRecursive(tempBackupDir);
      }
      throw err;
    }
  }

  /**
   * Duplicates an existing project with an isolated directory, independent snapshots, and new registry entry.
   */
  public static duplicateProject(projectId: string, newName?: string): ProjectMetadata {
    if (!this.isInitialized) this.init();
    const validId = SnapshotManager.validateProjectId(projectId);
    const source = this.projectsMap.get(validId);

    if (!source) {
      throw new Error(`Project with ID "${validId}" does not exist`);
    }

    const copyName = newName || `${source.name} (Copy)`;
    const newId = `${validId}_copy_${Date.now().toString(36)}`;
    const newProjectDir = path.join(this.GENERATED_PROJECTS_DIR, newId);

    // 1. Copy source project directory (excluding node_modules)
    if (fs.existsSync(source.projectPath)) {
      this.copyDirectoryRecursive(source.projectPath, newProjectDir);
    } else {
      fs.mkdirSync(newProjectDir, { recursive: true });
    }

    // 2. Duplicate snapshot versions
    try {
      SnapshotManager.duplicateSnapshots(validId, newId);
    } catch (err: any) {
      logger.warn(`Could not duplicate snapshots for ${validId}: ${err.message}`);
    }

    // 3. Create independent project metadata
    const now = Date.now();
    const duplicated: ProjectMetadata = {
      id: newId,
      name: copyName,
      originalUrl: source.originalUrl,
      projectPath: newProjectDir,
      previewUrl: `/preview/${encodeURIComponent(newId)}/`,
      createdAt: now,
      updatedAt: now,
      currentVersion: source.currentVersion,
      versions: JSON.parse(JSON.stringify(source.versions)),
      status: source.status,
    };

    this.projectsMap.set(newId, duplicated);
    this.saveRegistry();
    logger.info(`Duplicated project "${validId}" to "${newId}"`);

    return duplicated;
  }

  /**
   * Safely deletes a project, its files, its snapshots, and its registry record.
   */
  public static deleteProject(projectId: string): { success: boolean; message: string } {
    if (!this.isInitialized) this.init();
    const validId = SnapshotManager.validateProjectId(projectId);
    const project = this.projectsMap.get(validId);

    const projectDir = project
      ? project.projectPath
      : path.join(this.GENERATED_PROJECTS_DIR, validId);

    // Security guard: verify target path is strictly within GENERATED_PROJECTS_DIR
    const resolved = path.resolve(projectDir);
    if (!resolved.startsWith(this.GENERATED_PROJECTS_DIR)) {
      throw new Error(`Security Error: Cannot delete project outside authorized directory: "${resolved}"`);
    }

    // 1. Delete project directory on disk
    if (fs.existsSync(resolved)) {
      this.removeDirectoryRecursive(resolved);
    }

    // 2. Delete project snapshots
    try {
      SnapshotManager.deleteSnapshots(validId);
    } catch (err: any) {
      logger.warn(`Could not delete snapshots for ${validId}: ${err.message}`);
    }

    // 3. Remove from registry
    this.projectsMap.delete(validId);
    this.saveRegistry();

    logger.info(`Deleted project "${validId}" and its files successfully`);
    return {
      success: true,
      message: `Project "${validId}" deleted successfully`,
    };
  }

  /**
   * Resolves safe project path and verifies directory containment.
   */
  public static resolveSafePath(userPath: string): string {
    if (!userPath || typeof userPath !== 'string') {
      throw new Error('Path must be a non-empty string');
    }

    const trimmed = userPath.trim();
    if (
      trimmed.includes('..') ||
      trimmed.includes('\0') ||
      trimmed.startsWith('/') ||
      /^[a-zA-Z]:[\\/]/.test(trimmed)
    ) {
      // If absolute, verify it's inside GENERATED_PROJECTS_DIR
      const resolved = path.resolve(trimmed);
      if (!resolved.startsWith(this.GENERATED_PROJECTS_DIR)) {
        throw new Error(`Security Error: Path escapes authorized generated projects directory: "${resolved}"`);
      }
      return resolved;
    }

    const resolved = path.resolve(this.GENERATED_PROJECTS_DIR, trimmed);
    if (!resolved.startsWith(this.GENERATED_PROJECTS_DIR)) {
      throw new Error(`Security Error: Path escapes authorized generated projects directory: "${resolved}"`);
    }
    return resolved;
  }

  /**
   * Helper to slugify a name into a safe identifier.
   */
  private static slugify(text: string): string {
    const slug = text
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, '_')
      .replace(/^_+|_+$/g, '');
    return slug || `project_${Date.now()}`;
  }

  /**
   * Helper to format a folder name into a human-readable title.
   */
  private static formatProjectName(folderName: string): string {
    return folderName
      .replace(/^(benchmark_|test_)/, '')
      .replace(/[_-]+/g, ' ')
      .replace(/\b\w/g, (c) => c.toUpperCase());
  }

  /**
   * Helper to recursively copy directories without node_modules.
   */
  private static copyDirectoryRecursive(src: string, dest: string): void {
    if (!fs.existsSync(src)) return;
    if (!fs.existsSync(dest)) {
      fs.mkdirSync(dest, { recursive: true });
    }

    const entries = fs.readdirSync(src, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.name === 'node_modules' || entry.name === '.git') continue;

      const srcPath = path.join(src, entry.name);
      const destPath = path.join(dest, entry.name);

      if (entry.isDirectory()) {
        this.copyDirectoryRecursive(srcPath, destPath);
      } else if (entry.isFile()) {
        fs.copyFileSync(srcPath, destPath);
      }
    }
  }

  /**
   * Helper to recursively delete directories.
   */
  private static removeDirectoryRecursive(dir: string): void {
    if (fs.existsSync(dir)) {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  }
}
