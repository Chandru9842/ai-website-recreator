# AI Website Recreator 🌐✨

> **Founding AI Engineer Assessment Project**
> An autonomous AI agent pipeline that analyzes live public websites via Playwright and recreates their exact layout, sections, navigation, content, assets, typography, and responsive styling as a fresh React + Tailwind CSS application, with an iterative natural-language modification engine and automated build healing.

---

## 📌 Core Philosophy: Analysis Before Generation

This is **NOT** a generic AI website template generator that outputs random themes based on a simple prompt.

Instead, the agent executes an end-to-end 5-stage pipeline:

```
Target Website URL
        ↓
[1. Playwright Analyzer] ──→ Computed DOM, Typography, Colors, Assets, Viewports
        ↓
[2. AI UI Specification] ──→ Grounded UISpecification (Zero Hallucinations)
        ↓
[3. React Generator]     ──→ Reusable Components, Tailwind Tokens, Vite App
        ↓
[4. Validator & Auto-Heal] ──→ tsc + vite build (Diagnostics & Iterative Fixes)
        ↓
[Live Preview in Dashboard]
        ↓
[5. NL Modifier]        ──→ "Make navbar sticky" / "Change primary color"
        ↓
[Re-Validate & Rollback] ──→ Verified Updated React Frontend
```

---

## 🏗️ System Architecture & Modular Design

The project is structured as a modular TypeScript monorepo:

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
│   │   ├── analyzer/           # 🔍 MODULE 1: Playwright Website Analyzer
│   │   │   ├── browser.ts      # Headless browser lifecycle, stealth headers, viewport manager
│   │   │   ├── domExtractor.ts # Semantic DOM tree, metadata, navigation bar, and text extraction
│   │   │   ├── styleExtractor.ts # Computed color palette clustering, typography scale mining
│   │   │   ├── assetExtractor.ts # Resolution of images, SVGs, background-image URLs, logos
│   │   │   ├── sectionDetector.ts# Heuristic layout segmenter (Hero, Features, Pricing, Footer)
│   │   │   ├── responsiveInspector.ts # Multi-viewport sampling (Mobile 375px, Tablet, Desktop)
│   │   │   ├── index.ts        # Orchestrator: analyzeWebsite(url, options)
│   │   │   └── cli.ts          # Standalone CLI test runner
│   │   │
│   │   ├── spec/               # 🧠 MODULE 2: AI Analysis & UI Specification Layer
│   │   │   ├── specGenerator.ts# Gemini LLM grounder + deterministic rule-based fallback
│   │   │   ├── promptBuilder.ts# Grounding prompt builder enforcing strict data fidelity
│   │   │   ├── validator.ts    # JSON schema validator for UISpecification
│   │   │   └── index.ts        # Entry point: generateUISpecification(extractedData)
│   │   │
│   │   ├── generator/          # ⚛️ MODULE 3: React + Tailwind Code Generator
│   │   │   ├── componentGenerator.ts # Generates Navbar, Hero, Section, Card, CTA, Footer
│   │   │   ├── styleConfigurator.ts  # Generates tailwind.config.js with exact extracted tokens
│   │   │   ├── projectScaffolder.ts  # Scaffolds complete standalone Vite + React + TS project
│   │   │   └── index.ts        # Entry point: generateReactProject(spec, outputDir)
│   │   │
│   │   ├── validator/          # 🛡️ MODULE 4: Validation & Auto-Healing Engine
│   │   │   ├── buildRunner.ts  # Executes `tsc --noEmit` and `vite build`
│   │   │   ├── diagnosticExtractor.ts # Parses raw compiler output into structured diagnostics
│   │   │   ├── autoHealer.ts   # AI + regex diagnostic healing loop (up to 3 iterations)
│   │   │   └── index.ts        # Entry point: validateAndHeal(projectPath)
│   │   │
│   │   ├── modifier/           # 💬 MODULE 5: Natural Language Frontend Modification Engine
│   │   │   ├── safeFileModifier.ts # Sandboxed file read/write with path traversal guard
│   │   │   ├── fileSelector.ts # Intent-to-file mapper for targeted in-place edits
│   │   │   ├── aiModifier.ts   # LLM instruction parser + high-precision deterministic rules
│   │   │   ├── historyManager.ts # Persistent modification history (.modifications.json)
│   │   │   └── index.ts        # Orchestrator: modifyProject(options) with rollback
│   │   │
│   │   ├── routes/
│   │   │   ├── analyze.ts      # REST & SSE streaming endpoints (/api/analyze)
│   │   │   ├── generate.ts     # Generation endpoint (/api/generate)
│   │   │   ├── validate.ts     # Validation endpoint (/api/validate)
│   │   │   └── modify.ts       # Natural language modification endpoint (/api/modify)
│   │   ├── app.ts              # Express application factory
│   │   └── index.ts            # Server entry point (Port 5000)
│   └── package.json
│
├── shared/                     # 📦 Shared TypeScript Types & Contracts
│   ├── src/
│   │   ├── types.ts            # ExtractedWebsiteData, UISpecification, Diagnostic, etc.
│   │   └── index.ts
│   └── package.json
│
└── package.json                # Root workspaces package
```

---

## 🔍 The 5 Modules

### Module 1: Website Analyzer (`server/src/analyzer/`)
- Launches headless Chromium via Playwright (with fallback to system Chrome/Edge).
- Extracts DOM structure, page metadata, navigation links, and action buttons.
- Computes styles: color clustering (`primary`, `secondary`, `background`, `surface`, `text`), font families, and typography scales.
- Resolves all image, SVG, background, and OpenGraph asset URLs.
- Classifies layout sections: `hero`, `features`, `pricing`, `testimonials`, `cta`, `footer`.
- Samples mobile (375px) and tablet (768px) viewports for responsive behaviors and hamburger navigation.

### Module 2: AI Analysis & UI Specification Layer (`server/src/spec/`)
- Converts raw `ExtractedWebsiteData` into a strongly-typed `UISpecification`.
- Primary grounding source: the extracted data (not assumptions from the URL).
- Uses Gemini 2.5 Flash with structured system instructions forbidding synthetic or hallucinated sections.
- Includes a deterministic rule-based fallback ensuring 100% reliability offline or in testing environments.

### Module 3: React + Tailwind Code Generator (`server/src/generator/`)
- Translates `UISpecification` into a clean, standalone Vite + React + TypeScript + Tailwind project.
- Generates only components that actually exist in the target specification (`Navbar`, `Hero`, `Section`, `Footer`).
- Preserves exact section ordering, headings, body text, buttons, links, images, and layout geometries.
- Configures custom Tailwind color tokens and font families derived from the original site.

### Module 4: Validation & Auto-Healing Engine (`server/src/validator/`)
- Runs `tsc --noEmit` and `vite build` against generated projects.
- Parses raw compiler output into structured diagnostics:
  ```json
  {
    "file": "src/components/Hero.tsx",
    "line": 42,
    "column": 12,
    "errorType": "typescript",
    "message": "Cannot find name 'ChevronRight'",
    "severity": "error"
  }
  ```
- Executes an automated repair loop (up to 3 iterations) resolving missing imports, unclosed tags, and syntax errors.

### Module 5: Natural Language Frontend Modification Engine (`server/src/modifier/`)
- Modifies existing projects **in-place** without regenerating from scratch.
- Selects and edits only the minimal set of files required for the requested change.
- Sandboxed safe file access: strictly rejects absolute paths, `..` path traversals, and edits outside the project.
- Closed-loop validation: all modifications pass Module 4 build validation before returning success.
- Automatic rollback: restores files to their previous state if validation fails after repair attempts.
- Persistent audit log: records instruction, timestamp, files modified, and validation outcome in `.modifications.json`.

---

## 🚀 Quickstart & Running Tests

### 1. Install Dependencies
```bash
npm install
```

### 2. Run All Automated Test Suites
Every module includes dedicated unit and integration tests:

```bash
# Module 1: Website Analyzer
npm run test:analyzer

