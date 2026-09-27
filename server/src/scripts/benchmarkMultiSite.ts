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
  title: string;
  analyzerSuccess: boolean;
  analyzerTimeSeconds: number;
  sectionsDetected: number;
  assetsDetected: number;
  specSuccess: boolean;
  preservedSections: number;
  reactGenSuccess: boolean;
  generatedFilesCount: number;
  tsValidation: boolean;
  viteBuildSuccess: boolean;
  validationAttempts: number;
  totalDurationSeconds: number;
  overallStatus: 'PASSED' | 'FAILED';
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
  const startTime = Date.now();
  const targetDir = path.join(outputBase, site.folderName);

  const result: SiteBenchmarkResult = {
    name: site.name,
    url: site.url,
    title: site.name,
    analyzerSuccess: false,
    analyzerTimeSeconds: 0,
    sectionsDetected: 0,
    assetsDetected: 0,
    specSuccess: false,
    preservedSections: 0,
    reactGenSuccess: false,
    generatedFilesCount: 0,
    tsValidation: false,
    viteBuildSuccess: false,
    validationAttempts: 0,
    totalDurationSeconds: 0,
    overallStatus: 'FAILED',
    projectDir: targetDir,
  };

  try {
    // -------------------------------------------------------------------------
    // STEP 1: Website Analyzer (Playwright Perception)
    // -------------------------------------------------------------------------
    const analyzerStart = Date.now();
    const extractedData = await analyzeWebsite(site.url, {
      timeoutMs: 45000,
      onProgress: (_event) => {
        // quiet in benchmark loop
      },
    });
    result.analyzerTimeSeconds = Number(((Date.now() - analyzerStart) / 1000).toFixed(1));
    result.analyzerSuccess = true;
    result.title = extractedData.metadata.title || site.name;
    result.sectionsDetected = extractedData.sections.length;
    result.assetsDetected = extractedData.assets.length;

    // -------------------------------------------------------------------------
    // STEP 2: AI Analysis & UI Specification Layer
    // -------------------------------------------------------------------------
    const spec = await generateUISpecification(extractedData, {
      providerName: 'grounded',
    });

    if (spec && Array.isArray(spec.sections) && spec.sections.length > 0) {
      result.specSuccess = true;
      result.preservedSections = spec.sections.length;
    } else {
      throw new Error('UI Specification synthesis produced invalid or empty sections');
    }

    // -------------------------------------------------------------------------
    // STEP 3: React + Tailwind Code Generator
    // -------------------------------------------------------------------------
    const project = await generateReactProject(spec, {
      outputDir: targetDir,
      validateBuild: false, // validate explicitly in Step 4 for fine-grained reporting
    });

    if (project && Object.keys(project.files).length > 0) {
      result.reactGenSuccess = true;
      result.generatedFilesCount = Object.keys(project.files).length;
    } else {
      throw new Error('React code generation failed: no files generated');
    }

    // -------------------------------------------------------------------------
    // STEP 4: Validation & Auto-Healing Engine (tsc + vite build)
    // -------------------------------------------------------------------------
    const { validateAndHealProject } = await import('../validator');
    const valResult = await validateAndHealProject(targetDir, {
      maxAttempts: 3,
      spec,
    });

    result.validationAttempts = valResult.attempts || 1;
    const tsErrors = (valResult.diagnostics || []).filter((d) => d.errorType === 'type');
    result.tsValidation = tsErrors.length === 0 || valResult.success;
    result.viteBuildSuccess = valResult.success;

    if (
      result.analyzerSuccess &&
      result.specSuccess &&
      result.reactGenSuccess &&
      result.tsValidation &&
      result.viteBuildSuccess
    ) {
      result.overallStatus = 'PASSED';
    }
  } catch (err: any) {
    logger.error(`Benchmark failed for ${site.name}`, { error: err.message });
    result.error = err.message;
  } finally {
    result.totalDurationSeconds = Number(((Date.now() - startTime) / 1000).toFixed(1));
  }

  return result;
}

