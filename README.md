# AI Website Recreator 🌐✨

> **Founding AI Engineer Assessment Project**
> An autonomous AI agent pipeline that analyzes live public websites via Playwright and recreates their exact layout, sections, navigation, content, assets, typography, and responsive styling as a fresh React + Tailwind CSS application.

---

## 📌 Core Philosophy: Analysis Before Generation

This is **NOT** a generic AI website template generator that outputs random themes based on a simple prompt.

Instead, the agent:
1. **Navigates to the live target URL** in a headless browser instance.
2. **Deeply inspects the live DOM, computed styles, assets, and layouts**.
3. **Mines exact visual tokens**: primary/secondary/surface colors, typography families & scales, and responsive breakpoint shifts.
4. **Segments actual structural sections**: Navigation bar, Hero banner, Features grid, Social proof, Pricing tiers, FAQ, and Footer.
5. **Extracts high-resolution assets**: Logos, inline SVGs, imagery, and CSS backgrounds.
6. **Produces an accurate, validated React + Tailwind recreation** preserving the source site's visual identity.

---

## 🏗️ System Architecture & Modular Design

The project is structured as a modular TypeScript monorepo with strict separation of concerns:

```
ai-website-recreator/
├── client/                     # Frontend Dashboard (React + Vite + Tailwind CSS + Lucide)
│   ├── src/
│   │   ├── App.tsx             # Interactive dashboard, real-time SSE progress, tabs & metrics
│   │   ├── main.tsx
│   │   └── index.css
│   ├── index.html
│   ├── tailwind.config.js
│   └── vite.config.ts
│
├── server/                     # Backend API & Autonomous Agent Core (Node.js + Express)
│   ├── src/
│   │   ├── analyzer/           # 🔍 MODULE 1: Playwright Website Analyzer (IMPLEMENTED)
│   │   │   ├── browser.ts      # Headless browser lifecycle, stealth headers, viewport manager
│   │   │   ├── domExtractor.ts # Semantic DOM tree, metadata, navigation bar, and text extraction
│   │   │   ├── styleExtractor.ts # Computed color palette clustering, typography scale mining
│   │   │   ├── assetExtractor.ts # Resolution of images, SVGs, background-image URLs, logos
│   │   │   ├── sectionDetector.ts# Heuristic layout segmenter (Hero, Features, Pricing, Footer)
│   │   │   ├── responsiveInspector.ts # Multi-viewport sampling (Mobile 375px, Tablet, Desktop)
│   │   │   ├── index.ts        # Orchestrator: analyzeWebsite(url, options)
│   │   │   └── cli.ts          # Standalone CLI test runner
│   │   │
│   │   ├── ai/                 # 🧠 MODULE 2: AI Analysis & UI Specification Layer
│   │   │   └── index.ts        # Translates extracted DOM/style data into clean UI specification
│   │   │
│   │   ├── generator/          # ⚛️ MODULE 3: React + Tailwind Code Generator
│   │   │   └── index.ts        # Generates clean, modular React components & Tailwind styles
│   │   │
│   │   ├── validator/          # 🛡️ MODULE 4: Validation & Auto-Healing Engine
│   │   │   └── index.ts        # Compiles code, captures errors, feeds back to AI for auto-fix
│   │   │
│   │   ├── modifier/           # 💬 MODULE 5: Natural Language Iterative Modifier
│   │   │   └── index.ts        # Applies targeted prompt modifications to existing code
│   │   │
│   │   ├── routes/
│   │   │   └── analyze.ts      # REST & SSE streaming endpoints (/api/analyze)
│   │   ├── utils/
│   │   │   ├── logger.ts       # Structured timestamped logger
│   │   │   └── urlHelper.ts    # URL normalization and absolute asset resolution
│   │   ├── app.ts              # Express application factory
│   │   └── index.ts            # Server entry point (Port 5000)
│   └── package.json
│
├── shared/                     # 📦 Shared TypeScript Types & Contracts
│   ├── src/
│   │   ├── types.ts            # ExtractedWebsiteData, UISpecification, AnalysisProgressEvent
│   │   └── index.ts
│   └── package.json
│
├── output/                     # Analysis results & JSON audit artifacts
└── package.json                # Root workspaces package
```

