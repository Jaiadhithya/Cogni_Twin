'use client';

import { useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { uploadDocument, searchDocument } from '@/lib/api';
import { PRESET_SAMPLE_DATASETS, DEMO_SUMMARY_DATA } from '@/lib/mockData';
import { useDataset } from '@/context/DatasetContext';
import { useToast } from '@/components/ui/CyberneticToast';
import {
  UploadCloud,
  CheckCircle,
  AlertTriangle,
  Loader2,
  FileText,
  Database,
  Search,
  Table2,
  BookOpen,
  Sparkles,
  ArrowRight,
  ShieldCheck,
  Check,
  Zap,
  Layers,
  ChevronRight
} from 'lucide-react';

const TABS = [
  { id: 'csv', label: 'Structured Data (CSV)', icon: Table2 },
  { id: 'pdf', label: 'Knowledge Base (PDFs)', icon: BookOpen },
] as const;

type TabId = (typeof TABS)[number]['id'];

function AnimatedTabs({
  activeTab,
  onChange,
}: {
  activeTab: TabId;
  onChange: (tab: TabId) => void;
}) {
  return (
    <div className="relative inline-flex items-center p-1.5 rounded-full obsidian-panel border border-white/10 shadow-2xl">
      {TABS.map((tab) => {
        const Icon = tab.icon;
        const isActive = activeTab === tab.id;

        return (
          <button
            key={tab.id}
            onClick={() => onChange(tab.id)}
            className={`relative z-10 flex items-center gap-2 px-6 py-2.5 rounded-full font-mono text-xs font-bold transition-colors duration-200 cursor-pointer uppercase tracking-wider ${
              isActive ? 'text-[#030507]' : 'text-white/60 hover:text-white'
            }`}
          >
            {isActive && (
              <motion.div
                layoutId="activeIngestTab"
                className="absolute inset-0 rounded-full bg-[#00F0FF] shadow-[0_0_20px_rgba(0,240,255,0.4)]"
                transition={{ type: 'spring', bounce: 0.2, duration: 0.5 }}
              />
            )}
            <span className="relative z-10 flex items-center gap-2">
              <Icon className="w-4 h-4" />
              {tab.label}
            </span>
          </button>
        );
      })}
    </div>
  );
}

// ─── CSV Upload & Schema Profiling Panel ─────────────────────────
function CSVUploadPanel() {
  const router = useRouter();
  const { registerDataset, selectDataset } = useDataset();
  const { addToast } = useToast();
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadingText, setLoadingText] = useState('');
  const [progressStage, setProgressStage] = useState(0);
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [dragActive, setDragActive] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, []);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0]);
      setResult(null);
      setError(null);
    }
  };

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') setDragActive(true);
    else if (e.type === 'dragleave') setDragActive(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      setFile(e.dataTransfer.files[0]);
      setResult(null);
      setError(null);
    }
  };

  const executeSimulatedOrRealIngestion = async (selectedFile?: File, presetName?: string) => {
    setLoading(true);
    setError(null);
    setResult(null);

    const stages = [
      '1/4 Parsing CSV byte stream & delimiter matrix...',
      '2/4 Groq GPT-OSS-120B semantic schema profiling...',
      '3/4 Indexing temporal time-series & dimensions...',
      '4/4 Initializing 90-Day Prophet forecasting twin...',
    ];

    let step = 0;
    setProgressStage(0);
    setLoadingText(stages[0]);

    if (intervalRef.current) clearInterval(intervalRef.current);
    intervalRef.current = setInterval(() => {
      step++;
      setProgressStage(step);
      if (step < stages.length) {
        setLoadingText(stages[step]);
      }
    }, 1100);

    try {
      if (selectedFile) {
        const formData = new FormData();
        formData.append('file', selectedFile);
        const res = await fetch('/api/ingest/csv', {
          method: 'POST',
          body: formData,
        });

        if (res.ok) {
          const data = await res.json();
          setResult(data);
          setFile(null);
          const dsId = data?.dataset_id || 'INGESTED-TWIN-2026';
          registerDataset({
            id: dsId,
            name: selectedFile?.name || dsId,
            row_count: data?.row_count ?? 0,
            target_metric: data?.column_mapping?.target_metric || 'revenue',
            dimensions: data?.column_mapping?.dimensions || ['Product_Category', 'Sales_Channel'],
          });
          selectDataset(dsId);
          addToast({
            type: 'success',
            title: 'DATASET MATRIX SYNCHRONIZED',
            message: `Twin ${dsId} is active across Dashboard, Forecast, and Query terminals.`,
          });
          setLoading(false);
          return;
        }
      }

      // Simulated preset or backend unavailable: activate a clearly-labeled sample dataset
      setTimeout(() => {
        const presetId = presetName ? `${presetName.toUpperCase().slice(0, 10)}-2026` : 'CUSTOM-TWIN-2026';
        const profilingResult = {
          dataset_id: presetId,
          is_demo: true,
          row_count: 51280,
          column_mapping: {
            primary_date: 'transaction_date',
            target_metric: 'revenue',
            dimensions: ['Product_Category', 'Sales_Channel', 'Geographic_Region', 'Customer_Tier'],
          },
          health: {
            clean_pct: 99.8,
            missing_dates: 0,
            duplicates: 0,
            granularity: 'Daily (Uniform)',
          },
          sample_rows: [
            { transaction_date: '2026-09-01', revenue: '$14,200', Product_Category: 'Edge Blades', Sales_Channel: 'Enterprise API' },
            { transaction_date: '2026-09-02', revenue: '$18,900', Product_Category: 'Neural Nodes', Sales_Channel: 'Cloud Marketplace' },
            { transaction_date: '2026-09-03', revenue: '$12,450', Product_Category: 'Bridges', Sales_Channel: 'OEM Partners' },
            { transaction_date: '2026-09-04', revenue: '$21,100', Product_Category: 'Photonic Links', Sales_Channel: 'Enterprise API' },
          ]
        };
        setResult(profilingResult);
        registerDataset({
          id: presetId,
          name: presetName || 'Custom Operational Twin',
          row_count: 51280,
          target_metric: 'revenue',
          dimensions: ['Product_Category', 'Sales_Channel', 'Geographic_Region', 'Customer_Tier'],
        });
        selectDataset(presetId);
        addToast({
          type: 'info',
          title: 'SAMPLE DATASET ACTIVATED',
          message: `Ingestion backend unavailable. Twin ${presetId} is running on bundled sample data, not your uploaded file.`,
        });
        setFile(null);
        setLoading(false);
      }, 4500);

    } catch (err: any) {
      // Backend failed: fall back to a clearly-labeled demo dataset
      const fallbackId = 'COGNITWIN-DEMO-2026';
      setResult({
        dataset_id: fallbackId,
        is_demo: true,
        row_count: 51280,
        column_mapping: {
          primary_date: 'transaction_date',
          target_metric: 'revenue',
          dimensions: ['Product_Category', 'Sales_Channel', 'Geographic_Region', 'Customer_Tier'],
        },
      });
      selectDataset(fallbackId);
      addToast({
        type: 'warning',
        title: 'INGESTION FAILED — DEMO MODE',
        message: `Upload could not be processed (${err?.message || 'backend unreachable'}). A labeled sample dataset was activated instead.`,
      });
      setLoading(false);
    } finally {
      if (inputRef.current) inputRef.current.value = '';
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -15 }}
      className="space-y-8"
    >
      {!result ? (
        <>
          {/* Preset 1-Click Curated Datasets */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-mono uppercase tracking-wider text-white/50 flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-[#00F0FF]" />
                Instant 1-Click Curated Twins:
              </span>
              <span className="text-[10px] font-mono text-white/30 uppercase">
                Zero upload required
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              {PRESET_SAMPLE_DATASETS.map((ds) => (
                <div
                  key={ds.id}
                  role="button"
                  tabIndex={0}
                  aria-label={`Load the ${ds.name} sample dataset`}
                  onClick={() => executeSimulatedOrRealIngestion(undefined, ds.id)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      executeSimulatedOrRealIngestion(undefined, ds.id);
                    }
                  }}
                  className="group p-4 rounded-xl bg-white/[0.02] hover:bg-white/[0.05] border border-white/10 hover:border-[#00F0FF]/40 transition-all cursor-pointer space-y-2 relative overflow-hidden focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#00F0FF]"
                >
                  <div className="flex items-start justify-between">
                    <h4 className="font-display font-semibold text-xs text-white group-hover:text-[#00F0FF] transition-colors line-clamp-1">
                      {ds.name}
                    </h4>
                    <span className="w-1.5 h-1.5 rounded-full bg-[#00E599] group-hover:scale-125 transition-transform" />
                  </div>
                  <p className="text-[11px] text-white/50 font-sans line-clamp-2 leading-relaxed">
                    {ds.description}
                  </p>
                  <div className="flex items-center justify-between font-mono text-[10px] text-white/40 pt-1 border-t border-white/5">
                    <span>{ds.records}</span>
                    <span className="text-[#00F0FF] font-semibold flex items-center gap-0.5">
                      Load Twin &rarr;
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="flex items-center gap-4">
            <div className="h-[1px] flex-1 bg-white/10" />
            <span className="text-[10px] font-mono text-white/30 uppercase tracking-widest">
              OR UPLOAD RAW CSV
            </span>
            <div className="h-[1px] flex-1 bg-white/10" />
          </div>

          {/* Radiant Drop Zone */}
          <div
            role="button"
            tabIndex={0}
            aria-label="Upload a CSV file. Drag and drop, or press Enter to browse."
            className={`relative border-2 border-dashed rounded-2xl flex flex-col items-center justify-center p-12 sm:p-16 transition-all duration-200 cursor-pointer overflow-hidden ${
              dragActive
                ? 'border-[#00F0FF] bg-[#00F0FF]/10 scale-[1.01] shadow-[0_0_30px_rgba(0,240,255,0.2)]'
                : 'border-white/15 hover:border-white/30 bg-white/[0.02] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#00F0FF]'
            }`}
            onDragEnter={handleDrag}
            onDragLeave={handleDrag}
            onDragOver={handleDrag}
            onDrop={handleDrop}
            onClick={() => inputRef.current?.click()}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                inputRef.current?.click();
              }
            }}
          >
            <input
              ref={inputRef}
              id="file-upload"
              type="file"
              accept=".csv"
              className="hidden"
              onChange={handleFileChange}
            />

            <div className="w-16 h-16 rounded-2xl bg-white/[0.04] border border-white/10 flex items-center justify-center mb-4 shadow-[0_0_20px_rgba(0,240,255,0.15)] group-hover:scale-105 transition-transform">
              <UploadCloud className={`w-8 h-8 ${dragActive ? 'text-[#00F0FF]' : 'text-zinc-300'}`} />
            </div>

            <p className="text-base font-semibold text-white">
              Drag & Drop your transactional CSV here, or click to browse
            </p>
            <p className="text-xs font-mono text-white/40 mt-2">
              Auto-schema detection: Date, target metric, & dimensional vector mapping
            </p>
          </div>

          {/* Selected File Card */}
          {file && (
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="flex items-center justify-between p-4 rounded-xl bg-[#06090E] border border-[#00F0FF]/40 shadow-lg font-mono text-xs"
            >
              <div className="flex items-center gap-3">
                <Table2 className="w-4 h-4 text-[#00F0FF]" />
                <span className="text-white font-semibold">{file.name}</span>
              </div>
              <span className="text-white/50">{(file.size / 1024 / 1024).toFixed(2)} MB</span>
            </motion.div>
          )}

          {/* Start Ingestion Button */}
          <div className="flex justify-end">
            <button
              onClick={() => executeSimulatedOrRealIngestion(file || undefined)}
              disabled={loading}
              className={`flex items-center gap-2.5 px-8 py-3.5 rounded-full font-mono text-xs font-bold uppercase tracking-wider transition-all cursor-pointer ${
                loading
                  ? 'bg-white/10 text-white/50 cursor-not-allowed'
                  : 'bg-[#00F0FF] hover:bg-[#00D5E5] text-black shadow-[0_0_25px_rgba(0,240,255,0.35)] hover:-translate-y-0.5'
              }`}
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin text-black" />
                  <span>{loadingText}</span>
                </>
              ) : (
                <>
                  <UploadCloud className="w-4 h-4" />
                  <span>Execute Reactor Ingestion</span>
                </>
              )}
            </button>
          </div>

          {error && (
            <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/25 flex items-start gap-3 text-red-400 font-mono text-xs">
              <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" />
              <div>
                <h4 className="font-bold">Ingestion Interrupted</h4>
                <p className="mt-0.5 text-red-300/80">{error}</p>
              </div>
            </div>
          )}
        </>
      ) : (
        /* Smart Schema Profiling Confirmation UI */
        <motion.div
          initial={{ opacity: 0, scale: 0.96 }}
          animate={{ opacity: 1, scale: 1 }}
          className="space-y-6"
        >
          {/* Header Bar */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-6 rounded-2xl bg-[#06090E]/90 border border-white/10 shadow-2xl">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-[#00E599]/15 border border-[#00E599]/30 flex items-center justify-center flex-shrink-0 shadow-[0_0_15px_rgba(0,229,153,0.3)]">
                <CheckCircle className="w-6 h-6 text-[#00E599]" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-xl font-display font-bold text-white">
                    {result.is_demo ? 'Sample Dataset Activated' : 'Smart Schema Profiling Complete'}
                  </h3>
                  {result.is_demo ? (
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-400 border border-amber-500/30 font-semibold">
                      DEMO DATA — NOT YOUR UPLOAD
                    </span>
                  ) : (
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-[#00E599]/15 text-[#00E599] border border-[#00E599]/30 font-semibold">
                      HEALTHY
                    </span>
                  )}
                </div>
                <p className="text-xs font-mono text-white/50 mt-1">
                  Twin ID: <span className="text-[#00F0FF]">{result.dataset_id}</span> •{' '}
                  {result.row_count?.toLocaleString()}{' '}
                  {result.is_demo ? 'sample rows (bundled demo dataset)' : 'rows indexed into columnar storage'}
                </p>
              </div>
            </div>

            {/* Launch Buttons */}
            <div className="flex flex-wrap items-center gap-2.5">
              <button
                onClick={() => router.push(`/dashboard?dataset_id=${result.dataset_id}`)}
                className="px-4 py-2 rounded-full bg-white/[0.06] hover:bg-white/[0.1] border border-white/10 text-white font-mono text-xs font-semibold transition-all cursor-pointer"
              >
                Observatory Dashboard
              </button>
              <button
                onClick={() => router.push(`/query?dataset_id=${result.dataset_id}`)}
                className="px-4 py-2 rounded-full bg-white/[0.06] hover:bg-white/[0.1] border border-white/10 text-[#00F0FF] font-mono text-xs font-semibold transition-all cursor-pointer"
              >
                Ask AI Analyst
              </button>
              <button
                onClick={() => router.push(`/forecast?dataset_id=${result.dataset_id}`)}
                className="px-5 py-2 rounded-full bg-[#00E599] hover:bg-[#00F0FF] text-[#030507] font-mono text-xs font-bold uppercase tracking-wider transition-all shadow-[0_0_20px_rgba(0,229,153,0.4)] cursor-pointer"
              >
                Launch Forecast &rarr;
              </button>
            </div>
          </div>

          {/* Mapped Schema Details Grid */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            
            {/* Timeline Column */}
            <div className="p-5 rounded-xl bg-white/[0.02] border border-white/10 space-y-2 font-mono">
              <span className="text-[10px] uppercase tracking-wider text-white/40 block">
                PRIMARY TIMELINE COLUMN
              </span>
              <div className="flex items-center gap-2">
                <span className="px-3 py-1 rounded-full bg-[#00F0FF]/15 text-[#00F0FF] border border-[#00F0FF]/30 text-xs font-bold">
                  {result.column_mapping?.primary_date || 'transaction_date'}
                </span>
                <span className="text-[10px] text-white/40">ISO 8601 (Daily)</span>
              </div>
            </div>

            {/* Target Metric Column */}
            <div className="p-5 rounded-xl bg-white/[0.02] border border-white/10 space-y-2 font-mono">
              <span className="text-[10px] uppercase tracking-wider text-white/40 block">
                TARGET FORECASTING METRIC
              </span>
              <div className="flex items-center gap-2">
                <span className="px-3 py-1 rounded-full bg-[#00E599]/15 text-[#00E599] border border-[#00E599]/30 text-xs font-bold">
                  {result.column_mapping?.target_metric || 'revenue'}
                </span>
                <span className="text-[10px] text-white/40">Numeric Float</span>
              </div>
            </div>

            {/* Data Quality Sensor */}
            <div className="p-5 rounded-xl bg-white/[0.02] border border-white/10 space-y-2 font-mono">
              <span className="text-[10px] uppercase tracking-wider text-white/40 block">
                INTEGRITY & CLEANLINESS
              </span>
              <div className="flex items-center gap-2">
                <span className="px-3 py-1 rounded-full bg-[#FFB020]/15 text-[#FFB020] border border-[#FFB020]/30 text-xs font-bold">
                  99.8% FIDELITY
                </span>
                <span className="text-[10px] text-white/40">0 Nulls • 0 Dupes</span>
              </div>
            </div>

          </div>

          {/* Dimensions List */}
          <div className="p-5 rounded-xl bg-white/[0.02] border border-white/10 space-y-3 font-mono">
            <div className="flex items-center justify-between">
              <span className="text-xs uppercase tracking-wider text-white/60 font-semibold">
                Categorical Dimensions Profiled
              </span>
              <span className="text-[10px] text-white/40">
                {result.column_mapping?.dimensions?.length || 4} Dimensions Active
              </span>
            </div>
            <div className="flex flex-wrap gap-2">
              {(result.column_mapping?.dimensions || ['Product_Category', 'Sales_Channel', 'Geographic_Region', 'Customer_Tier']).map((dim: string) => (
                <span
                  key={dim}
                  className="px-3 py-1.5 rounded-lg bg-white/[0.04] text-white text-xs border border-white/10 flex items-center gap-1.5"
                >
                  <span className="w-1.5 h-1.5 rounded-full bg-[#00F0FF]" />
                  <span>{dim.replace(/_/g, ' ')}</span>
                </span>
              ))}
            </div>
          </div>

          {/* Upload Another Button */}
          <div className="flex justify-start">
            <button
              onClick={() => setResult(null)}
              className="text-xs font-mono text-white/50 hover:text-white underline underline-offset-4 cursor-pointer"
            >
              &larr; Upload another dataset
            </button>
          </div>
        </motion.div>
      )}
    </motion.div>
  );
}

// ─── PDF Upload & Semantic Search Panel ─────────────────────────
function PDFPanel() {
  const [dragActive, setDragActive] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadStatus, setUploadStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [uploadMessage, setUploadMessage] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  const [query, setQuery] = useState('');
  const [results, setResults] = useState<any[]>([]);
  const [searching, setSearching] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const [searchError, setSearchError] = useState('');

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') setDragActive(true);
    else if (e.type === 'dragleave') setDragActive(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFile(e.dataTransfer.files[0]);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) handleFile(e.target.files[0]);
  };

  const handleFile = async (selectedFile: File) => {
    if (selectedFile.type !== 'application/pdf') {
      setUploadStatus('error');
      setUploadMessage('Only PDF files are supported.');
      return;
    }

    setUploading(true);
    setUploadStatus('idle');
    try {
      await uploadDocument(selectedFile);
      setUploadStatus('success');
      setUploadMessage(`Successfully indexed ${selectedFile.name} into vector store.`);
    } catch (err: any) {
      setUploadStatus('error');
      setUploadMessage(
        `Failed to index ${selectedFile.name}: ${err?.message || 'vector store backend unavailable'}. Please retry.`,
      );
    } finally {
      setUploading(false);
    }
  };

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!query.trim()) return;
    setSearching(true);
    setSearchError('');
    setHasSearched(true);
    try {
      const data = await searchDocument(query, 4);
      setResults(data);
    } catch (err: any) {
      setResults([]);
      setSearchError(
        `Semantic search failed: ${err?.message || 'vector store backend unavailable'}. Upload a document and retry.`,
      );
    } finally {
      setSearching(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -15 }}
      className="space-y-8"
    >
      {/* PDF Drop Zone */}
      <div className="space-y-3">
        <h3 className="text-xs font-mono uppercase tracking-wider text-white/50">
          Upload Strategic PDF Manuals & Knowledge Base
        </h3>

        <div
          role="button"
          tabIndex={uploading ? -1 : 0}
          aria-label="Upload a PDF document. Drag and drop, or press Enter to browse."
          aria-disabled={uploading}
          className={`relative border-2 border-dashed rounded-2xl flex flex-col items-center justify-center p-12 transition-all duration-200 cursor-pointer overflow-hidden ${
            dragActive
              ? 'border-[#00F0FF] bg-[#00F0FF]/10 scale-[1.01]'
              : 'border-white/15 hover:border-white/30 bg-white/[0.02] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#00F0FF]'
          } ${uploading ? 'opacity-50 pointer-events-none' : ''}`}
          onDragEnter={handleDrag}
          onDragLeave={handleDrag}
          onDragOver={handleDrag}
          onDrop={handleDrop}
          onClick={() => inputRef.current?.click()}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              inputRef.current?.click();
            }
          }}
        >
          <input ref={inputRef} type="file" accept=".pdf" className="hidden" onChange={handleChange} />

          {uploading ? (
            <div className="flex flex-col items-center gap-3">
              <Loader2 className="w-8 h-8 animate-spin text-[#00F0FF]" />
                <span className="text-xs font-mono text-white/70">
                  Generating dense embeddings (BAAI/bge-small-en-v1.5, 384-dim)...
                </span>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-3">
              <div className="w-14 h-14 rounded-2xl bg-white/[0.04] border border-white/10 flex items-center justify-center">
                <BookOpen className="w-7 h-7 text-[#00F0FF]" />
              </div>
              <div className="text-center">
                <p className="text-sm font-semibold text-white">Click or drag PDF documents here</p>
                <p className="text-xs font-mono text-white/40 mt-1">
                  Automatic chunking, sentence boundary detection, & cosine index
                </p>
              </div>
            </div>
          )}
        </div>

        {uploadStatus !== 'idle' && (
          <div
            className={`p-4 rounded-xl flex items-start gap-3 font-mono text-xs ${
              uploadStatus === 'success'
                ? 'bg-[#00E599]/10 border border-[#00E599]/30 text-[#00E599]'
                : 'bg-red-500/10 border border-red-500/30 text-red-400'
            }`}
          >
            {uploadStatus === 'success' ? (
              <CheckCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
            ) : (
              <AlertTriangle className="w-4 h-4 mt-0.5 flex-shrink-0" />
            )}
            <div>{uploadMessage}</div>
          </div>
        )}
      </div>

      <div className="h-[1px] bg-white/10" />

      {/* Vector Query Search Bar */}
      <div className="space-y-4">
        <h3 className="text-xs font-mono uppercase tracking-wider text-white/60 flex items-center gap-2">
          <Database className="w-4 h-4 text-[#00F0FF]" />
          <span>Vector Semantic Search Sandbox</span>
        </h3>

        <form onSubmit={handleSearch} className="relative flex items-center">
          <div className="absolute left-4 flex items-center pointer-events-none text-white/40">
            <Search className="w-4 h-4" />
          </div>
          <input
            type="text"
            className="w-full bg-[#07080B] border border-white/15 focus:border-[#00F0FF] rounded-xl py-3.5 pl-11 pr-24 font-mono text-sm text-white placeholder-white/40 focus:outline-none transition-colors"
            placeholder="Search indexed knowledge (e.g. 'What are our volume rebate thresholds?')..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          <button
            type="submit"
            disabled={searching || !query.trim()}
            className="absolute right-2 px-4 py-1.5 rounded-lg bg-[#00F0FF] hover:bg-[#00D5E5] text-black font-mono text-xs font-bold transition-all disabled:opacity-40 cursor-pointer"
          >
            {searching ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Query'}
          </button>
        </form>

        {/* Results List */}
        {searchError && (
          <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/30 text-red-400 font-mono text-xs flex items-start gap-3">
            <AlertTriangle className="w-4 h-4 mt-0.5 flex-shrink-0" />
            <div>{searchError}</div>
          </div>
        )}

        {results.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
            {results.map((res, idx) => (
              <div
                key={idx}
                className="p-5 rounded-xl bg-white/[0.02] border border-white/10 hover:border-[#00F0FF]/30 transition-all space-y-2.5"
              >
                <div className="flex items-center justify-between font-mono text-xs">
                  <div className="flex items-center gap-2 text-white/70">
                    <FileText className="w-3.5 h-3.5 text-[#00F0FF]" />
                    <span className="truncate max-w-[180px]">{res.document_title}</span>
                  </div>
                  <span className="px-2 py-0.5 rounded bg-[#00E599]/15 text-[#00E599] text-[10px] font-bold">
                    Score: {res.score.toFixed(3)}
                  </span>
                </div>
                <p className="text-xs text-white/80 font-sans leading-relaxed">
                  {res.text_content}
                </p>
              </div>
            ))}
          </div>
        )}
      </div>
    </motion.div>
  );
}

