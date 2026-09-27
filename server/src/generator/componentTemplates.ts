export function generateButtonComponent(): string {
  return `import React from 'react';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost' | 'link';
  href?: string;
  isCta?: boolean;
  children: React.ReactNode;
}

export const Button: React.FC<ButtonProps> = ({
  variant = 'primary',
  href,
  isCta = false,
  children,
  className = '',
  ...props
}) => {
  const baseClasses = 'inline-flex items-center justify-center font-medium transition-all duration-200 rounded-site-button cursor-pointer focus:outline-none';
  
  let variantClasses = '';
  switch (variant) {
    case 'primary':
      variantClasses = 'bg-site-primary text-white hover:opacity-90 shadow-sm';
      break;
    case 'secondary':
      variantClasses = 'bg-site-secondary text-white hover:opacity-90';
      break;
    case 'outline':
      variantClasses = 'border border-site-primary text-site-primary hover:bg-site-primary hover:text-white';
      break;
    case 'ghost':
      variantClasses = 'text-site-text hover:bg-black/5 dark:hover:bg-white/5';
      break;
    case 'link':
      variantClasses = 'text-site-primary hover:underline p-0 h-auto';
      break;
  }

  const sizeClasses = isCta ? 'px-6 py-3 text-base font-semibold shadow-md' : 'px-4 py-2 text-sm';
  const combinedClasses = \`\${baseClasses} \${variantClasses} \${sizeClasses} \${className}\`.trim();

  if (href) {
    return (
      <a href={href} className={combinedClasses}>
        {children}
      </a>
    );
  }

  return (
    <button className={combinedClasses} {...props}>
      {children}
    </button>
  );
};
`;
}

export function generateMediaAssetComponent(): string {
  return `import React, { useState } from 'react';

export interface MediaAssetProps {
  url: string;
  type?: 'image' | 'svg' | 'background' | 'icon' | 'logo';
  alt?: string;
  width?: number;
  height?: number;
  className?: string;
}

export const MediaAsset: React.FC<MediaAssetProps> = ({
  url,
  type = 'image',
  alt = 'Asset',
  width,
  height,
  className = '',
}) => {
  const [hasError, setHasError] = useState(false);

  if (!url || hasError) {
    // Graceful invisible fallback without disrupting layout
    return (
      <div
        className={\`bg-site-muted/10 rounded flex items-center justify-center text-site-muted text-xs \${className}\`}
        style={{ width: width ? \`\${width}px\` : 'auto', height: height ? \`\${height}px\` : 'auto', minHeight: '24px' }}
      >
        <span className="sr-only">{alt}</span>
      </div>
    );
  }

  return (
    <img
      src={url}
      alt={alt}
      width={width}
      height={height}
      className={className}
      onError={() => setHasError(true)}
      loading="lazy"
    />
  );
};
`;
}

export function generateCardComponent(): string {
  return `import React from 'react';
import { MediaAsset } from './MediaAsset';
import { Button } from './Button';

export interface CardProps {
  title?: string;
  subtitle?: string;
  description?: string;
  badge?: string;
  price?: string;
  period?: string;
  imageUrl?: string;
  iconUrl?: string;
  features?: string[];
  buttons?: Array<{ text: string; href?: string; variant?: any }>;
  className?: string;
}

export const Card: React.FC<CardProps> = ({
  title,
  subtitle,
  description,
  badge,
  price,
  period,
  imageUrl,
  iconUrl,
  features,
  buttons,
  className = '',
}) => {
  return (
    <div className={\`bg-site-surface border border-site-border rounded-site-card p-6 flex flex-col justify-between transition-all hover:shadow-md \${className}\`}>
      <div>
        {badge && (
          <span className="inline-block px-2.5 py-1 text-xs font-semibold rounded-full bg-site-primary/10 text-site-primary mb-3">
            {badge}
          </span>
        )}

        {imageUrl && (
          <div className="mb-4 overflow-hidden rounded-md flex items-center justify-center">
            <MediaAsset url={imageUrl} alt={title || 'Card Image'} className="max-h-48 w-full object-cover" />
          </div>
        )}

        {iconUrl && (
          <div className="mb-4 w-10 h-10 flex items-center justify-center rounded-lg bg-site-primary/10">
            <MediaAsset url={iconUrl} alt="icon" className="w-6 h-6 object-contain" />
          </div>
        )}

        {title && <h3 className="text-lg font-bold text-site-text mb-1">{title}</h3>}
        {subtitle && <h4 className="text-sm font-medium text-site-muted mb-2">{subtitle}</h4>}

        {price && (
          <div className="my-3 flex items-baseline gap-1">
            <span className="text-3xl font-extrabold text-site-text">{price}</span>
            {period && <span className="text-sm text-site-muted">{period}</span>}
          </div>
        )}

        {description && <p className="text-sm text-site-muted leading-relaxed mt-2">{description}</p>}

        {features && features.length > 0 && (
          <ul className="mt-4 space-y-2 text-sm text-site-text">
            {features.map((f, i) => (
              <li key={i} className="flex items-center gap-2">
                <span className="text-site-primary">✓</span>
                <span>{f}</span>
              </li>
            ))}
          </ul>
        )}
      </div>

      {buttons && buttons.length > 0 && (
        <div className="mt-6 flex gap-2">
          {buttons.map((btn, idx) => (
            <Button key={idx} variant={btn.variant || 'primary'} href={btn.href}>
              {btn.text}
            </Button>
          ))}
        </div>
      )}
    </div>
  );
};
`;
}
