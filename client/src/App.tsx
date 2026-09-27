import React, { useState, useEffect } from 'react';
import {
  ExtractedWebsiteData,
  AnalysisProgressEvent,
  UISpecification,
  ModifyResponse,
  ProjectMetadata,
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
  FolderGit2,
  Copy,
  Trash2,
  Edit3,
  Plus,
  ArrowLeft,
  RotateCcw,
  Clock,
  Check,
  X,
} from 'lucide-react';

export default function App() {
  // Navigation & Top-Level View State
  const [currentView, setCurrentView] = useState<'generator' | 'projects' | 'project-details'>('projects');
  const [projects, setProjects] = useState<ProjectMetadata[]>([]);
  const [isLoadingProjects, setIsLoadingProjects] = useState(false);
  const [activeProject, setActiveProject] = useState<(ProjectMetadata & { files?: Record<string, string> }) | null>(null);
  const [detailsTab, setDetailsTab] = useState<'preview' | 'code' | 'history'>('preview');

  // Generator & Pipeline State
  const [url, setUrl] = useState('https://news.ycombinator.com');
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [progressEvent, setProgressEvent] = useState<AnalysisProgressEvent | null>(null);
  const [analysisResult, setAnalysisResult] = useState<ExtractedWebsiteData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [successNotice, setSuccessNotice] = useState<string | null>(null);
  const [analysisActiveTab, setAnalysisActiveTab] = useState<'overview' | 'sections' | 'styles' | 'assets' | 'json'>('overview');
  const [isGenerating, setIsGenerating] = useState(false);

  // Project Details & Code Inspector State
  const [activeCodeFile, setActiveCodeFile] = useState<string>('src/App.tsx');
  const [viewportMode, setViewportMode] = useState<'desktop' | 'tablet' | 'mobile'>('desktop');
  const [previewKey, setPreviewKey] = useState<number>(Date.now());

  // In-place Natural Language Modification (Module 5)
  const [instruction, setInstruction] = useState('Make the navbar sticky');
  const [isModifying, setIsModifying] = useState(false);
  const [modificationResult, setModificationResult] = useState<ModifyResponse | null>(null);

  // Version Restore State
  const [isRestoring, setIsRestoring] = useState(false);
  const [restoringVer, setRestoringVer] = useState<number | null>(null);

  // Project Rename State
  const [renamingProjectId, setRenamingProjectId] = useState<string | null>(null);
  const [renameInputValue, setRenameInputValue] = useState('');

  // Project Search Filter
  const [searchFilter, setSearchFilter] = useState('');

  // Load Projects on Initial Mount
  useEffect(() => {
    fetchProjects();
  }, []);

  const fetchProjects = async () => {
    setIsLoadingProjects(true);
    try {
      const res = await fetch('/api/projects');
      const json = await res.json();
      if (json.success && Array.isArray(json.data)) {
        setProjects(json.data);
      }
    } catch (err: any) {
      console.error('Failed to fetch projects registry:', err);
    } finally {
      setIsLoadingProjects(false);
    }
  };

  const handleOpenProject = async (projectId: string, initialTab: 'preview' | 'code' | 'history' = 'preview') => {
    setError(null);
    setSuccessNotice(null);
    try {
      const res = await fetch(`/api/projects/${encodeURIComponent(projectId)}`);
      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.error || `Failed to open project "${projectId}"`);
      }

      setActiveProject(json.data);
      if (json.data.files && Object.keys(json.data.files).length > 0) {
        const firstFile = Object.keys(json.data.files).includes('src/App.tsx')
          ? 'src/App.tsx'
          : Object.keys(json.data.files)[0];
        setActiveCodeFile(firstFile);
      }
      setDetailsTab(initialTab);
      setCurrentView('project-details');
      setPreviewKey(Date.now());
    } catch (err: any) {
      setError(err.message || 'Error loading project');
    }
  };

  const handleDuplicateProject = async (projectId: string) => {
    setError(null);
    try {
      const res = await fetch(`/api/projects/${encodeURIComponent(projectId)}/duplicate`, {
        method: 'POST',
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.error || 'Failed to duplicate project');
      }

      await fetchProjects();
      setSuccessNotice(`Successfully duplicated as "${json.data.name}"`);
      handleOpenProject(json.data.id, 'preview');
    } catch (err: any) {
      setError(err.message || 'Error duplicating project');
    }
  };

  const handleDeleteProject = async (projectId: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    if (!window.confirm(`Are you sure you want to permanently delete project "${projectId}"?`)) {
      return;
    }

    setError(null);
    try {
      const res = await fetch(`/api/projects/${encodeURIComponent(projectId)}`, {
        method: 'DELETE',
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.error || 'Failed to delete project');
      }

      await fetchProjects();
      if (activeProject?.id === projectId) {
        setActiveProject(null);
        setCurrentView('projects');
      }
      setSuccessNotice(`Project "${projectId}" deleted successfully`);
    } catch (err: any) {
      setError(err.message || 'Error deleting project');
    }
  };

  const handleRenameSubmit = async (projectId: string) => {
    if (!renameInputValue.trim()) {
      setRenamingProjectId(null);
      return;
    }

    try {
      const res = await fetch(`/api/projects/${encodeURIComponent(projectId)}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: renameInputValue.trim() }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.error || 'Failed to rename project');
      }

      await fetchProjects();
      if (activeProject && activeProject.id === projectId) {
        setActiveProject((prev: any) => ({ ...prev, name: renameInputValue.trim() }));
      }
      setRenamingProjectId(null);
      setSuccessNotice('Project renamed successfully');
    } catch (err: any) {
      setError(err.message || 'Error renaming project');
    }
  };

  const handleRestoreVersion = async (projectId: string, verNumber: number) => {
    if (!window.confirm(`Restore project to version v${verNumber}? Current files will be reverted to this snapshot.`)) {
      return;
    }

    setIsRestoring(true);
    setRestoringVer(verNumber);
    setError(null);
    setSuccessNotice(null);

    try {
      const res = await fetch(`/api/projects/${encodeURIComponent(projectId)}/restore/${verNumber}`, {
        method: 'POST',
      });
      const json = await res.json();

      if (!res.ok || !json.success) {
        const diagMsg = json.diagnostics?.map((d: any) => `[${d.stage}] ${d.message}`).join('; ');
        throw new Error(`${json.error || 'Version restore failed'}. ${diagMsg ? `(${diagMsg})` : ''}`);
      }

      setActiveProject(json.data);
      setPreviewKey(Date.now());
      setSuccessNotice(`Successfully restored to v${verNumber}! Project re-validated with Module 4.`);
      await fetchProjects();
    } catch (err: any) {
      setError(err.message || 'Error restoring version');
    } finally {
      setIsRestoring(false);
      setRestoringVer(null);
    }
  };

  // 1. Analyze Website (Module 1)
  const handleAnalyze = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!url || isAnalyzing) return;

    setIsAnalyzing(true);
    setError(null);
    setSuccessNotice(null);
    setActiveProject(null);
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
    setSuccessNotice(null);

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

      // Refresh registry & switch to Project Details
      await fetchProjects();
      const newProjectId = genJson.data?.id || genJson.data?.projectDir?.split(/[\\/]/).pop();
      if (newProjectId) {
        await handleOpenProject(newProjectId, 'preview');
        setSuccessNotice(`Successfully generated & registered project "${genJson.data?.name || newProjectId}"!`);
      }
    } catch (err: any) {
      setError(err.message || 'Error generating React recreation project');
    } finally {
      setIsGenerating(false);
    }
  };

  // 3. Natural Language Modification (Module 5)
  const handleModify = async (customInstruction?: string) => {
    const textToApply = customInstruction || instruction;
    if (!activeProject || !textToApply || isModifying) return;

    setIsModifying(true);
    setError(null);
    setSuccessNotice(null);

    try {
      const targetPath = activeProject.projectPath;
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
      await fetchProjects();
      await handleOpenProject(activeProject.id, detailsTab);
      setPreviewKey(Date.now());
      setSuccessNotice(`Modification applied & recorded as new version!`);
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
    'Make the buttons rounded',
    'Make the hero section centered',
    'Change the background to dark',
    'Make the navigation responsive',
    'Add a testimonials section',
    'Make the hero heading larger',
    'Remove the footer section',
  ];

  const filteredProjects = projects.filter((p) => {
    const q = searchFilter.toLowerCase();
    return p.name.toLowerCase().includes(q) || p.originalUrl.toLowerCase().includes(q) || p.id.toLowerCase().includes(q);
  });

  const currentPreviewUrl = activeProject?.previewUrl || (activeProject?.id ? `/preview/${encodeURIComponent(activeProject.id)}/` : '');

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans">
      {/* Top Header Navigation */}
      <header className="border-b border-slate-800/80 bg-slate-900/60 backdrop-blur-md sticky top-0 z-50 shadow-md">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center space-x-3 cursor-pointer" onClick={() => setCurrentView('projects')}>
            <div className="h-10 w-10 rounded-xl bg-gradient-to-tr from-teal-500 to-cyan-400 flex items-center justify-center shadow-lg shadow-teal-500/20">
              <Sparkles className="h-5 w-5 text-slate-950 font-bold" />
            </div>
            <div>
              <div className="font-bold text-lg tracking-tight bg-gradient-to-r from-white via-slate-200 to-slate-400 bg-clip-text text-transparent">
                AI Website Recreator
              </div>
              <div className="text-xs text-teal-400 font-medium hidden sm:block">
                Project Manager • Version History • Autonomous Auto-Healing
              </div>
            </div>
          </div>

          {/* View Switcher Tabs & Quick Action */}
          <div className="flex items-center space-x-2">
            <div className="bg-slate-950/80 p-1 rounded-xl border border-slate-800 flex items-center text-xs font-medium">
              <button
                onClick={() => {
                  setCurrentView('projects');
                  fetchProjects();
                }}
                className={`px-3 py-1.5 rounded-lg flex items-center gap-1.5 transition ${
                  currentView === 'projects'
                    ? 'bg-teal-500/20 text-teal-300 font-semibold border border-teal-500/30'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900/60'
                }`}
              >
                <FolderGit2 className="h-3.5 w-3.5" />
                <span>Projects</span>
                <span className="ml-1 px-1.5 py-0.2 rounded-full bg-slate-800 text-[10px] text-slate-300">
                  {projects.length}
                </span>
              </button>

              <button
                onClick={() => {
                  setCurrentView('generator');
                  setAnalysisResult(null);
                  setError(null);
                  setSuccessNotice(null);
                }}
                className={`px-3 py-1.5 rounded-lg flex items-center gap-1.5 transition ${
                  currentView === 'generator'
                    ? 'bg-teal-500/20 text-teal-300 font-semibold border border-teal-500/30'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900/60'
                }`}
              >
                <Zap className="h-3.5 w-3.5" />
                <span>Recreator</span>
              </button>
            </div>

            <button
              onClick={() => {
                setCurrentView('generator');
                setAnalysisResult(null);
                setError(null);
                setSuccessNotice(null);
              }}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold bg-gradient-to-r from-teal-400 to-cyan-400 text-slate-950 shadow-md shadow-teal-500/20 hover:from-teal-300 hover:to-cyan-300 transition"
            >
              <Plus className="h-3.5 w-3.5 stroke-[2.5]" />
              <span>Create New Project</span>
            </button>
          </div>
        </div>
      </header>

      {/* Global Toast / Feedback Notifications */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 w-full mt-4">
        {error && (
          <div className="p-4 rounded-xl bg-red-950/60 border border-red-800/80 text-red-200 text-sm flex items-start justify-between gap-3 shadow-lg animate-fade-in">
            <div className="flex items-start gap-3">
              <AlertCircle className="h-5 w-5 text-red-400 flex-shrink-0 mt-0.5" />
              <div>
                <span className="font-bold block text-red-100">Operation Error</span>
                <span className="text-red-300 leading-relaxed">{error}</span>
              </div>
            </div>
            <button onClick={() => setError(null)} className="text-red-400 hover:text-red-200">
              <X className="h-4 w-4" />
            </button>
          </div>
        )}

        {successNotice && (
          <div className="p-4 rounded-xl bg-emerald-950/60 border border-emerald-800/80 text-emerald-200 text-sm flex items-start justify-between gap-3 shadow-lg animate-fade-in">
            <div className="flex items-center gap-3">
              <CheckCircle2 className="h-5 w-5 text-emerald-400 flex-shrink-0" />
              <span className="font-medium text-emerald-100">{successNotice}</span>
            </div>
            <button onClick={() => setSuccessNotice(null)} className="text-emerald-400 hover:text-emerald-200">
              <X className="h-4 w-4" />
            </button>
          </div>
        )}
      </div>

      {/* Main Container */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 flex flex-col gap-6">

        {/* ========================================================================= */}
        {/* VIEW 1: PROJECTS LIST & DASHBOARD                                         */}
        {/* ========================================================================= */}
        {currentView === 'projects' && (
          <div className="flex flex-col gap-6">
            {/* Top Toolbar */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-slate-900/50 p-5 rounded-2xl border border-slate-800">
              <div>
                <h1 className="text-xl sm:text-2xl font-bold text-white flex items-center gap-2">
                  <FolderGit2 className="h-6 w-6 text-teal-400" />
                  Project Registry
                </h1>
                <p className="text-xs sm:text-sm text-slate-400 mt-1">
                  Manage recreated websites, browse snapshot history, restore prior builds, and duplicate projects.
                </p>
              </div>

              <div className="flex items-center gap-3">
                <div className="relative">
                  <input
                    type="text"
                    placeholder="Search projects..."
                    value={searchFilter}
                    onChange={(e) => setSearchFilter(e.target.value)}
                    className="w-48 sm:w-64 pl-8 pr-3 py-1.5 bg-slate-950 border border-slate-700 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-teal-500"
                  />
                  <Search className="h-3.5 w-3.5 text-slate-500 absolute left-2.5 top-2.5 pointer-events-none" />
                </div>

                <button
                  onClick={fetchProjects}
                  disabled={isLoadingProjects}
                  title="Reload registry from disk"
                  className="p-2 rounded-xl bg-slate-950 border border-slate-700 text-slate-400 hover:text-white transition"
                >
                  <RefreshCw className={`h-4 w-4 ${isLoadingProjects ? 'animate-spin text-teal-400' : ''}`} />
                </button>
              </div>
            </div>

            {/* Project Cards Grid */}
            {filteredProjects.length === 0 ? (
              <div className="p-12 text-center bg-slate-900/30 border border-dashed border-slate-800 rounded-2xl flex flex-col items-center justify-center gap-4">
                <div className="h-14 w-14 rounded-2xl bg-teal-500/10 border border-teal-500/20 flex items-center justify-center">
                  <FolderGit2 className="h-7 w-7 text-teal-400" />
                </div>
                <div>
                  <h3 className="text-base font-semibold text-white">No projects found</h3>
                  <p className="text-xs text-slate-400 mt-1 max-w-sm">
                    {searchFilter ? 'No projects match your search query.' : 'Run the recreation pipeline to create your first autonomous website clone.'}
                  </p>
                </div>
                <button
                  onClick={() => setCurrentView('generator')}
                  className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-semibold bg-teal-500 text-slate-950 shadow-md hover:bg-teal-400 transition"
                >
                  <Plus className="h-4 w-4" />
                  Create New Project
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                {filteredProjects.map((p) => {
                  const isRenaming = renamingProjectId === p.id;
                  const isPassed = p.status === 'passed';

                  return (
                    <div
                      key={p.id}
                      className="group bg-gradient-to-b from-slate-900/90 to-slate-900/40 border border-slate-800 hover:border-teal-500/50 rounded-2xl p-5 flex flex-col justify-between transition-all duration-200 shadow-lg hover:shadow-teal-500/5 relative overflow-hidden"
                    >
                      {/* Top Badge Row */}
                      <div className="flex items-center justify-between gap-2 mb-3">
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-mono font-medium bg-teal-500/15 text-teal-300 border border-teal-500/30">
                          v{p.currentVersion}
                        </span>

                        <span
                          className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold tracking-wider uppercase border ${
                            isPassed
                              ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                              : 'bg-rose-500/10 text-rose-400 border-rose-500/30'
                          }`}
                        >
                          <span className={`w-1.5 h-1.5 rounded-full mr-1.5 ${isPassed ? 'bg-emerald-400' : 'bg-rose-400'}`} />
                          {isPassed ? 'BUILD PASSED' : 'BUILD FAILED'}
                        </span>
                      </div>

                      {/* Title & Rename */}
                      <div className="mb-4">
                        {isRenaming ? (
                          <div className="flex items-center gap-1.5">
                            <input
                              type="text"
                              value={renameInputValue}
                              onChange={(e) => setRenameInputValue(e.target.value)}
                              autoFocus
                              className="w-full px-2 py-1 bg-slate-950 border border-teal-500 rounded text-sm text-white focus:outline-none"
                            />
                            <button
                              onClick={() => handleRenameSubmit(p.id)}
                              className="p-1 rounded bg-teal-500 text-slate-950 hover:bg-teal-400"
                            >
                              <Check className="h-3.5 w-3.5" />
                            </button>
                            <button
                              onClick={() => setRenamingProjectId(null)}
                              className="p-1 rounded bg-slate-800 text-slate-300 hover:text-white"
                            >
                              <X className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        ) : (
                          <div className="flex items-center justify-between gap-2">
                            <h3
                              onClick={() => handleOpenProject(p.id, 'preview')}
                              className="text-base font-bold text-white group-hover:text-teal-300 cursor-pointer transition truncate"
                              title={p.name}
                            >
                              {p.name}
                            </h3>
                            <button
                              onClick={() => {
                                setRenamingProjectId(p.id);
                                setRenameInputValue(p.name);
                              }}
                              title="Rename project"
                              className="opacity-0 group-hover:opacity-100 text-slate-500 hover:text-slate-300 p-1 rounded transition"
                            >
                              <Edit3 className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        )}

                        {/* Original URL */}
                        <div className="mt-1 flex items-center gap-1.5 text-xs text-slate-400 truncate">
                          <Globe className="h-3.5 w-3.5 text-slate-500 flex-shrink-0" />
                          {p.originalUrl ? (
                            <a
                              href={p.originalUrl}
                              target="_blank"
                              rel="noreferrer"
                              className="hover:underline hover:text-teal-400 truncate"
                            >
                              {p.originalUrl}
                            </a>
                          ) : (
                            <span className="text-slate-500">Autonomous Recreation</span>
                          )}
                        </div>
                      </div>

                      {/* Metadata Details */}
                      <div className="border-t border-slate-800/80 pt-3 pb-3 grid grid-cols-2 gap-2 text-[11px] text-slate-400">
                        <div>
                          <span className="text-slate-500 block">Created</span>
                          <span className="text-slate-300">
                            {new Date(p.createdAt).toLocaleDateString(undefined, {
                              day: 'numeric',
                              month: 'short',
                              year: 'numeric',
                            })}
                          </span>
                        </div>
                        <div>
                          <span className="text-slate-500 block">Modified</span>
                          <span className="text-slate-300">
                            {new Date(p.updatedAt).toLocaleTimeString(undefined, {
                              hour: '2-digit',
                              minute: '2-digit',
                            })}
                          </span>
                        </div>
                      </div>

                      {/* Action Buttons Row */}
                      <div className="border-t border-slate-800/80 pt-3 flex items-center justify-between gap-2">
                        <div className="flex items-center gap-1.5">
                          <button
                            onClick={() => handleOpenProject(p.id, 'preview')}
                            className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-teal-500/15 hover:bg-teal-500/25 border border-teal-500/30 text-teal-300 text-xs font-medium transition"
                          >
                            <Eye className="h-3 w-3" />
                            <span>Preview</span>
                          </button>

                          <button
                            onClick={() => handleOpenProject(p.id, 'code')}
                            className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-slate-800/80 hover:bg-slate-800 text-slate-200 text-xs font-medium transition"
                          >
                            <FileCode className="h-3 w-3" />
                            <span>Open</span>
                          </button>
                        </div>

                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => handleDuplicateProject(p.id)}
                            title="Duplicate project"
                            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition"
                          >
                            <Copy className="h-3.5 w-3.5" />
                          </button>
                          <button
                            onClick={(e) => handleDeleteProject(p.id, e)}
                            title="Delete project"
                            className="p-1.5 rounded-lg text-rose-400 hover:text-rose-200 hover:bg-rose-950/40 transition"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* ========================================================================= */}
        {/* VIEW 2: PROJECT DETAILS VIEW (Visual Preview, Code Inspector, History)     */}
        {/* ========================================================================= */}
        {currentView === 'project-details' && activeProject && (
          <div className="flex flex-col gap-6 animate-fade-in">
            {/* Top Navigation Bar */}
            <div className="flex items-center justify-between">
              <button
                onClick={() => {
                  setCurrentView('projects');
                  fetchProjects();
                }}
                className="inline-flex items-center gap-1.5 text-xs text-slate-400 hover:text-white transition"
              >
                <ArrowLeft className="h-4 w-4" />
                <span>Back to Project Registry</span>
              </button>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => handleDuplicateProject(activeProject.id)}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-900 border border-slate-800 text-xs text-slate-300 hover:text-white hover:border-slate-700 transition"
                >
                  <Copy className="h-3.5 w-3.5" />
                  <span>Duplicate Project</span>
                </button>
                <button
                  onClick={(e) => handleDeleteProject(activeProject.id, e)}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-red-950/30 border border-red-900/40 text-xs text-red-300 hover:bg-red-900/40 transition"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  <span>Delete</span>
                </button>
              </div>
            </div>

            {/* Project Details Header Box (Per Specification) */}
            <div className="bg-gradient-to-r from-slate-900/90 via-slate-900/60 to-slate-900/90 border border-slate-800 rounded-2xl p-6 shadow-xl">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800/80 pb-5">
                <div>
                  <div className="flex items-center gap-3">
                    <span className="text-xs uppercase tracking-wider text-slate-400 font-mono">Project</span>
                    <h2 className="text-xl sm:text-2xl font-black text-white tracking-tight">
                      {activeProject.name}
                    </h2>
                    <span className="px-2.5 py-0.5 rounded-full text-xs font-mono font-bold bg-teal-500/20 text-teal-300 border border-teal-500/40">
                      v{activeProject.currentVersion}
                    </span>
                  </div>

                  <div className="flex items-center gap-3 mt-2 text-xs text-slate-400">
                    <span className="font-mono text-slate-500">Original URL:</span>
                    {activeProject.originalUrl ? (
                      <a
                        href={activeProject.originalUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="text-teal-400 hover:underline flex items-center gap-1"
                      >
                        {activeProject.originalUrl}
                        <ExternalLink className="h-3 w-3" />
                      </a>
                    ) : (
                      <span className="text-slate-500">Local Generation</span>
                    )}
                    <span>•</span>
                    <span className="font-mono text-slate-500">Directory:</span>
                    <span className="font-mono text-slate-400 truncate max-w-xs">{activeProject.projectPath}</span>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <span className="text-xs uppercase tracking-wider text-slate-400 font-mono mr-1">Status:</span>
                  <span
                    className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-bold tracking-wider uppercase border ${
                      activeProject.status === 'passed'
                        ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                        : 'bg-rose-500/10 text-rose-400 border-rose-500/30'
                    }`}
                  >
                    <span
                      className={`w-2 h-2 rounded-full mr-2 ${
                        activeProject.status === 'passed' ? 'bg-emerald-400 animate-pulse' : 'bg-rose-400'
                      }`}
                    />
                    {activeProject.status === 'passed' ? 'BUILD PASSED' : 'BUILD FAILED'}
                  </span>
                </div>
              </div>

              {/* Three Main Tabs: Visual Preview, Code Inspector, History */}
              <div className="flex items-center justify-between mt-5 pt-1">
                <div className="flex items-center gap-2 bg-slate-950 p-1 rounded-xl border border-slate-800">
                  <button
                    onClick={() => setDetailsTab('preview')}
                    className={`px-4 py-2 rounded-lg text-xs font-semibold flex items-center gap-2 transition ${
                      detailsTab === 'preview'
                        ? 'bg-teal-500/20 text-teal-300 border border-teal-500/30 shadow'
                        : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    <Eye className="h-3.5 w-3.5" />
                    <span>Visual Preview</span>
                  </button>

                  <button
                    onClick={() => setDetailsTab('code')}
                    className={`px-4 py-2 rounded-lg text-xs font-semibold flex items-center gap-2 transition ${
                      detailsTab === 'code'
                        ? 'bg-teal-500/20 text-teal-300 border border-teal-500/30 shadow'
                        : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    <FileCode className="h-3.5 w-3.5" />
                    <span>Code Inspector</span>
                  </button>

                  <button
                    onClick={() => setDetailsTab('history')}
                    className={`px-4 py-2 rounded-lg text-xs font-semibold flex items-center gap-2 transition ${
                      detailsTab === 'history'
                        ? 'bg-teal-500/20 text-teal-300 border border-teal-500/30 shadow'
                        : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    <History className="h-3.5 w-3.5" />
                    <span>History</span>
                    <span className="ml-1 px-1.5 py-0.2 rounded-full bg-slate-800 text-[10px] text-teal-300">
                      {activeProject.versions.length}
                    </span>
                  </button>
                </div>

                {/* Viewport controls visible when in preview mode */}
                {detailsTab === 'preview' && (
                  <div className="hidden sm:flex items-center gap-2 bg-slate-950 p-1 rounded-xl border border-slate-800">
                    <button
                      onClick={() => setViewportMode('desktop')}
                      className={`p-1.5 rounded-lg text-xs flex items-center gap-1 transition ${
                        viewportMode === 'desktop' ? 'bg-slate-800 text-teal-300 font-semibold' : 'text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      <Monitor className="h-3.5 w-3.5" />
                      <span>Desktop</span>
                    </button>
                    <button
                      onClick={() => setViewportMode('tablet')}
                      className={`p-1.5 rounded-lg text-xs flex items-center gap-1 transition ${
                        viewportMode === 'tablet' ? 'bg-slate-800 text-teal-300 font-semibold' : 'text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      <Tablet className="h-3.5 w-3.5" />
                      <span>Tablet (768px)</span>
                    </button>
                    <button
                      onClick={() => setViewportMode('mobile')}
                      className={`p-1.5 rounded-lg text-xs flex items-center gap-1 transition ${
                        viewportMode === 'mobile' ? 'bg-slate-800 text-teal-300 font-semibold' : 'text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      <Smartphone className="h-3.5 w-3.5" />
                      <span>Mobile (375px)</span>
                    </button>
                    <div className="h-4 w-px bg-slate-800 mx-1" />
                    <a
                      href={currentPreviewUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="p-1.5 rounded-lg text-xs text-slate-400 hover:text-white flex items-center gap-1"
                    >
                      <ExternalLink className="h-3.5 w-3.5" />
                    </a>
                  </div>
                )}
              </div>
            </div>

            {/* TAB CONTENT 1: VISUAL PREVIEW */}
            {detailsTab === 'preview' && (
              <div className="flex flex-col gap-6">
                <div className="flex justify-center bg-slate-950/60 p-4 rounded-2xl border border-slate-800/80 shadow-2xl">
                  <div
                    className={`transition-all duration-300 flex flex-col ${
                      viewportMode === 'mobile'
                        ? 'w-[375px]'
                        : viewportMode === 'tablet'
                        ? 'w-[768px]'
                        : 'w-full'
                    }`}
                  >
                    {/* Browser Frame Bar */}
                    <div className="w-full bg-slate-900 border border-slate-800 rounded-t-xl px-4 py-2.5 flex items-center justify-between text-xs text-slate-400 font-mono shadow-md">
                      <div className="flex items-center gap-2">
                        <span className="h-2.5 w-2.5 rounded-full bg-rose-500/80 inline-block" />
                        <span className="h-2.5 w-2.5 rounded-full bg-amber-500/80 inline-block" />
                        <span className="h-2.5 w-2.5 rounded-full bg-emerald-500/80 inline-block" />
                        <span className="ml-2 text-slate-300 font-sans font-medium text-[11px]">
                          {viewportMode === 'mobile'
                            ? 'Mobile Viewport (375px)'
                            : viewportMode === 'tablet'
                            ? 'Tablet Viewport (768px)'
                            : 'Desktop Viewport (100%)'}
                        </span>
                      </div>
                      <span className="text-teal-400 text-[11px] truncate max-w-[250px]">
                        {currentPreviewUrl}
                      </span>
                    </div>

                    {/* Live Preview Iframe */}
                    <iframe
                      key={previewKey}
                      src={currentPreviewUrl}
                      title="Generated React Website Visual Preview"
                      className="w-full h-[650px] bg-white rounded-b-xl border-x border-b border-slate-800 shadow-2xl transition-all"
                      sandbox="allow-scripts allow-same-origin allow-forms allow-popups"
                    />
                  </div>
                </div>

                {/* Natural Language Modifier Section (Module 5) */}
                <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-6 flex flex-col gap-4">
                  <div>
                    <h3 className="text-base font-bold text-white flex items-center gap-2">
                      <Sliders className="h-4 w-4 text-teal-400" />
                      In-Place Natural Language Modification (Module 5)
                    </h3>
                    <p className="text-xs text-slate-400 mt-0.5">
                      Targeted code modifications without full regeneration. Automatically creates version snapshots upon build validation.
                    </p>
                  </div>

                  {/* Sample Chips */}
                  <div className="flex flex-wrap gap-2">
                    {samplePrompts.map((p, idx) => (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => setInstruction(p)}
                        className="text-xs px-3 py-1.5 rounded-lg bg-slate-950 border border-slate-800 text-slate-300 hover:border-teal-500/40 hover:text-teal-300 transition"
                      >
                        &ldquo;{p}&rdquo;
                      </button>
                    ))}
                  </div>

                  {/* Input & Action */}
                  <div className="flex flex-col sm:flex-row gap-3">
                    <input
                      type="text"
                      value={instruction}
                      onChange={(e) => setInstruction(e.target.value)}
                      disabled={isModifying}
                      placeholder="e.g. Replace hero with bakery hero, Make navbar sticky..."
                      className="flex-1 px-4 py-2.5 bg-slate-950 border border-slate-700/80 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-teal-500/50 text-white placeholder-slate-500"
                    />
                    <button
                      onClick={() => handleModify()}
                      disabled={isModifying || !instruction}
                      className="inline-flex items-center justify-center px-6 py-2.5 rounded-xl bg-gradient-to-r from-teal-400 to-cyan-400 text-slate-950 font-bold text-sm shadow-md hover:opacity-95 transition disabled:opacity-50 gap-2 flex-shrink-0"
                    >
                      {isModifying ? (
                        <>
                          <RefreshCw className="h-4 w-4 animate-spin" />
                          Modifying & Auto-Healing...
                        </>
                      ) : (
                        <>
                          <Send className="h-4 w-4" />
                          Apply Modification
                        </>
                      )}
                    </button>
                  </div>

                  {modificationResult && (
                    <div className="p-3.5 rounded-xl bg-slate-950 border border-teal-500/30 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs animate-fade-in">
                      <span className="text-teal-300 font-medium flex items-center gap-1.5">
                        <ShieldCheck className="h-4 w-4 text-emerald-400 flex-shrink-0" />
                        {modificationResult.message || 'Modification applied and validated successfully!'}
                      </span>
                      {modificationResult.modifiedFiles && modificationResult.modifiedFiles.length > 0 && (
                        <div className="flex items-center gap-1 text-[11px] font-mono text-slate-400">
                          <span>Modified:</span>
                          <span className="text-teal-400">{modificationResult.modifiedFiles.join(', ')}</span>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* TAB CONTENT 2: CODE INSPECTOR */}
            {detailsTab === 'code' && (
              <div className="bg-slate-950 rounded-2xl border border-slate-800 overflow-hidden flex flex-col shadow-2xl">
                {/* File Tabs */}
                <div className="flex items-center gap-1 p-2 bg-slate-900/80 border-b border-slate-800 overflow-x-auto text-xs font-mono">
                  {Object.keys(activeProject.files || {}).map((file) => (
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

                {/* Source Code View */}
                <pre className="p-5 text-xs font-mono text-slate-300 overflow-x-auto max-h-[550px] leading-relaxed bg-slate-950 selection:bg-teal-500/30">
                  {(activeProject.files && activeProject.files[activeCodeFile]) || '// Select a file to view source'}
                </pre>
              </div>
            )}

            {/* TAB CONTENT 3: VERSION HISTORY TIMELINE (Per Requirement 10) */}
            {detailsTab === 'history' && (
              <div className="bg-slate-900/50 border border-slate-800 rounded-2xl p-6 sm:p-8 flex flex-col gap-6 shadow-xl">
                <div>
                  <h3 className="text-lg font-bold text-white flex items-center gap-2">
                    <History className="h-5 w-5 text-teal-400" />
                    Version History & Snapshot Timeline
                  </h3>
                  <p className="text-xs sm:text-sm text-slate-400 mt-1">
                    Every successful generation and natural-language modification produces an isolated source snapshot. Previous versions can be safely restored with automatic build validation and rollback guards.
                  </p>
                </div>

                {/* Vertical Timeline */}
                <div className="relative pl-6 sm:pl-8 border-l-2 border-slate-800 flex flex-col gap-8 my-2">
                  {activeProject.versions
                    .slice()
                    .reverse()
                    .map((v) => {
                      const isCurrent = v.version === activeProject.currentVersion;
                      const isThisRestoring = isRestoring && restoringVer === v.version;

                      return (
                        <div key={v.version} className="relative flex flex-col gap-2">
                          {/* Timeline Node Dot */}
                          <div
                            className={`absolute -left-[31px] sm:-left-[39px] top-1.5 h-6 w-6 rounded-full border-2 flex items-center justify-center text-[10px] font-mono font-bold transition-all ${
                              isCurrent
                                ? 'bg-teal-500 border-teal-300 text-slate-950 shadow-lg shadow-teal-500/30 ring-4 ring-teal-500/20'
                                : 'bg-slate-900 border-slate-700 text-slate-400'
                            }`}
                          >
                            v{v.version}
                          </div>

                          {/* Version Card */}
                          <div
                            className={`p-5 rounded-xl border transition-all ${
                              isCurrent
                                ? 'bg-gradient-to-r from-teal-950/30 to-slate-900/60 border-teal-500/40 shadow-lg'
                                : 'bg-slate-950/60 border-slate-800/80 hover:border-slate-700'
                            }`}
                          >
                            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                              <div>
                                <div className="flex items-center gap-2">
                                  <span className="font-mono font-bold text-sm text-teal-300">
                                    v{v.version} — {v.instruction}
                                  </span>
                                  {isCurrent && (
                                    <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-teal-500/20 text-teal-300 border border-teal-500/30 uppercase tracking-wide">
                                      Active Version
                                    </span>
                                  )}
                                </div>

                                <div className="flex items-center gap-3 mt-1.5 text-xs text-slate-400">
                                  <span className="flex items-center gap-1 text-slate-400">
                                    <Clock className="h-3 w-3" />
                                    {new Date(v.timestamp).toLocaleDateString(undefined, {
                                      day: 'numeric',
                                      month: 'short',
                                      year: 'numeric',
                                    })}
                                    , {new Date(v.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                  </span>
                                  <span>•</span>
                                  <span className="font-mono text-slate-300">
                                    {v.modifiedFiles.length} {v.modifiedFiles.length === 1 ? 'file' : 'files'} modified
                                  </span>
                                  <span>•</span>
                                  <span className="inline-flex items-center text-emerald-400 font-semibold gap-1 text-[11px]">
                                    <CheckCircle2 className="h-3 w-3" />
                                    Build PASSED
                                  </span>
                                </div>
                              </div>

                              {/* Restore Button */}
                              <div>
                                {!isCurrent ? (
                                  <button
                                    onClick={() => handleRestoreVersion(activeProject.id, v.version)}
                                    disabled={isRestoring}
                                    className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-semibold bg-slate-800 hover:bg-teal-500 hover:text-slate-950 text-slate-200 border border-slate-700 hover:border-teal-400 transition shadow disabled:opacity-50"
                                  >
                                    {isThisRestoring ? (
                                      <>
                                        <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                                        <span>Restoring & Validating...</span>
                                      </>
                                    ) : (
                                      <>
                                        <RotateCcw className="h-3.5 w-3.5" />
                                        <span>Restore</span>
                                      </>
                                    )}
                                  </button>
                                ) : (
                                  <span className="text-xs text-teal-400 font-mono font-medium">
                                    Current
                                  </span>
                                )}
                              </div>
                            </div>

                            {/* Modified Files Pills */}
                            {v.modifiedFiles.length > 0 && (
                              <div className="mt-3 flex flex-wrap gap-1.5 pt-2 border-t border-slate-800/60">
                                {v.modifiedFiles.map((file, fIdx) => (
                                  <span
                                    key={fIdx}
                                    className="px-2 py-0.5 rounded bg-slate-900 border border-slate-800 font-mono text-[10px] text-slate-300"
                                  >
                                    {file}
                                  </span>
                                ))}
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                </div>
              </div>
            )}
          </div>
        )}

        {/* ========================================================================= */}
        {/* VIEW 3: URL RECREATOR (ANALYZER & GENERATOR PIPELINE)                     */}
        {/* ========================================================================= */}
        {currentView === 'generator' && (
          <div className="flex flex-col gap-6">
            {/* URL Input Form */}
            <section className="bg-gradient-to-b from-slate-900/80 to-slate-900/40 border border-slate-800 rounded-2xl p-6 sm:p-8 backdrop-blur shadow-2xl relative overflow-hidden">
              <div className="absolute top-0 right-0 w-96 h-96 bg-teal-500/5 rounded-full blur-3xl pointer-events-none -mr-20 -mt-20" />

              <div className="max-w-3xl">
                <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-white mb-2">
                  Autonomous Website Recreation & Modification Agent
                </h1>
                <p className="text-slate-400 text-sm sm:text-base mb-6 leading-relaxed">
                  Inspects live DOM semantics via Playwright, generates an exact React + Tailwind recreation, validates
                  compilation with auto-healing, and automatically registers projects with full version history.
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

              {/* Progress Event Banner */}
              {isAnalyzing && progressEvent && (
                <div className="mt-6 p-4 rounded-xl bg-slate-950/60 border border-teal-500/20 flex flex-col gap-2 animate-fade-in">
                  <div className="flex justify-between items-center text-xs">
                    <span className="text-teal-400 font-semibold flex items-center gap-2">
                      <span className="h-2 w-2 rounded-full bg-teal-400 animate-ping" />
                      {progressEvent.message}
                    </span>
                    <span className="font-mono text-slate-400">{progressEvent.progress}%</span>
                  </div>
                  <div className="w-full h-1.5 bg-slate-800 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-teal-500 to-cyan-400 transition-all duration-300"
                      style={{ width: `${progressEvent.progress}%` }}
                    />
                  </div>
                </div>
              )}
            </section>

            {/* Step 2 Trigger: Generate Recreation */}
            {analysisResult && (
              <section className="bg-slate-900/60 border border-slate-800 rounded-2xl p-6 flex flex-col sm:flex-row items-center justify-between gap-4 animate-fade-in">
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
                      Generating, Validating & Registering...
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
                        onClick={() => setAnalysisActiveTab(tab)}
                        className={`px-3 py-1.5 rounded-lg capitalize transition ${
                          analysisActiveTab === tab
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
                {analysisActiveTab === 'overview' && (
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
                {analysisActiveTab === 'sections' && (
                  <div className="flex flex-col gap-4">
                    {analysisResult.sections.map((section, idx) => (
                      <div key={idx} className="p-4 bg-slate-950 rounded-xl border border-slate-800 flex flex-col gap-2">
                        <div className="flex items-center justify-between">
                          <span className="font-mono text-xs text-teal-400 font-bold uppercase">
                            [{section.type}] {section.name}
                          </span>
                          <span className="text-xs text-slate-500">Layout: {section.layout.type}</span>
                        </div>
                        <p className="text-sm text-slate-300">
                          {section.heading || section.description || 'Section content extracted'}
                        </p>
                      </div>
                    ))}
                  </div>
                )}

                {/* Tab: Styles */}
                {analysisActiveTab === 'styles' && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                      <h3 className="text-sm font-bold text-white mb-3">Color Palette</h3>
                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                        {analysisResult.colors.palette.map((color, idx) => (
                          <div key={idx} className="p-3 bg-slate-950 rounded-xl border border-slate-800 flex flex-col gap-2">
                            <div
                              className="h-10 w-full rounded border border-slate-800"
                              style={{ backgroundColor: color.hex }}
                            />
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
                {analysisActiveTab === 'assets' && (
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
                {analysisActiveTab === 'json' && (
                  <pre className="p-4 bg-slate-950 rounded-xl border border-slate-800 text-xs font-mono text-teal-300 max-h-[500px] overflow-auto">
                    {JSON.stringify(analysisResult, null, 2)}
                  </pre>
                )}
              </section>
            )}
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-900 bg-slate-950 py-6 text-center text-xs text-slate-500">
        AI Website Recreator • Full Architecture Complete (Modules 1–5 + Project Management & Version History)
      </footer>
    </div>
  );
}
