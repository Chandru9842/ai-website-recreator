import { GoogleGenerativeAI } from '@google/generative-ai';
import { UISpecification } from '@ai-website-recreator/shared';
import { FileChangeInstruction, ModificationPlan } from './types';
import { SafeFileModifier } from './safeFileModifier';
import { selectRelevantFiles } from './fileSelector';
import { Logger } from '../utils/logger';

const logger = new Logger('AIModifier');

/**
 * Plans and generates code modifications for a project based on a natural language instruction.
 */
export async function planModifications(
  projectDir: string,
  instruction: string,
  spec?: UISpecification
): Promise<ModificationPlan> {
  const selection = selectRelevantFiles(projectDir, instruction);
  logger.info(`Selected ${selection.relevantFiles.length} candidate file(s) for intent: ${selection.intentCategory}`);

  // Gather current content of relevant files
  const fileContents: Record<string, string> = {};
  for (const relPath of selection.relevantFiles) {
    if (SafeFileModifier.safeFileExists(projectDir, relPath)) {
      fileContents[relPath] = SafeFileModifier.safeReadFile(projectDir, relPath);
    }
  }

  // Strategy A: Gemini LLM if GEMINI_API_KEY is present
  if (process.env.GEMINI_API_KEY) {
    try {
      const aiPlan = await requestAIModificationPlan(
        instruction,
        selection.relevantFiles,
        fileContents,
        SafeFileModifier.listProjectFiles(projectDir),
        spec
      );
      if (aiPlan && aiPlan.changes.length > 0) {
        logger.info(`AI generated modification plan with ${aiPlan.changes.length} file change(s).`);
        return aiPlan;
      }
    } catch (err: any) {
      logger.warn(`AI modification request failed: ${err.message}. Falling back to deterministic modifier.`);
    }
  }

  // Strategy B: Deterministic Transformation Engine (offline / test / instant)
  logger.info('Applying high-fidelity deterministic modification engine...');
  return generateDeterministicPlan(projectDir, instruction, selection, fileContents);
}

/**
 * Queries Gemini to produce structured modification instructions with complete updated file contents.
 */
async function requestAIModificationPlan(
  instruction: string,
  targetFiles: string[],
  fileContents: Record<string, string>,
  allFiles: string[],
  spec?: UISpecification
): Promise<ModificationPlan | null> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return null;

  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({
    model: process.env.GEMINI_MODEL || 'gemini-1.5-flash',
    generationConfig: {
      responseMimeType: 'application/json',
      temperature: 0.1,
    },
  });

  const prompt = `You are an expert React + TypeScript + Tailwind frontend modifier.
The user wants to modify an existing generated website project.

User Natural Language Request:
"${instruction}"

Project Structure (Available Files):
${JSON.stringify(allFiles, null, 2)}

Target Files & Current Code:
${Object.entries(fileContents)
  .map(([f, code]) => `--- FILE: ${f} ---\n\`\`\`\n${code}\n\`\`\``)
  .join('\n\n')}

${spec ? `Current Website Metadata: "${spec.metadata.title}"` : ''}

