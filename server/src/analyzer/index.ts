import {
  AnalysisProgressEvent,
  AnalysisStep,
  ExtractedWebsiteData,
} from '@ai-website-recreator/shared';
import { createBrowserSession, triggerLazyLoading } from './browser';
import { extractDOMStructure } from './domExtractor';
import { extractStyles } from './styleExtractor';
import { extractAssets } from './assetExtractor';
import { detectSections } from './sectionDetector';
import { inspectResponsive } from './responsiveInspector';
import { normalizeUrl } from '../utils/urlHelper';
import { Logger } from '../utils/logger';

const logger = new Logger('WebsiteAnalyzer');

export interface AnalyzerOptions {
  onProgress?: (event: AnalysisProgressEvent) => void;
  viewport?: { width: number; height: number };
  timeoutMs?: number;
}

export async function analyzeWebsite(
  rawUrl: string,
  options: AnalyzerOptions = {}
): Promise<ExtractedWebsiteData> {
  const url = normalizeUrl(rawUrl);
  logger.info(`Starting deep website analysis for: ${url}`);

  const reportProgress = (step: AnalysisStep, progress: number, message: string) => {
    logger.info(`[${progress}%] ${message}`);
    if (options.onProgress) {
      options.onProgress({
        step,
        progress,
        message,
        timestamp: new Date().toISOString(),
      });
    }
  };

  reportProgress('browser_launch', 5, 'Launching headless Playwright browser engine...');
  const session = await createBrowserSession(options.viewport || { width: 1440, height: 900 });

  try {
    reportProgress('navigating', 15, `Navigating to ${url}...`);

    // Navigate with graceful timeout fallback
    try {
      await session.page.goto(url, {
        waitUntil: 'networkidle',
        timeout: options.timeoutMs || 25000,
      });
    } catch (navErr: any) {
      logger.warn(`networkidle timed out or failed, falling back to domcontentloaded: ${navErr.message}`);
      await session.page.goto(url, {
        waitUntil: 'domcontentloaded',
        timeout: 15000,
      });
    }

    // Ensure __name is bound globally for tsx / esbuild function serializations
    await session.page.evaluate('window.__name = (t) => t; globalThis.__name = (t) => t;').catch(() => {});

    reportProgress('rendering_content', 30, 'Triggering lazy-loaded assets and interactive elements...');
    await triggerLazyLoading(session.page);

    reportProgress('extracting_dom', 45, 'Inspecting DOM hierarchy, semantic tags, and navigation bar...');
    const domSummary = await extractDOMStructure(session.page, url);

    reportProgress('extracting_styles', 60, 'Mining computed color palette and typography scale...');
    const styles = await extractStyles(session.page);

    reportProgress('extracting_assets', 75, 'Extracting images, vector SVGs, and brand assets...');
    const assets = await extractAssets(session.page, url);

    reportProgress('detecting_sections', 85, 'Segmenting major sections (Hero, Features, Pricing, Footer)...');
    const sections = await detectSections(session.page, url);

    reportProgress('inspecting_responsive', 95, 'Inspecting responsive breakpoints and layout shifts...');
    const responsive = await inspectResponsive(session.page);

    const extractedData: ExtractedWebsiteData = {
      metadata: domSummary.metadata,
      colors: styles.colors,
      typography: styles.typography,
      navigation: domSummary.navigation,
      sections,
      assets,
      responsive,
      rawDomSummary: domSummary.rawDomSummary,
    };

    reportProgress('completed', 100, `Successfully analyzed ${url}! Extracted ${sections.length} sections and ${assets.length} assets.`);
    return extractedData;
  } catch (error: any) {
    logger.error('Website analysis failed', { error: error.message, stack: error.stack });
    reportProgress('failed', 0, `Analysis failed: ${error.message}`);
    throw error;
  } finally {
    await session.close();
  }
}

export * from './browser';
export * from './domExtractor';
export * from './styleExtractor';
export * from './assetExtractor';
export * from './sectionDetector';
export * from './responsiveInspector';
