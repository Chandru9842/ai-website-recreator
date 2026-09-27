import { BuildDiagnostic, DiagnosticErrorType } from '@ai-website-recreator/shared';

/**
 * Normalizes file path to forward slashes and extracts relative project path (e.g. "src/App.tsx")
 */
function normalizePath(rawPath: string): string {
  let cleaned = rawPath.replace(/\\/g, '/').trim();
  // Strip quotes if present
  cleaned = cleaned.replace(/^["']|["']$/g, '');

  const srcIndex = cleaned.lastIndexOf('src/');
  if (srcIndex !== -1) {
    return cleaned.substring(srcIndex);
  }
  return cleaned;
}

/**
 * Parses raw compiler & bundler output from tsc and vite into structured diagnostics.
 * Conforms to:
 * {
 *   file?: string,
 *   line?: number,
 *   column?: number,
 *   errorType: 'syntax' | 'import' | 'type' | 'build' | 'unknown',
 *   message: string,
 *   severity: 'error' | 'warning'
 * }
 */
export function parseBuildDiagnostics(rawOutput: string): BuildDiagnostic[] {
  if (!rawOutput || rawOutput.trim().length === 0) {
    return [];
  }

  const diagnostics: BuildDiagnostic[] = [];
  const lines = rawOutput.split(/\r?\n/);

  // 1. TypeScript tsc error pattern:
  // e.g., src/sections/HeroSection.tsx(14,25): error TS2304: Cannot find name 'Button'.
  // or C:/path/to/src/App.tsx(10,5): error TS2322: Type 'string' is not assignable to type 'number'.
  const tscRegex = /^([^(]+)\((\d+),(\d+)\):\s+(error|warning)\s+(TS\d+):\s+(.+)$/;

  // 2. Vite / Rollup parse / syntax error pattern:
  // e.g., [vite]: Rollup failed to resolve import "xyz" from "src/App.tsx".
  const viteResolveRegex = /Rollup failed to resolve import "([^"]+)" from "([^"]+)"/;

  // 3. Rollup syntax error pattern:
  // e.g., Parse failure: Unexpected token ... (12:4) in src/App.tsx
  const viteSyntaxRegex = /Parse failure:\s*(.+?)(?:\s*\((\d+):(\d+)\))?(?:\s*in\s*([^\s]+))?$/;

  // 4. Vite JSX / ESBuild / Babel error pattern:
  // e.g., [plugin:vite:react-babel] C:/path/src/App.tsx: Unterminated JSX contents. (12:4)
  // or [plugin:vite:react-babel] Unexpected token, expected ... (12:4)
  const esbuildSyntaxRegex = /\[plugin:vite:[^\]]+\]\s*(?:([^\s:]+\.(?:tsx|ts|jsx|js)):\s*)?(.+?)(?:\s*\((\d+):(\d+)\))?$/;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    // Check TypeScript error
    const tscMatch = line.match(tscRegex);
    if (tscMatch) {
      const [, filePath, lineStr, colStr, severity, tsCode, message] = tscMatch;
      const codeNum = tsCode.toUpperCase();

      let errorType: DiagnosticErrorType = 'type';
      if (
        codeNum === 'TS2304' ||
        codeNum === 'TS2307' ||
        message.toLowerCase().includes('cannot find name') ||
        message.toLowerCase().includes('cannot find module')
      ) {
        errorType = 'import';
      } else if (
        codeNum === 'TS1005' ||
        codeNum === 'TS1109' ||
        codeNum === 'TS1128' ||
        codeNum === 'TS17004' ||
        message.toLowerCase().includes('expected') ||
        message.toLowerCase().includes('jsx') ||
        message.toLowerCase().includes('unterminated')
      ) {
        errorType = 'syntax';
      }

      diagnostics.push({
        file: normalizePath(filePath),
        line: parseInt(lineStr, 10),
        column: parseInt(colStr, 10),
        errorType,
        message: message.trim(),
        severity: severity.toLowerCase() === 'warning' ? 'warning' : 'error',
        raw: line,
      });
      continue;
    }

    // Check Vite unresolved import
    const viteResolveMatch = line.match(viteResolveRegex);
    if (viteResolveMatch) {
      const [, importedName, fromFile] = viteResolveMatch;
      diagnostics.push({
        file: normalizePath(fromFile),
        errorType: 'import',
        message: `Failed to resolve import "${importedName}"`,
        severity: 'error',
        raw: line,
      });
      continue;
    }

    // Check Vite syntax / parse error
    const viteSyntaxMatch = line.match(viteSyntaxRegex);
    if (viteSyntaxMatch) {
      const [, message, lineStr, colStr, filePath] = viteSyntaxMatch;
      diagnostics.push({
        file: filePath ? normalizePath(filePath) : undefined,
        line: lineStr ? parseInt(lineStr, 10) : undefined,
        column: colStr ? parseInt(colStr, 10) : undefined,
        errorType: 'syntax',
        message: message.trim(),
        severity: 'error',
        raw: line,
      });
      continue;
    }

    // Check ESBuild / Babel syntax error
    const esbuildMatch = line.match(esbuildSyntaxRegex);
    if (esbuildMatch) {
      const [, inlineFile, message, lineStr, colStr] = esbuildMatch;
      let detectedFile = inlineFile ? normalizePath(inlineFile) : undefined;

      // If no inline file, search neighboring lines
      if (!detectedFile) {
        for (let j = Math.max(0, i - 2); j <= Math.min(lines.length - 1, i + 2); j++) {
          const fileMatch = lines[j].match(/([a-zA-Z0-9_\-\.\/\\:]+\.(?:tsx|ts|jsx|js))/);
          if (fileMatch) {
            detectedFile = normalizePath(fileMatch[1]);
            break;
          }
        }
      }

      diagnostics.push({
        file: detectedFile,
        line: lineStr ? parseInt(lineStr, 10) : undefined,
        column: colStr ? parseInt(colStr, 10) : undefined,
        errorType: 'syntax',
        message: message.trim(),
        severity: 'error',
        raw: line,
      });
      continue;
    }

    // Check general compilation failure
    if (line.includes('error TS') || line.includes('SyntaxError') || line.includes('ReferenceError')) {
      diagnostics.push({
        errorType: line.includes('SyntaxError') ? 'syntax' : 'build',
        message: line,
        severity: 'error',
        raw: line,
      });
    }
  }

  // Deduplicate diagnostics by file + line + message
  const uniqueDiagnostics: BuildDiagnostic[] = [];
  const seen = new Set<string>();

  for (const d of diagnostics) {
    const key = `${d.file || ''}:${d.line || 0}:${d.errorType}:${d.message}`;
    if (!seen.has(key)) {
      seen.add(key);
      uniqueDiagnostics.push(d);
    }
  }

  return uniqueDiagnostics;
}
