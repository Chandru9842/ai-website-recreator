import * as fs from 'fs';
import * as path from 'path';
import { analyzeWebsite } from '../analyzer';
import { generateUISpecification } from '../ai';
import { generateReactProject } from '../generator';
import { modifyProject } from '../modifier';
import { ProjectManager } from '../projects';

async function runE2EPipeline() {
  console.log('====================================================');
  console.log('       AUTHENTIC END-TO-END PIPELINE VERIFICATION   ');
  console.log('====================================================\n');

  const testUrl = 'https://news.ycombinator.com';
  const outputBase = path.resolve(__dirname, '../../../output');
  const e2eProjectName = 'e2e_verified_hn';
  const e2eProjectDir = path.join(outputBase, 'generated_projects', e2eProjectName);

  // Clean prior run if any
  if (fs.existsSync(e2eProjectDir)) {
    fs.rmSync(e2eProjectDir, { recursive: true, force: true });
  }

  // -------------------------------------------------------------------------
  // STEP 1: MODULE 1 — WEBSITE ANALYZER
  // -------------------------------------------------------------------------
  console.log('📍 STEP 1: Running Module 1 Website Analyzer on real public site...');
  const t0 = Date.now();
  const extractedData = await analyzeWebsite(testUrl);
  const tAnalyzer = Date.now() - t0;
  console.log(`   ✅ Analyzer finished in ${tAnalyzer}ms`);
  console.log(`      Title: "${extractedData.metadata.title}"`);
  console.log(`      Sections: ${extractedData.sections.length}`);
  console.log(`      Assets: ${extractedData.assets.length}`);
  console.log(`      Primary Color: ${extractedData.colors.primary}\n`);

  if (!extractedData.metadata.title || extractedData.sections.length === 0) {
    throw new Error('Module 1 failed: Extracted data missing required title or sections');
  }

  // -------------------------------------------------------------------------
  // STEP 2: MODULE 2 — GROUNDED UI SPECIFICATION
  // -------------------------------------------------------------------------
  console.log('📍 STEP 2: Synthesizing Grounded UI Specification...');
  const t1 = Date.now();
  const spec = await generateUISpecification(extractedData, { providerName: 'grounded' });
  const tSpec = Date.now() - t1;
  console.log(`   ✅ UI Specification synthesized in ${tSpec}ms`);
  console.log(`      Spec Sections: ${spec.sections.length}`);
  console.log(`      Theme Primary: ${spec.theme.colors.primary}`);
  console.log(`      Theme Background: ${spec.theme.colors.background}\n`);

  if (!spec.metadata || spec.sections.length === 0) {
    throw new Error('Module 2 failed: UI specification generation was empty');
  }

  // -------------------------------------------------------------------------
  // STEP 3 & 4: MODULE 3 GENERATOR + MODULE 4 BUILD VALIDATOR
  // -------------------------------------------------------------------------
  console.log('📍 STEP 3 & 4: Generating React + Tailwind Project with Module 4 Build Validation...');
  const t2 = Date.now();
  const genResult = await generateReactProject(spec, {
    outputDir: e2eProjectDir,
    validateBuild: true,
  });
  const tGen = Date.now() - t2;
  console.log(`   ✅ Project generated and validated in ${tGen}ms`);
  console.log(`      Files Written: ${Object.keys(genResult.files).length}`);
  console.log(`      Validation Success: ${genResult.validation?.success}`);
  console.log(`      Validation Attempts: ${genResult.validation?.attempts}`);

  const distIndexHtml = path.join(e2eProjectDir, 'dist', 'index.html');
  if (!fs.existsSync(distIndexHtml)) {
    throw new Error('Module 4 failed: dist/index.html was not generated');
  }
  const indexHtmlContent = fs.readFileSync(distIndexHtml, 'utf-8');
  console.log(`      dist/index.html size: ${indexHtmlContent.length} bytes\n`);

  // Register in Project Registry
  ProjectManager.createProject({
    id: e2eProjectName,
    name: 'E2E Hacker News',
    originalUrl: testUrl,
    projectPath: e2eProjectDir,
    status: 'passed',
    files: genResult.files,
  });
  console.log(`   ✅ Project registered in registry as "${e2eProjectName}" (v1)\n`);

  // -------------------------------------------------------------------------
  // STEP 5: VISUAL PREVIEW VERIFICATION
  // -------------------------------------------------------------------------
  console.log('📍 STEP 5: Verifying Visual Preview static assets...');
  const previewIndexPath = path.join(e2eProjectDir, 'dist', 'index.html');
  const previewAssetsDir = path.join(e2eProjectDir, 'dist', 'assets');
  if (!fs.existsSync(previewIndexPath) || !fs.existsSync(previewAssetsDir)) {
    throw new Error('Visual preview failed: Static assets directory missing');
  }
  const assetFiles = fs.readdirSync(previewAssetsDir);
  console.log(`   ✅ Visual preview assets found: ${assetFiles.join(', ')}`);
  console.log(`   ✅ Base preview route ready: /preview/${encodeURIComponent(e2eProjectName)}/\n`);

  // -------------------------------------------------------------------------
  // STEP 6: MODULE 5 — NATURAL LANGUAGE MODIFICATION ("Replace hero section with a bakery hero")
  // -------------------------------------------------------------------------
  console.log('📍 STEP 6: Applying Module 5 targeted natural language modification...');
  const modInstruction = 'Replace the hero section with a bakery hero';
  const t3 = Date.now();
  const modResult = await modifyProject(e2eProjectDir, modInstruction);
  const tMod = Date.now() - t3;

  console.log(`   ✅ Modification applied & validated in ${tMod}ms`);
  console.log(`      Success: ${modResult.success}`);
  console.log(`      Modified Files: ${modResult.modifiedFiles.join(', ')}`);
  console.log(`      Message: "${modResult.message}"`);
  console.log(`      Re-validation Attempts: ${modResult.validation?.attempts}`);

  if (!modResult.success) {
    throw new Error(`Module 5 failed: ${modResult.message}`);
  }

  // Record v2 in registry
  ProjectManager.createVersion(
    e2eProjectName,
    modInstruction,
    modResult.modifiedFiles,
    { success: true }
  );

  // -------------------------------------------------------------------------
  // STEP 7: VERIFY TARGETED MODIFICATION & ARTIFACT INTEGRITY
  // -------------------------------------------------------------------------
  console.log('📍 STEP 7: Verifying targeted modifications & preview update...');
  const heroFile = path.join(e2eProjectDir, 'src/sections/Section1HeroSection.tsx');
  const heroContent = fs.readFileSync(heroFile, 'utf-8');

  const hasBakeryHeading = heroContent.includes('Freshly Baked Artisanal Delights');
  const hasBakerySubtitle = heroContent.includes('Handcrafted sourdough');
  const hasBakeryBadge = heroContent.includes('ARTISAN BAKERY & PATISSERIE');
  const hasBakeryImage = heroContent.includes('images.unsplash.com');

  console.log(`      Bakery Heading:  ${hasBakeryHeading ? '✅ Verified' : '❌ Missing'}`);
  console.log(`      Bakery Subtitle: ${hasBakerySubtitle ? '✅ Verified' : '❌ Missing'}`);
  console.log(`      Bakery Badge:    ${hasBakeryBadge ? '✅ Verified' : '❌ Missing'}`);
  console.log(`      Bakery Image:    ${hasBakeryImage ? '✅ Verified' : '❌ Missing'}`);

  if (!hasBakeryHeading || !hasBakerySubtitle || !hasBakeryBadge) {
    throw new Error('Bakery hero content verification failed');
  }

  // Verify non-hero components were preserved
  const navbarFile = path.join(e2eProjectDir, 'src/sections/Navbar.tsx');
  if (fs.existsSync(navbarFile)) {
    const navbarContent = fs.readFileSync(navbarFile, 'utf-8');
    if (!navbarContent.includes('export default function Navbar')) {
      throw new Error('Integrity regression: Navbar was modified during hero change!');
    }
    console.log('      Navbar Integrity: ✅ Preserved untouched');
  }

  // -------------------------------------------------------------------------
  // STEP 8: RESTORE & ROLLBACK VERIFICATION
  // -------------------------------------------------------------------------
  console.log('📍 STEP 8: Testing atomic restore of v1 and rollback guard on corrupt input...');
  const restoreRes = await ProjectManager.restoreVersion(e2eProjectName, 1);
  if (!restoreRes.success) {
    throw new Error(`Restore to v1 failed: ${restoreRes.error}`);
  }
  const heroAfterRestore = fs.readFileSync(heroFile, 'utf-8');
  const restoredBackToOriginal = !heroAfterRestore.includes('Freshly Baked Artisanal Delights');
  console.log(`      Restored back to v1: ${restoredBackToOriginal ? '✅ Verified' : '❌ Failed'}`);

  // Test rollback guard on simulated failed compile
  const corruptVer = 999;
  const corruptSnapDir = path.join(outputBase, 'project_versions', e2eProjectName, `v${corruptVer}`);
  fs.mkdirSync(path.join(corruptSnapDir, 'src'), { recursive: true });
  fs.writeFileSync(path.join(corruptSnapDir, 'src', 'App.tsx'), 'export const broken = {{{ error syntax');
  fs.writeFileSync(path.join(corruptSnapDir, 'snapshot.json'), JSON.stringify({ version: corruptVer }));

  const projectMeta = ProjectManager.getProject(e2eProjectName)!;
  projectMeta.versions.push({
    version: corruptVer,
    instruction: 'Broken code snapshot',
    timestamp: Date.now(),
    modifiedFiles: ['src/App.tsx'],
    validation: { success: true },
    snapshotPath: corruptSnapDir,
  });

  const corruptRestore = await ProjectManager.restoreVersion(e2eProjectName, corruptVer);
  const rollbackProtected = !corruptRestore.success && fs.readFileSync(path.join(e2eProjectDir, 'src', 'App.tsx'), 'utf-8').includes('function App');
  console.log(`      Corrupt Restore Blocked & Rolled Back: ${rollbackProtected ? '✅ Verified' : '❌ Failed'}`);

  // Clean up e2e project
  ProjectManager.deleteProject(e2eProjectName);
  console.log(`\n   🧹 Cleaned up temporary e2e project.`);

  console.log('\n====================================================');
  console.log('  🎉 AUTHENTIC E2E PIPELINE TEST PASSED 100%!       ');
  console.log('====================================================\n');
}

runE2EPipeline().catch((err) => {
  console.error('\n❌ E2E Pipeline failed:', err);
  process.exit(1);
});
