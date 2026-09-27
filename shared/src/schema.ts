import { z } from 'zod';

export const UISectionTypeSchema = z.enum([
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
]);

export const UIHeadingSpecSchema = z.object({
  level: z.enum(['h1', 'h2', 'h3', 'h4', 'h5', 'h6']),
  text: z.string(),
  subtext: z.string().optional(),
  badge: z.string().optional(),
});

export const UIButtonSpecSchema = z.object({
  text: z.string(),
  href: z.string().optional(),
  variant: z.enum(['primary', 'secondary', 'outline', 'ghost', 'link']).default('primary'),
  icon: z.string().optional(),
  isCta: z.boolean().optional(),
});

export const UILinkSpecSchema = z.object({
  text: z.string(),
  href: z.string(),
  isExternal: z.boolean().optional(),
});

export const UIAssetSpecSchema = z.object({
  url: z.string(),
  type: z.enum(['image', 'svg', 'background', 'icon', 'logo']),
  alt: z.string().optional(),
  width: z.number().optional(),
  height: z.number().optional(),
  role: z.string().default('visual'),
});

export const UICardSpecSchema = z.object({
  id: z.string(),
  title: z.string().optional(),
  subtitle: z.string().optional(),
  description: z.string().optional(),
  badge: z.string().optional(),
  price: z.string().optional(),
  period: z.string().optional(),
  imageUrl: z.string().optional(),
  iconUrl: z.string().optional(),
  author: z
    .object({
      name: z.string(),
      role: z.string().optional(),
      avatarUrl: z.string().optional(),
    })
    .optional(),
  features: z.array(z.string()).optional(),
  buttons: z.array(UIButtonSpecSchema).optional(),
  link: UILinkSpecSchema.optional(),
});

export const UILayoutSpecSchema = z.object({
  type: z.enum(['grid', 'flex', 'single-column', 'split-hero', 'cards', 'masonry', 'columns']),
  direction: z.enum(['row', 'column']).optional(),
  columns: z.number().optional(),
  gap: z.string().optional(),
  alignment: z.enum(['start', 'center', 'end', 'between', 'stretch']).optional(),
  justify: z.enum(['start', 'center', 'end', 'between', 'around']).optional(),
  wrap: z.boolean().optional(),
});

export const UISpacingSpecSchema = z.object({
  paddingTop: z.string().optional(),
  paddingBottom: z.string().optional(),
  paddingX: z.string().optional(),
  marginTop: z.string().optional(),
  marginBottom: z.string().optional(),
  sectionGap: z.string().optional(),
});

export const UIResponsiveSpecSchema = z.object({
  hideOnMobile: z.boolean().optional(),
  hideOnDesktop: z.boolean().optional(),
  mobileColumns: z.number().optional(),
  tabletColumns: z.number().optional(),
  desktopColumns: z.number().optional(),
  mobileLayoutShift: z.string().optional(),
});

export const UIVisibilityRulesSchema = z.object({
  requiresAuth: z.boolean().optional(),
  conditionalRender: z.string().optional(),
  defaultVisible: z.boolean().default(true),
});

export const UISectionSpecSchema = z.object({
  id: z.string(),
  type: UISectionTypeSchema,
  name: z.string(),
  semanticTag: z.enum(['header', 'nav', 'main', 'section', 'article', 'aside', 'footer', 'div']).default('section'),
  headings: z.array(UIHeadingSpecSchema).default([]),
  paragraphs: z.array(z.string()).default([]),
  buttons: z.array(UIButtonSpecSchema).default([]),
  links: z.array(UILinkSpecSchema).default([]),
  assets: z.array(UIAssetSpecSchema).default([]),
  cards: z.array(UICardSpecSchema).default([]),
  layout: UILayoutSpecSchema.default({ type: 'single-column' }),
  spacing: UISpacingSpecSchema.default({}),
  styling: z.object({
    backgroundColor: z.string().optional(),
    textColor: z.string().optional(),
    accentColor: z.string().optional(),
    isDark: z.boolean().optional(),
    hasGradient: z.boolean().optional(),
    borderRadius: z.string().optional(),
    shadow: z.string().optional(),
  }).default({}),
  responsive: UIResponsiveSpecSchema.default({}),
  visibility: UIVisibilityRulesSchema.default({ defaultVisible: true }),
  rawTextGrounding: z.array(z.string()).default([]),
});

export const UINavigationSpecSchema = z.object({
  brand: z.object({
    text: z.string().optional(),
    logoUrl: z.string().optional(),
  }),
  links: z.array(UILinkSpecSchema).default([]),
  ctaButtons: z.array(UIButtonSpecSchema).default([]),
  isSticky: z.boolean().default(false),
  hasMobileMenu: z.boolean().default(false),
  mobileMenuType: z.enum(['hamburger', 'drawer', 'dropdown', 'none']).optional(),
});

export const UIThemeTokensSchema = z.object({
  colors: z.object({
    primary: z.string(),
    secondary: z.string().optional(),
    background: z.string(),
    surface: z.string(),
    textPrimary: z.string(),
    textMuted: z.string(),
    accent: z.string().optional(),
    border: z.string(),
  }),
  typography: z.object({
    headingFont: z.string(),
    bodyFont: z.string(),
    googleFontsToLoad: z.array(z.string()).default([]),
    fontSizeScale: z.record(z.string(), z.string()).default({}),
  }),
  borderRadius: z.object({
    base: z.string(),
    cards: z.string(),
    buttons: z.string(),
  }),
});

export const PageMetadataSchema = z.object({
  url: z.string(),
  title: z.string(),
  description: z.string().optional(),
  favicon: z.string().optional(),
  ogImage: z.string().optional(),
  viewport: z.object({
    width: z.number(),
    height: z.number(),
  }),
  timestamp: z.string(),
});

export const UISpecificationSchema = z.object({
  metadata: PageMetadataSchema,
  navigation: UINavigationSpecSchema,
  theme: UIThemeTokensSchema,
  sections: z.array(UISectionSpecSchema).min(1),
  groundingMetrics: z.object({
    preservedSectionsCount: z.number(),
    preservedAssetsCount: z.number(),
    preservedTextTokensCount: z.number(),
    antiHallucinationVerified: z.boolean(),
  }),
});

export type UISectionType = z.infer<typeof UISectionTypeSchema>;
export type UIHeadingSpec = z.infer<typeof UIHeadingSpecSchema>;
export type UIButtonSpec = z.infer<typeof UIButtonSpecSchema>;
export type UILinkSpec = z.infer<typeof UILinkSpecSchema>;
export type UIAssetSpec = z.infer<typeof UIAssetSpecSchema>;
export type UICardSpec = z.infer<typeof UICardSpecSchema>;
export type UILayoutSpec = z.infer<typeof UILayoutSpecSchema>;
export type UISpacingSpec = z.infer<typeof UISpacingSpecSchema>;
export type UIResponsiveSpec = z.infer<typeof UIResponsiveSpecSchema>;
export type UIVisibilityRules = z.infer<typeof UIVisibilityRulesSchema>;
export type UISectionSpec = z.infer<typeof UISectionSpecSchema>;
export type UINavigationSpec = z.infer<typeof UINavigationSpecSchema>;
export type UIThemeTokens = z.infer<typeof UIThemeTokensSchema>;
export type UISpecification = z.infer<typeof UISpecificationSchema>;
