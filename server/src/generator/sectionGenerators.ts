import {
  UINavigationSpec,
  UISectionSpec,
  UISpecification,
} from '@ai-website-recreator/shared';

export function generateNavbarComponent(nav: UINavigationSpec): string {
  const brandLogo = nav.brand.logoUrl
    ? `<MediaAsset url="${nav.brand.logoUrl}" alt="${nav.brand.text || 'Logo'}" className="h-8 w-auto object-contain" />`
    : `<span className="text-xl font-bold text-site-text font-heading">${nav.brand.text || 'Logo'}</span>`;

  return `import React, { useState } from 'react';
import { Button } from '../components/Button';
import { MediaAsset } from '../components/MediaAsset';

export const Navbar: React.FC = () => {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  return (
    <nav className="w-full bg-site-surface border-b border-site-border ${nav.isSticky ? 'sticky top-0 z-50 backdrop-blur-md bg-site-surface/90' : ''}">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Brand */}
          <div className="flex items-center gap-3">
            <a href="/" className="flex items-center gap-2">
              ${brandLogo}
            </a>
          </div>

          {/* Desktop Navigation Links */}
          <div className="hidden md:flex items-center space-x-6">
            ${nav.links
              .map(
                (l) =>
                  `<a href="${l.href}" className="text-sm font-medium text-site-muted hover:text-site-primary transition-colors">${l.text}</a>`
              )
              .join('\n            ')}
          </div>

          {/* Desktop CTA Buttons */}
          <div className="hidden md:flex items-center space-x-3">
            ${nav.ctaButtons
              .map(
                (b) =>
                  `<Button variant="${b.variant}" href="${b.href || '#'}">${b.text}</Button>`
              )
              .join('\n            ')}
          </div>

          {/* Mobile Hamburger Toggle Button */}
          <div className="flex md:hidden items-center">
            <button
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
              className="p-2 rounded-md text-site-muted hover:text-site-text hover:bg-black/5 focus:outline-none"
              aria-label="Toggle Navigation Menu"
            >
              <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                {isMobileMenuOpen ? (
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                ) : (
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                )}
              </svg>
            </button>
          </div>
        </div>
      </div>

      {/* Mobile Menu Dropdown */}
      {isMobileMenuOpen && (
        <div className="md:hidden border-t border-site-border bg-site-surface px-4 pt-2 pb-4 space-y-2">
          ${nav.links
            .map(
              (l) =>
                `<a href="${l.href}" className="block py-2 text-base font-medium text-site-muted hover:text-site-primary">${l.text}</a>`
            )
            .join('\n          ')}
          ${nav.ctaButtons.length > 0 ? `<div className="pt-2 flex flex-col gap-2">
            ${nav.ctaButtons
              .map((b) => `<Button variant="${b.variant}" href="${b.href || '#'}">${b.text}</Button>`)
              .join('\n            ')}
          </div>` : ''}
        </div>
      )}
    </nav>
  );
};
`;
}

export function generateHeroSectionComponent(sec: UISectionSpec): string {
  const heading = sec.headings[0]?.text || 'Welcome';
  const subheading = sec.headings[0]?.subtext || '';
  const paragraph = sec.paragraphs[0] || '';
  const heroAsset = sec.assets[0];

  const hasSplitLayout = sec.layout.type === 'split-hero' || !!heroAsset;

  return `import React from 'react';
import { Button } from '../components/Button';
import { MediaAsset } from '../components/MediaAsset';

export const ${getComponentName(sec)}: React.FC = () => {
  return (
    <section id="${sec.id}" className="w-full ${sec.styling.backgroundColor ? `bg-[${sec.styling.backgroundColor}]` : 'bg-site-bg'} py-16 sm:py-24 border-b border-site-border overflow-hidden">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="${hasSplitLayout ? 'grid grid-cols-1 lg:grid-cols-2 gap-12 items-center' : 'max-w-3xl mx-auto text-center'}">
          {/* Text Content */}
          <div className="flex flex-col ${hasSplitLayout ? 'items-start text-left' : 'items-center text-center'}">
            ${subheading ? `<span className="inline-block px-3 py-1 text-xs font-semibold rounded-full bg-site-primary/10 text-site-primary mb-4 tracking-wide uppercase">
              ${subheading}
            </span>` : ''}

            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold text-site-text tracking-tight font-heading leading-tight mb-6">
              ${escapeJsx(heading)}
            </h1>

            ${paragraph ? `<p className="text-lg sm:text-xl text-site-muted leading-relaxed mb-8 max-w-2xl">
              ${escapeJsx(paragraph)}
            </p>` : ''}

            ${sec.buttons.length > 0 ? `<div className="flex flex-wrap gap-4 ${hasSplitLayout ? '' : 'justify-center'}">
              ${sec.buttons
                .map(
                  (b, idx) =>
                    `<Button variant="${b.variant || (idx === 0 ? 'primary' : 'secondary')}" isCta={${idx === 0}} href="${b.href || '#'}">
                ${b.text}
              </Button>`
                )
                .join('\n              ')}
            </div>` : ''}
          </div>

          {/* Hero Asset */}
          ${heroAsset ? `<div className="w-full flex items-center justify-center">
            <div className="relative rounded-2xl overflow-hidden shadow-2xl border border-site-border bg-site-surface">
              <MediaAsset
                url="${heroAsset.url}"
                alt="${heroAsset.alt || heading}"
                className="w-full h-auto object-cover max-h-[500px]"
              />
            </div>
          </div>` : ''}
        </div>
      </div>
    </section>
  );
};
`;
}

