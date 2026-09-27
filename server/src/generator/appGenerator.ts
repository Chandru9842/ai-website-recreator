import { UISpecification } from '@ai-website-recreator/shared';
import { getComponentName } from './sectionGenerators';

export function generateAppTsx(spec: UISpecification): string {
  const hasNavbar =
    (spec.navigation.links && spec.navigation.links.length > 0) ||
    spec.navigation.brand.text ||
    spec.navigation.brand.logoUrl;

  const sectionImports: string[] = [];
  const sectionRenders: string[] = [];

  spec.sections.forEach((sec) => {
    // Avoid duplicating footer if handled separately
    if (sec.type === 'footer') return;

    const componentName = getComponentName(sec);
    sectionImports.push(`import { ${componentName} } from './sections/${componentName}';`);
    sectionRenders.push(`<${componentName} />`);
  });

  const hasFooter = spec.sections.some((s) => s.type === 'footer') || hasNavbar;

  return `import React from 'react';
${hasNavbar ? "import { Navbar } from './sections/Navbar';" : ''}
${sectionImports.join('\n')}
${hasFooter ? "import { Footer } from './sections/Footer';" : ''}

export default function App() {
  return (
    <div className="min-h-screen bg-site-bg text-site-text font-body selection:bg-site-primary selection:text-white">
      ${hasNavbar ? '<Navbar />' : ''}
      <main>
        ${sectionRenders.join('\n        ')}
      </main>
      ${hasFooter ? '<Footer />' : ''}
    </div>
  );
}
`;
}

export function generateMainTsx(): string {
  return `import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
`;
}
