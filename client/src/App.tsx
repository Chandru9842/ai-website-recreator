import React, { useState } from 'react';
import {
  ExtractedWebsiteData,
  AnalysisProgressEvent,
} from '@ai-website-recreator/shared';
import {
  Globe,
  Search,
  Sparkles,
  Layout,
  Palette,
  Type,
  Image as ImageIcon,
  AlertCircle,
  ExternalLink,
  Code2,
  RefreshCw,
  Smartphone,
  Layers,
  ArrowRight,
} from 'lucide-react';

export default function App() {
  const [url, setUrl] = useState('https://news.ycombinator.com');
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [progressEvent, setProgressEvent] = useState<AnalysisProgressEvent | null>(null);
  const [analysisResult, setAnalysisResult] = useState<ExtractedWebsiteData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'overview' | 'sections' | 'styles' | 'assets' | 'json'>('overview');

  const handleAnalyze = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!url || isAnalyzing) return;

    setIsAnalyzing(true);
    setError(null);
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

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col">
      {/* Top Navigation */}
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
              <div className="text-xs text-teal-400 font-medium">Founding AI Engineer Engine • Module 1: Website Analyzer</div>
            </div>
          </div>

          <div className="flex items-center space-x-3">
            <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 mr-1.5 animate-pulse"></span>
              Playwright Ready
            </span>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 flex flex-col gap-8">
        {/* Hero & Input Section */}
        <section className="bg-gradient-to-b from-slate-900/80 to-slate-900/40 border border-slate-800 rounded-2xl p-6 sm:p-8 backdrop-blur shadow-2xl relative overflow-hidden">
          <div className="absolute top-0 right-0 w-96 h-96 bg-teal-500/5 rounded-full blur-3xl pointer-events-none -mr-20 -mt-20"></div>

          <div className="max-w-3xl">
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-white mb-2">
              Autonomous Visual & Structural Website Analyzer
            </h1>
            <p className="text-slate-400 text-sm sm:text-base mb-6 leading-relaxed">
              Accepts any live, public website URL, inspects DOM semantics via Playwright, mines the computed
              color palette and typography tokens, extracts assets, and segments actual layout sections.
            </p>

            <form onSubmit={handleAnalyze} className="flex flex-col sm:flex-row gap-3">
              <div className="relative flex-1">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-500">
                  <Globe className="h-5 w-5" />
                </div>
                <input
                  type="text"
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  placeholder="https://example.com"
                  disabled={isAnalyzing}
                  className="block w-full pl-11 pr-4 py-3.5 bg-slate-950/80 border border-slate-700/80 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent text-sm transition-all"
                />
              </div>

              <button
                type="submit"
                disabled={isAnalyzing || !url}
                className="inline-flex items-center justify-center px-6 py-3.5 rounded-xl font-semibold text-sm bg-gradient-to-r from-teal-500 to-emerald-500 hover:from-teal-400 hover:to-emerald-400 text-slate-950 shadow-lg shadow-teal-500/25 transition-all disabled:opacity-50 disabled:cursor-not-allowed group cursor-pointer"
              >
                {isAnalyzing ? (
                  <>
                    <RefreshCw className="h-4 w-4 mr-2 animate-spin text-slate-950" />
                    Analyzing DOM...
                  </>
                ) : (
                  <>
                    <Search className="h-4 w-4 mr-2 group-hover:scale-110 transition-transform" />
                    Analyze Website
                  </>
                )}
              </button>
            </form>

            {/* Quick URL presets */}
            <div className="mt-3 flex items-center gap-2 text-xs text-slate-500 flex-wrap">
              <span>Try test URLs:</span>
              {[
                { name: 'Hacker News', url: 'https://news.ycombinator.com' },
                { name: 'Tailwind CSS', url: 'https://tailwindcss.com' },
                { name: 'Stripe', url: 'https://stripe.com' },
                { name: 'GitHub', url: 'https://github.com' },
              ].map((preset) => (
                <button
                  key={preset.name}
                  type="button"
                  onClick={() => setUrl(preset.url)}
                  className="text-slate-400 hover:text-teal-400 underline decoration-slate-700 hover:decoration-teal-400 cursor-pointer transition-colors"
                >
                  {preset.name}
                </button>
              ))}
            </div>
          </div>

          {/* Progress Bar (when analyzing) */}
          {isAnalyzing && progressEvent && (
            <div className="mt-8 pt-6 border-t border-slate-800/80 animate-in fade-in duration-300">
              <div className="flex justify-between items-center text-xs font-medium mb-2">
                <span className="text-teal-400 flex items-center gap-2">
                  <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                  {progressEvent.message}
                </span>
                <span className="text-slate-400 font-mono">{progressEvent.progress}%</span>
              </div>
              <div className="w-full h-2 bg-slate-950 rounded-full overflow-hidden border border-slate-800">
                <div
                  className="h-full bg-gradient-to-r from-teal-500 to-cyan-400 transition-all duration-300 ease-out"
                  style={{ width: `${progressEvent.progress}%` }}
                ></div>
              </div>
            </div>
          )}

          {/* Error Banner */}
          {error && (
            <div className="mt-6 p-4 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 flex items-start gap-3 text-sm">
              <AlertCircle className="h-5 w-5 shrink-0 mt-0.5" />
              <div>
                <div className="font-semibold">Analysis Failed</div>
                <div className="text-xs text-red-300 mt-1">{error}</div>
              </div>
            </div>
          )}
        </section>

        {/* Results Dashboard */}
        {analysisResult && (
          <section className="flex flex-col gap-6 animate-in fade-in duration-500">
            {/* Meta summary card */}
            <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-5 flex flex-wrap items-center justify-between gap-4">
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-lg font-bold text-white tracking-tight">
                    {analysisResult.metadata.title}
                  </h2>
                  <a
                    href={analysisResult.metadata.url}
                    target="_blank"
                    rel="noreferrer"
                    className="text-slate-400 hover:text-teal-400 transition-colors"
                  >
                    <ExternalLink className="h-4 w-4" />
                  </a>
                </div>
                <p className="text-xs text-slate-400 mt-1">
                  {analysisResult.metadata.description || 'No meta description provided'}
                </p>
              </div>

              <div className="flex items-center gap-4 text-xs font-mono text-slate-400">
                <div className="flex items-center gap-1.5 bg-slate-950/80 px-3 py-1.5 rounded-lg border border-slate-800">
                  <Layers className="h-3.5 w-3.5 text-teal-400" />
                  <span>{analysisResult.sections.length} Sections</span>
                </div>
                <div className="flex items-center gap-1.5 bg-slate-950/80 px-3 py-1.5 rounded-lg border border-slate-800">
                  <ImageIcon className="h-3.5 w-3.5 text-cyan-400" />
                  <span>{analysisResult.assets.length} Assets</span>
                </div>
                <div className="flex items-center gap-1.5 bg-slate-950/80 px-3 py-1.5 rounded-lg border border-slate-800">
                  <Smartphone className="h-3.5 w-3.5 text-amber-400" />
                  <span>
                    {analysisResult.responsive.mobile.hamburgerDetected
                      ? 'Mobile Hamburger'
                      : 'Responsive Flow'}
                  </span>
                </div>
              </div>
            </div>

            {/* Navigation Tabs */}
            <div className="flex border-b border-slate-800 gap-2">
              {[
                { id: 'overview', label: 'Overview', icon: Layout },
                { id: 'sections', label: 'Sections', icon: Layers, count: analysisResult.sections.length },
                { id: 'styles', label: 'Colors & Typography', icon: Palette },
                { id: 'assets', label: 'Assets & Media', icon: ImageIcon, count: analysisResult.assets.length },
                { id: 'json', label: 'Raw Extracted JSON', icon: Code2 },
              ].map((tab) => {
                const Icon = tab.icon;
                const isActive = activeTab === tab.id;
                return (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id as any)}
                    className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-all cursor-pointer ${
                      isActive
                        ? 'border-teal-400 text-teal-400 bg-teal-500/5'
                        : 'border-transparent text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    <Icon className="h-4 w-4" />
                    <span>{tab.label}</span>
                    {tab.count !== undefined && (
                      <span className="text-xs px-1.5 py-0.5 rounded-full bg-slate-800 text-slate-400">
                        {tab.count}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>

            {/* Tab: Overview */}
            {activeTab === 'overview' && (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {/* Visual Tokens Card */}
                <div className="bg-slate-900/50 border border-slate-800 rounded-xl p-5 flex flex-col gap-4">
                  <div className="flex items-center gap-2 text-sm font-semibold text-slate-200">
                    <Palette className="h-4 w-4 text-teal-400" />
                    <span>Core Color Tokens</span>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="p-3 bg-slate-950 rounded-lg border border-slate-800">
                      <div className="text-xs text-slate-500 mb-1">Primary Brand</div>
                      <div className="flex items-center gap-2">
                        <div
                          className="h-5 w-5 rounded-md border border-slate-700 shadow-sm"
                          style={{ backgroundColor: analysisResult.colors.primary }}
                        ></div>
                        <span className="font-mono text-xs font-bold text-white">
                          {analysisResult.colors.primary}
                        </span>
                      </div>
                    </div>

                    <div className="p-3 bg-slate-950 rounded-lg border border-slate-800">
                      <div className="text-xs text-slate-500 mb-1">Background</div>
                      <div className="flex items-center gap-2">
                        <div
                          className="h-5 w-5 rounded-md border border-slate-700 shadow-sm"
                          style={{ backgroundColor: analysisResult.colors.background }}
                        ></div>
                        <span className="font-mono text-xs text-slate-300">
                          {analysisResult.colors.background}
                        </span>
                      </div>
                    </div>

                    <div className="p-3 bg-slate-950 rounded-lg border border-slate-800">
                      <div className="text-xs text-slate-500 mb-1">Text Primary</div>
                      <div className="flex items-center gap-2">
                        <div
                          className="h-5 w-5 rounded-md border border-slate-700 shadow-sm"
                          style={{ backgroundColor: analysisResult.colors.textPrimary }}
                        ></div>
                        <span className="font-mono text-xs text-slate-300">
                          {analysisResult.colors.textPrimary}
                        </span>
                      </div>
                    </div>

                    <div className="p-3 bg-slate-950 rounded-lg border border-slate-800">
                      <div className="text-xs text-slate-500 mb-1">Surface Card</div>
                      <div className="flex items-center gap-2">
                        <div
                          className="h-5 w-5 rounded-md border border-slate-700 shadow-sm"
                          style={{ backgroundColor: analysisResult.colors.surface || '#ffffff' }}
                        ></div>
                        <span className="font-mono text-xs text-slate-300">
                          {analysisResult.colors.surface || '#ffffff'}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Typography Card */}
                <div className="bg-slate-900/50 border border-slate-800 rounded-xl p-5 flex flex-col gap-4">
                  <div className="flex items-center gap-2 text-sm font-semibold text-slate-200">
                    <Type className="h-4 w-4 text-cyan-400" />
                    <span>Deduce Typography</span>
                  </div>
                  <div className="flex flex-col gap-3">
                    <div className="p-3 bg-slate-950 rounded-lg border border-slate-800">
                      <div className="text-xs text-slate-500 mb-1">Heading Family</div>
                      <div className="text-sm font-bold text-white truncate">
                        {analysisResult.typography.headingFont}
                      </div>
                    </div>
                    <div className="p-3 bg-slate-950 rounded-lg border border-slate-800">
                      <div className="text-xs text-slate-500 mb-1">Body Family</div>
                      <div className="text-sm text-slate-300 truncate">
                        {analysisResult.typography.bodyFont}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Navigation Summary */}
                <div className="bg-slate-900/50 border border-slate-800 rounded-xl p-5 flex flex-col gap-4">
                  <div className="flex items-center gap-2 text-sm font-semibold text-slate-200">
                    <Globe className="h-4 w-4 text-emerald-400" />
                    <span>Navigation Structure</span>
                  </div>
                  <div className="flex flex-col gap-2 text-xs">
                    <div className="flex justify-between py-1 border-b border-slate-800">
                      <span className="text-slate-500">Brand Name / Logo:</span>
                      <span className="font-semibold text-slate-200">
                        {analysisResult.navigation.brand.text || (analysisResult.navigation.brand.logoUrl ? 'Vector/Img Logo' : 'Detected')}
                      </span>
                    </div>
                    <div className="flex justify-between py-1 border-b border-slate-800">
                      <span className="text-slate-500">Positioning:</span>
                      <span className="text-slate-300">
                        {analysisResult.navigation.isSticky ? 'Sticky / Fixed Top' : 'Standard Flow'}
                      </span>
                    </div>
                    <div className="flex justify-between py-1 border-b border-slate-800">
                      <span className="text-slate-500">Nav Links:</span>
                      <span className="text-slate-300">{analysisResult.navigation.links.length} items</span>
                    </div>
                    <div className="flex justify-between py-1">
                      <span className="text-slate-500">Action CTAs:</span>
                      <span className="text-slate-300">{analysisResult.navigation.ctaButtons.length} buttons</span>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Tab: Sections */}
            {activeTab === 'sections' && (
              <div className="flex flex-col gap-4">
                {analysisResult.sections.map((sec, idx) => (
                  <div
                    key={sec.id}
                    className="p-5 bg-slate-900/50 border border-slate-800 rounded-xl flex flex-col gap-3 hover:border-slate-700 transition-colors"
                  >
                    <div className="flex items-center justify-between flex-wrap gap-2">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-mono font-bold px-2 py-0.5 rounded bg-teal-500/10 text-teal-400 border border-teal-500/20">
                          #{idx + 1} {sec.type.toUpperCase()}
                        </span>
                        <h3 className="font-bold text-white text-base">{sec.name}</h3>
                      </div>
                      <div className="flex items-center gap-2 text-xs text-slate-400">
                        <span className="bg-slate-950 px-2 py-1 rounded border border-slate-800 font-mono">
                          Layout: {sec.layout.type} ({sec.layout.columns || 1} col)
                        </span>
                        {sec.styling.backgroundColor && (
                          <div className="flex items-center gap-1.5 bg-slate-950 px-2 py-1 rounded border border-slate-800">
                            <div
                              className="h-3 w-3 rounded-full"
                              style={{ backgroundColor: sec.styling.backgroundColor }}
                            ></div>
                            <span className="font-mono">{sec.styling.backgroundColor}</span>
                          </div>
                        )}
                      </div>
                    </div>

                    {sec.heading && (
                      <div className="text-sm font-semibold text-teal-200">
                        Heading: &ldquo;{sec.heading}&rdquo;
                      </div>
                    )}
                    {sec.description && (
                      <p className="text-xs text-slate-400 line-clamp-2">{sec.description}</p>
                    )}

                    {sec.items.length > 0 && (
                      <div className="mt-2 pt-3 border-t border-slate-800/80">
                        <div className="text-xs font-medium text-slate-500 mb-2">
                          Items / Cards ({sec.items.length}):
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">
                          {sec.items.map((item, itemIdx) => (
                            <div
                              key={itemIdx}
                              className="p-2.5 bg-slate-950 rounded-lg border border-slate-800/60 text-xs"
                            >
                              {item.title && <div className="font-semibold text-slate-200">{item.title}</div>}
                              {item.description && (
                                <div className="text-slate-400 text-xs mt-1 line-clamp-2">
                                  {item.description}
                                </div>
                              )}
                              {item.price && (
                                <div className="font-mono text-teal-400 font-bold mt-1">{item.price}</div>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {sec.buttons.length > 0 && (
                      <div className="flex gap-2 mt-2">
                        {sec.buttons.map((btn, btnIdx) => (
                          <span
                            key={btnIdx}
                            className="inline-flex items-center gap-1 text-xs px-2.5 py-1 rounded-md bg-slate-800 text-slate-300 border border-slate-700 font-medium"
                          >
                            <ArrowRight className="h-3 w-3 text-teal-400" />
                            {btn.text}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}

            {/* Tab: Styles */}
            {activeTab === 'styles' && (
              <div className="flex flex-col gap-6">
                {/* Palette */}
                <div className="p-5 bg-slate-900/50 border border-slate-800 rounded-xl">
                  <h3 className="text-sm font-bold text-white mb-4 flex items-center gap-2">
                    <Palette className="h-4 w-4 text-teal-400" />
                    Computed Color Palette ({analysisResult.colors.palette.length} colors)
                  </h3>
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
                    {analysisResult.colors.palette.map((color, idx) => (
                      <div
                        key={idx}
                        className="p-3 bg-slate-950 rounded-xl border border-slate-800 flex flex-col gap-2"
                      >
                        <div
                          className="h-12 w-full rounded-lg border border-slate-700/60 shadow-inner"
                          style={{ backgroundColor: color.hex }}
                        ></div>
                        <div className="flex justify-between items-center">
                          <span className="font-mono text-xs font-bold text-white">{color.hex}</span>
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-800 text-slate-400 uppercase">
                            {color.role}
                          </span>
                        </div>
                        <div className="text-[10px] text-slate-500 font-mono">
                          Freq: {color.frequency} elements
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Typography scale */}
                <div className="p-5 bg-slate-900/50 border border-slate-800 rounded-xl">
                  <h3 className="text-sm font-bold text-white mb-4 flex items-center gap-2">
                    <Type className="h-4 w-4 text-cyan-400" />
                    Typography Hierarchy & Scale
                  </h3>
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-slate-950 text-slate-400 border-b border-slate-800">
                        <tr>
                          <th className="py-2.5 px-3">Tag</th>
                          <th className="py-2.5 px-3">Font Family</th>
                          <th className="py-2.5 px-3">Size</th>
                          <th className="py-2.5 px-3">Weight</th>
                          <th className="py-2.5 px-3">Sample Text</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-800/60">
                        {analysisResult.typography.scale.map((token, idx) => (
                          <tr key={idx} className="hover:bg-slate-950/40">
                            <td className="py-2 px-3 font-mono text-teal-400 uppercase">{token.tag}</td>
                            <td className="py-2 px-3 font-medium text-slate-300">{token.fontFamily}</td>
                            <td className="py-2 px-3 font-mono text-slate-400">{token.fontSize}</td>
                            <td className="py-2 px-3 font-mono text-slate-400">{token.fontWeight}</td>
                            <td className="py-2 px-3 text-slate-400 max-w-xs truncate">&ldquo;{token.sampleText}&rdquo;</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}

            {/* Tab: Assets */}
            {activeTab === 'assets' && (
              <div className="p-5 bg-slate-900/50 border border-slate-800 rounded-xl">
                <h3 className="text-sm font-bold text-white mb-4 flex items-center gap-2">
                  <ImageIcon className="h-4 w-4 text-cyan-400" />
                  Extracted Assets & Media ({analysisResult.assets.length})
                </h3>
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
                  {analysisResult.assets.map((asset, idx) => (
                    <div
                      key={idx}
                      className="p-2.5 bg-slate-950 rounded-xl border border-slate-800 flex flex-col gap-2 group"
                    >
                      <div className="h-28 w-full rounded-lg bg-slate-900 border border-slate-800/80 overflow-hidden flex items-center justify-center p-2 relative">
                        {asset.type === 'svg' || asset.url.startsWith('data:image/svg') ? (
                          <img
                            src={asset.url}
                            alt={asset.alt || 'vector icon'}
                            className="max-h-full max-w-full object-contain filter invert"
                          />
                        ) : (
                          <img
                            src={asset.url}
                            alt={asset.alt || 'extracted asset'}
                            className="max-h-full max-w-full object-contain"
                            onError={(e) => {
                              (e.target as HTMLElement).style.display = 'none';
                            }}
                          />
                        )}
                        <span className="absolute top-1 right-1 text-[9px] font-mono px-1 rounded bg-slate-950/80 text-teal-400 uppercase">
                          {asset.type}
                        </span>
                      </div>
                      <div className="text-[11px] font-medium text-slate-300 truncate">
                        {asset.context}
                      </div>
                      <a
                        href={asset.url}
                        target="_blank"
                        rel="noreferrer"
                        className="text-[10px] text-teal-400 hover:underline truncate"
                      >
                        {asset.url}
                      </a>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Tab: Raw JSON */}
            {activeTab === 'json' && (
              <div className="p-4 bg-slate-950 rounded-xl border border-slate-800">
                <pre className="text-xs font-mono text-teal-300 overflow-x-auto max-h-[600px] p-2 leading-relaxed">
                  {JSON.stringify(analysisResult, null, 2)}
                </pre>
              </div>
            )}
          </section>
        )}
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-900 bg-slate-950 py-6 mt-12 text-center text-xs text-slate-500">
        AI Website Recreator • Architectural Milestone 1: Website Analyzer Complete
      </footer>
    </div>
  );
}
