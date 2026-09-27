import { Page } from 'playwright';
import { SectionData, SectionItem, SectionType } from '@ai-website-recreator/shared';
import { resolveAssetUrl } from '../utils/urlHelper';
import { Logger } from '../utils/logger';

const logger = new Logger('SectionDetector');

export async function detectSections(page: Page, baseUrl: string): Promise<SectionData[]> {
  logger.info('Detecting major page sections and layout structures...');

  const rawSections = await page.evaluate(() => {
    // @ts-ignore
    const __name = (target: any) => target;

    // Utility to convert rgb to hex
    const rgbToHex = (rgbStr: string): string | null => {
      if (!rgbStr || rgbStr === 'transparent' || rgbStr === 'inherit') return null;
      const match = rgbStr.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*([\d.]+))?\)/);
      if (!match) return null;
      const r = parseInt(match[1], 10);
      const g = parseInt(match[2], 10);
      const b = parseInt(match[3], 10);
      const a = match[4] !== undefined ? parseFloat(match[4]) : 1;
      if (a === 0) return null;
      return '#' + [r, g, b].map((x) => x.toString(16).padStart(2, '0')).join('').toLowerCase();
    };

    const isDarkColor = (hex: string | null): boolean => {
      if (!hex || hex === '#ffffff') return false;
      const c = hex.substring(1);
      const rgb = parseInt(c, 16);
      const r = (rgb >> 16) & 0xff;
      const g = (rgb >> 8) & 0xff;
      const b = (rgb >> 0) & 0xff;
      const luma = 0.2126 * r + 0.7152 * g + 0.0722 * b;
      return luma < 128;
    };

    // Collect candidate section elements
    const sectionCandidates: HTMLElement[] = [];
    const directElements = Array.from(document.querySelectorAll('header, footer, section, main > div, body > div'));

    for (const el of directElements) {
      const htmlEl = el as HTMLElement;
      const rect = htmlEl.getBoundingClientRect();
      const style = window.getComputedStyle(htmlEl);

      // Must be visible and have noticeable height (at least 80px)
      if (
        style.display !== 'none' &&
        style.visibility !== 'hidden' &&
        rect.height >= 80 &&
        rect.width >= 300
      ) {
        sectionCandidates.push(htmlEl);
      }
    }

    // If no distinct sections found, fall back to body children
    if (sectionCandidates.length === 0) {
      const bodyChildren = Array.from(document.body.children) as HTMLElement[];
      sectionCandidates.push(...bodyChildren.filter((c) => c.getBoundingClientRect().height >= 80));
    }

    // Process each candidate section
    const detected: Array<{
      id: string;
      type: SectionType;
      name: string;
      heading?: string;
      subheading?: string;
      description?: string;
      layout: {
        type: 'grid' | 'flex' | 'single-column' | 'split-hero' | 'cards' | 'masonry';
        columns?: number;
        gap?: string;
        alignment?: string;
      };
      items: SectionItem[];
      buttons: Array<{ text: string; href?: string; variant: 'primary' | 'secondary' | 'outline' }>;
      styling: {
        backgroundColor?: string;
        textColor?: string;
        isDark?: boolean;
        hasGradient?: boolean;
        padding?: string;
      };
      rawTextSample: string[];
      assets: Array<{ rawUrl: string; type: any; alt?: string; context: string }>;
    }> = [];

    let sectionIndex = 0;

    for (const el of sectionCandidates) {
      sectionIndex++;
      const tag = el.tagName.toLowerCase();
      const className = (el.className || '').toString().toLowerCase();
      const id = (el.id || `section-${sectionIndex}`).toLowerCase();
      const textContent = (el.textContent || '').trim();

      if (!textContent && el.querySelectorAll('img, svg').length === 0) continue;

      // Extract Headings
      const h1 = el.querySelector('h1')?.textContent?.trim();
      const h2 = el.querySelector('h2')?.textContent?.trim();
      const h3 = el.querySelector('h3')?.textContent?.trim();
      const heading = h1 || h2 || h3 || undefined;

      // Extract Subheading / Kicker
      let subheading: string | undefined = undefined;
      const badgeEl = el.querySelector('[class*="badge"], [class*="pill"], [class*="tag"], span.text-sm');
      if (badgeEl && badgeEl.textContent?.trim() !== heading) {
        subheading = badgeEl.textContent?.trim();
      }

      // Extract Lead Description
      const paragraphs = Array.from(el.querySelectorAll('p'))
        .map((p) => p.textContent?.trim() || '')
        .filter((t) => t.length > 20 && t !== heading);
      const description = paragraphs[0] || undefined;

      // Classify Section Type
      let type: SectionType = 'content';
      if (tag === 'footer' || className.includes('footer') || id.includes('footer')) {
        type = 'footer';
      } else if (tag === 'header' || className.includes('header') || id.includes('header')) {
        type = 'header';
      } else if (
        sectionIndex === 1 ||
        h1 !== undefined ||
        className.includes('hero') ||
        id.includes('hero') ||
        className.includes('banner')
      ) {
        type = 'hero';
      } else if (
        className.includes('feature') ||
        id.includes('feature') ||
        el.querySelectorAll('[class*="feature"], [class*="card"]').length >= 3
      ) {
        type = 'features';
      } else if (
        className.includes('pricing') ||
        id.includes('pricing') ||
        textContent.includes('/mo') ||
        textContent.includes('/month') ||
        textContent.includes('€') ||
        textContent.includes('$') && el.querySelectorAll('button').length >= 2
      ) {
        type = 'pricing';
      } else if (
        className.includes('testimonial') ||
        className.includes('review') ||
        id.includes('testimonial')
      ) {
        type = 'testimonials';
      } else if (className.includes('faq') || id.includes('faq') || el.querySelectorAll('details').length >= 2) {
        type = 'faq';
      } else if (
        className.includes('logo') ||
        className.includes('partner') ||
        className.includes('sponsor') ||
        (el.querySelectorAll('img').length >= 4 && el.querySelectorAll('p').length <= 1)
      ) {
        type = 'social-proof';
      } else if (
        className.includes('stat') ||
        id.includes('stat') ||
        /\b\d+[\%kM\+]+\b/.test(textContent)
      ) {
        type = 'stats';
      } else if (
        className.includes('cta') ||
        id.includes('cta') ||
        (paragraphs.length <= 2 && el.querySelectorAll('button, a[class*="btn"]').length >= 1 && sectionIndex > 2)
      ) {
        type = 'cta';
      }

      // Detect Layout
      const style = window.getComputedStyle(el);
      const isGrid = style.display === 'grid';
      const isFlex = style.display === 'flex';
      let layoutType: 'grid' | 'flex' | 'single-column' | 'split-hero' | 'cards' | 'masonry' = 'single-column';
      let columns = 1;

      if (type === 'hero') {
        const hasSplitColumns = el.querySelectorAll('div > div, div > img').length >= 2;
        layoutType = hasSplitColumns ? 'split-hero' : 'single-column';
      } else if (isGrid) {
        layoutType = 'grid';
        const colsMatch = style.gridTemplateColumns.split(/\s+/).length;
        columns = colsMatch > 1 ? colsMatch : 3;
      } else if (isFlex && style.flexWrap === 'wrap') {
        layoutType = 'cards';
        columns = 3;
      }

      // Extract Repeated Items / Cards (for Features, Pricing, Testimonials, Stats)
      const items: SectionItem[] = [];
      const cardElements = Array.from(
        el.querySelectorAll(
          '[class*="card"], [class*="col"], [class*="item"], [class*="feature"], [class*="plan"], [class*="tier"], [class*="box"]'
        )
      ).slice(0, 8);

      if (cardElements.length >= 2) {
        for (const card of cardElements) {
          const cardHeading = card.querySelector('h2, h3, h4, h5, strong')?.textContent?.trim();
          const cardDesc = card.querySelector('p')?.textContent?.trim();
          const cardImg = card.querySelector('img')?.getAttribute('src');
          const cardPrice = card.querySelector('[class*="price"], .amount')?.textContent?.trim();

          if (cardHeading || cardDesc) {
            items.push({
              title: cardHeading,
              description: cardDesc,
              imageUrl: cardImg || undefined,
              price: cardPrice,
            });
          }
        }
      }

      // Extract Action Buttons
      const buttons: Array<{ text: string; href?: string; variant: 'primary' | 'secondary' | 'outline' }> = [];
      const btnEls = Array.from(el.querySelectorAll('button, a[role="button"], a.btn, a[class*="button"]')).slice(0, 4);

      btnEls.forEach((btn, idx) => {
        const text = btn.textContent?.trim();
        const href = btn.getAttribute('href') || undefined;
        if (text && text.length < 30) {
          buttons.push({
            text,
            href,
            variant: idx === 0 ? 'primary' : 'secondary',
          });
        }
      });

      // Extract Section Assets
      const assets: Array<{ rawUrl: string; type: any; alt?: string; context: string }> = [];
      const sectionImgs = Array.from(el.querySelectorAll('img')).slice(0, 6);
      for (const img of sectionImgs) {
        const src = img.currentSrc || img.getAttribute('src');
        if (src) {
          assets.push({
            rawUrl: src,
            type: 'image',
            alt: img.getAttribute('alt') || undefined,
            context: `${type}-asset`,
          });
        }
      }

      // Styling
      const bgColor = rgbToHex(style.backgroundColor);
      const txtColor = rgbToHex(style.color);
      const isDark = isDarkColor(bgColor);

      // Raw text snippet (first 10 unique text tokens)
      const textSamples = Array.from(el.querySelectorAll('h1, h2, h3, h4, p, span'))
        .map((n) => n.textContent?.trim() || '')
        .filter((t) => t.length > 3 && t.length < 150)
        .slice(0, 8);

      detected.push({
        id: `section-${sectionIndex}-${type}`,
        type,
        name: heading ? `${type.toUpperCase()}: ${heading.slice(0, 30)}` : `${type.toUpperCase()} Section`,
        heading,
        subheading,
        description,
        layout: {
          type: layoutType,
          columns,
          gap: style.gap || '24px',
        },
        items,
        buttons,
        styling: {
          backgroundColor: bgColor || undefined,
          textColor: txtColor || undefined,
          isDark,
          padding: `${style.paddingTop} ${style.paddingRight} ${style.paddingBottom} ${style.paddingLeft}`,
        },
        rawTextSample: textSamples,
        assets,
      });
    }

    return detected;
  });

  // Resolve asset URLs to absolute URLs
  const sections: SectionData[] = rawSections.map((sec) => ({
    ...sec,
    items: sec.items.map((it) => ({
      ...it,
      imageUrl: it.imageUrl ? resolveAssetUrl(it.imageUrl, baseUrl) : undefined,
    })),
    assets: sec.assets.map((asset) => ({
      url: resolveAssetUrl(asset.rawUrl, baseUrl),
      type: asset.type,
      alt: asset.alt,
      context: asset.context,
    })),
  }));

  logger.info(`Detected ${sections.length} major sections: ${sections.map((s) => s.type).join(', ')}`);
  return sections;
}
