import { Page } from 'playwright';
import { NavigationStructure, PageMetadata } from '@ai-website-recreator/shared';
import { resolveAssetUrl } from '../utils/urlHelper';
import { Logger } from '../utils/logger';

const logger = new Logger('DOMExtractor');

export interface DOMSummary {
  metadata: PageMetadata;
  navigation: NavigationStructure;
  rawDomSummary: {
    totalNodes: number;
    headingsCount: number;
    buttonsCount: number;
    imagesCount: number;
  };
}

export async function extractDOMStructure(page: Page, url: string): Promise<DOMSummary> {
  logger.info('Extracting DOM structure, metadata, and navigation...');

  const result = await page.evaluate((pageUrl) => {
    // @ts-ignore
    const __name = (target: any) => target;

    // 1. Metadata
    const title = document.title || '';
    const metaDesc =
      document.querySelector('meta[name="description"]')?.getAttribute('content') ||
      document.querySelector('meta[property="og:description"]')?.getAttribute('content') ||
      undefined;

    const favicon =
      document.querySelector('link[rel="icon"]')?.getAttribute('href') ||
      document.querySelector('link[rel="shortcut icon"]')?.getAttribute('href') ||
      undefined;

    const ogImage = document.querySelector('meta[property="og:image"]')?.getAttribute('content') || undefined;

    // 2. Navigation Analysis
    const navEl = document.querySelector('header, nav, [role="navigation"]');
    let brandText: string | undefined = undefined;
    let brandLogoUrl: string | undefined = undefined;
    const navLinks: Array<{ text: string; href: string; isButton?: boolean; hasDropdown?: boolean }> = [];
    const ctaButtons: Array<{ text: string; href?: string; variant: 'primary' | 'secondary' | 'outline' }> = [];
    let isSticky = false;
    let hasMobileMenu = false;

    if (navEl) {
      const navStyle = window.getComputedStyle(navEl);
      isSticky = navStyle.position === 'sticky' || navStyle.position === 'fixed';

      // Look for logo / brand
      const logoImg = navEl.querySelector('img[alt*="logo" i], img[class*="logo" i], a[class*="logo" i] img, a[class*="brand" i] img');
      if (logoImg) {
        brandLogoUrl = logoImg.getAttribute('src') || (logoImg as HTMLImageElement).currentSrc;
      }
      const logoTextEl = navEl.querySelector('a[class*="brand" i], a[class*="logo" i], .brand, .logo');
      if (logoTextEl && !brandLogoUrl) {
        brandText = logoTextEl.textContent?.trim();
      }

      // Collect links
      const links = Array.from(navEl.querySelectorAll('a'));
      const seenText = new Set<string>();

      links.forEach((a) => {
        const text = (a.textContent || '').trim();
        const href = a.getAttribute('href') || '#';

        if (!text || seenText.has(text) || text.length > 30) return;
        seenText.add(text);

        const isBtn =
          a.classList.contains('btn') ||
          a.classList.contains('button') ||
          window.getComputedStyle(a).backgroundColor !== 'rgba(0, 0, 0, 0)';

        if (isBtn) {
          ctaButtons.push({
            text,
            href,
            variant: 'primary',
          });
        } else {
          navLinks.push({
            text,
            href,
            isButton: false,
          });
        }
      });

      // Collect buttons in nav
      const buttons = Array.from(navEl.querySelectorAll('button'));
      buttons.forEach((btn) => {
        const text = (btn.textContent || '').trim();
        const ariaLabel = btn.getAttribute('aria-label') || '';
        if (ariaLabel.toLowerCase().includes('menu') || text.toLowerCase().includes('menu')) {
          hasMobileMenu = true;
        } else if (text && text.length < 30) {
          ctaButtons.push({
            text,
            variant: 'primary',
          });
        }
      });
    }

    // 3. Raw DOM statistics
    const totalNodes = document.querySelectorAll('*').length;
    const headingsCount = document.querySelectorAll('h1, h2, h3, h4, h5, h6').length;
    const buttonsCount = document.querySelectorAll('button, a[role="button"], input[type="button"], input[type="submit"]').length;
    const imagesCount = document.querySelectorAll('img, svg').length;

    return {
      metadata: {
        url: pageUrl,
        title,
        description: metaDesc,
        favicon,
        ogImage,
        viewport: {
          width: window.innerWidth,
          height: window.innerHeight,
        },
        timestamp: new Date().toISOString(),
      },
      navigation: {
        brand: {
          text: brandText,
          logoUrl: brandLogoUrl,
        },
        links: navLinks.slice(0, 10),
        ctaButtons: ctaButtons.slice(0, 3),
        isSticky,
        hasMobileMenu,
      },
      rawDomSummary: {
        totalNodes,
        headingsCount,
        buttonsCount,
        imagesCount,
      },
    };
  }, url);

  // Normalize URLs
  if (result.metadata.favicon) {
    result.metadata.favicon = resolveAssetUrl(result.metadata.favicon, url);
  }
  if (result.metadata.ogImage) {
    result.metadata.ogImage = resolveAssetUrl(result.metadata.ogImage, url);
  }
  if (result.navigation.brand.logoUrl) {
    result.navigation.brand.logoUrl = resolveAssetUrl(result.navigation.brand.logoUrl, url);
  }

  logger.info(`Extracted DOM summary. Nav links: ${result.navigation.links.length}, Headings: ${result.rawDomSummary.headingsCount}`);
  return result;
}
