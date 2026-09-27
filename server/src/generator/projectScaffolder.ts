import * as fs from 'fs';
import * as path from 'path';
import { UISpecification } from '@ai-website-recreator/shared';
import { GeneratedProject } from './types';
import {
  generateIndexCss,
  generateIndexHtml,
  generatePackageJson,
  generatePostcssConfig,
  generateTailwindConfig,
  generateTsConfig,
  generateViteConfig,
} from './styleConfigurator';
import {
  generateButtonComponent,
  generateCardComponent,
  generateMediaAssetComponent,
} from './componentTemplates';
import {
  generateFooterComponent,
  generateHeroSectionComponent,
  generateNavbarComponent,
  generateGenericOrContentSectionComponent,
  getComponentName,
} from './sectionGenerators';
import { generateAppTsx, generateMainTsx } from './appGenerator';
import { Logger } from '../utils/logger';

const logger = new Logger('ProjectScaffolder');

export function scaffoldReactProject(spec: UISpecification): GeneratedProject {
  const safeId = `recreated-${spec.metadata.title
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '-')
    .replace(/-+/g, '-')
    .slice(0, 25)}-${Date.now()}`;

  const files: Record<string, string> = {};

  // 1. Root configuration files
  files['package.json'] = generatePackageJson(spec);
  files['tsconfig.json'] = generateTsConfig();
  files['vite.config.ts'] = generateViteConfig();
  files['tailwind.config.js'] = generateTailwindConfig(spec);
  files['postcss.config.js'] = generatePostcssConfig();
  files['index.html'] = generateIndexHtml(spec);

  // 2. Core App & Styling
  files['src/index.css'] = generateIndexCss(spec);
  files['src/App.tsx'] = generateAppTsx(spec);
  files['src/main.tsx'] = generateMainTsx();

  // 3. Reusable Components
  files['src/components/Button.tsx'] = generateButtonComponent();
  files['src/components/Card.tsx'] = generateCardComponent();
  files['src/components/MediaAsset.tsx'] = generateMediaAssetComponent();

  // 4. Navigation
  const hasNavbar =
    (spec.navigation.links && spec.navigation.links.length > 0) ||
    spec.navigation.brand.text ||
    spec.navigation.brand.logoUrl;

  if (hasNavbar) {
    files['src/sections/Navbar.tsx'] = generateNavbarComponent(spec.navigation);
  }

  // 5. Section Components
  spec.sections.forEach((sec) => {
    if (sec.type === 'footer') return; // Handled separately

    const componentName = getComponentName(sec);
    if (sec.type === 'hero') {
      files[`src/sections/${componentName}.tsx`] = generateHeroSectionComponent(sec);
    } else {
      files[`src/sections/${componentName}.tsx`] = generateGenericOrContentSectionComponent(sec);
    }
  });

  // 6. Footer Component
  const footerSec = spec.sections.find((s) => s.type === 'footer');
  if (footerSec || hasNavbar) {
    files['src/sections/Footer.tsx'] = generateFooterComponent(footerSec, spec.navigation);
  }

  logger.info(`Scaffolded ${Object.keys(files).length} files for project "${spec.metadata.title}"`);

  return {
    id: safeId,
    siteName: spec.metadata.title,
    sourceUrl: spec.metadata.url,
    createdAt: new Date().toISOString(),
    files,
    buildStatus: 'untested',
  };
}

export async function writeProjectToDisk(
  project: GeneratedProject,
  targetDir: string
): Promise<string> {
  const resolvedTarget = path.resolve(targetDir);
  logger.info(`Writing project files to disk: ${resolvedTarget}`);

  if (!fs.existsSync(resolvedTarget)) {
    fs.mkdirSync(resolvedTarget, { recursive: true });
  }

  for (const [relativePath, content] of Object.entries(project.files)) {
    const fullPath = path.join(resolvedTarget, relativePath);
    const parentDir = path.dirname(fullPath);
    if (!fs.existsSync(parentDir)) {
      fs.mkdirSync(parentDir, { recursive: true });
    }
    fs.writeFileSync(fullPath, content, 'utf-8');
  }

  project.projectDir = resolvedTarget;
  logger.info(`Successfully wrote ${Object.keys(project.files).length} files to ${resolvedTarget}`);
  return resolvedTarget;
}
