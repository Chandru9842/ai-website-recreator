import React, { useState } from 'react';
import {
  ExtractedWebsiteData,
  AnalysisProgressEvent,
  UISpecification,
  ModifyResponse,
  ModificationRecord,
} from '@ai-website-recreator/shared';
import {
  Globe,
  Search,
  Sparkles,
  Layout,
  Palette,
  Image as ImageIcon,
  AlertCircle,
  ExternalLink,
  RefreshCw,
  Smartphone,
  CheckCircle2,
  Sliders,
  Send,
  History,
  FileCode,
  ShieldCheck,
  Zap,
  Monitor,
  Tablet,
  Eye,
} from 'lucide-react';

export default function App() {
  const [url, setUrl] = useState('https://news.ycombinator.com');
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [progressEvent, setProgressEvent] = useState<AnalysisProgressEvent | null>(null);
  const [analysisResult, setAnalysisResult] = useState<ExtractedWebsiteData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'overview' | 'sections' | 'styles' | 'assets' | 'json'>('overview');

  // Generation & Pipeline state
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedProject, setGeneratedProject] = useState<any | null>(null);
  const [activeCodeFile, setActiveCodeFile] = useState<string>('src/App.tsx');

  // Visual Live Preview state
  const [projectDisplayMode, setProjectDisplayMode] = useState<'preview' | 'code'>('preview');
  const [viewportMode, setViewportMode] = useState<'desktop' | 'tablet' | 'mobile'>('desktop');
  const [previewKey, setPreviewKey] = useState<number>(Date.now());

  // Modification state
  const [instruction, setInstruction] = useState('Make the navbar sticky');
  const [isModifying, setIsModifying] = useState(false);
  const [modificationResult, setModificationResult] = useState<ModifyResponse | null>(null);
  const [modificationHistory, setModificationHistory] = useState<ModificationRecord[]>([]);

  // 1. Analyze Website (Module 1)
  const handleAnalyze = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!url || isAnalyzing) return;

    setIsAnalyzing(true);
    setError(null);
    setGeneratedProject(null);
    setModificationResult(null);
    setProgressEvent({
      step: 'browser_launch',
      progress: 5,
      message: 'Initializing headless browser inspection...',
      timestamp: new Date().toISOString(),
    });

    const clientId = `client-${Date.now()}`;
    const eventSource = new EventSource(`/api/analyze/events?clientId=${clientId}`);

    eventSource.onmessage = (event) => {
      try {
        const data: AnalysisProgressEvent = JSON.parse(event.data);
        setProgressEvent(data);
      } catch (err) {
        console.error('Failed to parse SSE event:', err);
      }
    };

    eventSource.onerror = () => {
      eventSource.close();
    };

    try {
      const response = await fetch('/api/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url, clientId }),
      });

      const json = await response.json();
      if (!response.ok || !json.success) {
        throw new Error(json.error || 'Website analysis failed');
      }

      setAnalysisResult(json.data);
      setProgressEvent(null);
    } catch (err: any) {
      setError(err.message || 'An unexpected error occurred during website analysis');
    } finally {
      setIsAnalyzing(false);
      eventSource.close();
    }
  };

  // 2. Generate React Project (Modules 2, 3 & 4)
  const handleGenerate = async () => {
    if (!analysisResult || isGenerating) return;

    setIsGenerating(true);
    setError(null);

    try {
      // Step A: Synthesize UI Specification
      const specRes = await fetch('/api/spec', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ data: analysisResult }),
      });
      const specJson = await specRes.json();
      if (!specRes.ok || !specJson.success) {
        throw new Error(specJson.error || 'Failed to synthesize UI specification');
      }
      const spec: UISpecification = specJson.data;

      // Step B: Generate React Project with Validation & Auto-Healing
      const genRes = await fetch('/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          spec,
          validateBuild: true,
        }),
      });

      const genJson = await genRes.json();
      if (!genRes.ok || !genJson.success) {
        throw new Error(genJson.error || 'Failed to generate React project');
      }

      setGeneratedProject(genJson.data);
      if (genJson.data?.files) {
        const firstFile = Object.keys(genJson.data.files)[0] || 'src/App.tsx';
        setActiveCodeFile(firstFile);
      }
      setPreviewKey(Date.now());
      setProjectDisplayMode('preview');
    } catch (err: any) {
      setError(err.message || 'Error generating React recreation project');
    } finally {
      setIsGenerating(false);
    }
  };

  // 3. Natural Language Modification (Module 5)
  const handleModify = async (customInstruction?: string) => {
    const textToApply = customInstruction || instruction;
    if (!generatedProject || !textToApply || isModifying) return;

    setIsModifying(true);
    setError(null);

    try {
      const targetPath = generatedProject.projectDir;
      const res = await fetch('/api/modify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          projectPath: targetPath,
          instruction: textToApply,
        }),
      });

      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.error || json.message || 'Modification failed build validation');
      }

      setModificationResult(json);
      if (json.history) {
        setModificationHistory(json.history);
      }

      if (json.updatedFiles) {
        setGeneratedProject((prev: any) => ({
          ...prev,
          files: { ...prev.files, ...json.updatedFiles },
        }));
      }

      if (json.modifiedFiles && json.modifiedFiles.length > 0) {
        setActiveCodeFile(json.modifiedFiles[0]);
      }

      setPreviewKey(Date.now());
    } catch (err: any) {
      setError(err.message || 'Error modifying project');
    } finally {
      setIsModifying(false);
    }
  };

  const samplePrompts = [
    'Make the navbar sticky',
    'Change the primary color to blue',
    'Replace the hero section with a bakery hero',
    'Add a testimonials section',
    'Make the hero heading larger',
    'Remove the footer section',
  ];

  const currentProjectName = generatedProject?.projectDir
    ? generatedProject.projectDir.split(/[\\/]/).pop()
    : generatedProject?.id || '';
  const currentPreviewUrl =
    generatedProject?.previewUrl ||
    (currentProjectName ? `/preview/${encodeURIComponent(currentProjectName)}/` : '');

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col">
      {/* Top Header */}
      <header className="border-b border-slate-800/80 bg-slate-900/50 backdrop-blur-md sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="h-10 w-10 rounded-xl bg-gradient-to-tr from-teal-500 to-cyan-400 flex items-center justify-center shadow-lg shadow-teal-500/20">
              <Sparkles className="h-5 w-5 text-slate-950 font-bold" />
            </div>
            <div>
              <div className="font-bold text-lg tracking-tight bg-gradient-to-r from-white via-slate-200 to-slate-400 bg-clip-text text-transparent">
                AI Website Recreator
              </div>
              <div className="text-xs text-teal-400 font-medium">
                End-to-End Pipeline: Analyze • Synthesize • Generate • Auto-Heal • Natural Language Modify
              </div>
            </div>
          </div>

          <div className="flex items-center space-x-3">
            <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 mr-1.5 animate-pulse"></span>
              Full Pipeline Active
            </span>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 flex flex-col gap-8">
        {/* URL Input Section */}
        <section className="bg-gradient-to-b from-slate-900/80 to-slate-900/40 border border-slate-800 rounded-2xl p-6 sm:p-8 backdrop-blur shadow-2xl relative overflow-hidden">
          <div className="absolute top-0 right-0 w-96 h-96 bg-teal-500/5 rounded-full blur-3xl pointer-events-none -mr-20 -mt-20"></div>

          <div className="max-w-3xl">
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-white mb-2">
              Autonomous Website Recreation & Modification Agent
            </h1>
            <p className="text-slate-400 text-sm sm:text-base mb-6 leading-relaxed">
              Inspects live DOM semantics via Playwright, generates an exact React + Tailwind recreation, validates
              compilation with auto-healing, and applies natural language modifications in-place.
            </p>

            <form onSubmit={handleAnalyze} className="flex flex-col sm:flex-row gap-3">
              <div className="relative flex-1">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                  <Globe className="h-5 w-5 text-slate-500" />
                </div>
                <input
                  type="url"
                  required
                  placeholder="https://example.com"
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  disabled={isAnalyzing || isGenerating}
                  className="w-full pl-10 pr-4 py-3 bg-slate-950/80 border border-slate-700/80 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-teal-500/50 focus:border-teal-500 text-white placeholder-slate-500 transition shadow-inner"
                />
              </div>

              <button
                type="submit"
                disabled={isAnalyzing || isGenerating}
                className="inline-flex items-center justify-center px-6 py-3 border border-transparent text-sm font-semibold rounded-xl text-slate-950 bg-gradient-to-r from-teal-400 to-cyan-400 hover:from-teal-300 hover:to-cyan-300 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-teal-500 transition shadow-lg shadow-teal-500/20 disabled:opacity-50 disabled:cursor-not-allowed gap-2"
              >
                {isAnalyzing ? (
                  <>
                    <RefreshCw className="h-4 w-4 animate-spin" />
                    Analyzing DOM...
                  </>
                ) : (
                  <>
                    <Search className="h-4 w-4" />
                    Analyze Website
                  </>
                )}
              </button>
            </form>
          </div>

          {/* SSE Progress Banner */}
          {isAnalyzing && progressEvent && (
            <div className="mt-6 p-4 rounded-xl bg-slate-950/60 border border-teal-500/20 flex flex-col gap-2 animate-fade-in">
              <div className="flex justify-between items-center text-xs">
                <span className="text-teal-400 font-semibold flex items-center gap-2">
                  <span className="h-2 w-2 rounded-full bg-teal-400 animate-ping"></span>
                  {progressEvent.message}
                </span>
                <span className="font-mono text-slate-400">{progressEvent.progress}%</span>
              </div>
              <div className="w-full h-1.5 bg-slate-800 rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-teal-500 to-cyan-400 transition-all duration-300"
                  style={{ width: `${progressEvent.progress}%` }}
                ></div>
              </div>
            </div>
          )}

          {/* Error Message */}
          {error && (
            <div className="mt-6 p-4 rounded-xl bg-red-950/40 border border-red-800/60 text-red-300 text-sm flex items-start gap-3">
              <AlertCircle className="h-5 w-5 text-red-400 flex-shrink-0 mt-0.5" />
              <div>
                <span className="font-semibold block text-red-200">Error encountered:</span>
                {error}
              </div>
            </div>
          )}
        </section>

        {/* Step 2 Trigger: Generate Recreation */}
        {analysisResult && !generatedProject && (
          <section className="bg-slate-900/60 border border-slate-800 rounded-2xl p-6 flex flex-col sm:flex-row items-center justify-between gap-4">
            <div>
              <h2 className="text-lg font-bold text-white flex items-center gap-2">
                <CheckCircle2 className="h-5 w-5 text-emerald-400" />
                Analysis Complete for &ldquo;{analysisResult.metadata.title}&rdquo;
              </h2>
              <p className="text-sm text-slate-400 mt-1">
                Extracted {analysisResult.sections.length} sections, {analysisResult.assets.length} assets, and {analysisResult.colors.palette.length} color tokens.
              </p>
            </div>

            <button
              onClick={handleGenerate}
              disabled={isGenerating}
              className="inline-flex items-center px-6 py-3 rounded-xl bg-gradient-to-r from-teal-500 to-emerald-400 text-slate-950 font-bold text-sm shadow-lg shadow-teal-500/20 hover:opacity-95 transition disabled:opacity-50 gap-2 flex-shrink-0"
            >
              {isGenerating ? (
                <>
                  <RefreshCw className="h-4 w-4 animate-spin" />
                  Generating & Auto-Healing...
                </>
              ) : (
                <>
                  <Zap className="h-4 w-4" />
                  Generate React Recreation
                </>
              )}
            </button>
          </section>
        )}

        {/* GENERATED WEBSITE & LIVE PREVIEW (Module 3 & 4) */}
        {generatedProject && (
          <section className="bg-slate-900/70 border border-slate-800 rounded-2xl p-6 sm:p-8 flex flex-col gap-6 shadow-2xl">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800 pb-5">
              <div>
                <div className="flex items-center gap-3">
                  <h2 className="text-xl font-bold text-white flex items-center gap-2">
                    <CheckCircle2 className="h-6 w-6 text-emerald-400" />
                    Generated React Application
                  </h2>
                  <span className="px-2.5 py-0.5 text-xs font-semibold rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 uppercase">
                    Build Passed (tsc + vite)
                  </span>
                </div>
                <p className="text-sm text-slate-400 mt-1">
                  Location: <code className="font-mono text-teal-400 text-xs">{generatedProject.projectDir}</code>
                </p>
              </div>

              <div className="flex items-center gap-3">
                <span className="text-xs text-slate-400 font-mono">
                  {Object.keys(generatedProject.files || {}).length} files generated
                </span>
              </div>
            </div>

            {/* Tab Controls: Visual Live Preview vs Code Inspector */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800 pb-4">
              <div className="flex items-center gap-1.5 p-1 bg-slate-950 rounded-xl border border-slate-800">
                <button
                  type="button"
                  onClick={() => setProjectDisplayMode('preview')}
                  className={`px-4 py-2 rounded-lg text-xs font-semibold flex items-center gap-2 transition ${
                    projectDisplayMode === 'preview'
                      ? 'bg-gradient-to-r from-teal-400 to-cyan-400 text-slate-950 shadow-md font-bold'
                      : 'text-slate-400 hover:text-white hover:bg-slate-900'
                  }`}
                >
                  <Eye className="h-4 w-4" />
                  Visual Live Preview
                </button>
                <button
                  type="button"
                  onClick={() => setProjectDisplayMode('code')}
                  className={`px-4 py-2 rounded-lg text-xs font-semibold flex items-center gap-2 transition ${
                    projectDisplayMode === 'code'
                      ? 'bg-gradient-to-r from-teal-400 to-cyan-400 text-slate-950 shadow-md font-bold'
                      : 'text-slate-400 hover:text-white hover:bg-slate-900'
                  }`}
                >
                  <FileCode className="h-4 w-4" />
                  Code Inspector ({Object.keys(generatedProject.files || {}).length} files)
                </button>
              </div>

              {/* Viewport controls & Open in New Window (Visible in Preview mode) */}
              {projectDisplayMode === 'preview' && (
                <div className="flex items-center flex-wrap gap-2">
                  <div className="flex items-center gap-1 bg-slate-950 p-1 rounded-xl border border-slate-800 text-xs">
                    <button
                      type="button"
                      onClick={() => setViewportMode('desktop')}
                      title="Desktop (100% full width)"
                      className={`px-3 py-1.5 rounded-lg flex items-center gap-1.5 transition ${
                        viewportMode === 'desktop'
                          ? 'bg-slate-800 text-teal-300 font-bold border border-teal-500/30 shadow-sm'
                          : 'text-slate-400 hover:text-white'
                      }`}
                    >
                      <Monitor className="h-3.5 w-3.5" />
                      <span>Desktop</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setViewportMode('tablet')}
                      title="Tablet (768px centered preview)"
                      className={`px-3 py-1.5 rounded-lg flex items-center gap-1.5 transition ${
                        viewportMode === 'tablet'
                          ? 'bg-slate-800 text-teal-300 font-bold border border-teal-500/30 shadow-sm'
                          : 'text-slate-400 hover:text-white'
                      }`}
                    >
                      <Tablet className="h-3.5 w-3.5" />
                      <span>Tablet (768px)</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setViewportMode('mobile')}
                      title="Mobile (375px centered preview)"
                      className={`px-3 py-1.5 rounded-lg flex items-center gap-1.5 transition ${
                        viewportMode === 'mobile'
                          ? 'bg-slate-800 text-teal-300 font-bold border border-teal-500/30 shadow-sm'
                          : 'text-slate-400 hover:text-white'
                      }`}
                    >
                      <Smartphone className="h-3.5 w-3.5" />
                      <span>Mobile (375px)</span>
                    </button>
                  </div>

                  <a
                    href={currentPreviewUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 hover:border-teal-500/40 text-xs text-teal-300 font-semibold flex items-center gap-1.5 transition shadow-sm hover:bg-slate-900"
                  >
                    <ExternalLink className="h-3.5 w-3.5" />
                    <span>Open in New Window</span>
                  </a>

                  <button
                    type="button"
                    onClick={() => setPreviewKey(Date.now())}
                    title="Reload live preview"
                    className="p-2 rounded-xl bg-slate-950 border border-slate-800 hover:border-slate-700 text-slate-400 hover:text-teal-300 transition"
                  >
                    <RefreshCw className="h-3.5 w-3.5" />
                  </button>
                </div>
              )}
            </div>

            {/* TAB CONTENT: Visual Preview vs Code Inspector */}
            {projectDisplayMode === 'preview' ? (
              <div className="bg-slate-950/80 rounded-2xl border border-slate-800/80 p-3 sm:p-6 flex flex-col items-center justify-start overflow-hidden">
                <div
                  className={`w-full transition-all duration-300 flex flex-col items-center ${
                    viewportMode === 'mobile'
                      ? 'max-w-[375px]'
                      : viewportMode === 'tablet'
                      ? 'max-w-[768px]'
                      : 'w-full'
                  }`}
                >
                  {/* Browser Mock Frame Header */}
                  <div className="w-full bg-slate-900 border border-slate-800 rounded-t-xl px-4 py-2.5 flex items-center justify-between text-xs text-slate-400 font-mono shadow-md">
                    <div className="flex items-center gap-2">
                      <span className="h-2.5 w-2.5 rounded-full bg-rose-500/80 inline-block"></span>
                      <span className="h-2.5 w-2.5 rounded-full bg-amber-500/80 inline-block"></span>
                      <span className="h-2.5 w-2.5 rounded-full bg-emerald-500/80 inline-block"></span>
                      <span className="ml-2 text-slate-300 font-sans font-medium text-[11px]">
                        {viewportMode === 'mobile'
                          ? 'Mobile Viewport (375px)'
                          : viewportMode === 'tablet'
                          ? 'Tablet Viewport (768px)'
                          : 'Desktop Viewport (100%)'}
                      </span>
                    </div>
                    <span className="text-teal-400 text-[11px] truncate max-w-[200px]">
                      {currentPreviewUrl}
                    </span>
                  </div>

                  {/* Actual Rendered Live Preview iframe */}
                  <iframe
                    key={previewKey}
                    src={currentPreviewUrl}
                    title="Generated React Website Visual Preview"
                    className="w-full h-[650px] bg-white rounded-b-xl border-x border-b border-slate-800 shadow-2xl transition-all"
                    sandbox="allow-scripts allow-same-origin allow-forms allow-popups"
                  />
                </div>
              </div>
            ) : (
              /* Existing Code Inspector */
              <div className="bg-slate-950 rounded-xl border border-slate-800 overflow-hidden flex flex-col">
                {/* File selector tabs */}
                <div className="flex items-center gap-1 p-2 bg-slate-900/80 border-b border-slate-800 overflow-x-auto text-xs font-mono">
                  {Object.keys(generatedProject.files || {}).map((file) => (
                    <button
                      key={file}
                      onClick={() => setActiveCodeFile(file)}
                      className={`px-3 py-1.5 rounded-lg transition whitespace-nowrap flex items-center gap-1.5 ${
                        activeCodeFile === file
                          ? 'bg-teal-500/20 text-teal-300 font-semibold border border-teal-500/30'
                          : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
                      }`}
                    >
                      <FileCode className="h-3.5 w-3.5" />
                      {file}
                    </button>
                  ))}
                </div>

                {/* Code viewer */}
                <pre className="p-4 text-xs font-mono text-slate-300 overflow-x-auto max-h-[350px] leading-relaxed">
                  {generatedProject.files[activeCodeFile] || '// Select a file to inspect'}
                </pre>
              </div>
            )}

            {/* AI NATURAL LANGUAGE MODIFICATION (Module 5) */}
            <div className="mt-4 pt-6 border-t border-slate-800/80 flex flex-col gap-5">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-bold text-white flex items-center gap-2">
                    <Sliders className="h-5 w-5 text-teal-400" />
                    AI Natural Language Modification
                  </h3>
                  <p className="text-xs sm:text-sm text-slate-400 mt-0.5">
                    Modifies existing project files in-place with strict build validation. Does not regenerate the website from scratch.
                  </p>
                </div>
              </div>

              {/* Sample Chips */}
              <div className="flex flex-wrap gap-2">
                {samplePrompts.map((p, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => setInstruction(p)}
                    className="text-xs px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-800 text-slate-300 hover:border-teal-500/40 hover:text-teal-300 transition"
                  >
                    &ldquo;{p}&rdquo;
                  </button>
                ))}
              </div>

              {/* Modification Form */}
              <div className="flex flex-col sm:flex-row gap-3">
                <input
                  type="text"
                  value={instruction}
                  onChange={(e) => setInstruction(e.target.value)}
                  disabled={isModifying}
                  placeholder="e.g., Make the navbar sticky, change primary color to blue..."
                  className="flex-1 px-4 py-3 bg-slate-950 border border-slate-700/80 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-teal-500/50 text-white placeholder-slate-500"
                />
                <button
                  onClick={() => handleModify()}
                  disabled={isModifying || !instruction}
                  className="inline-flex items-center justify-center px-6 py-3 rounded-xl bg-gradient-to-r from-teal-400 to-cyan-400 text-slate-950 font-bold text-sm shadow-lg shadow-teal-500/20 hover:opacity-95 transition disabled:opacity-50 gap-2 flex-shrink-0"
                >
                  {isModifying ? (
                    <>
                      <RefreshCw className="h-4 w-4 animate-spin" />
                      Applying & Validating...
                    </>
                  ) : (
                    <>
                      <Send className="h-4 w-4" />
                      Apply Modification
                    </>
                  )}
                </button>
              </div>

              {/* Modification Status & Feedback Card */}
              {modificationResult && (
                <div className="p-4 rounded-xl bg-slate-950 border border-teal-500/30 flex flex-col gap-3 animate-fade-in">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-teal-400 flex items-center gap-1.5">
                      <ShieldCheck className="h-4 w-4 text-emerald-400" />
                      {modificationResult.message || 'Modification applied successfully'}
                    </span>
                    <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 uppercase">
                      Build Validated
                    </span>
                  </div>

                  <div className="flex items-center gap-2">
                    <span className="text-xs text-slate-400">Files Modified:</span>
                    <div className="flex flex-wrap gap-1.5">
                      {modificationResult.modifiedFiles.map((file, idx) => (
                        <span
                          key={idx}
                          className="px-2 py-0.5 rounded bg-slate-900 border border-slate-800 text-[11px] font-mono text-teal-300"
                        >
                          {file}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {/* Modification History Feed */}
              {modificationHistory.length > 0 && (
                <div className="mt-2 flex flex-col gap-2">
                  <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
                    <History className="h-3.5 w-3.5" />
                    Modification History ({modificationHistory.length})
                  </h4>
                  <div className="flex flex-col gap-2 max-h-48 overflow-y-auto">
                    {modificationHistory.map((h, idx) => (
                      <div
                        key={idx}
                        className="p-3 bg-slate-950/60 rounded-lg border border-slate-800/80 flex items-center justify-between text-xs"
                      >
                        <div className="flex items-center gap-2.5">
                          <CheckCircle2 className="h-4 w-4 text-emerald-400 flex-shrink-0" />
                          <span className="text-slate-200 font-medium">&ldquo;{h.instruction}&rdquo;</span>
                          <span className="text-slate-500 text-[11px]">
                            ({h.modifiedFiles.join(', ')})
                          </span>
                        </div>
                        <span className="text-[10px] text-slate-400 font-mono">
                          {new Date(h.timestamp).toLocaleTimeString()}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </section>
        )}

        {/* Extracted Website Details Tabs (Module 1) */}
        {analysisResult && (
          <section className="bg-slate-900/60 border border-slate-800 rounded-2xl p-6 sm:p-8 flex flex-col gap-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800 pb-5">
              <div>
                <h2 className="text-xl font-bold text-white">{analysisResult.metadata.title}</h2>
                <div className="flex items-center gap-3 mt-1 text-xs text-slate-400">
                  <a
                    href={analysisResult.metadata.url}
                    target="_blank"
                    rel="noreferrer"
                    className="text-teal-400 hover:underline flex items-center gap-1"
                  >
                    {analysisResult.metadata.url}
                    <ExternalLink className="h-3 w-3" />
                  </a>
                  <span>•</span>
                  <span>Viewport: {analysisResult.metadata.viewport.width}x{analysisResult.metadata.viewport.height}</span>
                </div>
              </div>

              {/* Tabs */}
              <div className="flex items-center gap-1 bg-slate-950 p-1 rounded-xl border border-slate-800 text-xs">
                {(['overview', 'sections', 'styles', 'assets', 'json'] as const).map((tab) => (
                  <button
                    key={tab}
                    onClick={() => setActiveTab(tab)}
                    className={`px-3 py-1.5 rounded-lg capitalize transition ${
                      activeTab === tab
                        ? 'bg-teal-500/20 text-teal-300 font-semibold'
                        : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    {tab}
                  </button>
                ))}
              </div>
            </div>

            {/* Tab: Overview */}
            {activeTab === 'overview' && (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="p-4 bg-slate-950 rounded-xl border border-slate-800 flex items-center gap-3">
                  <Layout className="h-8 w-8 text-teal-400" />
                  <div>
                    <div className="text-2xl font-bold text-white">{analysisResult.sections.length}</div>
                    <div className="text-xs text-slate-400">Sections Segmented</div>
                  </div>
                </div>

                <div className="p-4 bg-slate-950 rounded-xl border border-slate-800 flex items-center gap-3">
                  <Palette className="h-8 w-8 text-cyan-400" />
                  <div>
                    <div className="text-2xl font-bold text-white">{analysisResult.colors.palette.length}</div>
                    <div className="text-xs text-slate-400">Palette Tokens</div>
                  </div>
                </div>

                <div className="p-4 bg-slate-950 rounded-xl border border-slate-800 flex items-center gap-3">
                  <ImageIcon className="h-8 w-8 text-emerald-400" />
                  <div>
                    <div className="text-2xl font-bold text-white">{analysisResult.assets.length}</div>
                    <div className="text-xs text-slate-400">Assets Extracted</div>
                  </div>
                </div>

                <div className="p-4 bg-slate-950 rounded-xl border border-slate-800 flex items-center gap-3">
                  <Smartphone className="h-8 w-8 text-indigo-400" />
                  <div>
                    <div className="text-sm font-bold text-white">
                      {analysisResult.responsive.mobile.hamburgerDetected ? 'Mobile Nav' : 'Desktop Flow'}
                    </div>
                    <div className="text-xs text-slate-400">Responsive Profile</div>
                  </div>
                </div>
              </div>
            )}

            {/* Tab: Sections */}
            {activeTab === 'sections' && (
              <div className="flex flex-col gap-4">
                {analysisResult.sections.map((section, idx) => (
                  <div key={idx} className="p-4 bg-slate-950 rounded-xl border border-slate-800 flex flex-col gap-2">
                    <div className="flex items-center justify-between">
                      <span className="font-mono text-xs text-teal-400 font-bold uppercase">
                        [{section.type}] {section.name}
                      </span>
                      <span className="text-xs text-slate-500">
                        Layout: {section.layout.type}
                      </span>
                    </div>
                    <p className="text-sm text-slate-300">
                      {section.heading || section.description || 'Section content extracted'}
                    </p>
                  </div>
                ))}
              </div>
            )}

            {/* Tab: Styles */}
            {activeTab === 'styles' && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <h3 className="text-sm font-bold text-white mb-3">Color Palette</h3>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                    {analysisResult.colors.palette.map((color, idx) => (
                      <div key={idx} className="p-3 bg-slate-950 rounded-xl border border-slate-800 flex flex-col gap-2">
                        <div
                          className="h-10 w-full rounded border border-slate-800"
                          style={{ backgroundColor: color.hex }}
                        ></div>
                        <span className="font-mono text-xs font-bold text-white">{color.hex}</span>
                        <span className="text-[10px] text-slate-400 uppercase">{color.role}</span>
                      </div>
                    ))}
                  </div>
                </div>

                <div>
                  <h3 className="text-sm font-bold text-white mb-3">Typography Tokens</h3>
                  <div className="p-4 bg-slate-950 rounded-xl border border-slate-800 flex flex-col gap-2">
                    <div className="text-xs">
                      <span className="text-slate-400">Heading Font: </span>
                      <span className="font-semibold text-white">{analysisResult.typography.headingFont}</span>
                    </div>
                    <div className="text-xs">
                      <span className="text-slate-400">Body Font: </span>
                      <span className="font-semibold text-white">{analysisResult.typography.bodyFont}</span>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Tab: Assets */}
            {activeTab === 'assets' && (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
                {analysisResult.assets.map((asset, idx) => (
                  <div key={idx} className="p-3 bg-slate-950 rounded-xl border border-slate-800 flex flex-col gap-2">
                    <div className="h-24 w-full bg-slate-900 rounded flex items-center justify-center p-2 overflow-hidden">
                      <img
                        src={asset.url}
                        alt={asset.alt || 'asset'}
                        className="max-h-full max-w-full object-contain"
                        onError={(e) => {
                          (e.target as HTMLElement).style.display = 'none';
                        }}
                      />
                    </div>
                    <span className="text-xs text-slate-300 truncate">{asset.alt || asset.context}</span>
                    <span className="text-[10px] font-mono text-teal-400 uppercase">{asset.type}</span>
                  </div>
                ))}
              </div>
            )}

            {/* Tab: JSON */}
            {activeTab === 'json' && (
              <pre className="p-4 bg-slate-950 rounded-xl border border-slate-800 text-xs font-mono text-teal-300 max-h-[500px] overflow-auto">
                {JSON.stringify(analysisResult, null, 2)}
              </pre>
            )}
          </section>
        )}
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-900 bg-slate-950 py-6 text-center text-xs text-slate-500">
        AI Website Recreator • Full Architecture Complete (Modules 1–5)
      </footer>
    </div>
  );
}