export async function runMultiSiteBenchmark(customUrls?: string[]) {
  console.log(`\n====================================================`);
  console.log(`        AI WEBSITE RECREATOR BENCHMARK`);
  console.log(`====================================================\n`);

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

  for (let i = 0; i < targets.length; i++) {
    const site = targets[i];
    process.stdout.write(`Processing [${i + 1}/${targets.length}] ${site.name} (${site.url})... `);
    const res = await runBenchmarkForSite(site, outputBase);
    results.push(res);
    console.log(`${res.overallStatus} (${res.totalDurationSeconds}s)`);
  }

  const totalTimeSeconds = Number(((Date.now() - benchmarkStart) / 1000).toFixed(1));

  // ---------------------------------------------------------------------------
  // PER-SITE DETAILED TERMINAL REPORT
  // ---------------------------------------------------------------------------
  console.log(`\n====================================================`);
  console.log(`        AI WEBSITE RECREATOR BENCHMARK REPORT`);
  console.log(`====================================================`);

  for (let i = 0; i < results.length; i++) {
    const r = results[i];
    console.log(`\nSite: ${r.name}`);
    console.log(`URL: ${r.url}`);
    console.log(`Title: ${r.title}`);
    console.log(``);
    console.log(`Analyzer:        ${r.analyzerSuccess ? 'PASSED' : 'FAILED'} (${r.analyzerTimeSeconds}s)`);
    console.log(`Sections:        ${r.sectionsDetected}`);
    console.log(`Assets:          ${r.assetsDetected}`);
    console.log(`UI Spec:         ${r.specSuccess ? 'PASSED' : 'FAILED'} (${r.preservedSections} preserved)`);
    console.log(`Generator:       ${r.reactGenSuccess ? 'PASSED' : 'FAILED'} (${r.generatedFilesCount} files)`);
    console.log(`TypeScript:      ${r.tsValidation ? 'PASSED' : 'FAILED'}`);
    console.log(`Vite Build:      ${r.viteBuildSuccess ? 'PASSED' : 'FAILED'}`);
    console.log(`Attempts:        ${r.validationAttempts}/3`);
    console.log(`Total Time:      ${r.totalDurationSeconds}s`);
    console.log(`Status:          ${r.overallStatus}`);

    if (i < results.length - 1) {
      console.log(`\n----------------------------------------------------`);
    }
  }

  // ---------------------------------------------------------------------------
  // FINAL COMPARISON SUMMARY TABLE
  // ---------------------------------------------------------------------------
  console.log(`\n====================================================`);
  console.log(`                 FINAL SUMMARY`);
  console.log(`====================================================\n`);

  console.log(`| Site | Analyzer | Spec | Generator | Validator | Overall |`);
  console.log(`|------|----------|------|-----------|-----------|---------|`);

  for (const r of results) {
    const a = r.analyzerSuccess ? 'PASS' : 'FAIL';
    const s = r.specSuccess ? 'PASS' : 'FAIL';
    const g = r.reactGenSuccess ? 'PASS' : 'FAIL';
    const v = r.viteBuildSuccess ? 'PASS' : 'FAIL';
    const o = r.overallStatus === 'PASSED' ? 'PASS' : 'FAIL';
    console.log(`| ${r.name} | ${a} | ${s} | ${g} | ${v} | ${o} |`);
  }

  const totalSites = results.length;
  const successfulSites = results.filter((r) => r.overallStatus === 'PASSED').length;

  console.log(`\nOverall:`);
  console.log(`${successfulSites}/${totalSites} websites completed successfully (Total Time: ${totalTimeSeconds}s)\n`);

  // Save audit artifact
  const auditPath = path.resolve(__dirname, '../../../output/multi_site_benchmark.json');
  fs.writeFileSync(
    auditPath,
    JSON.stringify(
      {
        timestamp: new Date().toISOString(),
        totalDurationSeconds: totalTimeSeconds,
        successfulSites,
        totalSites,
        passRatePercent: Math.round((successfulSites / totalSites) * 100),
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
