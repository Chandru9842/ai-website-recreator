import { ExtractedWebsiteData, UISpecification } from '@ai-website-recreator/shared';
import { Logger } from '../utils/logger';

const logger = new Logger('AILayer');

/**
 * AI Analysis Layer Interface
 * Converts raw ExtractedWebsiteData into a structured UI Specification
 * without inventing unrelated sections.
 */
export async function convertToUISpec(
  data: ExtractedWebsiteData,
  apiKey?: string
): Promise<UISpecification> {
  logger.info(`Converting extracted data for ${data.metadata.title} into UI Specification...`);
  
  // Scaffolding for AI transformation layer
  return {
    pageTitle: data.metadata.title,
    theme: {
      colors: {
        primary: data.colors.primary,
        background: data.colors.background,
        text: data.colors.textPrimary,
        surface: data.colors.surface || '#ffffff',
      },
      fonts: {
        heading: data.typography.headingFont,
        body: data.typography.bodyFont,
        cdnLinks: data.typography.googleFontsToLoad,
      },
      borderRadius: '0.5rem',
    },
    components: data.sections.map((sec) => ({
      name: sec.name.replace(/[^a-zA-Z0-9]/g, ''),
      sectionId: sec.id,
      type: sec.type,
      props: {
        heading: sec.heading,
        description: sec.description,
        items: sec.items,
        buttons: sec.buttons,
      },
      tailwindClasses: ['w-full', sec.styling.isDark ? 'bg-slate-900 text-white' : 'bg-white text-slate-900'],
    })),
  };
}
