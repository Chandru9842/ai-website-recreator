import * as fs from 'fs';
import * as path from 'path';
import { SnapshotManifest } from './types';
import { Logger } from '../utils/logger';

const logger = new Logger('SnapshotManager');

export class SnapshotManager {
  private static readonly SNAPSHOT_ROOT = path.resolve(__dirname, '../../../output/project_versions');

  /**
   * Validates project ID against traversal attacks, special characters, and system paths.
   */
  public static validateProjectId(projectId: string): string {
    if (!projectId || typeof projectId !== 'string') {
      throw new Error('Project ID is required and must be a string');
    }

    const trimmed = projectId.trim();
    if (
      trimmed.includes('..') ||
      trimmed.includes('/') ||
      trimmed.includes('\\') ||
      trimmed.includes('\0') ||
      trimmed.includes(':') ||
      trimmed === '.env' ||
      trimmed === '.git' ||
      trimmed === 'package-lock.json'
    ) {
      throw new Error(`Security Error: Invalid project ID contains forbidden traversal or system characters: "${trimmed}"`);
    }

    if (!/^[a-zA-Z0-9_\-]+$/.test(trimmed)) {
      throw new Error(`Security Error: Project ID must only contain alphanumeric characters, underscores, and hyphens: "${trimmed}"`);
    }

    return trimmed;
  }

  /**
   * Validates version number.
   */
  public static validateVersion(version: number): number {
    if (typeof version !== 'number' || !Number.isInteger(version) || version < 1) {
      throw new Error(`Invalid version number: "${version}". Version must be a positive integer.`);
    }
    return version;
  }

  /**
   * Resolves safe snapshot directory path.
   */
  public static getSnapshotDir(projectId: string, version: number): string {
    const validId = this.validateProjectId(projectId);
    const validVer = this.validateVersion(version);
    const snapshotDir = path.join(this.SNAPSHOT_ROOT, validId, `v${validVer}`);

    // Verify directory containment
    const resolved = path.resolve(snapshotDir);
    if (!resolved.startsWith(this.SNAPSHOT_ROOT)) {
      throw new Error(`Security Error: Snapshot path escapes authorized snapshot root: "${resolved}"`);
    }

    return resolved;
  }

  /**
   * Captures a snapshot of the project for a specific version.
   */
  public static createSnapshot(
    projectId: string,
    version: number,
    projectDir: string,
    instruction: string,
    modifiedFiles?: string[]
  ): string {
    const snapshotDir = this.getSnapshotDir(projectId, version);

    if (!fs.existsSync(snapshotDir)) {
      fs.mkdirSync(snapshotDir, { recursive: true });
    }

    const recordedFiles: string[] = [];
    const filesToCopy = this.determineFilesToSnapshot(projectDir, modifiedFiles);

    for (const relFile of filesToCopy) {
      const srcPath = path.join(projectDir, relFile);
      const destPath = path.join(snapshotDir, relFile);

      if (fs.existsSync(srcPath) && fs.statSync(srcPath).isFile()) {
        const destDir = path.dirname(destPath);
        if (!fs.existsSync(destDir)) {
          fs.mkdirSync(destDir, { recursive: true });
        }
        fs.copyFileSync(srcPath, destPath);
        recordedFiles.push(relFile);
      }
    }

    // Save manifest
    const manifest: SnapshotManifest = {
      projectId,
      version,
      instruction,
      timestamp: Date.now(),
      files: recordedFiles,
    };

    fs.writeFileSync(path.join(snapshotDir, 'manifest.json'), JSON.stringify(manifest, null, 2), 'utf-8');
    logger.info(`Created snapshot v${version} for project "${projectId}" (${recordedFiles.length} files saved)`);

    return snapshotDir;
  }

  /**
   * Restores snapshot files back into the project directory.
   */
  public static restoreSnapshot(projectId: string, version: number, projectDir: string): string[] {
    const snapshotDir = this.getSnapshotDir(projectId, version);

    if (!fs.existsSync(snapshotDir)) {
      throw new Error(`Snapshot v${version} does not exist for project "${projectId}"`);
    }

    const restoredFiles: string[] = [];
    const snapshotFiles = this.getAllFilesRecursive(snapshotDir);

    for (const fullPath of snapshotFiles) {
      const relPath = path.relative(snapshotDir, fullPath).replace(/\\/g, '/');
      if (relPath === 'manifest.json') continue; // Skip metadata manifest

      const targetPath = path.join(projectDir, relPath);
      const targetDir = path.dirname(targetPath);

      if (!fs.existsSync(targetDir)) {
        fs.mkdirSync(targetDir, { recursive: true });
      }

      fs.copyFileSync(fullPath, targetPath);
      restoredFiles.push(relPath);
    }

    logger.info(`Restored snapshot v${version} to project "${projectId}" (${restoredFiles.length} files restored)`);
    return restoredFiles;
  }

