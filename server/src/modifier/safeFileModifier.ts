import * as path from 'path';
import * as fs from 'fs';
import { Logger } from '../utils/logger';

const logger = new Logger('SafeFileModifier');

export class SafeFileModifier {
  /**
   * Resolves and verifies that a target relative path is safely enclosed within projectDir.
   * Throws an error if any traversal, absolute path, or jailbreak attempt is detected.
   */
  public static resolveSafePath(projectDir: string, relativePath: string): string {
    if (!relativePath || typeof relativePath !== 'string') {
      throw new Error('Security Error: Invalid or empty file path.');
    }

    const cleanPath = relativePath.trim().replace(/\\/g, '/');

    // 1. Reject absolute paths
    if (path.isAbsolute(cleanPath) || /^[a-zA-Z]:/.test(cleanPath) || cleanPath.startsWith('/')) {
      throw new Error(`Security Error: Absolute path modification is strictly prohibited: "${relativePath}"`);
    }

    // 2. Reject path traversal
    const segments = cleanPath.split('/');
    if (segments.includes('..') || cleanPath.includes('../') || cleanPath.includes('..\\')) {
      throw new Error(`Security Error: Directory traversal ("..") is strictly prohibited: "${relativePath}"`);
    }

    // 3. Reject sensitive or hidden files
    const filename = path.basename(cleanPath);
    if (filename.startsWith('.env') || filename === '.git' || filename === 'package-lock.json') {
      throw new Error(`Security Error: Modification of sensitive system file is prohibited: "${filename}"`);
    }

    const resolvedProjectDir = path.resolve(projectDir);
    const resolvedTargetPath = path.resolve(resolvedProjectDir, cleanPath);

    // 4. Ensure resolved path is strictly within projectDir
    const relativeToRoot = path.relative(resolvedProjectDir, resolvedTargetPath);
    if (relativeToRoot.startsWith('..') || path.isAbsolute(relativeToRoot)) {
      throw new Error(`Security Error: Path escapes the project directory boundary: "${relativePath}"`);
    }

    return resolvedTargetPath;
  }

  /**
   * Safely reads a file from within the project directory.
   */
  public static safeReadFile(projectDir: string, relativePath: string): string {
    const safePath = this.resolveSafePath(projectDir, relativePath);
    if (!fs.existsSync(safePath)) {
      throw new Error(`File does not exist: "${relativePath}"`);
    }
    return fs.readFileSync(safePath, 'utf-8');
  }

  /**
   * Safely writes or overwrites a file inside the project directory.
   */
  public static safeWriteFile(projectDir: string, relativePath: string, content: string): void {
    const safePath = this.resolveSafePath(projectDir, relativePath);
    const parentDir = path.dirname(safePath);
    if (!fs.existsSync(parentDir)) {
      fs.mkdirSync(parentDir, { recursive: true });
    }
    fs.writeFileSync(safePath, content, 'utf-8');
    logger.info(`Safely wrote file: ${relativePath}`);
  }

  /**
   * Safely deletes a file inside the project directory.
   */
  public static safeDeleteFile(projectDir: string, relativePath: string): void {
    const safePath = this.resolveSafePath(projectDir, relativePath);
    if (fs.existsSync(safePath)) {
      fs.unlinkSync(safePath);
      logger.info(`Safely deleted file: ${relativePath}`);
    }
  }

  /**
   * Safely checks if a file exists within the project directory.
   */
  public static safeFileExists(projectDir: string, relativePath: string): boolean {
    try {
      const safePath = this.resolveSafePath(projectDir, relativePath);
      return fs.existsSync(safePath);
    } catch {
      return false;
    }
  }

  /**
   * Recursively scans and lists all relevant source and config files in the project.
   */
  public static listProjectFiles(projectDir: string): string[] {
    const resolvedProjectDir = path.resolve(projectDir);
    const fileList: string[] = [];

    const walk = (currentDir: string) => {
      const entries = fs.readdirSync(currentDir, { withFileTypes: true });
      for (const entry of entries) {
        const fullPath = path.join(currentDir, entry.name);
        const relPath = path.relative(resolvedProjectDir, fullPath).replace(/\\/g, '/');

        // Skip node_modules, dist, hidden files
        if (entry.name === 'node_modules' || entry.name === 'dist' || entry.name.startsWith('.')) {
          continue;
        }

        if (entry.isDirectory()) {
          walk(fullPath);
        } else if (
          entry.name.endsWith('.tsx') ||
          entry.name.endsWith('.ts') ||
          entry.name.endsWith('.jsx') ||
          entry.name.endsWith('.js') ||
          entry.name.endsWith('.html') ||
          entry.name.endsWith('.css')
        ) {
          fileList.push(relPath);
        }
      }
    };

    if (fs.existsSync(resolvedProjectDir)) {
      walk(resolvedProjectDir);
    }

    return fileList;
  }
}