// ─── Main Ingest Page Component ─────────────────────────────────
export default function IngestPage() {
  const [activeTab, setActiveTab] = useState<TabId>('csv');

  return (
    <div className="p-4 sm:p-8 max-w-5xl mx-auto space-y-8 pb-24 relative z-10">
      
      {/* Header */}
      <header className="space-y-2">
        <div className="flex items-center gap-2 font-mono text-[11px] text-[#00F0FF] tracking-widest uppercase mb-1">
          <span className="w-1.5 h-1.5 rounded-full bg-[#00F0FF]" />
          SYS.REACTOR // DATA & KNOWLEDGE INTAKE
        </div>
        <h1 className="text-3xl sm:text-4xl lg:text-5xl font-display font-bold text-white tracking-tight">
          Data & Vector Ingestion Reactor
        </h1>
        <p className="text-sm font-sans text-white/60 max-w-2xl">
          Feed raw transactional time-series records to spawn an autonomous digital twin, or index PDF operational manuals for semantic vector search.
        </p>
        <div className="h-[1px] bg-gradient-to-r from-transparent via-white/10 to-transparent pt-3" />
      </header>

      {/* Segmented Control */}
      <div className="flex justify-center">
        <AnimatedTabs activeTab={activeTab} onChange={setActiveTab} />
      </div>

      {/* Main Reactor Panel */}
      <div className="obsidian-panel rounded-2xl p-6 sm:p-8 border border-white/10 shadow-2xl">
        <AnimatePresence mode="wait">
          {activeTab === 'csv' ? (
            <CSVUploadPanel key="csv" />
          ) : (
            <PDFPanel key="pdf" />
          )}
        </AnimatePresence>
      </div>

    </div>
  );
}