  /**
   * Duplicates all snapshots from a source project to a new project.
   */
  public static duplicateSnapshots(sourceProjectId: string, newProjectId: string): void {
    const srcId = this.validateProjectId(sourceProjectId);
    const destId = this.validateProjectId(newProjectId);

    const srcDir = path.join(this.SNAPSHOT_ROOT, srcId);
    const destDir = path.join(this.SNAPSHOT_ROOT, destId);

    if (fs.existsSync(srcDir)) {
      this.copyDirectoryRecursive(srcDir, destDir);
      logger.info(`Duplicated snapshots from "${srcId}" to "${destId}"`);
    }
  }

  /**
   * Deletes all snapshots for a project.
   */
  public static deleteSnapshots(projectId: string): void {
    const validId = this.validateProjectId(projectId);
    const projectSnapshotDir = path.join(this.SNAPSHOT_ROOT, validId);

    if (fs.existsSync(projectSnapshotDir)) {
      fs.rmSync(projectSnapshotDir, { recursive: true, force: true });
      logger.info(`Deleted snapshot directory for project "${validId}"`);
    }
  }

  /**
   * Determines which files should be included in the snapshot.
   */
  private static determineFilesToSnapshot(projectDir: string, specificFiles?: string[]): string[] {
    const allProjectFiles = this.getAllFilesRecursive(projectDir).map((f) =>
      path.relative(projectDir, f).replace(/\\/g, '/')
    );

    // Filter out node_modules, dist, git, and logs
    const safeProjectFiles = allProjectFiles.filter(
      (f) =>
        !f.startsWith('node_modules/') &&
        !f.startsWith('dist/') &&
        !f.startsWith('.git/') &&
        !f.startsWith('.cache/') &&
        !f.endsWith('.log') &&
        !f.endsWith('.lock')
    );

    if (!specificFiles || specificFiles.length === 0) {
      return safeProjectFiles;
    }

    // Always include specific files plus core configuration and source entry files
    const coreConfigs = ['package.json', 'tsconfig.json', 'vite.config.ts', 'tailwind.config.js', 'index.html'];
    const resultSet = new Set<string>();

    for (const file of specificFiles) {
      resultSet.add(file.replace(/\\/g, '/'));
    }

    for (const core of coreConfigs) {
      if (fs.existsSync(path.join(projectDir, core))) {
        resultSet.add(core);
      }
    }

    // Also include all files in src/ to ensure full source state integrity
    for (const f of safeProjectFiles) {
      if (f.startsWith('src/')) {
        resultSet.add(f);
      }
    }

    return Array.from(resultSet);
  }

  /**
   * Recursively retrieves all files inside a directory.
   */
  private static getAllFilesRecursive(dir: string): string[] {
    if (!fs.existsSync(dir)) return [];
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    const files: string[] = [];

    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        if (entry.name !== 'node_modules' && entry.name !== '.git' && entry.name !== 'dist') {
          files.push(...this.getAllFilesRecursive(fullPath));
        }
      } else if (entry.isFile()) {
        files.push(fullPath);
      }
    }

    return files;
  }

  /**
   * Recursively copies a directory to a new destination.
   */
  private static copyDirectoryRecursive(src: string, dest: string): void {
    if (!fs.existsSync(dest)) {
      fs.mkdirSync(dest, { recursive: true });
    }

    const entries = fs.readdirSync(src, { withFileTypes: true });
    for (const entry of entries) {
      const srcPath = path.join(src, entry.name);
      const destPath = path.join(dest, entry.name);

      if (entry.isDirectory()) {
        this.copyDirectoryRecursive(srcPath, destPath);
      } else if (entry.isFile()) {
        fs.copyFileSync(srcPath, destPath);
      }
    }
  }
}
