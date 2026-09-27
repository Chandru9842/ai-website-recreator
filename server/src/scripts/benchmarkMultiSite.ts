import * as fs from 'fs';
import * as path from 'path';
import { analyzeWebsite } from '../analyzer';
import { generateUISpecification } from '../ai';
import { generateReactProject } from '../generator';
import { Logger } from '../utils/logger';

const logger = new Logger('MultiSiteBenchmark');

export interface SiteBenchmarkResult {
  name: string;
  url: string;
  analyzerSuccess: boolean;
  sectionsDetected: number;
  assetsDetected: number;
  specSuccess: boolean;
  reactGenSuccess: boolean;
  tsValidation: boolean;
  viteBuildSuccess: boolean;
  durationSeconds: number;
  projectDir?: string;
  error?: string;
}

interface TargetSite {
  name: string;
  url: string;
  folderName: string;
}

const DEFAULT_SITES: TargetSite[] = [
  {
    name: 'Hacker News',
    url: 'https://news.ycombinator.com',
    folderName: 'benchmark_hackernews',
  },
  {
    name: 'Tailwind CSS',
    url: 'https://tailwindcss.com',
    folderName: 'benchmark_tailwindcss',
  },
  {
    name: 'Quotes to Scrape',
    url: 'https://quotes.toscrape.com',
    folderName: 'benchmark_quotes_catalog',
  },
];

async function runBenchmarkForSite(site: TargetSite, outputBase: string): Promise<SiteBenchmarkResult> {
  console.log(`\n================================================================================`);
  console.log(`🚀 BENCHMARKING TARGET: ${site.name.toUpperCase()} (${site.url})`);
  console.log(`================================================================================`);

  const startTime = Date.now();
  const targetDir = path.join(outputBase, site.folderName);

  const result: SiteBenchmarkResult = {
    name: site.name,
    url: site.url,
    analyzerSuccess: false,
    sectionsDetected: 0,
    assetsDetected: 0,
    specSuccess: false,
    reactGenSuccess: false,
    tsValidation: false,
    viteBuildSuccess: false,
    durationSeconds: 0,
    projectDir: targetDir,
  };

  try {
    // -------------------------------------------------------------------------
    // STEP 1: Website Analyzer (Playwright Perception)
    // -------------------------------------------------------------------------
    console.log(`\n[Stage 1/4] Running Playwright Website Analyzer on ${site.url}...`);
    const extractedData = await analyzeWebsite(site.url, {
      timeoutMs: 45000,
      onProgress: (event) => {
        const bar = '='.repeat(Math.floor(event.progress / 5)).padEnd(20, ' ');
        process.stdout.write(`\r  [${bar}] ${event.progress.toString().padStart(3, ' ')}% | ${event.message.slice(0, 50)}...`);
      },
    });
    console.log('\n  ✅ Analysis complete!');

    result.analyzerSuccess = true;
    result.sectionsDetected = extractedData.sections.length;
    result.assetsDetected = extractedData.assets.length;

    console.log(`  📊 Extracted Metrics:`);
    console.log(`     • Title:            ${extractedData.metadata.title}`);
    console.log(`     • Colors Detected:  ${extractedData.colors.palette.length} palette tokens (Primary: ${extractedData.colors.primary})`);
    console.log(`     • Typography Fonts: ${extractedData.typography.headingFont} / ${extractedData.typography.bodyFont}`);
    console.log(`     • Sections Found:   ${result.sectionsDetected} (${extractedData.sections.map((s) => s.type).join(', ')})`);
    console.log(`     • Assets Found:     ${result.assetsDetected} media items`);

    // -------------------------------------------------------------------------
    // STEP 2: AI Analysis & UI Specification Layer
    // -------------------------------------------------------------------------
    console.log(`\n[Stage 2/4] Synthesizing Grounded UI Specification...`);
    const spec = await generateUISpecification(extractedData, {
      providerName: 'grounded',
    });

    if (spec && Array.isArray(spec.sections) && spec.sections.length > 0) {
      result.specSuccess = true;
      console.log(`  ✅ UI Specification synthesized cleanly (${spec.sections.length} typed sections, ${spec.navigation.links.length} nav links)`);
    } else {
      throw new Error('UI Specification synthesis produced invalid or empty sections');
    }

    // -------------------------------------------------------------------------
    // STEP 3: React + Tailwind Code Generator
    // -------------------------------------------------------------------------
    console.log(`\n[Stage 3/4] Generating Modular React + Tailwind Project in:`);
    console.log(`  📁 ${targetDir}`);

    const project = await generateReactProject(spec, {
      outputDir: targetDir,
      validateBuild: false, // validate explicitly in Step 4 for fine-grained reporting
    });

    if (project && Object.keys(project.files).length > 0) {
      result.reactGenSuccess = true;
      console.log(`  ✅ React project scaffolded (${Object.keys(project.files).length} files generated)`);
    } else {
      throw new Error('React code generation failed: no files generated');
    }

    // -------------------------------------------------------------------------
    // STEP 4: Validation & Auto-Healing Engine (tsc + vite build)
    // -------------------------------------------------------------------------
    console.log(`\n[Stage 4/4] Validating Build with Auto-Healing (tsc --noEmit & vite build)...`);
    const { validateAndHealProject } = await import('../validator');
    const valResult = await validateAndHealProject(targetDir, {
      maxAttempts: 3,
      spec,
    });

    const tsErrors = valResult.diagnostics.filter((d) => d.errorType === 'type');
    result.tsValidation = tsErrors.length === 0 || valResult.success;
    result.viteBuildSuccess = valResult.success;

    if (valResult.success) {
      console.log(`  ✅ Build Validation PASSED (Production bundle ready in dist/)`);
    } else {
      console.warn(`  ⚠️ Build validation completed with diagnostics: ${valResult.diagnostics[0]?.message || 'Build errors'}`);
    }
  } catch (err: any) {
    logger.error(`Benchmark failed for ${site.name}`, { error: err.message });
    result.error = err.message;
    console.error(`\n❌ Error during pipeline execution: ${err.message}`);
  } finally {
    result.durationSeconds = Number(((Date.now() - startTime) / 1000).toFixed(1));
  }

  return result;
}

