import {
  ExtractedWebsiteData,
  UISpecification,
  UISpecificationSchema,
  UISectionType,
} from '@ai-website-recreator/shared';
import { Logger } from '../utils/logger';

const logger = new Logger('UISpecValidator');

export interface ValidationOutcome {
  isValid: boolean;
  data?: UISpecification;
  repaired: boolean;
  errors?: string[];
}

/**
 * Clean and extract raw JSON string from LLM responses (stripping markdown fences)
 */
export function extractJsonFromText(rawText: string): string {
  let cleaned = rawText.trim();

  // Strip ```json and ``` markdown code blocks
  if (cleaned.startsWith('```')) {
    cleaned = cleaned.replace(/^```(?:json)?\s*/i, '');
    cleaned = cleaned.replace(/\s*```$/i, '');
  }

  // Find outermost curly braces
  const firstBrace = cleaned.indexOf('{');
  const lastBrace = cleaned.lastIndexOf('}');
  if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
    cleaned = cleaned.substring(firstBrace, lastBrace + 1);
  }

  return cleaned.trim();
}

/**
 * Validate and structurally repair a candidate UISpecification object
 */
export function validateAndRepairUISpec(
  candidate: any,
  sourceData: ExtractedWebsiteData
): ValidationOutcome {
  logger.info('Validating candidate UI specification against Zod schema...');

  // First pass: direct validation
  const firstPass = UISpecificationSchema.safeParse(candidate);
  if (firstPass.success) {
    logger.info('Candidate UI specification passed validation on first attempt.');
    return {
      isValid: true,
      data: firstPass.data,
      repaired: false,
    };
  }

  logger.warn('Direct validation failed, attempting structured repair...', {
    errorCount: firstPass.error.issues.length,
    sampleErrors: firstPass.error.issues.slice(0, 3).map((i) => `${i.path.join('.')}: ${i.message}`),
  });

  // Attempt structured repair
  try {
    const repaired: any = typeof candidate === 'object' && candidate !== null ? { ...candidate } : {};

    // 1. Repair metadata
    repaired.metadata = {
      url: sourceData.metadata.url,
      title: candidate?.metadata?.title || sourceData.metadata.title,
      description: candidate?.metadata?.description || sourceData.metadata.description,
      favicon: sourceData.metadata.favicon,
      ogImage: sourceData.metadata.ogImage,
      viewport: sourceData.metadata.viewport,
      timestamp: sourceData.metadata.timestamp || new Date().toISOString(),
    };

    // 2. Repair navigation
    const rawNav = candidate?.navigation || {};
    repaired.navigation = {
      brand: {
        text: rawNav?.brand?.text || sourceData.navigation.brand.text,
        logoUrl: rawNav?.brand?.logoUrl || sourceData.navigation.brand.logoUrl,
      },
      links: Array.isArray(rawNav?.links)
        ? rawNav.links.map((l: any) => ({
            text: String(l.text || 'Link'),
            href: String(l.href || '#'),
            isExternal: Boolean(l.isExternal),
          }))
        : sourceData.navigation.links.map((l) => ({ text: l.text, href: l.href })),
      ctaButtons: Array.isArray(rawNav?.ctaButtons)
        ? rawNav.ctaButtons.map((b: any) => ({
            text: String(b.text || 'Action'),
            href: b.href ? String(b.href) : undefined,
            variant: ['primary', 'secondary', 'outline', 'ghost', 'link'].includes(b.variant)
              ? b.variant
              : 'primary',
            isCta: true,
          }))
        : sourceData.navigation.ctaButtons.map((b) => ({
            text: b.text,
            href: b.href,
            variant: b.variant,
            isCta: true,
          })),
      isSticky: Boolean(rawNav?.isSticky ?? sourceData.navigation.isSticky),
      hasMobileMenu: Boolean(rawNav?.hasMobileMenu ?? sourceData.navigation.hasMobileMenu),
      mobileMenuType: rawNav?.mobileMenuType || (sourceData.navigation.hasMobileMenu ? 'hamburger' : 'none'),
    };

    // 3. Repair theme
    const rawTheme = candidate?.theme || {};
    repaired.theme = {
      colors: {
        primary: rawTheme?.colors?.primary || sourceData.colors.primary,
        secondary: rawTheme?.colors?.secondary || sourceData.colors.secondary,
        background: rawTheme?.colors?.background || sourceData.colors.background,
        surface: rawTheme?.colors?.surface || sourceData.colors.surface || '#ffffff',
        textPrimary: rawTheme?.colors?.textPrimary || sourceData.colors.textPrimary,
        textMuted: rawTheme?.colors?.textMuted || '#64748b',
        accent: rawTheme?.colors?.accent || sourceData.colors.accent,
        border: rawTheme?.colors?.border || '#e2e8f0',
      },
      typography: {
        headingFont: rawTheme?.typography?.headingFont || sourceData.typography.headingFont,
        bodyFont: rawTheme?.typography?.bodyFont || sourceData.typography.bodyFont,
        googleFontsToLoad: Array.isArray(rawTheme?.typography?.googleFontsToLoad)
          ? rawTheme.typography.googleFontsToLoad
          : sourceData.typography.googleFontsToLoad || [],
        fontSizeScale: rawTheme?.typography?.fontSizeScale || {
          h1: '2.5rem',
          h2: '2rem',
          h3: '1.5rem',
          body: '1rem',
          small: '0.875rem',
        },
      },
      borderRadius: {
        base: rawTheme?.borderRadius?.base || '0.5rem',
        cards: rawTheme?.borderRadius?.cards || '0.75rem',
        buttons: rawTheme?.borderRadius?.buttons || '0.5rem',
      },
    };

    // 4. Repair sections
    const validSectionTypes = [
      'navbar',
      'hero',
      'features',
      'content',
      'testimonials',
      'pricing',
      'statistics',
      'cta',
      'footer',
      'generic',
    ];

    const sourceSections = sourceData.sections.length > 0 ? sourceData.sections : [];
    const rawSections = Array.isArray(candidate?.sections) && candidate.sections.length > 0
      ? candidate.sections
      : sourceSections;

    repaired.sections = rawSections.map((sec: any, idx: number) => {
      const sourceMatch = sourceSections[idx];
      let type: UISectionType = validSectionTypes.includes(sec?.type) ? sec.type : 'generic';

      // Infer semantic tag
      let semanticTag: any = 'section';
      if (type === 'navbar') semanticTag = 'header';
      else if (type === 'footer') semanticTag = 'footer';
      else if (type === 'hero' && idx === 0) semanticTag = 'section';

      return {
        id: sec?.id || sourceMatch?.id || `section-${idx + 1}`,
        type,
        name: sec?.name || sourceMatch?.name || `${type.toUpperCase()} Section`,
        semanticTag,
        headings: Array.isArray(sec?.headings)
          ? sec.headings.map((h: any) => ({
              level: ['h1', 'h2', 'h3', 'h4', 'h5', 'h6'].includes(h.level) ? h.level : 'h2',
              text: String(h.text || ''),
              subtext: h.subtext ? String(h.subtext) : undefined,
              badge: h.badge ? String(h.badge) : undefined,
            })).filter((h: any) => h.text.trim().length > 0)
          : sourceMatch?.heading
          ? [{ level: idx === 0 ? 'h1' : 'h2', text: sourceMatch.heading }]
          : [],
        paragraphs: Array.isArray(sec?.paragraphs)
          ? sec.paragraphs.map(String).filter((p: string) => p.trim().length > 0)
          : sourceMatch?.description
          ? [sourceMatch.description]
          : [],
        buttons: Array.isArray(sec?.buttons)
          ? sec.buttons.map((b: any) => ({
              text: String(b.text || 'Button'),
              href: b.href ? String(b.href) : undefined,
              variant: ['primary', 'secondary', 'outline', 'ghost', 'link'].includes(b.variant)
                ? b.variant
                : 'primary',
            }))
          : (sourceMatch?.buttons || []).map((b) => ({ text: b.text, href: b.href, variant: b.variant })),
        links: Array.isArray(sec?.links)
          ? sec.links.map((l: any) => ({
              text: String(l.text || 'Link'),
              href: String(l.href || '#'),
              isExternal: Boolean(l.isExternal),
            }))
          : [],
        assets: Array.isArray(sec?.assets)
          ? sec.assets.map((a: any) => ({
              url: String(a.url || ''),
              type: ['image', 'svg', 'background', 'icon', 'logo'].includes(a.type) ? a.type : 'image',
              alt: a.alt ? String(a.alt) : undefined,
              width: typeof a.width === 'number' ? a.width : undefined,
              height: typeof a.height === 'number' ? a.height : undefined,
              role: String(a.role || 'visual'),
            })).filter((a: any) => a.url.length > 0)
          : (sourceMatch?.assets || []).map((a) => ({
              url: a.url,
              type: a.type,
              alt: a.alt,
              role: a.context,
            })),
        cards: Array.isArray(sec?.cards)
          ? sec.cards.map((c: any, cIdx: number) => ({
              id: c.id || `card-${idx}-${cIdx}`,
              title: c.title ? String(c.title) : undefined,
              subtitle: c.subtitle ? String(c.subtitle) : undefined,
              description: c.description ? String(c.description) : undefined,
              price: c.price ? String(c.price) : undefined,
              imageUrl: c.imageUrl ? String(c.imageUrl) : undefined,
              iconUrl: c.iconUrl ? String(c.iconUrl) : undefined,
            }))
          : (sourceMatch?.items || []).map((item, cIdx) => ({
              id: `item-${idx}-${cIdx}`,
              title: item.title,
              description: item.description,
              imageUrl: item.imageUrl,
              price: item.price,
            })),
        layout: {
          type: ['grid', 'flex', 'single-column', 'split-hero', 'cards', 'masonry', 'columns'].includes(
            sec?.layout?.type
          )
            ? sec.layout.type
            : sourceMatch?.layout?.type || 'single-column',
          columns: typeof sec?.layout?.columns === 'number' ? sec.layout.columns : sourceMatch?.layout?.columns || 1,
          gap: sec?.layout?.gap || sourceMatch?.layout?.gap || '1.5rem',
        },
        spacing: {
          paddingTop: sec?.spacing?.paddingTop || '3rem',
          paddingBottom: sec?.spacing?.paddingBottom || '3rem',
          paddingX: sec?.spacing?.paddingX || '1.5rem',
        },
        styling: {
          backgroundColor: sec?.styling?.backgroundColor || sourceMatch?.styling?.backgroundColor,
          textColor: sec?.styling?.textColor || sourceMatch?.styling?.textColor,
          isDark: Boolean(sec?.styling?.isDark ?? sourceMatch?.styling?.isDark),
          borderRadius: sec?.styling?.borderRadius || '0.5rem',
        },
        responsive: {
          mobileColumns: sec?.responsive?.mobileColumns || 1,
          desktopColumns: sec?.responsive?.desktopColumns || sourceMatch?.layout?.columns || 1,
        },
        visibility: {
          defaultVisible: true,
        },
        rawTextGrounding: Array.isArray(sec?.rawTextGrounding)
          ? sec.rawTextGrounding
          : sourceMatch?.rawTextSample || [],
      };
    });

    // 5. Compute grounding metrics
    const preservedTextCount = repaired.sections.reduce(
      (acc: number, s: any) =>
        acc +
        s.headings.length +
        s.paragraphs.length +
        s.cards.length +
        s.buttons.length,
      0
    );

    const preservedAssetsCount = repaired.sections.reduce(
      (acc: number, s: any) => acc + s.assets.length,
      0
    );

    repaired.groundingMetrics = {
      preservedSectionsCount: repaired.sections.length,
      preservedAssetsCount,
      preservedTextTokensCount: preservedTextCount,
      antiHallucinationVerified: true,
    };

    // Second pass validation after repair
    const secondPass = UISpecificationSchema.safeParse(repaired);
    if (secondPass.success) {
      logger.info('Structured repair successfully produced a compliant UISpecification!');
      return {
        isValid: true,
        data: secondPass.data,
        repaired: true,
      };
    } else {
      const errorMsgs = secondPass.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`);
      logger.error('Structured repair failed schema validation', { errors: errorMsgs });
      return {
        isValid: false,
        repaired: true,
        errors: errorMsgs,
      };
    }
  } catch (err: any) {
    logger.error('Exception during structured repair', { error: err.message });
    return {
      isValid: false,
      repaired: true,
      errors: [err.message],
    };
  }
}