export function generateGenericOrContentSectionComponent(sec: UISectionSpec): string {
  const heading = sec.headings[0]?.text;
  const paragraph = sec.paragraphs[0];
  const columns = sec.layout.columns || (sec.cards.length >= 3 ? 3 : sec.cards.length === 2 ? 2 : 1);

  return `import React from 'react';
import { Card } from '../components/Card';
import { Button } from '../components/Button';
import { MediaAsset } from '../components/MediaAsset';

export const ${getComponentName(sec)}: React.FC = () => {
  return (
    <section id="${sec.id}" className="w-full py-16 sm:py-20 border-b border-site-border ${sec.styling.backgroundColor ? `bg-[${sec.styling.backgroundColor}]` : 'bg-site-bg'}">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        ${heading ? `<div className="max-w-3xl mx-auto text-center mb-12">
          <h2 className="text-3xl sm:text-4xl font-bold text-site-text font-heading tracking-tight mb-4">
            ${escapeJsx(heading)}
          </h2>
          ${paragraph ? `<p className="text-base sm:text-lg text-site-muted leading-relaxed">
            ${escapeJsx(paragraph)}
          </p>` : ''}
        </div>` : ''}

        {/* Section Cards / Items */}
        ${sec.cards.length > 0 ? `<div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-${columns} gap-6 sm:gap-8">
          ${sec.cards
            .map(
              (c) =>
                `<Card
            key="${c.id}"
            title="${escapeJsx(c.title || '')}"
            description="${escapeJsx(c.description || '')}"
            price="${escapeJsx(c.price || '')}"
            imageUrl="${c.imageUrl || ''}"
            iconUrl="${c.iconUrl || ''}"
          />`
            )
            .join('\n          ')}
        </div>` : ''}

        {/* Section Assets */}
        ${sec.assets.length > 0 && sec.cards.length === 0 ? `<div className="mt-8 flex flex-wrap items-center justify-center gap-6">
          ${sec.assets
            .slice(0, 6)
            .map(
              (a) =>
                `<MediaAsset url="${a.url}" alt="${a.alt || 'Visual'}" className="max-h-40 rounded-lg object-contain" />`
            )
            .join('\n          ')}
        </div>` : ''}

        {/* Section Action Buttons */}
        ${sec.buttons.length > 0 ? `<div className="mt-10 flex items-center justify-center gap-4">
          ${sec.buttons
            .map((b) => `<Button variant="${b.variant}" href="${b.href || '#'}">${b.text}</Button>`)
            .join('\n          ')}
        </div>` : ''}
      </div>
    </section>
  );
};
`;
}

export function generateFooterComponent(sec?: UISectionSpec, nav?: UINavigationSpec): string {
  const heading = sec?.headings[0]?.text || '';
  const brandText = nav?.brand.text || 'Recreated Website';

  return `import React from 'react';

export const Footer: React.FC = () => {
  return (
    <footer className="w-full bg-site-surface border-t border-site-border py-12">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col md:flex-row items-center justify-between gap-6">
        <div>
          <span className="text-lg font-bold text-site-text font-heading">${brandText}</span>
          ${heading ? `<p className="text-xs text-site-muted mt-1 max-w-md">${escapeJsx(heading)}</p>` : ''}
        </div>

        <div className="flex flex-wrap gap-6 text-sm text-site-muted">
          ${(nav?.links || [])
            .map((l) => `<a href="${l.href}" className="hover:text-site-primary transition-colors">${l.text}</a>`)
            .join('\n          ')}
        </div>

        <div className="text-xs text-site-muted">
          © {new Date().getFullYear()} ${brandText}. Built with AI Website Recreator.
        </div>
      </div>
    </footer>
  );
};
`;
}

export function getComponentName(sec: UISectionSpec): string {
  const cleanId = sec.id
    .replace(/[^a-zA-Z0-9]/g, ' ')
    .split(' ')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join('');

  return `${cleanId}Section`;
}

function escapeJsx(text: string): string {
  if (!text) return '';
  return text
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/\{/g, '&#123;')
    .replace(/\}/g, '&#125;');
}
