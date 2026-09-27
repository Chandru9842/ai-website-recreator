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
  // 1. STICKY NAVBAR & RESPONSIVE NAVIGATION
  // =========================================================================
  if (selection.intentCategory === 'navbar' || norm.includes('sticky') || norm.includes('responsive')) {
    const navbarFile = selection.relevantFiles[0] || 'src/sections/Navbar.tsx';
    let code = fileContents[navbarFile] || SafeFileModifier.safeReadFile(projectDir, navbarFile);

    if (norm.includes('responsive') || norm.includes('mobile')) {
      if (!code.includes('hidden md:flex')) {
        code = code.replace(/(<(?:nav|div)[^>]*className=["'][^"']*?)flex([^"']*?["'])/, '$1hidden md:flex$2');
      }
      changes.push({
        file: navbarFile,
        operation: 'modify',
        reason: 'Enhanced navbar responsiveness with hidden md:flex layout and responsive classes',
        updatedContent: code,
      });

      return {
        intent: 'Make navigation responsive',
        reasoning: 'Configured responsive navigation layout classes for mobile and desktop viewports.',
        changes,
      };
    }

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
  // 2. PRIMARY COLOR / THEME / DARK MODE
  // =========================================================================
  if (selection.intentCategory === 'theme' || norm.includes('color') || norm.includes('primary') || norm.includes('dark')) {
    const configFile = 'tailwind.config.js';
    let code = fileContents[configFile] || SafeFileModifier.safeReadFile(projectDir, configFile);

    // Dark theme / Dark background
    if (norm.includes('dark') || norm.includes('black')) {
      code = code.replace(/(bg:\s*['"])(#[a-fA-F0-9]{3,8}|[a-zA-Z0-9_\-]+)(['"])/, `$1#0f172a$3`);
      code = code.replace(/(surface:\s*['"])(#[a-fA-F0-9]{3,8}|[a-zA-Z0-9_\-]+)(['"])/, `$1#1e293b$3`);
      code = code.replace(/(text:\s*['"])(#[a-fA-F0-9]{3,8}|[a-zA-Z0-9_\-]+)(['"])/, `$1#f8fafc$3`);
      code = code.replace(/(muted:\s*['"])(#[a-fA-F0-9]{3,8}|[a-zA-Z0-9_\-]+)(['"])/, `$1#94a3b8$3`);
      code = code.replace(/(border:\s*['"])(#[a-fA-F0-9]{3,8}|[a-zA-Z0-9_\-]+)(['"])/, `$1#334155$3`);

      changes.push({
        file: configFile,
        operation: 'modify',
        reason: 'Updated theme tokens to dark mode (#0f172a bg, #1e293b surface, #f8fafc text)',
        updatedContent: code,
      });

      return {
        intent: 'Change background to dark',
        reasoning: 'Updated theme color tokens to dark slate palette in tailwind.config.js.',
        changes,
      };
    }

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
  // 5. HERO / VISUAL ASSET / COPY MODIFICATIONS
  // =========================================================================
  if (
    selection.intentCategory === 'hero' ||
    norm.includes('hero') ||
    norm.includes('heading') ||
    norm.includes('title') ||
    norm.includes('bakery') ||
    norm.includes('image') ||
    norm.includes('photo') ||
    norm.includes('picture') ||
    norm.includes('robot') ||
    norm.includes('graphic')
  ) {
    const heroFile = selection.relevantFiles[0] || 'src/sections/Section1HeroSection.tsx';
    let code = fileContents[heroFile] || SafeFileModifier.safeReadFile(projectDir, heroFile);

    // -----------------------------------------------------------------------
    // 5A. Thematic Replacement: Bakery Hero
    // -----------------------------------------------------------------------
    const isBakeryTrigger =
      norm.includes('replace the hero section with a bakery hero') ||
      norm.includes('replace the hero with a bakery hero') ||
      norm.includes('replace hero with bakery hero') ||
      norm.includes('make the hero a bakery') ||
      norm.includes('create a bakery hero') ||
      norm.includes('bakery hero') ||
      norm.includes('bakery') ||
      (norm.includes('hero') && norm.includes('bake'));

    if (isBakeryTrigger) {
      const targetHeading = 'Freshly Baked Artisanal Delights Every Morning';
      const targetSubtitle =
        'Handcrafted sourdough, golden croissants, and organic pastries baked with passion and tradition.';
      const targetBadge = 'ARTISAN BAKERY & PATISSERIE';
      const targetPrimaryCta = 'Order Fresh Bakes';
      const targetSecondaryCta = 'Explore Our Menu';
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

      // 3. Subtitle / Paragraph replacement or insertion
      if (code.includes('<p')) {
        code = code.replace(
          /(<p[^>]*>)([\s\S]*?)(<\/p>)/,
          `$1\n              ${targetSubtitle}\n            $3`
        );
      } else {
        code = code.replace(
          /(<\/h1>)/,
          `$1\n\n            <p className="text-lg text-slate-600 dark:text-slate-300 max-w-2xl mb-8 leading-relaxed">\n              ${targetSubtitle}\n            </p>`
        );
      }

      // 4. Button / CTA replacement
      if (code.includes('<div className="flex flex-wrap gap-4')) {
        code = code.replace(
          /(<div className="flex flex-wrap gap-4[^>]*>)([\s\S]*?)(<\/div>)/,
          `$1\n              <Button variant="primary" isCta={true} href="#order">\n                ${targetPrimaryCta}\n              </Button>\n              <Button variant="secondary" href="#menu">\n                ${targetSecondaryCta}\n              </Button>\n            $3`
        );
      } else if (code.includes('<Button')) {
        code = code.replace(
          /(<Button[^>]*>)([\s\S]*?)(<\/Button>)/,
          `<Button variant="primary" isCta={true} href="#order">\n                ${targetPrimaryCta}\n              </Button>\n              <Button variant="secondary" href="#menu">\n                ${targetSecondaryCta}\n              </Button>`
        );
      }

      // 5. MediaAsset or img replacement or insertion
      if (code.includes('<MediaAsset')) {
        code = code.replace(/(<MediaAsset[^>]*?url=["'])([^"']*?)(["'])/, `$1${targetImage}$3`);
        code = code.replace(/(<MediaAsset[^>]*?alt=["'])([^"']*?)(["'])/, `$1Freshly Baked Artisanal Bakery Delights$3`);
      } else if (code.includes('<img')) {
        code = code.replace(/(<img[^>]*?src=["'])([^"']*?)(["'])/, `$1${targetImage}$3`);
        code = code.replace(/(<img[^>]*?alt=["'])([^"']*?)(["'])/, `$1Freshly Baked Artisanal Bakery Delights$3`);
      } else {
        const imageJsx = `\n          <div className="mt-8 rounded-2xl overflow-hidden shadow-2xl max-w-4xl mx-auto">\n            <img src="${targetImage}" alt="Freshly Baked Artisanal Bakery Delights" className="w-full h-80 object-cover" />\n          </div>\n`;
        code = code.replace(/(<\/section>)/, `${imageJsx}        $1`);
      }

      changes.push({
        file: heroFile,
        operation: 'modify',
        reason: 'Transformed hero section into an artisanal bakery hero (heading, subtitle, badge, CTA, and image)',
        updatedContent: code,
      });

      return {
        intent: 'Replace hero with a bakery hero',
        reasoning:
          'Updated the hero section with the requested artisanal bakery heading, subtitle, badge, CTA button, and high-quality bakery photography.',
        changes,
      };
    }

    // -----------------------------------------------------------------------
    // 5B. Image / Visual Asset Replacement (Robot, Tech, Car, Nature, etc.)
    // -----------------------------------------------------------------------
    const isImageTrigger =
      norm.includes('image') ||
      norm.includes('photo') ||
      norm.includes('picture') ||
      norm.includes('robot') ||
      norm.includes('img') ||
      norm.includes('graphic');

    if (isImageTrigger) {
      let targetImage = 'https://images.unsplash.com/photo-1485827404703-89b55fcc595e?auto=format&fit=crop&w=1200&q=80';
      let targetAlt = 'Futuristic AI Robot Assistant';
      let topicName = 'robot';

      if (norm.includes('robot') || norm.includes('cyborg') || norm.includes('bot') || norm.includes('ai')) {
        targetImage = 'https://images.unsplash.com/photo-1485827404703-89b55fcc595e?auto=format&fit=crop&w=1200&q=80';
        targetAlt = 'Futuristic AI Robot Assistant';
        topicName = 'robot';
      } else if (norm.includes('code') || norm.includes('developer') || norm.includes('laptop') || norm.includes('software') || norm.includes('tech')) {
        targetImage = 'https://images.unsplash.com/photo-1517694712202-14dd9538aa97?auto=format&fit=crop&w=1200&q=80';
        targetAlt = 'Modern Software Engineering Setup';
        topicName = 'developer tech';
      } else if (norm.includes('car') || norm.includes('automotive') || norm.includes('vehicle')) {
        targetImage = 'https://images.unsplash.com/photo-1503376780353-7e6692767b70?auto=format&fit=crop&w=1200&q=80';
        targetAlt = 'High-Performance Sports Car';
        topicName = 'sports car';
      } else if (norm.includes('nature') || norm.includes('mountain') || norm.includes('forest') || norm.includes('landscape')) {
        targetImage = 'https://images.unsplash.com/photo-1470071459604-3b5ec3a7fe05?auto=format&fit=crop&w=1200&q=80';
        targetAlt = 'Scenic Mountain Wilderness';
        topicName = 'nature landscape';
      } else if (norm.includes('coffee') || norm.includes('cafe')) {
        targetImage = 'https://images.unsplash.com/photo-1501339847302-ac426a4a7cbb?auto=format&fit=crop&w=1200&q=80';
        targetAlt = 'Artisanal Coffee & Roastery';
        topicName = 'coffee';
      } else if (norm.includes('office') || norm.includes('business') || norm.includes('team')) {
        targetImage = 'https://images.unsplash.com/photo-1522071820081-009f0129c71c?auto=format&fit=crop&w=1200&q=80';
        targetAlt = 'Collaborative Team Workspace';
        topicName = 'office team';
      } else if (norm.includes('city') || norm.includes('skyline')) {
        targetImage = 'https://images.unsplash.com/photo-1477959858617-67f30bc75b82?auto=format&fit=crop&w=1200&q=80';
        targetAlt = 'Metropolitan City Skyline';
        topicName = 'city skyline';
      }

      // Check if user provided an explicit image URL in the instruction
      const urlMatch = instruction.match(/https?:\/\/[^\s"'<>]+/);
      if (urlMatch) {
        targetImage = urlMatch[0];
        targetAlt = 'Custom User Visual Asset';
        topicName = 'custom image';
      }

      // Replace in <MediaAsset ... />
      if (code.includes('<MediaAsset')) {
        code = code.replace(/(<MediaAsset[^>]*?url=["'])([^"']*?)(["'])/, `$1${targetImage}$3`);
        code = code.replace(/(<MediaAsset[^>]*?alt=["'])([^"']*?)(["'])/, `$1${targetAlt}$3`);
      } else if (code.includes('<img')) {
        code = code.replace(/(<img[^>]*?src=["'])([^"']*?)(["'])/, `$1${targetImage}$3`);
        code = code.replace(/(<img[^>]*?alt=["'])([^"']*?)(["'])/, `$1${targetAlt}$3`);
      } else {
        const imageJsx = `\n          <div className="mt-8 rounded-2xl overflow-hidden shadow-2xl max-w-4xl mx-auto">\n            <img src="${targetImage}" alt="${targetAlt}" className="w-full h-80 object-cover" />\n          </div>\n`;
        code = code.replace(/(<\/section>)/, `${imageJsx}        $1`);
      }

      changes.push({
        file: heroFile,
        operation: 'modify',
        reason: `Updated visual media asset with ${topicName} imagery (${targetAlt})`,
        updatedContent: code,
      });

      return {
        intent: `Change image to ${topicName}`,
        reasoning: `Updated visual asset URL to high-resolution ${topicName} photography and updated alt text to "${targetAlt}".`,
        changes,
      };
    }

    // -----------------------------------------------------------------------
    // 5C. Custom Heading / Title Text Replacement
    // -----------------------------------------------------------------------
    const headingMatch = instruction.match(/(?:change|set|make|update)\s+(?:the\s+)?(?:heading|title|headline)\s+(?:to\s+|into\s+|:\s*|\s*["'])([^"'\n]+)/i);
    if (headingMatch) {
      const customHeading = headingMatch[1].replace(/["']/g, '').trim();
      if (customHeading && !norm.includes('larger') && !norm.includes('bigger') && !norm.includes('size')) {
        code = code.replace(/(<h1[^>]*>)([\s\S]*?)(<\/h1>)/, `$1\n              ${customHeading}\n            $3`);

        changes.push({
          file: heroFile,
          operation: 'modify',
          reason: `Updated hero heading to "${customHeading}"`,
          updatedContent: code,
        });

        return {
          intent: `Change hero heading to "${customHeading}"`,
          reasoning: `Updated primary h1 heading text in ${heroFile}.`,
          changes,
        };
      }
    }

    // -----------------------------------------------------------------------
    // 5D. Custom Subtitle / Description Text Replacement
    // -----------------------------------------------------------------------
    const subtitleMatch = instruction.match(/(?:change|set|make|update)\s+(?:the\s+)?(?:subtitle|description|paragraph|text)\s+(?:to\s+|into\s+|:\s*|\s*["'])([^"'\n]+)/i);
    if (subtitleMatch) {
      const customSubtitle = subtitleMatch[1].replace(/["']/g, '').trim();
      if (customSubtitle) {
        if (code.includes('<p')) {
          code = code.replace(/(<p[^>]*>)([\s\S]*?)(<\/p>)/, `$1\n              ${customSubtitle}\n            $3`);
        }

        changes.push({
          file: heroFile,
          operation: 'modify',
          reason: `Updated hero description to "${customSubtitle}"`,
          updatedContent: code,
        });

        return {
          intent: `Change hero description to "${customSubtitle}"`,
          reasoning: `Updated hero description paragraph text in ${heroFile}.`,
          changes,
        };
      }
    }

    // -----------------------------------------------------------------------
    // 5E. Centered Hero Section
    // -----------------------------------------------------------------------
    if (norm.includes('center')) {
      code = code.replace(
        /(<section[^>]*className=["'])([^"']*)(["'])/,
        (_match, prefix, classes, suffix) => {
          const newClasses = classes.includes('text-center') ? classes : `${classes} text-center`.trim();
          return `${prefix}${newClasses}${suffix}`;
        }
      );
      code = code.replace(/items-start/g, 'items-center justify-center');
      code = code.replace(/text-left/g, 'text-center');
      if (code.includes('flex flex-wrap gap-4') && !code.includes('justify-center')) {
        code = code.replace('flex flex-wrap gap-4', 'flex flex-wrap gap-4 justify-center');
      }

      changes.push({
        file: heroFile,
        operation: 'modify',
        reason: 'Centered hero section content and alignment',
        updatedContent: code,
      });

      return {
        intent: 'Make hero section centered',
        reasoning: 'Applied center alignment and justify-center to hero section and action buttons.',
        changes,
      };
    }

    // -----------------------------------------------------------------------
    // 5F. Hero Heading Size (Larger / Display)
    // -----------------------------------------------------------------------
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

  // =========================================================================
  // 6. BUTTON STYLING (e.g. Rounded buttons / pill buttons)
  // =========================================================================
  if (
    selection.intentCategory === 'button' ||
    norm.includes('button') ||
    (norm.includes('round') && !norm.includes('nav'))
  ) {
    const btnFile = selection.relevantFiles.find((f) => f.includes('Button.tsx')) || 'src/components/Button.tsx';
    if (SafeFileModifier.safeFileExists(projectDir, btnFile)) {
      let code = fileContents[btnFile] || SafeFileModifier.safeReadFile(projectDir, btnFile);
      code = code.replace(/rounded-(?:site-button|md|lg|sm|xl)/g, 'rounded-full');
      if (!code.includes('rounded-full')) {
        code = code.replace(/(className=[{`'"][^`'"]*?)rounded[a-zA-Z0-9_\-]*/g, '$1rounded-full');
      }
      changes.push({
        file: btnFile,
        operation: 'modify',
        reason: 'Updated button border radius to rounded-full (pill style)',
        updatedContent: code,
      });
    }

    const configFile = 'tailwind.config.js';
    if (SafeFileModifier.safeFileExists(projectDir, configFile)) {
      let configCode = fileContents[configFile] || SafeFileModifier.safeReadFile(projectDir, configFile);
      if (configCode.includes('button:')) {
        configCode = configCode.replace(/(button:\s*['"])([^'"]+)(['"])/, '$19999px$3');
        changes.push({
          file: configFile,
          operation: 'modify',
          reason: 'Updated button border radius token to 9999px in tailwind.config.js',
          updatedContent: configCode,
        });
      }
    }

    if (changes.length > 0) {
      return {
        intent: 'Make buttons rounded',
        reasoning: 'Updated button component styling and tailwind tokens to rounded-full / 9999px pill shape.',
        changes,
      };
    }
  }

  // Fallback: return empty plan if unrecognized
  return {
    intent: instruction,
    reasoning: 'No specific modifications identified.',
    changes: [],
  };
}
