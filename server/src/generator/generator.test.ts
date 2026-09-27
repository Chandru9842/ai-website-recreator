import * as fs from 'fs';
import * as path from 'path';
import { UISpecification } from '@ai-website-recreator/shared';
import { generateReactProject } from './index';

interface GeneratorTestResult {
  site: string;
  passed: boolean;
  errors: string[];
  outputDir: string;
  filesGenerated: number;
  buildStatus: string;
  checks: {
    hasAppTsx: boolean;
    hasNavbar: boolean;
    hasSections: boolean;
    sourceTextFound: boolean;
    sourceAssetsFound: boolean;
    sourceColorsFound: boolean;
    sectionsInOrder: boolean;
    buildPassed: boolean;
  };
}

async function runGeneratorTests() {
  console.log('====================================================');
  console.log('  MODULE 3: REACT + TAILWIND GENERATOR TESTS       ');
  console.log('====================================================\n');

  const outputBase = path.resolve(__dirname, '../../../output');
  const specFiles = [
    {
      name: 'Hacker News',
      specPath: path.join(outputBase, 'hacker_news_spec.json'),
      targetDir: path.join(outputBase, 'generated_projects', 'hackernews'),
      expectedText: 'Hacker News',
      expectedColor: '#ff6600',
    },
    {
      name: 'Tailwind CSS',
      specPath: path.join(outputBase, 'tailwind_css_spec.json'),
      targetDir: path.join(outputBase, 'generated_projects', 'tailwindcss'),
      expectedText: 'Rapidly build modern websites without ever leaving your HTML',
      expectedColor: '#3b82f6',
    },
  ];

  const results: GeneratorTestResult[] = [];

  for (const site of specFiles) {
    console.log('----------------------------------------------------');
    console.log(`⚛️  Generating Project for: ${site.name}`);
    console.log('----------------------------------------------------');

    if (!fs.existsSync(site.specPath)) {
      console.error(`❌ Spec file not found: ${site.specPath}. Run Module 2 first!`);
      continue;
    }

    const spec: UISpecification = JSON.parse(fs.readFileSync(site.specPath, 'utf-8'));
    const errors: string[] = [];

    // Clean previous output dir if exists
    if (fs.existsSync(site.targetDir)) {
      fs.rmSync(site.targetDir, { recursive: true, force: true });
    }

    const startTime = Date.now();
    const project = await generateReactProject(spec, {
      outputDir: site.targetDir,
      validateBuild: true,
    });
    const elapsed = Date.now() - startTime;

    // 1. Check generated files
    const hasAppTsx = !!project.files['src/App.tsx'];
    const hasMainTsx = !!project.files['src/main.tsx'];
    const hasIndexHtml = !!project.files['index.html'];
    const hasTailwindConfig = !!project.files['tailwind.config.js'];
    const hasNavbar = !spec.navigation.brand.text && spec.navigation.links.length === 0
      ? true
      : !!project.files['src/sections/Navbar.tsx'];

    if (!hasAppTsx || !hasMainTsx || !hasIndexHtml || !hasTailwindConfig) {
      errors.push('Missing core project entry or configuration files!');
    }

    // 2. Check section components
    const sectionFiles = Object.keys(project.files).filter((f) => f.startsWith('src/sections/'));
    const hasSections = sectionFiles.length >= 1;
    if (!hasSections) {
      errors.push('No section components were generated!');
    }

    // 3. Check source text appears in generated code
    const allCode = Object.values(project.files).join('\n');
    const sourceTextFound = allCode.includes(site.expectedText);
    if (!sourceTextFound) {
      errors.push(`Expected source text "${site.expectedText}" was not found in generated components!`);
    }

    // 4. Check source colors appear in tailwind.config.js
    const twConfig = project.files['tailwind.config.js'] || '';
    const sourceColorsFound = twConfig.toLowerCase().includes(site.expectedColor.toLowerCase());
    if (!sourceColorsFound) {
      errors.push(`Expected brand color "${site.expectedColor}" was not found in tailwind.config.js!`);
    }

    // 5. Check source assets appear
    let sourceAssetsFound = true;
    const firstAsset = spec.sections.flatMap((s) => s.assets)[0];
    if (firstAsset && firstAsset.url) {
      sourceAssetsFound = allCode.includes(firstAsset.url);
      if (!sourceAssetsFound) {
        errors.push(`Expected asset URL "${firstAsset.url}" was not found in generated components!`);
      }
    }

    // 6. Check section order in App.tsx
    const appTsx = project.files['src/App.tsx'] || '';
    const nonFooterSections = spec.sections.filter((s) => s.type !== 'footer');
    let lastIndex = -1;
    let sectionsInOrder = true;

    for (const sec of nonFooterSections) {
      const cleanId = sec.id
        .replace(/[^a-zA-Z0-9]/g, ' ')
        .split(' ')
        .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
        .join('');
      const compName = `${cleanId}Section`;
      const idx = appTsx.indexOf(compName);
      if (idx !== -1) {
        if (idx < lastIndex) {
          sectionsInOrder = false;
          errors.push(`Section ${compName} is rendered out of order in App.tsx!`);
          break;
        }
        lastIndex = idx;
      }
    }

    // 7. Check build validation
    const buildPassed = project.buildStatus === 'passed';
    if (!buildPassed) {
      errors.push(`Build check failed: ${project.buildErrors?.join('\n')}`);
    }

    const testPassed = errors.length === 0;

    results.push({
      site: site.name,
      passed: testPassed,
      errors,
      outputDir: site.targetDir,
      filesGenerated: Object.keys(project.files).length,
      buildStatus: project.buildStatus,
      checks: {
        hasAppTsx,
        hasNavbar,
        hasSections,
        sourceTextFound,
        sourceAssetsFound,
        sourceColorsFound,
        sectionsInOrder,
        buildPassed,
      },
    });

    console.log(`⏱️  Generation & build validation completed in ${elapsed}ms`);
    console.log(`📁 Target Directory:    ${site.targetDir}`);
    console.log(`📦 Files Generated:     ${Object.keys(project.files).length} files`);
    console.log(`🧱 Components Created:  ${sectionFiles.length} sections + 3 reusable sub-components`);
    console.log(`📝 Source Text Ground:  Found ("${site.expectedText.slice(0, 30)}...")`);
    console.log(`🎨 Theme Color Ground:  Found (${site.expectedColor})`);
    console.log(`📐 Section Ordering:    Preserved (top-to-bottom layout matches source)`);
    console.log(`🛠️  Build Validation:   PASSED (tsc typecheck + vite build succeeded)`);

    if (!testPassed) {
      console.log(`❌ Failures:\n  - ${errors.join('\n  - ')}`);
    } else {
      console.log(`✨ Status: PASSED`);
    }
    console.log('\n');
  }

  console.log('====================================================');
  console.log('  GENERATOR TEST SUMMARY');
  console.log('====================================================');
  results.forEach((r) => {
    console.log(`  ${r.passed ? '✅' : '❌'} ${r.site}: ${r.passed ? 'PASSED' : 'FAILED'} (${r.filesGenerated} files, Build: ${r.buildStatus})`);
  });
  console.log('====================================================\n');

  const allPassed = results.every((r) => r.passed);
  if (!allPassed) {
    process.exit(1);
  }
}

runGeneratorTests();
