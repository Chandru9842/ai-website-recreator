import * as fs from 'fs';
import * as path from 'path';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { BuildDiagnostic, UISpecification } from '@ai-website-recreator/shared';
import { Logger } from '../utils/logger';

const logger = new Logger('AutoFixer');

export interface RepairResult {
  fixedFiles: string[];
  success: boolean;
  notes: string[];
}

/**
 * Auto-Healing Engine
 * Diagnoses build/compiler failures and applies targeted AI or deterministic fixes ONLY to affected files.
 */
export async function repairProjectFiles(
  projectDir: string,
  diagnostics: BuildDiagnostic[],
  spec?: UISpecification
): Promise<RepairResult> {
  const fixedFiles: string[] = [];
  const notes: string[] = [];

  // 1. Group diagnostics by affected file
  const fileDiagnosticsMap = new Map<string, BuildDiagnostic[]>();

  for (const diag of diagnostics) {
    let targetFile = diag.file;

    // If file is not parsed directly, inspect message or raw output for file references
    if (!targetFile) {
      const match = (diag.raw || diag.message).match(/(src\/[a-zA-Z0-9_\-\.\/]+\.(?:tsx|ts|jsx|js|html|css))/);
      if (match) {
        targetFile = match[1];
      }
    }

    if (targetFile) {
      const cleanPath = targetFile.replace(/\\/g, '/');
      const list = fileDiagnosticsMap.get(cleanPath) || [];
      list.push(diag);
      fileDiagnosticsMap.set(cleanPath, list);
    }
  }

  if (fileDiagnosticsMap.size === 0) {
    logger.warn('No specific files identified from diagnostics to heal.');
    return { fixedFiles: [], success: false, notes: ['No specific files identified from diagnostics.'] };
  }

  // 2. Process each affected file
  for (const [relativePath, fileDiags] of fileDiagnosticsMap.entries()) {
    const absolutePath = path.resolve(projectDir, relativePath);

    if (!fs.existsSync(absolutePath)) {
      logger.warn(`Target file to heal not found on disk: ${absolutePath}`);
      continue;
    }

    const originalCode = fs.readFileSync(absolutePath, 'utf-8');
    logger.info(`Attempting auto-repair for: ${relativePath} (${fileDiags.length} diagnostics)...`);

    let repairedCode: string | null = null;

    // Strategy A: AI Fix (if GEMINI_API_KEY is available)
    if (process.env.GEMINI_API_KEY) {
      repairedCode = await attemptAIFix(relativePath, originalCode, fileDiags, spec);
    }

    // Strategy B: Deterministic High-Precision Rule Repair (offline / fallback / instant)
    if (!repairedCode || repairedCode.trim() === originalCode.trim()) {
      repairedCode = applyDeterministicFix(relativePath, originalCode, fileDiags);
    }

    // If code was repaired and changed, write to disk
    if (repairedCode && repairedCode.trim() !== originalCode.trim()) {
      fs.writeFileSync(absolutePath, repairedCode, 'utf-8');
      fixedFiles.push(relativePath);
      notes.push(`Repaired ${relativePath} (${fileDiags.map((d) => d.errorType).join(', ')})`);
      logger.info(`Successfully wrote auto-repaired code to: ${relativePath}`);
    } else {
      logger.warn(`Could not determine repair for: ${relativePath}`);
    }
  }

  return {
    fixedFiles,
    success: fixedFiles.length > 0,
    notes,
  };
}

/**
 * Invokes Gemini AI to perform a targeted, surgical repair of a single affected file.
 */
async function attemptAIFix(
  filePath: string,
  code: string,
  diagnostics: BuildDiagnostic[],
  spec?: UISpecification
): Promise<string | null> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return null;

  try {
    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({
      model: process.env.GEMINI_MODEL || 'gemini-1.5-flash',
      generationConfig: {
        temperature: 0.1,
      },
    });

    const prompt = `You are an expert React + TypeScript + Tailwind compiler repair specialist.
A generated React website project failed compilation or bundling.

Target File: ${filePath}

Structured Compiler Diagnostics for this file:
${JSON.stringify(
  diagnostics.map((d) => ({
    line: d.line,
    column: d.column,
    errorType: d.errorType,
    message: d.message,
  })),
  null,
  2
)}

Current File Code:
\`\`\`tsx
${code}
\`\`\`

${spec ? `Project Title: "${spec.metadata.title}"` : ''}

STRICT INSTRUCTIONS:
1. Fix ONLY the compiler/syntax/type/import errors identified in the diagnostics.
2. Preserve the UISpecification, visual structure, Tailwind classes, and textual content.
3. Do NOT redesign the website.
4. Do NOT add unrelated sections.
5. Do NOT replace real assets with placeholders.
6. Do NOT invent new dependencies outside React, TypeScript, Lucide-react, and Tailwind.
7. Return ONLY the complete corrected file contents wrapped in a single \`\`\`tsx ... \`\`\` code block.`;

    const result = await model.generateContent(prompt);
    const responseText = result.response.text();

    const codeBlockMatch = responseText.match(/```(?:tsx|typescript|jsx|javascript)?\s*([\s\S]*?)```/);
    if (codeBlockMatch && codeBlockMatch[1].trim()) {
      return codeBlockMatch[1].trim();
    }
    return null;
  } catch (error: any) {
    logger.warn(`AI repair call failed for ${filePath}: ${error.message}. Falling back to deterministic fixer.`);
    return null;
  }
}