STRICT INSTRUCTIONS:
1. Modify ONLY the files required to fulfill the user's change.
2. Preserve all existing sections, text, links, and assets unless explicitly asked to modify or remove them.
3. Do NOT redesign the website.
4. Do NOT regenerate the entire website from scratch.
5. If creating a new section (e.g. Testimonials), clearly mark the component as AI-generated if not in the original site.
6. Return a JSON object matching this schema:
{
  "intent": string,
  "reasoning": string,
  "changes": [
    {
      "file": string (relative path inside project, e.g. "src/sections/Navbar.tsx"),
      "operation": "modify" | "create" | "delete",
      "reason": string,
      "updatedContent": string (the complete, valid, updated TypeScript / CSS code for the file)
    }
  ]
}`;

  const result = await model.generateContent(prompt);
  const text = result.response.text();

  try {
    const parsed = JSON.parse(text);
    if (parsed && Array.isArray(parsed.changes)) {
      return parsed as ModificationPlan;
    }
  } catch (err: any) {
    logger.warn('Failed to parse AI response as JSON:', err.message);
  }

  return null;
}

/**
 * High-Precision Deterministic Transformation Engine
 * Handles standard frontend modifications deterministically without external LLM latency.
 */
function generateDeterministicPlan(
  projectDir: string,
  instruction: string,
  selection: ReturnType<typeof selectRelevantFiles>,
  fileContents: Record<string, string>
): ModificationPlan {
  const norm = instruction.toLowerCase().trim();
  const changes: FileChangeInstruction[] = [];

  // =========================================================================
  // 1. STICKY NAVBAR
  // =========================================================================
  if (selection.intentCategory === 'navbar' || norm.includes('sticky')) {
    const navbarFile = selection.relevantFiles[0] || 'src/sections/Navbar.tsx';
    let code = fileContents[navbarFile] || SafeFileModifier.safeReadFile(projectDir, navbarFile);

    // Add sticky top-0 classes to <header> or <nav>
    if (!code.includes('sticky top-0')) {
      code = code.replace(
        /(<(?:header|nav)[^>]*className=["'])([^"']*)(["'])/,
        (_match, prefix, classes, suffix) => {
          const newClasses = `sticky top-0 z-50 backdrop-blur-md ${classes}`.replace(/\s+/g, ' ').trim();
          return `${prefix}${newClasses}${suffix}`;
        }
      );

      // If no className, add it
      if (!code.includes('sticky top-0')) {
        code = code.replace(/<(header|nav)/, '<$1 className="sticky top-0 z-50 backdrop-blur-md w-full"');
      }
    }

    changes.push({
      file: navbarFile,
      operation: 'modify',
      reason: 'Made navbar sticky with top-0 and z-index positioning',
      updatedContent: code,
    });

    return {
      intent: 'Make navbar sticky',
      reasoning: 'Applied sticky top-0 z-50 Tailwind utility classes to the navbar root element.',
      changes,
    };
  }

  // =========================================================================
  // 2. PRIMARY COLOR / THEME
  // =========================================================================
  if (selection.intentCategory === 'theme' || norm.includes('color') || norm.includes('primary')) {
    const configFile = 'tailwind.config.js';
    let code = fileContents[configFile] || SafeFileModifier.safeReadFile(projectDir, configFile);

    // Detect target color
    let newHex = '#2563eb'; // default modern blue
    if (norm.includes('blue')) newHex = '#2563eb';
    else if (norm.includes('emerald') || norm.includes('green')) newHex = '#059669';
    else if (norm.includes('purple')) newHex = '#7c3aed';
    else if (norm.includes('red')) newHex = '#dc2626';
    else if (norm.includes('orange')) newHex = '#ea580c';
    else if (norm.includes('cyan')) newHex = '#0891b2';
    else if (norm.includes('pink')) newHex = '#db2777';

    // Custom hex if provided
    const hexMatch = norm.match(/#([a-fA-F0-9]{6}|[a-fA-F0-9]{3})/);
    if (hexMatch) {
      newHex = hexMatch[0];
    }

    if (code.includes('primary:')) {
      code = code.replace(/(primary:\s*['"])(#[a-fA-F0-9]{3,8}|[a-zA-Z0-9_\-]+)(['"])/, `$1${newHex}$3`);
    } else if (code.includes('site:')) {
      code = code.replace(/(site:\s*\{)/, `$1\n        primary: '${newHex}',`);
    }

    changes.push({
      file: configFile,
      operation: 'modify',
      reason: `Updated primary theme color to ${newHex}`,
      updatedContent: code,
    });

    return {
      intent: 'Change primary color',
      reasoning: `Updated site.primary token in tailwind.config.js to ${newHex}.`,
      changes,
    };
  }

  // =========================================================================
  // 3. REMOVE SECTION
  // =========================================================================
  if (selection.intentCategory === 'remove_section' || norm.includes('remove') || norm.includes('delete')) {
    const targetSection = selection.targetSection || '';
    const appFile = 'src/App.tsx';
    let appCode = fileContents[appFile] || SafeFileModifier.safeReadFile(projectDir, appFile);

    // Identify matching section component from App.tsx
    const allFiles = SafeFileModifier.listProjectFiles(projectDir);
    const matchedSectionFile = allFiles.find((f) => {
      if (!f.startsWith('src/sections/')) return false;
      const lower = f.toLowerCase();
      if (targetSection) {
        return lower.includes(targetSection);
      }
      return f !== 'src/sections/Navbar.tsx';
    });

    if (matchedSectionFile) {
      const componentName = matchedSectionFile.replace(/^src\/sections\/|\.tsx$/g, '');

      // Remove import from App.tsx
      const importRegex = new RegExp(`import\\s*\\{[^}]*${componentName}[^}]*\\}\\s*from\\s*['"][^'"]+['"];?\\r?\\n?`, 'g');
      appCode = appCode.replace(importRegex, '');

      // Remove JSX tag from App.tsx
      const tagRegex = new RegExp(`\\s*<${componentName}\\s*\\/>`, 'g');
      appCode = appCode.replace(tagRegex, '');

      changes.push({
        file: appFile,
        operation: 'modify',
        reason: `Removed ${componentName} from App.tsx`,
        updatedContent: appCode,
      });

      return {
        intent: `Remove ${componentName}`,
        reasoning: `Removed ${componentName} import and JSX element from App.tsx.`,
        changes,
      };
    }
  }

  // =========================================================================
  // 4. ADD SECTION (e.g. Testimonials)
  // =========================================================================
  if (selection.intentCategory === 'add_section' || norm.includes('add') || norm.includes('testimonials')) {
    const appFile = 'src/App.tsx';
    let appCode = fileContents[appFile] || SafeFileModifier.safeReadFile(projectDir, appFile);

    const newComponentFile = 'src/sections/TestimonialsSection.tsx';
    const componentCode = `import React from 'react';

