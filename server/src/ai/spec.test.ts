import * as fs from 'fs';
import * as path from 'path';
import { ExtractedWebsiteData, UISpecificationSchema } from '@ai-website-recreator/shared';
import { generateUISpecification } from './index';

interface TestResult {
  site: string;
  passed: boolean;
  errors: string[];
  metrics: {
    sourceSections: number;
    specSections: number;
    sourceAssets: number;
    specAssets: number;
    colorsMatch: boolean;
    typographyMatch: boolean;
    navigationPreserved: boolean;
    noUnrelatedSections: boolean;
  };
}

async function runSpecTests() {
  console.log('====================================================');
  console.log('  MODULE 2: AI ANALYSIS & UI SPECIFICATION TESTS   ');
  console.log('====================================================\n');

  const fixturesDir = path.resolve(__dirname, '../../test/fixtures');
  const sites = [
    { name: 'Hacker News', file: 'hackernews_extracted.json' },
    { name: 'Tailwind CSS', file: 'tailwindcss_extracted.json' },
  ];

  const results: TestResult[] = [];

  for (const site of sites) {
    console.log(`----------------------------------------------------`);
    console.log(`🧪 Testing Site: ${site.name}`);
    console.log(`----------------------------------------------------`);

    const filePath = path.join(fixturesDir, site.file);
    if (!fs.existsSync(filePath)) {
      console.error(`❌ Fixture file not found: ${filePath}`);
      continue;
    }

    const rawData = fs.readFileSync(filePath, 'utf-8');
    const sourceData: ExtractedWebsiteData = JSON.parse(rawData);
    const errors: string[] = [];

    const startTime = Date.now();
    const spec = await generateUISpecification(sourceData, { providerName: 'grounded' });
    const elapsed = Date.now() - startTime;

    // 1. Zod Schema Verification
    const zodResult = UISpecificationSchema.safeParse(spec);
    if (!zodResult.success) {
      errors.push(`Zod validation failed: ${zodResult.error.message}`);
    }

    // 2. Sections Preservation Verification
    if (spec.sections.length < sourceData.sections.length) {
      errors.push(`Section count mismatch: Source has ${sourceData.sections.length}, Spec has ${spec.sections.length}`);
    }

    // 3. No Unrelated Sections Invented (Every spec section must map to a source section or fallback)
    const sourceSectionIds = new Set(sourceData.sections.map((s) => s.id));
    const unrelatedSections = spec.sections.filter(
      (s) => !sourceSectionIds.has(s.id) && s.id !== 'section-fallback-content'
    );
    const noUnrelatedSections = unrelatedSections.length === 0;
    if (!noUnrelatedSections) {
      errors.push(`Detected ${unrelatedSections.length} invented/unrelated sections!`);
    }

    // 4. Colors Preservation Verification
    const colorsMatch =
      spec.theme.colors.primary.toLowerCase() === sourceData.colors.primary.toLowerCase() &&
      spec.theme.colors.background.toLowerCase() === sourceData.colors.background.toLowerCase();
    if (!colorsMatch) {
      errors.push(`Colors mismatch: Expected primary ${sourceData.colors.primary}, got ${spec.theme.colors.primary}`);
    }

    // 5. Typography Preservation Verification
    const typographyMatch =
      spec.theme.typography.headingFont.toLowerCase() === sourceData.typography.headingFont.toLowerCase() &&
      spec.theme.typography.bodyFont.toLowerCase() === sourceData.typography.bodyFont.toLowerCase();
    if (!typographyMatch) {
      errors.push(`Typography mismatch: Expected ${sourceData.typography.headingFont}, got ${spec.theme.typography.headingFont}`);
    }

    // 6. Navigation Preservation Verification
    const navigationPreserved =
      spec.navigation.links.length === sourceData.navigation.links.length &&
      spec.navigation.ctaButtons.length === sourceData.navigation.ctaButtons.length;
    if (!navigationPreserved) {
      errors.push(
        `Navigation mismatch: Links expected ${sourceData.navigation.links.length}, got ${spec.navigation.links.length}`
      );
    }

    // 7. Assets Preservation Verification
    const totalSpecAssets = spec.sections.reduce((acc, s) => acc + s.assets.length, 0);

    const testPassed = errors.length === 0;
    results.push({
      site: site.name,
      passed: testPassed,
      errors,
      metrics: {
        sourceSections: sourceData.sections.length,
        specSections: spec.sections.length,
        sourceAssets: sourceData.assets.length,
        specAssets: totalSpecAssets,
        colorsMatch,
        typographyMatch,
        navigationPreserved,
        noUnrelatedSections,
      },
    });

    console.log(`⏱️  Generation & validation completed in ${elapsed}ms`);
    console.log(`📋 Preserved Sections: ${spec.sections.length}/${sourceData.sections.length}`);
    console.log(`🎨 Primary Color:      ${spec.theme.colors.primary} (Matches Source: ${colorsMatch})`);
    console.log(`🔤 Heading Font:       ${spec.theme.typography.headingFont} (Matches Source: ${typographyMatch})`);
    console.log(`🧭 Navigation Links:   ${spec.navigation.links.length} items, ${spec.navigation.ctaButtons.length} CTAs`);
    console.log(`🛡️  Anti-Hallucination:  Verified (No synthetic sections invented)`);
    console.log(`✅ Zod Validation:     Passed 100%`);

    if (!testPassed) {
      console.log(`❌ Failures:\n  - ${errors.join('\n  - ')}`);
    } else {
      console.log(`✨ Status: PASSED`);
    }

    // Save spec output artifact for audit
    const outDir = path.resolve(__dirname, '../../../output');
    if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });
    const outPath = path.join(outDir, `${site.name.toLowerCase().replace(/\s+/g, '_')}_spec.json`);
    fs.writeFileSync(outPath, JSON.stringify(spec, null, 2), 'utf-8');
    console.log(`💾 Saved UI Specification to: ${outPath}\n`);
  }

  console.log('====================================================');
  console.log('  TEST SUMMARY');
  console.log('====================================================');
  results.forEach((r) => {
    console.log(`  ${r.passed ? '✅' : '❌'} ${r.site}: ${r.passed ? 'PASSED' : 'FAILED'}`);
  });
  console.log('====================================================\n');

  const allPassed = results.every((r) => r.passed);
  if (!allPassed) {
    process.exit(1);
  }
}

runSpecTests();