export async function runMultiSiteBenchmark(customUrls?: string[]) {
  console.log(`\n`);
  console.log(`================================================================================`);
  console.log(`       AI WEBSITE RECREATOR — AUTOMATED MULTI-SITE GENERALIZATION BENCHMARK      `);
  console.log(`================================================================================`);
  console.log(`Evaluating pipeline adaptability across structurally diverse public websites.\n`);

  const outputBase = path.resolve(__dirname, '../../../output/generated_projects');
  if (!fs.existsSync(outputBase)) {
    fs.mkdirSync(outputBase, { recursive: true });
  }

  let targets = DEFAULT_SITES;
  if (customUrls && customUrls.length > 0) {
    targets = customUrls.map((url, idx) => ({
      name: `Custom Site ${idx + 1}`,
      url,
      folderName: `benchmark_custom_${idx + 1}`,
    }));
  }

  const results: SiteBenchmarkResult[] = [];
  const benchmarkStart = Date.now();

  for (const site of targets) {
    const res = await runBenchmarkForSite(site, outputBase);
    results.push(res);
  }

  const totalTimeSeconds = Number(((Date.now() - benchmarkStart) / 1000).toFixed(1));

  // ---------------------------------------------------------------------------
  // COMPARISON TABLE REPORT
  // ---------------------------------------------------------------------------
  console.log(`\n\n`);
  console.log(`========================================================================================================================`);
  console.log(`                                        FINAL MULTI-SITE BENCHMARK COMPARISON TABLE                                     `);
  console.log(`========================================================================================================================`);

  const pad = (str: string, len: number) => str.padEnd(len, ' ').slice(0, len);
  const statusIcon = (val: boolean) => (val ? '✅ PASS' : '❌ FAIL');

  console.log(
    `${pad('Site Name', 18)} | ${pad('Target URL', 30)} | ${pad('Analyzer', 9)} | ${pad('Sec', 4)} | ${pad('Assets', 6)} | ${pad('UI Spec', 9)} | ${pad('React Gen', 9)} | ${pad('TS Valid', 9)} | ${pad('Vite Build', 10)} | ${pad('Time', 6)}`
  );
  console.log(`-------------------|--------------------------------|-----------|------|--------|-----------|-----------|-----------|------------|-------`);

  for (const r of results) {
    console.log(
      `${pad(r.name, 18)} | ${pad(r.url, 30)} | ${pad(statusIcon(r.analyzerSuccess), 9)} | ${pad(String(r.sectionsDetected), 4)} | ${pad(String(r.assetsDetected), 6)} | ${pad(statusIcon(r.specSuccess), 9)} | ${pad(statusIcon(r.reactGenSuccess), 9)} | ${pad(statusIcon(r.tsValidation), 9)} | ${pad(statusIcon(r.viteBuildSuccess), 10)} | ${pad(`${r.durationSeconds}s`, 6)}`
    );
  }

  console.log(`========================================================================================================================`);

  const totalSites = results.length;
  const successfulSites = results.filter(
    (r) => r.analyzerSuccess && r.specSuccess && r.reactGenSuccess && r.viteBuildSuccess
  ).length;
  const passRate = Math.round((successfulSites / totalSites) * 100);

  console.log(`📌 SUMMARY METRICS:`);
  console.log(`   • Total Websites Evaluated:   ${totalSites}`);
  console.log(`   • Fully Recreated & Built:    ${successfulSites}/${totalSites} (${passRate}%)`);
  console.log(`   • Total Benchmark Duration:   ${totalTimeSeconds}s`);
  console.log(`   • Architecture Generalization: ${passRate === 100 ? '✅ 100% GENERALIZATION CONFIRMED' : '⚠️ PARTIAL GENERALIZATION'}`);
  console.log(`========================================================================================================================\n`);

  // Save audit artifact
  const auditPath = path.resolve(__dirname, '../../../output/multi_site_benchmark.json');
  fs.writeFileSync(
    auditPath,
    JSON.stringify(
      {
        timestamp: new Date().toISOString(),
        totalDurationSeconds: totalTimeSeconds,
        passRatePercent: passRate,
        results,
      },
      null,
      2
    )
  );
  console.log(`💾 Saved complete benchmark audit log to: ${auditPath}\n`);

  if (successfulSites < totalSites) {
    process.exit(1);
  }
}

// Direct CLI Execution
if (require.main === module || process.argv[1]?.includes('benchmarkMultiSite')) {
  const cliUrls = process.argv.slice(2).filter((arg) => arg.startsWith('http'));
  runMultiSiteBenchmark(cliUrls.length > 0 ? cliUrls : undefined).catch((err) => {
    console.error('Fatal benchmark error:', err);
    process.exit(1);
  });
}