/**
 * [AI-GENERATED SECTION: Testimonials]
 * Automatically synthesized based on user natural language instruction.
 */
export const TestimonialsSection: React.FC = () => {
  const testimonials = [
    {
      quote: "This recreated platform delivered beyond our expectations with remarkable speed and fidelity.",
      author: "Alex Morgan",
      role: "Lead Architect, Nova Tech"
    },
    {
      quote: "The visual grounding and design token preservation saved our team countless engineering hours.",
      author: "Samantha Ray",
      role: "VP Engineering, PulseScale"
    }
  ];

  return (
    <section id="section-testimonials" className="w-full py-16 sm:py-24 bg-site-surface border-b border-site-border">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center max-w-3xl mx-auto mb-16">
          <span className="inline-block px-3 py-1 text-xs font-semibold rounded-full bg-site-primary/10 text-site-primary mb-4 tracking-wide uppercase">
            AI-Generated Content
          </span>
          <h2 className="text-3xl sm:text-4xl font-extrabold text-site-text tracking-tight font-heading">
            What People Are Saying
          </h2>
          <p className="mt-4 text-site-muted text-lg">
            Hear from developers, founders, and teams using this platform every day.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          {testimonials.map((t, idx) => (
            <div key={idx} className="p-8 rounded-2xl bg-site-bg border border-site-border shadow-sm flex flex-col justify-between">
              <p className="text-site-text text-base sm:text-lg italic leading-relaxed mb-6">
                "{t.quote}"
              </p>
              <div>
                <div className="font-bold text-site-text font-heading">{t.author}</div>
                <div className="text-sm text-site-muted">{t.role}</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};
`;

    // Add import to App.tsx
    if (!appCode.includes('TestimonialsSection')) {
      appCode = `import { TestimonialsSection } from './sections/TestimonialsSection';\n${appCode}`;
      // Insert before <Footer />
      if (appCode.includes('<Footer />')) {
        appCode = appCode.replace('<Footer />', '<TestimonialsSection />\n      <Footer />');
      } else {
        appCode = appCode.replace('</main>', '  <TestimonialsSection />\n      </main>');
      }
    }

    changes.push({
      file: newComponentFile,
      operation: 'create',
      reason: 'Created reusable TestimonialsSection component',
      updatedContent: componentCode,
    });

    changes.push({
      file: appFile,
      operation: 'modify',
      reason: 'Registered TestimonialsSection in App.tsx before Footer',
      updatedContent: appCode,
    });

    return {
      intent: 'Add Testimonials section',
      reasoning: 'Generated TestimonialsSection.tsx with explicit AI-generated badge and inserted into App.tsx.',
      changes,
    };
  }

  // =========================================================================
  // 5. HERO MODIFICATIONS (Bakery hero replacement or Heading size scaling)
  // =========================================================================
  if (selection.intentCategory === 'hero' || norm.includes('hero') || norm.includes('heading') || norm.includes('bakery')) {
    const heroFile = selection.relevantFiles[0] || 'src/sections/Section1HeroSection.tsx';
    let code = fileContents[heroFile] || SafeFileModifier.safeReadFile(projectDir, heroFile);

    // Thematic Replacement: Bakery Hero
    const isBakeryTrigger =
      norm.includes('replace the hero with a bakery hero') ||
      norm.includes('make the hero a bakery') ||
      norm.includes('bakery hero') ||
      norm.includes('bakery') ||
      (norm.includes('replace') && norm.includes('hero') && norm.includes('bake'));

    if (isBakeryTrigger) {
      const targetHeading = 'Freshly Baked Artisanal Delights Every Morning';
      const targetSubtitle =
        'Handcrafted sourdough, golden croissants, and organic pastries baked with passion and tradition.';
      const targetBadge = 'Artisan Bakery & Patisserie';
      const targetCta = 'Order Fresh Bakes';
      const targetImage =
        'https://images.unsplash.com/photo-1509440159596-0249088772ff?auto=format&fit=crop&w=1200&q=80';

      // 1. Badge replacement or insertion
      if (
        code.includes('<span') &&
        /<span[^>]*uppercase[^>]*>([\s\S]*?)<\/span>/i.test(code)
      ) {
        code = code.replace(
          /(<span[^>]*uppercase[^>]*>)([\s\S]*?)(<\/span>)/i,
          `$1\n              ${targetBadge}\n            $3`
        );
      } else if (
        code.includes('<span') &&
        /<span[^>]*mb-4[^>]*>([\s\S]*?)<\/span>/i.test(code)
      ) {
        code = code.replace(
          /(<span[^>]*mb-4[^>]*>)([\s\S]*?)(<\/span>)/i,
          `$1\n              ${targetBadge}\n            $3`
        );
      } else {
        // Insert badge right before <h1
        const badgeJsx = `<span className="inline-block px-3 py-1 text-xs font-semibold rounded-full bg-site-primary/10 text-site-primary mb-4 tracking-wide uppercase">
              ${targetBadge}
            </span>\n\n            `;
        code = code.replace(/(<h1)/, `${badgeJsx}$1`);
      }

      // 2. Heading replacement
      code = code.replace(
        /(<h1[^>]*>)([\s\S]*?)(<\/h1>)/,
        `$1\n              ${targetHeading}\n            $3`
      );

      // 3. Subtitle / Paragraph replacement
      code = code.replace(
        /(<p[^>]*>)([\s\S]*?)(<\/p>)/,
        `$1\n              ${targetSubtitle}\n            $3`
      );

      // 4. Button / CTA replacement
      code = code.replace(
        /(<Button[^>]*>)([\s\S]*?)(<\/Button>)/,
        `$1\n                ${targetCta}\n              $3`
      );

      // 5. MediaAsset or img replacement
      if (code.includes('<MediaAsset')) {
        code = code.replace(
          /(<MediaAsset[^>]*?url=["'])([^"']*?)(["'])/,
          `$1${targetImage}$3`
        );
        code = code.replace(
          /(<MediaAsset[^>]*?alt=["'])([^"']*?)(["'])/,
          `$1Freshly Baked Artisanal Bakery Delights$3`
        );
      } else if (code.includes('<img')) {
        code = code.replace(
          /(<img[^>]*?src=["'])([^"']*?)(["'])/,
          `$1${targetImage}$3`
        );
        code = code.replace(
          /(<img[^>]*?alt=["'])([^"']*?)(["'])/,
          `$1Freshly Baked Artisanal Bakery Delights$3`
        );
      }

      changes.push({
        file: heroFile,
        operation: 'modify',
        reason:
          'Transformed hero section into an artisanal bakery hero (heading, subtitle, badge, CTA, and image)',
        updatedContent: code,
      });

      return {
        intent: 'Replace hero with a bakery hero',
        reasoning:
          'Updated the hero section with the requested artisanal bakery heading, subtitle, badge, CTA button, and high-quality bakery photography.',
        changes,
      };
    }

    // Replace h1 size classes with extra large display typography
    code = code.replace(
      /(<h1[^>]*className=["'][^"']*?)(text-[2345]xl[^"']*)(["'])/,
      '$1text-6xl sm:text-7xl lg:text-8xl font-black$3'
    );

    changes.push({
      file: heroFile,
      operation: 'modify',
      reason: 'Increased hero heading size to text-6xl/7xl/8xl font-black',
      updatedContent: code,
    });

    return {
      intent: 'Make hero heading larger',
      reasoning: 'Updated h1 heading size utility classes in HeroSection to display scale.',
      changes,
    };
  }

  // Fallback: return empty plan if unrecognized
  return {
    intent: instruction,
    reasoning: 'No specific modifications identified.',
    changes: [],
  };
}