# Module 2: UI Specification Layer
npm run test:spec

# Module 3: React + Tailwind Code Generator
npm run test:generator

# Module 4: Validation & Auto-Healing Engine
npm run test:validator

# Module 5: Natural Language Frontend Modification Engine
npm run test:modifier
```

### 3. Build All Monorepo Workspaces
```bash
npm run build
```

### 4. Start Development Servers (Dashboard + API)
```bash
npm run dev
```
- **Backend API**: `http://localhost:5000`
- **Frontend Dashboard**: `http://localhost:5173`

---

## 🌐 API Reference

### 1. Analyze Website
`POST /api/analyze`
```json
{
  "url": "https://example.com"
}
```
*Supports Server-Sent Events (SSE) streaming progress updates when requested with `Accept: text/event-stream`.*

### 2. Generate React Recreation
`POST /api/generate`
```json
{
  "spec": { ...UISpecification },
  "projectName": "my-recreation"
}
```

### 3. Validate & Auto-Heal Project
`POST /api/validate`
```json
{
  "projectPath": "output/projects/my-recreation"
}
```

### 4. Natural Language Modify
`POST /api/modify`
```json
{
  "projectPath": "output/projects/my-recreation",
  "instruction": "Make the navbar sticky"
}
```
**Response:**
```json
{
  "success": true,
  "projectPath": "output/projects/my-recreation",
  "instruction": "Make the navbar sticky",
  "modifiedFiles": ["src/components/Navbar.tsx"],
  "record": {
    "id": "mod_1774691456789_abc",
    "timestamp": 1774691456789,
    "instruction": "Make the navbar sticky",
    "summary": "Updated Navbar.tsx to make navbar sticky with sticky top-0 z-50",
    "filesModified": ["src/components/Navbar.tsx"],
    "validationPassed": true,
    "diagnosticsCount": 0
  }
}
```

---

## 🎙️ Founding AI Engineer Assessment Talking Points

1. **Why Playwright over standard Cheerio / Axios?**
   - Modern websites rely on client-side hydration (React/Next.js/Vue), CSS-in-JS, Tailwind variables, and lazy loading. Playwright inspects the rendered, computed DOM and live CSS rules rather than static initial HTML.

2. **How does the system prevent hallucinated sections?**
   - The AI generation layer is grounded strictly on the structured JSON produced by the Analyzer (`sections`, `items`, `buttons`, `styling`). The prompt schema forbids inventing synthetic sections or content not detected in the source.

3. **Closed-Loop Auto-Healing:**
   - Rather than hoping generated code works, the system compiles each project with `tsc --noEmit` and `vite build`. Any errors are parsed into structured diagnostics and fed back into an iterative auto-healer with AST-aware rules.

4. **In-Place Modification vs Full Regeneration:**
   - When the user asks for a change (e.g. "Make navbar sticky" or "Change primary color to blue"), the modification engine targets only affected files (`Navbar.tsx` or `tailwind.config.js`). It never wipes out existing work or regenerates from scratch.

5. **Sandbox Security & Rollback Safety:**
   - File modification is strictly sandboxed: path traversal attacks (`..`), absolute paths, and modifications to root directories are rejected before execution. Every modification snapshots modified files and automatically rolls back if builds fail.