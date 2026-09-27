import { Page } from 'playwright';
import { ColorInfo, TypographySystem, TypographyToken } from '@ai-website-recreator/shared';
import { Logger } from '../utils/logger';

const logger = new Logger('StyleExtractor');

interface RawStyleExtraction {
  colors: Array<{
    hex: string;
    rgb: string;
    role: string;
    frequency: number;
    sampleElements: string[];
  }>;
  background: string;
  textPrimary: string;
  primary: string;
  secondary?: string;
  accent?: string;
  surface?: string;
  typography: {
    headingFont: string;
    bodyFont: string;
    googleFontsToLoad: string[];
    scale: TypographyToken[];
  };
}

export async function extractStyles(page: Page): Promise<{
  colors: {
    palette: ColorInfo[];
    background: string;
    textPrimary: string;
    primary: string;
    secondary?: string;
    accent?: string;
    surface?: string;
  };
  typography: TypographySystem;
}> {
  logger.info('Extracting computed styles, colors, and typography...');

  const extracted = await page.evaluate(() => {
    // @ts-ignore
    const __name = (target: any) => target;

    // Utility: rgb(a) to hex
    const rgbToHex = (rgbStr: string): string | null => {
      if (!rgbStr || rgbStr === 'transparent' || rgbStr === 'inherit') return null;
      const match = rgbStr.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*([\d.]+))?\)/);
      if (!match) return null;
      const r = parseInt(match[1], 10);
      const g = parseInt(match[2], 10);
      const b = parseInt(match[3], 10);
      const a = match[4] !== undefined ? parseFloat(match[4]) : 1;

      if (a === 0) return null; // fully transparent

      const hex =
        '#' +
        [r, g, b]
          .map((x) => {
            const h = x.toString(16);
            return h.length === 1 ? '0' + h : h;
          })
          .join('');
      return hex.toLowerCase();
    }

    // Utility: calculate luminance
    const getLuminance = (hex: string): number => {
      const c = hex.substring(1);
      const rgb = parseInt(c, 16);
      const r = (rgb >> 16) & 0xff;
      const g = (rgb >> 8) & 0xff;
      const b = (rgb >> 0) & 0xff;
      return 0.2126 * r + 0.7152 * g + 0.0722 * b;
    };

    // Utility: check if color is neutral (gray/black/white)
    const isNeutral = (hex: string): boolean => {
      const c = hex.substring(1);
      const r = parseInt(c.slice(0, 2), 16);
      const g = parseInt(c.slice(2, 4), 16);
      const b = parseInt(c.slice(4, 6), 16);
      const max = Math.max(r, g, b);
      const min = Math.min(r, g, b);
      return max - min < 20; // low saturation
    };

    // 1. Gather all elements
    const elements = Array.from(document.querySelectorAll('*'));
    const colorCounts: Record<string, { count: number; rgb: string; samples: Set<string> }> = {};
    const buttonBgCounts: Record<string, number> = {};
    const textColors: Record<string, number> = {};

    const fontFamilies = new Set<string>();
    const headingFonts = new Set<string>();
    const typographyTokens: TypographyToken[] = [];
    const seenTypeScale = new Set<string>();

    // Detect Google Fonts loaded
    const googleFontsToLoad: string[] = [];
    const fontLinks = document.querySelectorAll('link[href*="fonts.googleapis.com"]');
    fontLinks.forEach((link) => {
      const href = link.getAttribute('href');
      if (href) googleFontsToLoad.push(href);
    });

    // Check body background
    const bodyStyle = window.getComputedStyle(document.body);
    const bodyBgHex = rgbToHex(bodyStyle.backgroundColor) || '#ffffff';
    const bodyColorHex = rgbToHex(bodyStyle.color) || '#0f172a';
    const bodyFont = bodyStyle.fontFamily.split(',')[0].replace(/['"]/g, '').trim() || 'sans-serif';

    elements.forEach((el) => {
      const style = window.getComputedStyle(el);
      const rect = el.getBoundingClientRect();
      if (rect.width === 0 || rect.height === 0 || style.display === 'none' || style.visibility === 'hidden') {
        return;
      }

      // Background color
      const bgHex = rgbToHex(style.backgroundColor);
      if (bgHex) {
        if (!colorCounts[bgHex]) {
          colorCounts[bgHex] = { count: 0, rgb: style.backgroundColor, samples: new Set() };
        }
        colorCounts[bgHex].count++;
        if (colorCounts[bgHex].samples.size < 3) {
          colorCounts[bgHex].samples.add(el.tagName.toLowerCase());
        }

        // Check if button/action
        if (el.tagName === 'BUTTON' || el.getAttribute('role') === 'button' || el.closest('button')) {
          buttonBgCounts[bgHex] = (buttonBgCounts[bgHex] || 0) + 1;
        }
      }

      // Text color
      const txtHex = rgbToHex(style.color);
      if (txtHex && (el.childNodes.length > 0 && Array.from(el.childNodes).some((n) => n.nodeType === 3 && n.textContent?.trim()))) {
        textColors[txtHex] = (textColors[txtHex] || 0) + 1;
        if (!colorCounts[txtHex]) {
          colorCounts[txtHex] = { count: 0, rgb: style.color, samples: new Set() };
        }
        colorCounts[txtHex].count++;
      }

      // Typography
      const family = style.fontFamily.split(',')[0].replace(/['"]/g, '').trim();
      if (family) fontFamilies.add(family);

      const isHeading = /^H[1-6]$/.test(el.tagName);
      if (isHeading && family) {
        headingFonts.add(family);
      }

      // Extract significant typography tokens
      if (isHeading || el.tagName === 'P' || el.tagName === 'BUTTON' || el.tagName === 'A') {
        const key = `${el.tagName}-${style.fontSize}-${style.fontWeight}`;
        if (!seenTypeScale.has(key) && typographyTokens.length < 15) {
          seenTypeScale.add(key);
          typographyTokens.push({
            fontFamily: family,
            fontSize: style.fontSize,
            fontWeight: style.fontWeight,
            lineHeight: style.lineHeight,
            tag: el.tagName.toLowerCase(),
            sampleText: (el.textContent || '').trim().slice(0, 40),
          });
        }
      }
    });

    // Determine primary brand color (most common vibrant/non-neutral color used in buttons or accents)
    const sortedButtonColors = Object.entries(buttonBgCounts)
      .filter(([hex]) => !isNeutral(hex))
      .sort((a, b) => b[1] - a[1]);

    const sortedAllVibrant = Object.entries(colorCounts)
      .filter(([hex]) => !isNeutral(hex))
      .sort((a, b) => b[1].count - a[1].count);

    let primaryColor = '#3b82f6'; // default fallback blue
    if (sortedButtonColors.length > 0) {
      primaryColor = sortedButtonColors[0][0];
    } else if (sortedAllVibrant.length > 0) {
      primaryColor = sortedAllVibrant[0][0];
    }

    // Determine secondary / accent
    let secondaryColor: string | undefined = undefined;
    if (sortedAllVibrant.length > 1 && sortedAllVibrant[1][0] !== primaryColor) {
      secondaryColor = sortedAllVibrant[1][0];
    }

    // Determine surface card color
    let surfaceColor = '#ffffff';
    const candidateSurfaces = Object.entries(colorCounts)
      .filter(([hex]) => hex !== bodyBgHex && Math.abs(getLuminance(hex) - getLuminance(bodyBgHex)) < 60)
      .sort((a, b) => b[1].count - a[1].count);
    if (candidateSurfaces.length > 0) {
      surfaceColor = candidateSurfaces[0][0];
    }

    // Top colors list formatted
    const palette = Object.entries(colorCounts)
      .sort((a, b) => b[1].count - a[1].count)
      .slice(0, 12)
      .map(([hex, data]) => {
        let role = 'border';
        if (hex === bodyBgHex) role = 'background';
        else if (hex === primaryColor) role = 'primary';
        else if (hex === secondaryColor) role = 'secondary';
        else if (hex === surfaceColor) role = 'surface';
        else if (hex === bodyColorHex) role = 'text';
        else if (isNeutral(hex) && getLuminance(hex) < 180 && getLuminance(hex) > 60) role = 'text-muted';
        else if (!isNeutral(hex)) role = 'accent';

        return {
          hex,
          rgb: data.rgb,
          role: role as any,
          frequency: data.count,
          sampleElements: Array.from(data.samples),
        };
      });

    const headingFont = Array.from(headingFonts)[0] || bodyFont;

    return {
      colors: {
        palette,
        background: bodyBgHex,
        textPrimary: bodyColorHex,
        primary: primaryColor,
        secondary: secondaryColor,
        surface: surfaceColor,
      },
      typography: {
        headingFont,
        bodyFont,
        googleFontsToLoad,
        scale: typographyTokens,
      },
    };
  });

  logger.info(`Extracted ${extracted.colors.palette.length} palette colors, Primary: ${extracted.colors.primary}`);
  return extracted;
}
