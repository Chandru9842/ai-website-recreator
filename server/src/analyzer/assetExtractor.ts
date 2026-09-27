import { Page } from 'playwright';
import { AssetInfo } from '@ai-website-recreator/shared';
import { resolveAssetUrl } from '../utils/urlHelper';
import { Logger } from '../utils/logger';

const logger = new Logger('AssetExtractor');

export async function extractAssets(page: Page, baseUrl: string): Promise<AssetInfo[]> {
  logger.info('Extracting assets, images, and SVGs...');

  const rawAssets = await page.evaluate(() => {
    // @ts-ignore
    const __name = (target: any) => target;

    const assets: Array<{
      rawUrl: string;
      type: 'image' | 'svg' | 'background' | 'icon' | 'logo';
      alt?: string;
      width?: number;
      height?: number;
      context: string;
    }> = [];

    const seenUrls = new Set<string>();

    const isVisible = (el: Element): boolean => {
      const style = window.getComputedStyle(el);
      const rect = el.getBoundingClientRect();
      return (
        style.display !== 'none' &&
        style.visibility !== 'hidden' &&
        style.opacity !== '0' &&
        rect.width > 0 &&
        rect.height > 0
      );
    };

    // 1. Process <img> elements
    const images = Array.from(document.querySelectorAll('img'));
    for (const img of images) {
      const src = img.currentSrc || img.getAttribute('src') || img.getAttribute('data-src');
      if (!src || src.startsWith('data:image/gif;base64,R0lGODlh')) continue; // Skip 1px spacers

      const rect = img.getBoundingClientRect();
      const width = Math.round(rect.width || img.naturalWidth || 0);
      const height = Math.round(rect.height || img.naturalHeight || 0);

      // Skip tiny tracking pixels
      if (width > 0 && width < 10 && height > 0 && height < 10) continue;

      let context = 'content-image';
      const alt = (img.getAttribute('alt') || '').toLowerCase();
      const className = (img.className || '').toLowerCase();
      const id = (img.id || '').toLowerCase();
      const parentNav = img.closest('nav, header');

      if (parentNav || alt.includes('logo') || className.includes('logo') || id.includes('logo')) {
        context = 'logo';
      } else if (img.closest('section:first-of-type, [class*="hero"], [id*="hero"]')) {
        context = 'hero-visual';
      } else if (width <= 64 && height <= 64) {
        context = 'icon';
      } else if (img.closest('[class*="card"], [class*="feature"], [class*="testimonial"]')) {
        context = 'card-image';
      }

      if (!seenUrls.has(src)) {
        seenUrls.add(src);
        assets.push({
          rawUrl: src,
          type: context === 'logo' ? 'logo' : 'image',
          alt: img.getAttribute('alt') || undefined,
          width,
          height,
          context,
        });
      }
    }

    // 2. Process background images on elements
    const allElements = Array.from(document.querySelectorAll('div, section, header, banner'));
    for (const el of allElements) {
      if (!isVisible(el)) continue;
      const bg = window.getComputedStyle(el).backgroundImage;
      if (bg && bg.startsWith('url(')) {
        const match = bg.match(/url\(['"]?(.*?)['"]?\)/);
        if (match && match[1] && !seenUrls.has(match[1])) {
          const rawUrl = match[1];
          seenUrls.add(rawUrl);
          const rect = el.getBoundingClientRect();
          assets.push({
            rawUrl,
            type: 'background',
            width: Math.round(rect.width),
            height: Math.round(rect.height),
            context: 'background-container',
          });
        }
      }
    }

    // 3. Process inline SVGs (capture as data uri or vector markers)
    const svgs = Array.from(document.querySelectorAll('svg'));
    let svgCount = 0;
    for (const svg of svgs) {
      if (svgCount >= 30) break; // Limit to 30 significant icons
      if (!isVisible(svg)) continue;
      const rect = svg.getBoundingClientRect();
      if (rect.width <= 0 || rect.height <= 0) continue;

      const isLogo = svg.closest('header, nav, [class*="logo"], [id*="logo"]') !== null;
      const outer = svg.outerHTML;
      if (outer.length > 5000) continue; // Skip huge complex SVGs

      const dataUri = `data:image/svg+xml;utf8,${encodeURIComponent(outer)}`;
      if (!seenUrls.has(dataUri)) {
        seenUrls.add(dataUri);
        svgCount++;
        assets.push({
          rawUrl: dataUri,
          type: isLogo ? 'logo' : 'svg',
          width: Math.round(rect.width),
          height: Math.round(rect.height),
          context: isLogo ? 'logo-vector' : 'icon',
        });
      }
    }

    // 4. Meta og:image and favicon
    const ogImg = document.querySelector('meta[property="og:image"]')?.getAttribute('content');
    if (ogImg && !seenUrls.has(ogImg)) {
      seenUrls.add(ogImg);
      assets.push({
        rawUrl: ogImg,
        type: 'image',
        context: 'social-preview',
      });
    }

    const favicon = document.querySelector('link[rel="icon"], link[rel="shortcut icon"]')?.getAttribute('href');
    if (favicon && !seenUrls.has(favicon)) {
      seenUrls.add(favicon);
      assets.push({
        rawUrl: favicon,
        type: 'icon',
        context: 'favicon',
      });
    }

    return assets;
  });

  // Resolve raw URLs to absolute URLs
  const resolvedAssets: AssetInfo[] = rawAssets.map((asset) => ({
    url: resolveAssetUrl(asset.rawUrl, baseUrl),
    type: asset.type,
    alt: asset.alt,
    dimensions:
      asset.width && asset.height
        ? { width: asset.width, height: asset.height }
        : undefined,
    context: asset.context,
  }));

  logger.info(`Extracted ${resolvedAssets.length} assets`);
  return resolvedAssets;
}
