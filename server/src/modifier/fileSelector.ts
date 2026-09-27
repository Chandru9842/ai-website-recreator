import * as path from 'path';
import { SafeFileModifier } from './safeFileModifier';

export interface FileSelectionResult {
  relevantFiles: string[];
  intentCategory: 'navbar' | 'theme' | 'remove_section' | 'add_section' | 'hero' | 'button' | 'general';
  targetSection?: string;
}

/**
 * Identifies the minimal set of files relevant to a user's natural language modification request.
 */
export function selectRelevantFiles(projectDir: string, instruction: string): FileSelectionResult {
  const norm = instruction.toLowerCase().trim();
  const allFiles = SafeFileModifier.listProjectFiles(projectDir);

  // 1. Sticky navbar or navigation modifications
  if (norm.includes('navbar') || norm.includes('nav') || norm.includes('sticky') || norm.includes('header')) {
    const navbarFile = allFiles.find((f) => f.includes('Navbar.tsx') || f.includes('Navbar'));
    if (navbarFile) {
      return {
        relevantFiles: [navbarFile],
        intentCategory: 'navbar',
      };
    }
  }

  // 2. Color / Theme / Typography modifications
  if (
    norm.includes('color') ||
    norm.includes('primary') ||
    norm.includes('secondary') ||
    norm.includes('background') ||
    norm.includes('palette') ||
    norm.includes('theme') ||
    norm.includes('dark')
  ) {
    const themeFiles = allFiles.filter(
      (f) => f.includes('tailwind.config.js') || f.includes('index.css') || f.includes('App.tsx')
    );
    return {
      relevantFiles: themeFiles.length > 0 ? themeFiles : ['tailwind.config.js'],
      intentCategory: 'theme',
    };
  }

  // 3. Remove section
  if (norm.includes('remove') || norm.includes('delete') || norm.includes('hide')) {
    const sectionMatch = norm.match(/(?:remove|delete|hide)\s+(?:the\s+)?([a-zA-Z0-9_\-]+)\s*(?:section)?/i);
    const targetSection = sectionMatch ? sectionMatch[1].toLowerCase() : '';

    const candidates = allFiles.filter((f) => {
      if (f === 'src/App.tsx') return true;
      if (targetSection && f.toLowerCase().includes(targetSection)) return true;
      return false;
    });

    return {
      relevantFiles: candidates.length > 0 ? candidates : ['src/App.tsx'],
      intentCategory: 'remove_section',
      targetSection,
    };
  }

  // 4. Image / Visual asset modifications (e.g. "change it into the robot the image", "change image to robot", "make image tech")
  if (
    norm.includes('image') ||
    norm.includes('img') ||
    norm.includes('photo') ||
    norm.includes('picture') ||
    norm.includes('robot') ||
    norm.includes('graphic') ||
    norm.includes('illustration') ||
    norm.includes('banner') ||
    norm.includes('media')
  ) {
    const sectionImageFiles = allFiles.filter((f) => {
      if (!f.endsWith('.tsx') || !f.startsWith('src/sections/')) return false;
      const content = SafeFileModifier.safeReadFile(projectDir, f);
      return content.includes('<img') || content.includes('<MediaAsset') || content.includes('src=');
    });

    const heroFile = allFiles.find(
      (f) =>
        f.includes('HeroSection') ||
        f.toLowerCase().includes('hero') ||
        (f.startsWith('src/sections/') && f.includes('Section1'))
    );

    const targetFile =
      sectionImageFiles.find((f) => f.includes('Hero') || f.includes('Section1')) ||
      heroFile ||
      sectionImageFiles[0] ||
      allFiles.find((f) => f.includes('HeroSection'));

    if (targetFile) {
      return {
        relevantFiles: [targetFile],
        intentCategory: 'hero',
      };
    }
  }

  // 5. Hero section / Text / Copy modifications (heading size, copy, bakery hero, layout)
  if (
    norm.includes('hero') ||
    norm.includes('heading') ||
    norm.includes('title') ||
    norm.includes('headline') ||
    norm.includes('subtitle') ||
    norm.includes('description') ||
    norm.includes('copy') ||
    norm.includes('text') ||
    norm.includes('bakery')
  ) {
    const heroFile = allFiles.find(
      (f) =>
        f.includes('HeroSection') ||
        f.toLowerCase().includes('hero') ||
        (f.startsWith('src/sections/') && f.includes('Section1'))
    );
    if (heroFile) {
      return {
        relevantFiles: [heroFile],
        intentCategory: 'hero',
      };
    }
  }

  // 5. Add section (e.g. Testimonials, FAQ, Pricing, etc.)
  if (norm.includes('add') || norm.includes('insert') || norm.includes('create')) {
    const sectionMatch = norm.match(/(?:add|insert|create)\s+(?:a\s+|an\s+)?([a-zA-Z0-9_\-]+)\s*(?:section)?/i);
    const targetSection = sectionMatch ? sectionMatch[1].toLowerCase() : 'custom';

    return {
      relevantFiles: ['src/App.tsx'],
      intentCategory: 'add_section',
      targetSection,
    };
  }

  // 6. Button styling (e.g. rounded buttons, pill buttons)
  if (norm.includes('button') || (norm.includes('round') && !norm.includes('nav'))) {
    const btnFiles = allFiles.filter(
      (f) => f.includes('Button.tsx') || f.includes('Button') || f.includes('tailwind.config.js')
    );
    if (btnFiles.length > 0) {
      return {
        relevantFiles: btnFiles,
        intentCategory: 'button',
      };
    }
  }

  // 7. General fallback: scan file contents for matching keywords
  const keywords = norm
    .split(/\s+/)
    .filter((w) => w.length > 3 && !['make', 'change', 'update', 'with', 'from', 'this', 'that'].includes(w));

  const matched = new Set<string>();
  for (const file of allFiles) {
    // Check filename
    for (const kw of keywords) {
      if (file.toLowerCase().includes(kw)) {
        matched.add(file);
      }
    }
  }

  if (matched.size > 0) {
    return {
      relevantFiles: Array.from(matched),
      intentCategory: 'general',
    };
  }

  // Default to App.tsx and main section if no specific match
  return {
    relevantFiles: allFiles.filter((f) => f === 'src/App.tsx' || f.includes('Section1')),
    intentCategory: 'general',
  };
}
