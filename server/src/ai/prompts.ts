import { ExtractedWebsiteData } from '@ai-website-recreator/shared';

export function buildSystemPrompt(): string {
  return `You are a Principal AI Frontend Architect specializing in website visual deconstruction and recreation.
Your task is to analyze ground-truth data extracted from a real live website via Playwright and synthesize a strict, typed UISpecification JSON.

CRITICAL ANTI-HALLUCINATION RULES:
1. Grounding First: Base your output ENTIRELY on the provided ExtractedWebsiteData.
2. DO NOT invent synthetic or unrelated sections (e.g. do not add a generic testimonials, pricing, or FAQ section unless detected in the source data).
3. Preserve the exact source text, headings, button labels, and asset URLs.
4. Section Classification: You must classify each detected section into one of the following exact types:
   - 'navbar'
   - 'hero'
   - 'features'
   - 'content'
   - 'testimonials'
   - 'pricing'
   - 'statistics'
   - 'cta'
   - 'footer'
   - 'generic'
   IF you are not completely confident in a semantic type, classify it as 'generic'. DO NOT guess or invent semantic roles.
5. Preserve Section Order: The order of sections in the UISpecification must match the visual top-to-bottom layout of the source website.
6. Responsive Behavior: Respect the extracted responsive inspection notes (e.g. mobile stacking, hamburger detection).
7. Return ONLY valid JSON with no conversational text or preamble.`;
}

export function buildUserPrompt(data: ExtractedWebsiteData): string {
  // Provide structured, compact summary of extracted data to avoid exceeding context
  const cleanData = {
    metadata: data.metadata,
    colors: {
      primary: data.colors.primary,
      secondary: data.colors.secondary,
      background: data.colors.background,
      surface: data.colors.surface,
      textPrimary: data.colors.textPrimary,
      palette: data.colors.palette.slice(0, 8),
    },
    typography: {
      headingFont: data.typography.headingFont,
      bodyFont: data.typography.bodyFont,
      googleFontsToLoad: data.typography.googleFontsToLoad,
      scale: data.typography.scale.slice(0, 10),
    },
    navigation: data.navigation,
    sections: data.sections.map((sec, idx) => ({
      index: idx + 1,
      id: sec.id,
      detectedType: sec.type,
      name: sec.name,
      heading: sec.heading,
      subheading: sec.subheading,
      description: sec.description,
      layout: sec.layout,
      itemsCount: sec.items.length,
      sampleItems: sec.items.slice(0, 6),
      buttons: sec.buttons,
      styling: sec.styling,
      assets: sec.assets.slice(0, 4),
      rawTextSnippet: sec.rawTextSample.slice(0, 6),
    })),
    assetsCount: data.assets.length,
    sampleAssets: data.assets.slice(0, 15),
    responsive: data.responsive,
  };

  return `Transform the following extracted website data into a complete, strictly compliant UISpecification JSON:

${JSON.stringify(cleanData, null, 2)}

Ensure all headings, paragraphs, cards, buttons, colors, typography, and section types are preserved without hallucinating extra content.`;
}
