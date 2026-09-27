/**
 * Core Shared Data Contracts for AI Website Recreator
 */

export interface PageMetadata {
  url: string;
  title: string;
  description?: string;
  favicon?: string;
  ogImage?: string;
  viewport: { width: number; height: number };
  timestamp: string;
}

export type ColorRole =
  | 'primary'
  | 'secondary'
  | 'background'
  | 'surface'
  | 'text'
  | 'text-muted'
  | 'accent'
  | 'border';

export interface ColorInfo {
  hex: string;
  rgb: string;
  role: ColorRole;
  frequency: number;
  sampleElements?: string[];
}

export interface TypographyToken {
  fontFamily: string;
  fontSize: string;
  fontWeight: string;
  lineHeight: string;
  tag: string;
  sampleText: string;
}

export interface TypographySystem {
  headingFont: string;
  bodyFont: string;
  googleFontsToLoad: string[];
  scale: TypographyToken[];
}

export interface AssetInfo {
  url: string;
  type: 'image' | 'svg' | 'background' | 'icon' | 'logo';
  alt?: string;
  dimensions?: { width: number; height: number };
  context: string;
}

export interface NavigationItem {
  text: string;
  href: string;
  isButton?: boolean;
  hasDropdown?: boolean;
}

export interface NavigationStructure {
  brand: {
    text?: string;
    logoUrl?: string;
  };
  links: NavigationItem[];
  ctaButtons: Array<{
    text: string;
    href?: string;
    variant: 'primary' | 'secondary' | 'outline';
  }>;
  isSticky: boolean;
  hasMobileMenu: boolean;
}

export type SectionType =
  | 'header'
  | 'hero'
  | 'features'
  | 'stats'
  | 'social-proof'
  | 'testimonials'
  | 'pricing'
  | 'faq'
  | 'cta'
  | 'footer'
  | 'gallery'
  | 'content';

export interface SectionItem {
  title?: string;
  subtitle?: string;
  description?: string;
  badge?: string;
  price?: string;
  period?: string;
  iconUrl?: string;
  imageUrl?: string;
  author?: {
    name: string;
    role?: string;
    avatarUrl?: string;
  };
  features?: string[];
  link?: {
    text: string;
    href: string;
  };
}

export interface SectionData {
  id: string;
  type: SectionType;
  name: string;
  heading?: string;
  subheading?: string;
  description?: string;
  layout: {
    type: 'grid' | 'flex' | 'single-column' | 'split-hero' | 'cards' | 'masonry';
    columns?: number;
    gap?: string;
    alignment?: string;
  };
  items: SectionItem[];
  buttons: Array<{
    text: string;
    href?: string;
    variant: 'primary' | 'secondary' | 'outline';
  }>;
  styling: {
    backgroundColor?: string;
    textColor?: string;
    isDark?: boolean;
    hasGradient?: boolean;
    padding?: string;
  };
  rawTextSample: string[];
  assets: AssetInfo[];
}

export interface ResponsiveBreakpointData {
  mobile: {
    hamburgerDetected: boolean;
    hiddenElementsCount: number;
    layoutShifts: string[];
  };
  tablet?: {
    layoutShifts: string[];
  };
  desktop: {
    viewport: { width: number; height: number };
  };
}

export interface ExtractedWebsiteData {
  metadata: PageMetadata;
  colors: {
    palette: ColorInfo[];
    background: string;
    textPrimary: string;
    primary: string;
    secondary?: string;
    accent?: string;
    surface?: string;
  };
  typography: TypographySystem;
  navigation: NavigationStructure;
  sections: SectionData[];
  assets: AssetInfo[];
  responsive: ResponsiveBreakpointData;
  rawDomSummary?: {
    totalNodes: number;
    headingsCount: number;
    buttonsCount: number;
    imagesCount: number;
  };
}

export type AnalysisStep =
  | 'browser_launch'
  | 'navigating'
  | 'rendering_content'
  | 'extracting_dom'
  | 'extracting_styles'
  | 'extracting_assets'
  | 'detecting_sections'
  | 'inspecting_responsive'
  | 'completed'
  | 'failed';

export interface AnalysisProgressEvent {
  step: AnalysisStep;
  progress: number;
  message: string;
  timestamp: string;
}

export * from './schema';

export interface GeneratedProject {
  id: string;
  sourceUrl: string;
  createdAt: string;
  files: Record<string, string>;
  previewUrl?: string;
  validationStatus: 'passed' | 'failed' | 'healed';
  validationErrors?: string[];
  iteration: number;
}

export interface ModifyRequest {
  projectPath: string;
  instruction: string;
  projectId?: string;
}

export interface ModificationRecord {
  id: string;
  instruction: string;
  timestamp: string;
  modifiedFiles: string[];
  validation: ValidationResult;
  success: boolean;
  message?: string;
}

export interface ModifyResponse {
  success: boolean;
  modifiedFiles: string[];
  validation: ValidationResult;
  message: string;
  history?: ModificationRecord[];
}

export type DiagnosticErrorType = 'syntax' | 'import' | 'type' | 'build' | 'unknown';

export interface BuildDiagnostic {
  file?: string;
  line?: number;
  column?: number;
  errorType: DiagnosticErrorType;
  message: string;
  severity: 'error' | 'warning';
  raw?: string;
}

export interface ValidationResult {
  success: boolean;
  attempts: number;
  diagnostics: BuildDiagnostic[];
  fixedFiles: string[];
  buildOutput: string;
  healed: boolean;
}

export interface ProjectVersion {
  version: number;
  instruction: string;
  timestamp: number;
  modifiedFiles: string[];
  validation: {
    success: boolean;
    diagnosticsCount?: number;
  };
  snapshotPath: string;
}

export interface ProjectMetadata {
  id: string;
  name: string;
  originalUrl: string;
  projectPath: string;
  previewUrl: string;
  createdAt: number;
  updatedAt: number;
  currentVersion: number;
  versions: ProjectVersion[];
  status: 'passed' | 'failed' | 'generating' | 'healing';
}

export interface CreateProjectPayload {
  name: string;
  originalUrl: string;
  projectPath?: string;
  previewUrl?: string;
}

export interface UpdateProjectPayload {
  name?: string;
  status?: 'passed' | 'failed' | 'generating' | 'healing';
}


