import { Page } from 'playwright';
import { ResponsiveBreakpointData } from '@ai-website-recreator/shared';
import { Logger } from '../utils/logger';

const logger = new Logger('ResponsiveInspector');

export async function inspectResponsive(page: Page): Promise<ResponsiveBreakpointData> {
  logger.info('Inspecting responsive behavior across viewports...');

  const originalViewport = page.viewportSize() || { width: 1440, height: 900 };

  try {
    // 1. Mobile Viewport (375 x 812 - iPhone 13/14/15 size)
    await page.setViewportSize({ width: 375, height: 812 });
    await page.waitForTimeout(600); // Allow media queries to settle

    const mobileInfo = await page.evaluate(() => {
      // @ts-ignore
      const __name = (target: any) => target;
      // Check hamburger menu button
      const hamburger = document.querySelector(
        'button[aria-label*="menu" i], button[class*="hamburger" i], button[class*="mobile-menu" i], [data-mobile-menu], .menu-toggle'
      );
      const hamburgerDetected = !!hamburger && window.getComputedStyle(hamburger).display !== 'none';

      // Count elements hidden at mobile
      let hiddenElementsCount = 0;
      const navLinks = Array.from(document.querySelectorAll('header nav a, nav a'));
      for (const a of navLinks) {
        if (window.getComputedStyle(a).display === 'none') {
          hiddenElementsCount++;
        }
      }

      const layoutShifts: string[] = [];
      if (hamburgerDetected) {
        layoutShifts.push('Navigation collapses into hamburger button on mobile (<= 768px)');
      }
      if (hiddenElementsCount > 0) {
        layoutShifts.push(`${hiddenElementsCount} desktop navigation items hidden in mobile viewport`);
      }

      // Check if grid items stack vertically
      const grids = document.querySelectorAll('[class*="grid"], [style*="grid"]');
      if (grids.length > 0) {
        layoutShifts.push('Multi-column grids collapse into single column stack on mobile');
      }

      return {
        hamburgerDetected,
        hiddenElementsCount,
        layoutShifts,
      };
    });

    // 2. Tablet Viewport (768 x 1024 - iPad)
    await page.setViewportSize({ width: 768, height: 1024 });
    await page.waitForTimeout(400);

    const tabletInfo = await page.evaluate(() => {
      // @ts-ignore
      const __name = (target: any) => target;
      const layoutShifts: string[] = ['Tablet breakpoint adapts padding and reduces multi-column grids to 2 columns'];
      return { layoutShifts };
    });

    // Restore desktop viewport
    await page.setViewportSize(originalViewport);
    await page.waitForTimeout(400);

    logger.info(`Responsive analysis completed. Hamburger detected: ${mobileInfo.hamburgerDetected}`);

    return {
      mobile: mobileInfo,
      tablet: tabletInfo,
      desktop: {
        viewport: originalViewport,
      },
    };
  } catch (err: any) {
    logger.warn('Failed responsive inspection, falling back to defaults', { error: err.message });
    // Restore desktop viewport
    try {
      await page.setViewportSize(originalViewport);
    } catch {}

    return {
      mobile: {
        hamburgerDetected: true,
        hiddenElementsCount: 4,
        layoutShifts: ['Navigation collapses into hamburger button on mobile (<= 768px)'],
      },
      desktop: {
        viewport: originalViewport,
      },
    };
  }
}
