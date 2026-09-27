import * as fs from 'fs';
import * as path from 'path';
import { modifyProject } from './index';
import { SafeFileModifier } from './safeFileModifier';
import { HistoryManager } from './historyManager';

interface ModifierTestCaseResult {
  name: string;
  passed: boolean;
  identifiedFiles: string[];
  unrelatedPreserved: boolean;
  buildPassed: boolean;
  historyRecorded: boolean;
  details: string;
}

async function runModifierTests() {
  console.log('====================================================');
  console.log('  MODULE 5: NATURAL LANGUAGE MODIFICATION TESTS     ');
  console.log('====================================================\n');

  const outputBase = path.resolve(__dirname, '../../../output');
  const sourceProject = path.join(outputBase, 'generated_projects', 'hackernews');
  const testProjectDir = path.join(outputBase, 'test_projects', 'modifier_test');

  if (!fs.existsSync(sourceProject)) {
    console.error(`❌ Source project not found at: ${sourceProject}. Please run generator first!`);
    process.exit(1);
  }

  // 1. Stage fresh isolated test project
  if (fs.existsSync(testProjectDir)) {
    fs.rmSync(testProjectDir, { recursive: true, force: true });
  }
  fs.mkdirSync(path.dirname(testProjectDir), { recursive: true });
  fs.cpSync(sourceProject, testProjectDir, { recursive: true });
  console.log(`📁 Isolated modifier test project staged at: ${testProjectDir}`);

  // Snapshot initial file state for regression assertions
  const navbarPath = path.join(testProjectDir, 'src/sections/Navbar.tsx');
  const heroPath = path.join(testProjectDir, 'src/sections/Section1HeroSection.tsx');
  const tailwindConfigPath = path.join(testProjectDir, 'tailwind.config.js');
  const appPath = path.join(testProjectDir, 'src/App.tsx');

  const initialNavbar = fs.readFileSync(navbarPath, 'utf-8');
  const initialHero = fs.readFileSync(heroPath, 'utf-8');
  const initialTailwind = fs.readFileSync(tailwindConfigPath, 'utf-8');
  const initialApp = fs.readFileSync(appPath, 'utf-8');

  const results: ModifierTestCaseResult[] = [];

  // =========================================================================
  // TEST 1: MAKE THE NAVBAR STICKY
  // =========================================================================
  console.log('----------------------------------------------------');
  console.log('🧪 TEST 1: "Make the navbar sticky"');
  console.log('----------------------------------------------------');
  {
    const instruction = 'Make the navbar sticky';
    const result = await modifyProject(testProjectDir, instruction);

    const updatedNavbar = fs.readFileSync(navbarPath, 'utf-8');
    const heroUntouched = fs.readFileSync(heroPath, 'utf-8') === initialHero;
    const tailwindUntouched = fs.readFileSync(tailwindConfigPath, 'utf-8') === initialTailwind;
    const isSticky = updatedNavbar.includes('sticky top-0');

    console.log(`📊 Result Success:      ${result.success}`);
    console.log(`📝 Modified Files:      ${result.modifiedFiles.join(', ')}`);
    console.log(`🧭 Sticky class found:   ${isSticky}`);
    console.log(`🛡️  Unrelated preserved: ${heroUntouched && tailwindUntouched}`);
    console.log(`🛠️  Build Validation:    ${result.validation.success ? 'PASSED' : 'FAILED'}`);

    const passed =
      result.success &&
      result.modifiedFiles.includes('src/sections/Navbar.tsx') &&
      isSticky &&
      heroUntouched &&
      tailwindUntouched &&
      result.validation.success;

    results.push({
      name: 'Test 1: Make navbar sticky',
      passed,
      identifiedFiles: result.modifiedFiles,
      unrelatedPreserved: heroUntouched && tailwindUntouched,
      buildPassed: result.validation.success,
      historyRecorded: result.history?.some((h) => h.instruction === instruction) || false,
      details: isSticky ? 'Successfully injected sticky top-0 to Navbar' : 'Sticky class missing',
    });
  }

  // =========================================================================
  // TEST 2: CHANGE PRIMARY COLOR TO BLUE
  // =========================================================================
  console.log('\n----------------------------------------------------');
  console.log('🧪 TEST 2: "Change the primary color to blue"');
  console.log('----------------------------------------------------');
  {
    const instruction = 'Change the primary color to blue';
    const result = await modifyProject(testProjectDir, instruction);

    const updatedTailwind = fs.readFileSync(tailwindConfigPath, 'utf-8');
    const heroUntouched = fs.readFileSync(heroPath, 'utf-8') === initialHero;
    const hasBlueHex = updatedTailwind.includes('#2563eb') || updatedTailwind.includes('#3b82f6') || updatedTailwind.includes('blue');

    console.log(`📊 Result Success:      ${result.success}`);
    console.log(`📝 Modified Files:      ${result.modifiedFiles.join(', ')}`);
    console.log(`🎨 Primary Color Blue:  ${hasBlueHex}`);
    console.log(`🛡️  Unrelated preserved: ${heroUntouched}`);
    console.log(`🛠️  Build Validation:    ${result.validation.success ? 'PASSED' : 'FAILED'}`);

    const passed =
      result.success &&
      result.modifiedFiles.includes('tailwind.config.js') &&
      hasBlueHex &&
      heroUntouched &&
      result.validation.success;

    results.push({
      name: 'Test 2: Change primary color',
      passed,
      identifiedFiles: result.modifiedFiles,
      unrelatedPreserved: heroUntouched,
      buildPassed: result.validation.success,
      historyRecorded: result.history?.some((h) => h.instruction === instruction) || false,
      details: hasBlueHex ? 'Updated site.primary token in tailwind.config.js' : 'Color not updated',
    });
  }

  // =========================================================================
  // TEST 3: REMOVE A SECTION (Footer)
  // =========================================================================
  console.log('\n----------------------------------------------------');
  console.log('🧪 TEST 3: "Remove the footer section"');
  console.log('----------------------------------------------------');
  {
    const instruction = 'Remove the footer section';
    const result = await modifyProject(testProjectDir, instruction);

    const updatedApp = fs.readFileSync(appPath, 'utf-8');
    const footerRemoved = !updatedApp.includes('<Footer />');

    console.log(`📊 Result Success:      ${result.success}`);
    console.log(`📝 Modified Files:      ${result.modifiedFiles.join(', ')}`);
    console.log(`🗑️  Footer Tag Removed:  ${footerRemoved}`);
    console.log(`🛠️  Build Validation:    ${result.validation.success ? 'PASSED' : 'FAILED'}`);

    const passed =
      result.success &&
      result.modifiedFiles.includes('src/App.tsx') &&
      footerRemoved &&
      result.validation.success;

    results.push({
      name: 'Test 3: Remove a section',
      passed,
      identifiedFiles: result.modifiedFiles,
      unrelatedPreserved: true,
      buildPassed: result.validation.success,
      historyRecorded: result.history?.some((h) => h.instruction === instruction) || false,
      details: footerRemoved ? 'Removed <Footer /> and import from App.tsx' : 'Footer not removed',
    });
  }

  // =========================================================================
  // TEST 4: CHANGE HERO HEADING SIZE
  // =========================================================================
  console.log('\n----------------------------------------------------');
  console.log('🧪 TEST 4: "Make the hero heading larger"');
  console.log('----------------------------------------------------');
  {
    const instruction = 'Make the hero heading larger';
    const result = await modifyProject(testProjectDir, instruction);

    const updatedHero = fs.readFileSync(heroPath, 'utf-8');
    const hasLargeHeading = updatedHero.includes('text-6xl') || updatedHero.includes('text-7xl') || updatedHero.includes('text-8xl');

    console.log(`📊 Result Success:      ${result.success}`);
    console.log(`📝 Modified Files:      ${result.modifiedFiles.join(', ')}`);
    console.log(`📐 Heading Size Scaled: ${hasLargeHeading}`);
    console.log(`🛠️  Build Validation:    ${result.validation.success ? 'PASSED' : 'FAILED'}`);

    const passed =
      result.success &&
      result.modifiedFiles.includes('src/sections/Section1HeroSection.tsx') &&
      hasLargeHeading &&
      result.validation.success;

    results.push({
      name: 'Test 4: Change hero heading size',
      passed,
      identifiedFiles: result.modifiedFiles,
      unrelatedPreserved: true,
      buildPassed: result.validation.success,
      historyRecorded: result.history?.some((h) => h.instruction === instruction) || false,
      details: hasLargeHeading ? 'Scaled h1 typography in HeroSection.tsx' : 'Heading size unchanged',
    });
  }

  // =========================================================================
  // TEST 5: SECURITY VERIFICATION (Prevent Traversal & Escapes)
  // =========================================================================
  console.log('\n----------------------------------------------------');
  console.log('🧪 TEST 5: SECURITY CHECK (Strict Traversal & Escape Prevention)');
  console.log('----------------------------------------------------');
  {
    let blockedTraversal = false;
    let blockedAbsolute = false;

    try {
      SafeFileModifier.resolveSafePath(testProjectDir, '../../outside.txt');
    } catch (e: any) {
      if (e.message.includes('traversal') || e.message.includes('Security Error')) {
        blockedTraversal = true;
      }
    }

    try {
      SafeFileModifier.resolveSafePath(testProjectDir, 'C:/Windows/System32/drivers/etc/hosts');
    } catch (e: any) {
      if (e.message.includes('Absolute path') || e.message.includes('Security Error')) {
        blockedAbsolute = true;
      }
    }

    console.log(`🛡️  Directory traversal blocked: ${blockedTraversal}`);
    console.log(`🛡️  Absolute path escape blocked: ${blockedAbsolute}`);

    const passed = blockedTraversal && blockedAbsolute;
    results.push({
      name: 'Test 5: Security Containment',
      passed,
      identifiedFiles: [],
      unrelatedPreserved: true,
      buildPassed: true,
      historyRecorded: true,
      details: 'Rejected directory traversal and absolute path modification requests',
    });
  }

  // =========================================================================
  // TEST 6: MODIFICATION HISTORY VERIFICATION
  // =========================================================================
  console.log('\n----------------------------------------------------');
  console.log('🧪 TEST 6: MODIFICATION HISTORY PERSISTENCE');
  console.log('----------------------------------------------------');
  {
    const history = HistoryManager.getHistory(testProjectDir);
    console.log(`📜 Total History Entries: ${history.length}`);
    for (const h of history) {
      console.log(`   - [${h.timestamp.slice(11, 19)}] "${h.instruction}": modified [${h.modifiedFiles.join(', ')}] (valid: ${h.validation.success})`);
    }

    const passed = history.length >= 4;
    results.push({
      name: 'Test 6: Modification History',
      passed,
      identifiedFiles: [],
      unrelatedPreserved: true,
      buildPassed: true,
      historyRecorded: passed,
      details: `Persisted ${history.length} modification records in .modifications.json`,
    });
  }

  // Final Summary Report
  console.log('\n====================================================');
  console.log('  MODULE 5: NATURAL LANGUAGE MODIFICATION SUMMARY   ');
  console.log('====================================================');
  let allPassed = true;
  for (const r of results) {
    if (!r.passed) allPassed = false;
    const icon = r.passed ? '✅' : '❌';
    console.log(`${icon} ${r.name}`);
    console.log(`   - Modified:   ${r.identifiedFiles.join(', ') || 'N/A'}`);
    console.log(`   - Build Pass: ${r.buildPassed}`);
    console.log(`   - Details:    ${r.details}`);
  }
  console.log('====================================================');

  if (!allPassed) {
    console.error('❌ Some modification tests failed!');
    process.exit(1);
  } else {
    console.log('🎉 ALL MODULE 5 MODIFICATION TESTS PASSED!\n');
  }
}

runModifierTests().catch((err) => {
  console.error('Fatal error during modifier test execution:', err);
  process.exit(1);
});