/**
 * High-Precision Deterministic Rule Repair
 * Fixes missing imports, JSX syntax errors, and TypeScript type mismatches deterministically.
 */
export function applyDeterministicFix(
  filePath: string,
  code: string,
  diagnostics: BuildDiagnostic[]
): string {
  let modified = code;

  for (const diag of diagnostics) {
    const msg = diag.message.toLowerCase();

    // 1. Missing Imports
    if (diag.errorType === 'import' || msg.includes('cannot find name') || msg.includes('failed to resolve import')) {
      const isSection = filePath.includes('sections/');
      const componentPrefix = isSection ? '../components/' : './components/';

      // Button
      if (msg.includes("'button'") || msg.includes('"button"')) {
        if (!modified.includes('Button')) {
          // not found
        } else if (!modified.includes(`from '${componentPrefix}Button'`) && !modified.includes(`from "${componentPrefix}Button"`)) {
          modified = `import { Button } from '${componentPrefix}Button';\n${modified}`;
        }
      }

      // Card
      if (msg.includes("'card'") || msg.includes('"card"')) {
        if (!modified.includes(`from '${componentPrefix}Card'`) && !modified.includes(`from "${componentPrefix}Card"`)) {
          modified = `import { Card } from '${componentPrefix}Card';\n${modified}`;
        }
      }

      // MediaAsset
      if (msg.includes("'mediaasset'") || msg.includes('"mediaasset"')) {
        if (!modified.includes(`from '${componentPrefix}MediaAsset'`) && !modified.includes(`from "${componentPrefix}MediaAsset"`)) {
          modified = `import { MediaAsset } from '${componentPrefix}MediaAsset';\n${modified}`;
        }
      }

      // React / useState / useEffect
      if (msg.includes("'react'") || msg.includes("'usestate'") || msg.includes("'useeffect'")) {
        if (!modified.includes("import React") && !modified.includes("from 'react'")) {
          modified = `import React, { useState, useEffect } from 'react';\n${modified}`;
        } else if (msg.includes('usestate') && !modified.includes('useState')) {
          modified = modified.replace(/import React/g, 'import React, { useState }');
        }
      }
    }

    // 2. JSX Syntax Errors
    if (diag.errorType === 'syntax') {
      if (msg.includes('unterminated') || msg.includes('expected') || msg.includes('jsx') || msg.includes('closing tag')) {
        const commonTags = ['span', 'div', 'p', 'h1', 'h2', 'h3', 'button', 'a', 'strong', 'em'];
        for (const tag of commonTags) {
          const openCount = (modified.match(new RegExp(`<${tag}[\\s>]`, 'g')) || []).length;
          const closeCount = (modified.match(new RegExp(`</${tag}>`, 'g')) || []).length;
          if (openCount > closeCount) {
            // Case A: Mismatched tag: <span ...>text</div> -> <span ...>text</span>
            const mismatchRegex = new RegExp(`(<${tag}[^>]*>[^<]*)<\\/(?!${tag})[a-zA-Z0-9]+>`, 'm');
            if (mismatchRegex.test(modified)) {
              modified = modified.replace(mismatchRegex, `$1</${tag}>`);
              continue;
            }

            // Case B: Missing closing tag before the next open tag: <span ...>text\n<h1 -> <span ...>text</span>\n<h1
            const missingBeforeNextTag = new RegExp(`(<${tag}[^>]*>[^<]+)(\\s*<[a-zA-Z0-9]+)`, 'm');
            if (missingBeforeNextTag.test(modified)) {
              modified = modified.replace(missingBeforeNextTag, `$1</${tag}>$2`);
              continue;
            }

            // Case C: Append closing tag before closing return div
            modified = modified.replace(/(\s*<\/div>\s*\)\s*;?\s*\}\s*)$/, `\n        </${tag}>$1`);
          }
        }

        // Unclosed curly braces
        const openBraces = (modified.match(/\{/g) || []).length;
        const closeBraces = (modified.match(/\}/g) || []).length;
        if (openBraces > closeBraces) {
          modified += '\n' + '}'.repeat(openBraces - closeBraces);
        }
        // Unclosed parentheses
        const openParens = (modified.match(/\(/g) || []).length;
        const closeParens = (modified.match(/\)/g) || []).length;
        if (openParens > closeParens) {
          modified += '\n' + ')'.repeat(openParens - closeParens) + ';';
        }
      }
    }

    // 3. TypeScript Type Errors
    if (diag.errorType === 'type') {
      if (diag.line && diag.line <= modified.split(/\r?\n/).length) {
        const lines = modified.split(/\r?\n/);
        const lineIdx = diag.line - 1;
        const targetLine = lines[lineIdx];

        if (msg.includes('not assignable to type') || msg.includes('does not exist on type')) {
          if (targetLine.includes(': number = "') || targetLine.includes(': number = \'')) {
            lines[lineIdx] = targetLine.replace(/:\s*number\s*=\s*["'](\d+)["']/g, ': number = $1');
          } else if (targetLine.includes('="') && msg.includes('number')) {
            lines[lineIdx] = targetLine.replace(/="(\d+)"/g, '={$1}');
          } else if (targetLine.includes(': number =')) {
            lines[lineIdx] = targetLine.replace(/:\s*number\s*=\s*([^;]+)/, ': any = $1');
          } else if (!targetLine.includes('as any')) {
            lines[lineIdx] = targetLine.replace(/([a-zA-Z0-9_]+)(\s*[,;)])/g, '$1 as any$2');
          }
          modified = lines.join('\n');
        }
      }
    }
  }

  return modified;
}