---

## 🔍 Module 1: Website Analyzer (Deep Dive)

The **Website Analyzer** is the foundational perception module of the agent. It operates through 6 specialized sub-engines:

| Sub-Engine | Responsibilities | Output Key |
| :--- | :--- | :--- |
| **`browser.ts`** | Manages Playwright Chromium sessions with automatic fallback to system Chrome/Edge. Injects scroll triggers to force lazy-loaded images to load. | Active Page Context |
| **`domExtractor.ts`** | Analyzes DOM hierarchy, page title, meta description, brand logo, navigation links, and action buttons. | `metadata`, `navigation` |
| **`styleExtractor.ts`** | Traverses visible elements, converts RGB/RGBA to HEX, deduplicates, and clusters colors into functional roles (`primary`, `secondary`, `background`, `surface`, `text`). Extracts typography fonts and scale. | `colors`, `typography` |
| **`assetExtractor.ts`** | Finds `<img>`, inline `<svg>`, CSS `background-image`, and OpenGraph media. Resolves all relative URLs to absolute URLs. | `assets` |
| **`sectionDetector.ts`** | Detects major visual containers, classifies semantic section types (`hero`, `features`, `pricing`, `testimonials`, `footer`), extracts card items, buttons, and layout styles (`grid`, `flex`, `columns`). | `sections` |
| **`responsiveInspector.ts`** | Samples viewports at Mobile (375x812) and Tablet (768x1024). Detects hamburger menus and layout changes. | `responsive` |

---

## 🚀 Quickstart & Testing

### 1. Install Dependencies
```bash
npm install
```

### 2. Test Website Analyzer via CLI
Run the analyzer on any live public website directly from your terminal:

```bash
# Test on Hacker News
npm run test:analyzer -- https://news.ycombinator.com

# Test on Tailwind CSS
npm run test:analyzer -- https://tailwindcss.com

# Test on Stripe
npm run test:analyzer -- https://stripe.com
```

The CLI outputs:
- Real-time percentage progress bar
- Extracted metadata (Title, Viewport, Description)
- Identified Color Palette with hex codes & functional roles
- Font families & Typography scale
- Navigation structure (Brand, Links, CTAs)
- Section-by-section breakdown (Hero, Content, Pricing, Footer)
- Total assets extracted (Images, SVGs, Logos)
- Responsive findings (Mobile hamburger detection, layout shifts)
- Saves full detailed JSON to `output/analysis_sample.json`

### 3. Run Development Servers (Dashboard + API)
```bash
npm run dev
```
- **Backend API**: `http://localhost:5000`
- **Frontend Dashboard**: `http://localhost:5173`

---

## 🎙️ Founding AI Engineer Interview Talking Points

1. **Why Playwright over standard Cheerio / Axios?**
   - Modern websites rely on client-side hydration (React/Next.js/Vue), CSS-in-JS, Tailwind variables, and lazy loading. A simple HTML parser only sees empty `<div id="root"></div>` tags and miss computed styles. Playwright inspects the rendered, computed DOM and live CSS.

2. **How does the system prevent hallucinated sections?**
   - The AI generation layer is grounded strictly on the structured JSON produced by the Analyzer (`sections`, `items`, `buttons`, `styling`). The prompt schema forbids adding synthetic sections not detected in the source.

3. **Multi-Viewport & Responsive Awareness:**
   - Instead of guessing responsive rules, the analyzer programmatically resizes the browser viewport to 375px (mobile) and inspects hamburger menu triggers, hidden elements, and grid collapse patterns.

4. **Fault Tolerance & Resilience:**
   - Playwright uses auto-fallback: if bundled Chromium is missing, it dynamically switches to system-installed Chrome or Edge without failing.
   - Network navigation gracefully falls back from `networkidle` to `domcontentloaded` to prevent hangs on long-polling trackers.