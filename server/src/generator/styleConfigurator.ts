import { UISpecification } from '@ai-website-recreator/shared';

export function generateTailwindConfig(spec: UISpecification): string {
  const { colors, typography, borderRadius } = spec.theme;

  return `/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        site: {
          primary: "${colors.primary}",
          secondary: "${colors.secondary || '#64748b'}",
          bg: "${colors.background}",
          surface: "${colors.surface}",
          text: "${colors.textPrimary}",
          muted: "${colors.textMuted}",
          border: "${colors.border}",
        }
      },
      fontFamily: {
        heading: ["${typography.headingFont}", "sans-serif"],
        body: ["${typography.bodyFont}", "sans-serif"],
      },
      borderRadius: {
        site: "${borderRadius.base}",
        card: "${borderRadius.cards}",
        button: "${borderRadius.buttons}",
      }
    },
  },
  plugins: [],
};
`;
}

export function generatePostcssConfig(): string {
  return `export default {
  plugins: {
    tailwindcss: {},
    autoprefixer: {},
  },
};
`;
}

export function generateIndexCss(spec: UISpecification): string {
  const { colors, typography } = spec.theme;

  return `@tailwind base;
@tailwind components;
@tailwind utilities;

@layer base {
  body {
    background-color: ${colors.background};
    color: ${colors.textPrimary};
    font-family: "${typography.bodyFont}", sans-serif;
    margin: 0;
    padding: 0;
    -webkit-font-smoothing: antialiased;
  }

  h1, h2, h3, h4, h5, h6 {
    font-family: "${typography.headingFont}", sans-serif;
  }
}
`;
}

export function generateIndexHtml(spec: UISpecification): string {
  const title = spec.metadata.title || 'Recreated Website';
  const favicon = spec.metadata.favicon ? `<link rel="icon" href="${spec.metadata.favicon}" />` : '';
  const fontLinks = (spec.theme.typography.googleFontsToLoad || [])
    .map((href) => `<link rel="stylesheet" href="${href}">`)
    .join('\n    ');

  return `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    ${favicon}
    <title>${title}</title>
    ${fontLinks}
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
`;
}

export function generatePackageJson(spec: UISpecification): string {
  const safeName = spec.metadata.title
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '-')
    .replace(/-+/g, '-')
    .slice(0, 30) || 'recreated-site';

  return `{
  "name": "${safeName}",
  "private": true,
  "version": "1.0.0",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "tsc && vite build",
    "preview": "vite preview"
  },
  "dependencies": {
    "react": "^18.3.1",
    "react-dom": "^18.3.1",
    "lucide-react": "^0.475.0"
  },
  "devDependencies": {
    "@types/react": "^18.3.18",
    "@types/react-dom": "^18.3.5",
    "@vitejs/plugin-react": "^4.3.4",
    "autoprefixer": "^10.4.20",
    "postcss": "^8.5.2",
    "tailwindcss": "^3.4.17",
    "typescript": "^5.7.3",
    "vite": "^6.1.0"
  }
}
`;
}

export function generateTsConfig(): string {
  return `{
  "compilerOptions": {
    "target": "ES2020",
    "useDefineForClassFields": true,
    "lib": ["ES2020", "DOM", "DOM.Iterable"],
    "module": "ESNext",
    "skipLibCheck": true,
    "moduleResolution": "bundler",
    "allowImportingTsExtensions": true,
    "resolveJsonModule": true,
    "isolatedModules": true,
    "noEmit": true,
    "jsx": "react-jsx",
    "strict": true,
    "noUnusedLocals": false,
    "noUnusedParameters": false,
    "noFallthroughCasesInSwitch": true
  },
  "include": ["src"]
}
`;
}

export function generateViteConfig(): string {
  return `import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  base: './',
  plugins: [react()],
});
`;
}
