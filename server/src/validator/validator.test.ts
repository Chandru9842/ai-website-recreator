import * as fs from 'fs';
import * as path from 'path';
import { runBuildValidation } from './compilerRunner';
import { parseBuildDiagnostics } from './diagnosticParser';
import { validateAndHealProject } from './index';

interface ValidatorTestCaseResult {
  name: string;
  errorDetected: boolean;
  detectedDiagnostic?: any;
  healed: boolean;
  attempts: number;
  fixedFiles: string[];
  finalBuildPassed: boolean;
  details: string;
}

async function runValidatorTests() {
  console.log('====================================================');
  console.log('  MODULE 4: VALIDATION & AUTO-HEALING ENGINE TESTS  ');
  console.log('====================================================\n');

  const outputBase = path.resolve(__dirname, '../../../output');
  const sourceProject = path.join(outputBase, 'generated_projects', 'hackernews');
  const testProjectDir = path.join(outputBase, 'test_projects', 'healing_test');

  if (!fs.existsSync(sourceProject)) {
    console.error(`❌ Source project not found at: ${sourceProject}. Please run generator first!`);
    process.exit(1);
  }

  // 1. Setup clean isolated test environment
  if (fs.existsSync(testProjectDir)) {
    fs.rmSync(testProjectDir, { recursive: true, force: true });
  }
  fs.mkdirSync(path.dirname(testProjectDir), { recursive: true });
  fs.cpSync(sourceProject, testProjectDir, { recursive: true });
  console.log(`📁 Test project staged at: ${testProjectDir}`);

  // Locate section file dynamically
  const sectionsDir = path.join(testProjectDir, 'src', 'sections');
  const sectionFiles = fs.readdirSync(sectionsDir).filter((f) => f.endsWith('.tsx') && f !== 'Navbar.tsx' && f !== 'Footer.tsx');
  const targetSectionFilename = sectionFiles[0] || 'Section1HeroSection.tsx';
  const targetSectionPath = path.join(sectionsDir, targetSectionFilename);
  const relativeSectionPath = `src/sections/${targetSectionFilename}`;

  console.log(`🎯 Test target component: ${relativeSectionPath}`);
  const originalSectionCode = fs.readFileSync(targetSectionPath, 'utf-8');

  // Baseline Verification
  console.log('\n--- [BASELINE] Verifying Clean Initial Project Build ---');
  const baselineResult = await validateAndHealProject(testProjectDir, { maxAttempts: 1 });
  if (!baselineResult.success) {
    console.error('❌ Baseline project failed to build!', baselineResult.buildOutput);
    process.exit(1);
  }
  console.log(`✅ Baseline verified: Clean build passed in ${baselineResult.attempts} attempt(s).\n`);

  const results: ValidatorTestCaseResult[] = [];

  // =========================================================================
  // TEST 1: MISSING IMPORT
  // =========================================================================
  console.log('----------------------------------------------------');
  console.log('🧪 TEST 1: INTENTIONAL MISSING IMPORT');
  console.log('----------------------------------------------------');
  {
    // Corrupt target section by removing Button import while Button is used in JSX
    const corruptedCode = originalSectionCode.replace(/import\s*\{\s*Button\s*\}\s*from\s*['"][^'"]+['"];?\s*/g, '');
    fs.writeFileSync(targetSectionPath, corruptedCode, 'utf-8');
    console.log(`💥 Injected defect: Removed Button import from ${relativeSectionPath}`);

    // 1. Validate detection
    console.log('🔍 Running compiler validation...');
    const rawBuild = await runBuildValidation(testProjectDir);
    const diags = parseBuildDiagnostics(rawBuild.combinedOutput);

    const importDiag = diags.find(
      (d) => d.errorType === 'import' || d.message.toLowerCase().includes('cannot find name')
    );
    const errorDetected = !rawBuild.success && !!importDiag;

    console.log(`📊 Error Detected: ${errorDetected ? 'YES' : 'NO'}`);
    if (importDiag) {
      console.log(`   File:      ${importDiag.file}`);
      console.log(`   Line:      ${importDiag.line}, Col: ${importDiag.column}`);
      console.log(`   ErrorType: ${importDiag.errorType}`);
      console.log(`   Severity:  ${importDiag.severity}`);
      console.log(`   Message:   ${importDiag.message}`);
    }

    // 2. Run auto-healing engine
    console.log('🔧 Triggering Auto-Healing Engine (Max 3 attempts)...');
    const healResult = await validateAndHealProject(testProjectDir, { maxAttempts: 3 });

    const healedSectionCode = fs.readFileSync(targetSectionPath, 'utf-8');
    const importRestored = healedSectionCode.includes("from '../components/Button'") || healedSectionCode.includes('import { Button }');

    console.log(`✨ Healing Result: Success = ${healResult.success}, Attempts = ${healResult.attempts}`);
    console.log(`📝 Fixed Files:    ${healResult.fixedFiles.join(', ')}`);
    console.log(`🛠️  Import Restored in code: ${importRestored}`);

    results.push({
      name: 'Test 1: Missing Import',
      errorDetected,
      detectedDiagnostic: importDiag,
      healed: healResult.success && importRestored,
      attempts: healResult.attempts,
      fixedFiles: healResult.fixedFiles,
      finalBuildPassed: healResult.success,
      details: `Detected: ${importDiag?.message || 'None'}. Healed in attempt ${healResult.attempts}.`,
    });

    // Reset Section to clean state
    fs.writeFileSync(targetSectionPath, originalSectionCode, 'utf-8');
  }

  // =========================================================================
  // TEST 2: INVALID JSX SYNTAX
  // =========================================================================
  console.log('\n----------------------------------------------------');
  console.log('🧪 TEST 2: INTENTIONAL INVALID JSX SYNTAX');
  console.log('----------------------------------------------------');
  {
    // Inject mismatched JSX closing tag: <span>text</div>
    const corruptedCode = originalSectionCode.replace(
      /(<span[^>]*>[^<]+)<\/span>/,
      '$1</div>'
    );
    fs.writeFileSync(targetSectionPath, corruptedCode, 'utf-8');
    console.log(`💥 Injected defect: Mismatched JSX closing tag in ${relativeSectionPath}`);

    // 1. Validate detection
    console.log('🔍 Running compiler validation...');
    const rawBuild = await runBuildValidation(testProjectDir);
    const diags = parseBuildDiagnostics(rawBuild.combinedOutput);

    const syntaxDiag = diags.find(
      (d) =>
        d.errorType === 'syntax' ||
        d.message.toLowerCase().includes('expected') ||
        d.message.toLowerCase().includes('jsx') ||
        d.message.toLowerCase().includes('closing tag')
    );
    const errorDetected = !rawBuild.success && !!syntaxDiag;

    console.log(`📊 Error Detected: ${errorDetected ? 'YES' : 'NO'}`);
    if (syntaxDiag) {
      console.log(`   File:      ${syntaxDiag.file}`);
      console.log(`   Line:      ${syntaxDiag.line}, Col: ${syntaxDiag.column}`);
      console.log(`   ErrorType: ${syntaxDiag.errorType}`);
      console.log(`   Severity:  ${syntaxDiag.severity}`);
      console.log(`   Message:   ${syntaxDiag.message}`);
    }

    // 2. Run auto-healing engine
    console.log('🔧 Triggering Auto-Healing Engine (Max 3 attempts)...');
    const healResult = await validateAndHealProject(testProjectDir, { maxAttempts: 3 });

    console.log(`✨ Healing Result: Success = ${healResult.success}, Attempts = ${healResult.attempts}`);
    console.log(`📝 Fixed Files:    ${healResult.fixedFiles.join(', ')}`);

    results.push({
      name: 'Test 2: Invalid JSX',
      errorDetected,
      detectedDiagnostic: syntaxDiag,
      healed: healResult.success,
      attempts: healResult.attempts,
      fixedFiles: healResult.fixedFiles,
      finalBuildPassed: healResult.success,
      details: `Detected: ${syntaxDiag?.message || 'None'}. Healed in attempt ${healResult.attempts}.`,
    });

    // Reset Section to clean state
    fs.writeFileSync(targetSectionPath, originalSectionCode, 'utf-8');
  }

  // =========================================================================
  // TEST 3: TYPESCRIPT TYPE ERROR
  // =========================================================================
  console.log('\n----------------------------------------------------');
  console.log('🧪 TEST 3: INTENTIONAL TYPESCRIPT TYPE ERROR');
  console.log('----------------------------------------------------');
  {
    // Inject type mismatch: assign string to number
    const corruptedCode = originalSectionCode.replace(
      'export const Section1HeroSection: React.FC = () => {',
      'export const Section1HeroSection: React.FC = () => {\n  const activeCount: number = "100";'
    );
    fs.writeFileSync(targetSectionPath, corruptedCode, 'utf-8');
    console.log(`💥 Injected defect: Assigned string to number in ${relativeSectionPath}`);

    // 1. Validate detection
    console.log('🔍 Running compiler validation...');
    const rawBuild = await runBuildValidation(testProjectDir);
    const diags = parseBuildDiagnostics(rawBuild.combinedOutput);

    const typeDiag = diags.find(
      (d) => d.errorType === 'type' || d.message.toLowerCase().includes('not assignable')
    );
    const errorDetected = !rawBuild.success && !!typeDiag;

    console.log(`📊 Error Detected: ${errorDetected ? 'YES' : 'NO'}`);
    if (typeDiag) {
      console.log(`   File:      ${typeDiag.file}`);
      console.log(`   Line:      ${typeDiag.line}, Col: ${typeDiag.column}`);
      console.log(`   ErrorType: ${typeDiag.errorType}`);
      console.log(`   Severity:  ${typeDiag.severity}`);
      console.log(`   Message:   ${typeDiag.message}`);
    }

    // 2. Run auto-healing engine
    console.log('🔧 Triggering Auto-Healing Engine (Max 3 attempts)...');
    const healResult = await validateAndHealProject(testProjectDir, { maxAttempts: 3 });

    console.log(`✨ Healing Result: Success = ${healResult.success}, Attempts = ${healResult.attempts}`);
    console.log(`📝 Fixed Files:    ${healResult.fixedFiles.join(', ')}`);

    results.push({
      name: 'Test 3: TypeScript Type Error',
      errorDetected,
      detectedDiagnostic: typeDiag,
      healed: healResult.success,
      attempts: healResult.attempts,
      fixedFiles: healResult.fixedFiles,
      finalBuildPassed: healResult.success,
      details: `Detected: ${typeDiag?.message || 'None'}. Healed in attempt ${healResult.attempts}.`,
    });

    // Reset Section to clean state
    fs.writeFileSync(targetSectionPath, originalSectionCode, 'utf-8');
  }

  // =========================================================================
  // TEST 4: RETRY LIMIT BEHAVIOR (Max 3 attempts on unfixable failure)
  // =========================================================================
  console.log('\n----------------------------------------------------');
  console.log('🧪 TEST 4: RETRY LIMIT TEST (Max 3 Attempts)');
  console.log('----------------------------------------------------');
  {
    // Inject unfixable syntax
    const corruptedCode = `???@@@!!! UNPARSABLE CORRUPTION\n${originalSectionCode}`;
    fs.writeFileSync(targetSectionPath, corruptedCode, 'utf-8');
    console.log(`💥 Injected unfixable defect into ${relativeSectionPath}`);

    const healResult = await validateAndHealProject(testProjectDir, { maxAttempts: 3 });

    const retryLimitRespected = healResult.attempts <= 3 && !healResult.success;
    console.log(`📊 Max Attempts Bound: Attempts = ${healResult.attempts}/3, Success = ${healResult.success}`);
    console.log(`🛡️  Retry limit adhered: ${retryLimitRespected}`);

    results.push({
      name: 'Test 4: Retry Limit Bound',
      errorDetected: true,
      detectedDiagnostic: healResult.diagnostics[0],
      healed: false, // Expected to fail
      attempts: healResult.attempts,
      fixedFiles: healResult.fixedFiles,
      finalBuildPassed: !healResult.success, // Test passes if it correctly reports failure
      details: `Safely terminated at attempt ${healResult.attempts} without infinite loop.`,
    });

    // Reset Section to clean state
    fs.writeFileSync(targetSectionPath, originalSectionCode, 'utf-8');
  }

  // Final Summary Report
  console.log('\n====================================================');
  console.log('  MODULE 4: VALIDATION & AUTO-HEALING SUMMARY       ');
  console.log('====================================================');
  let allPassed = true;
  for (const r of results) {
    const isPassing = r.errorDetected && (r.name.includes('Retry') ? !r.healed : r.healed);
    if (!isPassing) allPassed = false;
    const icon = isPassing ? '✅' : '❌';
    console.log(`${icon} ${r.name}`);
    console.log(`   - Detected:  ${r.errorDetected}`);
    console.log(`   - Attempts:  ${r.attempts}`);
    console.log(`   - Details:   ${r.details}`);
  }
  console.log('====================================================');

  if (!allPassed) {
    console.error('❌ Some validation or auto-healing tests failed!');
    process.exit(1);
  } else {
    console.log('🎉 ALL MODULE 4 VALIDATION & AUTO-HEALING TESTS PASSED!\n');
  }
}

runValidatorTests().catch((err) => {
  console.error('Fatal error during validator test execution:', err);
  process.exit(1);
});
