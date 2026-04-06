/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect, useCallback, useMemo, ChangeEvent } from 'react';
import { 
  Sparkles, 
  RefreshCw, 
  Copy, 
  Trash2, 
  Plus, 
  Settings, 
  History, 
  BookOpen, 
  ChevronRight, 
  ChevronDown,
  Wand2,
  Save,
  Check,
  X,
  Download,
  Upload,
  Search,
  Edit3,
  ExternalLink,
  AlertCircle
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { GoogleGenAI } from "@google/genai";

// --- Types ---

interface WildcardList {
  id: string;
  name: string;
  items: string[];
}

interface PromptHistory {
  id: string;
  template: string;
  result: string;
  timestamp: number;
}

interface Toast {
  id: string;
  message: string;
  type: 'success' | 'error' | 'info';
}

// --- Constants ---

const INITIAL_WILDCARDS: WildcardList[] = [
  {
    id: 'subject',
    name: 'Subject',
    items: ['a futuristic robot', 'a mystical forest', 'a cyberpunk city', 'a portrait of a warrior', 'a serene landscape', 'a cosmic nebula']
  },
  {
    id: 'style',
    name: 'Style',
    items: ['digital art', 'oil painting', 'watercolor', 'sketch', '3D render', 'anime style', 'cinematic lighting', 'minimalist']
  },
  {
    id: 'artist',
    name: 'Artist',
    items: ['Salvador Dali', 'Vincent van Gogh', 'Greg Rutkowski', 'ArtStation', 'Beeple', 'Hayao Miyazaki']
  },
  {
    id: 'lighting',
    name: 'Lighting',
    items: ['golden hour', 'neon glow', 'soft moonlight', 'dramatic shadows', 'volumetric lighting', 'studio lights']
  }
];

const PROMPT_TEMPLATES = [
  "__subject__ in the style of __artist__, __style__, __lighting__",
  "A detailed portrait of __subject__, highly detailed, 8k, __style__",
  "__subject__ exploring a __lighting__ environment, __style__",
];

// --- App Component ---

export default function App() {
  const [template, setTemplate] = useState(PROMPT_TEMPLATES[0]);
  const [customTemplates, setCustomTemplates] = useState<string[]>(() => {
    const saved = localStorage.getItem('wildpromptor_templates');
    return saved ? JSON.parse(saved) : PROMPT_TEMPLATES;
  });
  const [wildcards, setWildcards] = useState<WildcardList[]>(() => {
    const saved = localStorage.getItem('wildpromptor_wildcards');
    return saved ? JSON.parse(saved) : INITIAL_WILDCARDS;
  });
  const [history, setHistory] = useState<PromptHistory[]>(() => {
    const saved = localStorage.getItem('wildpromptor_history');
    return saved ? JSON.parse(saved) : [];
  });
  const [generatedPrompt, setGeneratedPrompt] = useState('');
  const [isEnhancing, setIsEnhancing] = useState(false);
  const [activeTab, setActiveTab] = useState<'builder' | 'wildcards' | 'history'>('builder');
  const [isCopied, setIsCopied] = useState(false);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [wildcardSearch, setWildcardSearch] = useState('');
  const [historySearch, setHistorySearch] = useState('');
  const [editingWildcardId, setEditingWildcardId] = useState<string | null>(null);
  const [batchGenerated, setBatchGenerated] = useState<string[]>([]);
  const [isBatching, setIsBatching] = useState(false);

  // --- Persistence ---

  useEffect(() => {
    localStorage.setItem('wildpromptor_wildcards', JSON.stringify(wildcards));
  }, [wildcards]);

  useEffect(() => {
    localStorage.setItem('wildpromptor_history', JSON.stringify(history));
  }, [history]);

  useEffect(() => {
    localStorage.setItem('wildpromptor_templates', JSON.stringify(customTemplates));
  }, [customTemplates]);

  // --- Logic ---

  const addToast = useCallback((message: string, type: Toast['type'] = 'info') => {
    const id = crypto.randomUUID();
    setToasts(prev => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, 3000);
  }, []);

  const saveTemplate = () => {
    if (template && !customTemplates.includes(template)) {
      setCustomTemplates(prev => [template, ...prev]);
      addToast('Template saved', 'success');
    }
  };

  const deleteTemplate = (t: string) => {
    setCustomTemplates(prev => prev.filter(item => item !== t));
    addToast('Template deleted', 'info');
  };

  const resetWildcards = () => {
    setWildcards(INITIAL_WILDCARDS);
    addToast('Wildcards reset to defaults', 'info');
  };

  const exportWildcards = () => {
    const data = JSON.stringify(wildcards, null, 2);
    const blob = new Blob([data], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `wildcards-${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
    addToast('Wildcards exported', 'success');
  };

  const importWildcards = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const imported = JSON.parse(event.target?.result as string);
        if (Array.isArray(imported)) {
          setWildcards(imported);
          addToast('Wildcards imported successfully', 'success');
        }
      } catch (err) {
        addToast('Invalid JSON file', 'error');
      }
    };
    reader.readAsText(file);
  };

  const generateBatch = useCallback(() => {
    setIsBatching(true);
    const results: string[] = [];
    for (let i = 0; i < 5; i++) {
      let result = template;
      const usedWildcards = template.match(/__[a-zA-Z0-9_]+__/g) || [];
      usedWildcards.forEach(match => {
        const name = match.slice(2, -2).toLowerCase();
        const list = wildcards.find(w => w.name.toLowerCase() === name || w.id.toLowerCase() === name);
        if (list && list.items.length > 0) {
          const randomItem = list.items[Math.floor(Math.random() * list.items.length)];
          result = result.replace(match, randomItem);
        }
      });
      results.push(result);
    }
    setBatchGenerated(results);
    
    // Add all to history
    const newHistoryItems = results.map(res => ({
      id: crypto.randomUUID(),
      template,
      result: res,
      timestamp: Date.now()
    }));
    
    setHistory(prev => [...newHistoryItems, ...prev].slice(0, 100));
    setIsBatching(false);
    addToast('Batch of 5 generated', 'success');
  }, [template, wildcards, addToast]);

  const generatePrompt = useCallback(() => {
    let result = template;
    const usedWildcards = template.match(/__[a-zA-Z0-9_]+__/g) || [];
    
    usedWildcards.forEach(match => {
      const name = match.slice(2, -2).toLowerCase();
      const list = wildcards.find(w => w.name.toLowerCase() === name || w.id.toLowerCase() === name);
      if (list && list.items.length > 0) {
        const randomItem = list.items[Math.floor(Math.random() * list.items.length)];
        result = result.replace(match, randomItem);
      }
    });
    
    setGeneratedPrompt(result);
    setBatchGenerated([]);
    
    if (result && (!history.length || history[0].result !== result)) {
      setHistory(prev => [
        { id: crypto.randomUUID(), template, result, timestamp: Date.now() },
        ...prev.slice(0, 99)
      ]);
    }
  }, [template, wildcards, history]);

  const updateWildcardItem = (listId: string, index: number, newValue: string) => {
    setWildcards(prev => prev.map(w => 
      w.id === listId ? { ...w, items: w.items.map((item, i) => i === index ? newValue : item) } : w
    ));
  };

  const enhancePrompt = async () => {
    if (!template) return;
    setIsEnhancing(true);
    try {
      const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: `Expand and enhance this image generation prompt template. Keep the wildcards (like __subject__, __style__, etc.) if they exist. Make it more descriptive and artistic.
        
        Original: ${template}
        
        Enhanced Prompt:`,
        config: {
          systemInstruction: "You are a prompt engineering expert for Stable Diffusion and Midjourney. Your goal is to take a simple prompt and make it detailed, adding artistic keywords, lighting, and composition details while preserving any __wildcard__ placeholders.",
        }
      });
      
      const enhanced = response.text?.trim() || template;
      setTemplate(enhanced);
    } catch (error) {
      console.error("Enhancement failed:", error);
    } finally {
      setIsEnhancing(false);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setIsCopied(true);
    setTimeout(() => setIsCopied(false), 2000);
  };

  const addWildcard = () => {
    const name = prompt("Enter wildcard name (e.g. 'color'):");
    if (name) {
      setWildcards(prev => [...prev, { id: name.toLowerCase(), name, items: [] }]);
    }
  };

  const addItemToWildcard = (id: string) => {
    const item = prompt("Enter new item:");
    if (item) {
      setWildcards(prev => prev.map(w => w.id === id ? { ...w, items: [...w.items, item] } : w));
    }
  };

  const removeItemFromWildcard = (id: string, index: number) => {
    setWildcards(prev => prev.map(w => w.id === id ? { ...w, items: w.items.filter((_, i) => i !== index) } : w));
  };

  const deleteWildcard = (id: string) => {
    setWildcards(prev => prev.filter(w => w.id !== id));
    addToast('Wildcard deleted', 'info');
  };

  const filteredWildcards = useMemo(() => {
    if (!wildcardSearch) return wildcards;
    const search = wildcardSearch.toLowerCase();
    return wildcards.filter(w => 
      w.name.toLowerCase().includes(search) || 
      w.items.some(item => item.toLowerCase().includes(search))
    );
  }, [wildcards, wildcardSearch]);

  const filteredHistory = useMemo(() => {
    if (!historySearch) return history;
    const search = historySearch.toLowerCase();
    return history.filter(h => 
      h.result.toLowerCase().includes(search) || 
      h.template.toLowerCase().includes(search)
    );
  }, [history, historySearch]);

  // --- Render ---

  return (
    <div className="min-h-screen bg-neutral-50 text-neutral-900 font-sans selection:bg-indigo-500/10">
      {/* Toasts */}
      <div className="fixed bottom-6 right-6 z-[100] flex flex-col gap-3 pointer-events-none">
        <AnimatePresence>
          {toasts.map(toast => (
            <motion.div
              key={toast.id}
              initial={{ opacity: 0, x: 20, scale: 0.9 }}
              animate={{ opacity: 1, x: 0, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9, transition: { duration: 0.2 } }}
              className={`pointer-events-auto px-4 py-3 rounded-xl shadow-2xl border flex items-center gap-3 min-w-[240px] ${
                toast.type === 'success' ? 'bg-green-50 border-green-100 text-green-700' :
                toast.type === 'error' ? 'bg-red-50 border-red-100 text-red-700' :
                'bg-white border-neutral-200 text-neutral-800'
              }`}
            >
              {toast.type === 'success' ? <Check className="w-5 h-5" /> : 
               toast.type === 'error' ? <AlertCircle className="w-5 h-5" /> : 
               <BookOpen className="w-5 h-5" />}
              <span className="text-sm font-medium">{toast.message}</span>
              <button onClick={() => setToasts(prev => prev.filter(t => t.id !== toast.id))} className="ml-auto p-1 hover:bg-black/5 rounded">
                <X className="w-4 h-4 opacity-50" />
              </button>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      {/* Header */}
      <header className="border-b border-neutral-200 bg-white/80 backdrop-blur-md sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-indigo-600 rounded-xl flex items-center justify-center shadow-lg shadow-indigo-500/20">
              <Sparkles className="text-white w-6 h-6" />
            </div>
            <h1 className="text-xl font-bold tracking-tight text-neutral-900">WildPromptor <span className="text-indigo-600">Web</span></h1>
          </div>
          
          <nav className="flex bg-neutral-100 p-1 rounded-lg border border-neutral-200">
            <button 
              onClick={() => setActiveTab('builder')}
              className={`px-4 py-1.5 rounded-md text-sm font-medium transition-all ${activeTab === 'builder' ? 'bg-white text-indigo-600 shadow-sm border border-neutral-200' : 'text-neutral-500 hover:text-neutral-900'}`}
            >
              Builder
            </button>
            <button 
              onClick={() => setActiveTab('wildcards')}
              className={`px-4 py-1.5 rounded-md text-sm font-medium transition-all ${activeTab === 'wildcards' ? 'bg-white text-indigo-600 shadow-sm border border-neutral-200' : 'text-neutral-500 hover:text-neutral-900'}`}
            >
              Wildcards
            </button>
            <button 
              onClick={() => setActiveTab('history')}
              className={`px-4 py-1.5 rounded-md text-sm font-medium transition-all ${activeTab === 'history' ? 'bg-white text-indigo-600 shadow-sm border border-neutral-200' : 'text-neutral-500 hover:text-neutral-900'}`}
            >
              History
            </button>
          </nav>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-8">
        <AnimatePresence mode="wait">
          {activeTab === 'builder' && (
            <motion.div 
              key="builder"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="grid grid-cols-1 lg:grid-cols-3 gap-8"
            >
              {/* Left: Template Editor */}
              <div className="lg:col-span-2 space-y-6">
                <div className="bg-white border border-neutral-200 rounded-2xl p-6 shadow-sm">
                  <div className="flex items-center justify-between mb-4">
                    <h2 className="text-lg font-semibold flex items-center gap-2 text-neutral-900">
                      <BookOpen className="w-5 h-5 text-indigo-600" />
                      Prompt Template
                    </h2>
                    <div className="flex gap-2">
                      <button 
                        onClick={saveTemplate}
                        className="flex items-center gap-2 px-3 py-1.5 bg-neutral-100 hover:bg-neutral-200 text-neutral-700 rounded-lg text-xs font-semibold transition-colors"
                        title="Save Template"
                      >
                        <Save className="w-3 h-3" />
                        Save
                      </button>
                      <button 
                        onClick={enhancePrompt}
                        disabled={isEnhancing}
                        className="flex items-center gap-2 px-3 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-600 rounded-lg text-xs font-semibold transition-colors disabled:opacity-50"
                      >
                        {isEnhancing ? <RefreshCw className="w-3 h-3 animate-spin" /> : <Wand2 className="w-3 h-3" />}
                        AI Enhance
                      </button>
                    </div>
                  </div>
                  
                  <textarea 
                    value={template}
                    onChange={(e) => setTemplate(e.target.value)}
                    placeholder="Enter your prompt template here... use __wildcard__ for random items."
                    className="w-full h-48 bg-neutral-50 border border-neutral-200 rounded-xl p-4 text-neutral-800 focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all resize-none font-mono text-sm leading-relaxed"
                  />
                  
                  <div className="mt-4 flex flex-wrap gap-2 max-h-24 overflow-y-auto custom-scrollbar pr-2">
                    <span className="text-xs text-neutral-500 font-medium uppercase tracking-wider self-center">Quick Insert:</span>
                    {wildcards.map(w => (
                      <button 
                        key={w.id}
                        onClick={() => setTemplate(prev => prev + ` __${w.name}__`)}
                        className="px-2 py-1 bg-neutral-100 hover:bg-neutral-200 rounded text-[10px] font-mono text-neutral-600 transition-colors border border-neutral-200"
                      >
                        __{w.name}__
                      </button>
                    ))}
                  </div>
                </div>

                {/* Generated Result */}
                <div className="bg-indigo-50 border border-indigo-100 rounded-2xl p-6 shadow-sm relative overflow-hidden">
                  <div className="absolute top-0 right-0 p-4">
                    <Sparkles className="w-24 h-24 text-indigo-600/5 -rotate-12" />
                  </div>
                  
                  <div className="flex items-center justify-between mb-4 relative z-10">
                    <h2 className="text-lg font-semibold flex items-center gap-2 text-neutral-900">
                      <RefreshCw className="w-5 h-5 text-indigo-600" />
                      Generated Result
                    </h2>
                    <div className="flex gap-2">
                      <button 
                        onClick={generateBatch}
                        disabled={isBatching}
                        className="flex items-center gap-2 px-4 py-2 bg-white hover:bg-neutral-50 text-neutral-700 border border-neutral-200 rounded-xl text-sm font-bold transition-all active:scale-95 disabled:opacity-50 shadow-sm"
                      >
                        {isBatching ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                        Batch (5)
                      </button>
                      <button 
                        onClick={generatePrompt}
                        className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-sm font-bold transition-all shadow-lg shadow-indigo-600/20 active:scale-95"
                      >
                        <RefreshCw className="w-4 h-4" />
                        Generate
                      </button>
                    </div>
                  </div>

                  <div className="space-y-3 relative z-10">
                    {batchGenerated.length > 0 ? (
                      batchGenerated.map((res, idx) => (
                        <div key={idx} className="bg-white border border-neutral-200 rounded-xl p-4 group relative shadow-sm">
                          <p className="text-sm text-neutral-800 leading-relaxed italic pr-10">"{res}"</p>
                          <button 
                            onClick={() => copyToClipboard(res)}
                            className="absolute top-3 right-3 p-1.5 bg-neutral-50 hover:bg-neutral-100 text-neutral-500 hover:text-neutral-900 rounded-lg opacity-0 group-hover:opacity-100 transition-all border border-neutral-200"
                          >
                            <Copy className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ))
                    ) : (
                      <div className="bg-white border border-neutral-200 rounded-xl p-5 min-h-[120px] group relative shadow-sm">
                        {generatedPrompt ? (
                          <p className="text-neutral-800 leading-relaxed italic">"{generatedPrompt}"</p>
                        ) : (
                          <p className="text-neutral-400 italic">Click generate to see the result...</p>
                        )}
                        
                        {generatedPrompt && (
                          <button 
                            onClick={() => copyToClipboard(generatedPrompt)}
                            className="absolute top-3 right-3 p-2 bg-neutral-50 hover:bg-neutral-100 text-neutral-500 hover:text-neutral-900 rounded-lg opacity-0 group-hover:opacity-100 transition-all border border-neutral-200"
                          >
                            {isCopied ? <Check className="w-4 h-4 text-green-600" /> : <Copy className="w-4 h-4" />}
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Right: Presets & Tips */}
              <div className="space-y-6">
                <div className="bg-white border border-neutral-200 rounded-2xl p-6 shadow-sm">
                  <h3 className="text-sm font-bold text-neutral-400 uppercase tracking-widest mb-4">Saved Templates</h3>
                  <div className="space-y-2 max-h-[300px] overflow-y-auto custom-scrollbar pr-2">
                    {customTemplates.map((t, i) => (
                      <div key={i} className="group relative">
                        <button 
                          onClick={() => setTemplate(t)}
                          className="w-full text-left p-3 pr-10 rounded-xl bg-neutral-50 hover:bg-neutral-100 border border-neutral-200 transition-all text-xs text-neutral-700 line-clamp-2"
                        >
                          {t}
                        </button>
                        <button 
                          onClick={() => deleteTemplate(t)}
                          className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 text-neutral-400 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-all"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </div>
                    ))}
                    {customTemplates.length === 0 && (
                      <p className="text-xs text-neutral-400 italic text-center py-4">No saved templates</p>
                    )}
                  </div>
                </div>

                <div className="bg-white border border-neutral-200 rounded-2xl p-6 shadow-sm">
                  <h3 className="text-sm font-bold text-neutral-400 uppercase tracking-widest mb-4">How it works</h3>
                  <ul className="space-y-3 text-xs text-neutral-500 leading-relaxed">
                    <li className="flex gap-2">
                      <span className="text-indigo-600 font-bold">1.</span>
                      Write a prompt using wildcards like <code className="text-indigo-600 font-mono">__subject__</code>.
                    </li>
                    <li className="flex gap-2">
                      <span className="text-indigo-600 font-bold">2.</span>
                      Define items for each wildcard in the <span className="text-neutral-800 font-medium">Wildcards</span> tab.
                    </li>
                    <li className="flex gap-2">
                      <span className="text-indigo-600 font-bold">3.</span>
                      Use <span className="text-neutral-800 font-medium">AI Enhance</span> to add artistic depth to your template.
                    </li>
                    <li className="flex gap-2">
                      <span className="text-indigo-600 font-bold">4.</span>
                      Click <span className="text-neutral-800 font-medium">Generate</span> to pick random items and bake your prompt.
                    </li>
                  </ul>
                </div>
              </div>
            </motion.div>
          )}

          {activeTab === 'wildcards' && (
            <motion.div 
              key="wildcards"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="space-y-6"
            >
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <h2 className="text-2xl font-bold tracking-tight text-neutral-900">Wildcard Library</h2>
                <div className="flex flex-wrap items-center gap-3">
                  <div className="relative flex-1 md:min-w-[300px]">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-400" />
                    <input 
                      type="text"
                      placeholder="Search wildcards or items..."
                      value={wildcardSearch}
                      onChange={(e) => setWildcardSearch(e.target.value)}
                      className="w-full bg-white border border-neutral-200 rounded-xl py-2 pl-10 pr-4 text-sm focus:ring-2 focus:ring-indigo-500/20 outline-none transition-all shadow-sm"
                    />
                  </div>
                  <div className="flex gap-2">
                    <button 
                      onClick={exportWildcards}
                      className="p-2 bg-white hover:bg-neutral-50 text-neutral-500 border border-neutral-200 rounded-xl transition-all shadow-sm"
                      title="Export JSON"
                    >
                      <Download className="w-5 h-5" />
                    </button>
                    <label className="p-2 bg-white hover:bg-neutral-50 text-neutral-500 border border-neutral-200 rounded-xl transition-all cursor-pointer shadow-sm" title="Import JSON">
                      <Upload className="w-5 h-5" />
                      <input type="file" accept=".json" onChange={importWildcards} className="hidden" />
                    </label>
                    <button 
                      onClick={resetWildcards}
                      className="p-2 bg-white hover:bg-neutral-50 text-neutral-500 border border-neutral-200 rounded-xl transition-all shadow-sm"
                      title="Reset Defaults"
                    >
                      <RefreshCw className="w-5 h-5" />
                    </button>
                    <button 
                      onClick={addWildcard}
                      className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-sm font-bold transition-all shadow-md"
                    >
                      <Plus className="w-4 h-4" />
                      New
                    </button>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                {filteredWildcards.map(list => (
                  <div key={list.id} className="bg-white border border-neutral-200 rounded-2xl overflow-hidden shadow-sm flex flex-col h-[400px]">
                    <div className="p-4 border-b border-neutral-200 flex items-center justify-between bg-neutral-50">
                      <h3 className="font-bold text-indigo-600 flex items-center gap-2">
                        <code className="text-xs bg-indigo-100 px-2 py-0.5 rounded">__{list.name}__</code>
                      </h3>
                      <div className="flex gap-1">
                        <button 
                          onClick={() => addItemToWildcard(list.id)}
                          className="p-1.5 hover:bg-neutral-200 text-neutral-500 hover:text-neutral-900 rounded-lg transition-colors"
                        >
                          <Plus className="w-4 h-4" />
                        </button>
                        <button 
                          onClick={() => deleteWildcard(list.id)}
                          className="p-1.5 hover:bg-red-50 text-neutral-400 hover:text-red-600 rounded-lg transition-colors"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                    
                    <div className="flex-1 overflow-y-auto p-4 space-y-2 custom-scrollbar">
                      {list.items.length === 0 ? (
                        <div className="h-full flex flex-col items-center justify-center text-neutral-400 italic text-sm">
                          <p>No items yet</p>
                          <button onClick={() => addItemToWildcard(list.id)} className="text-indigo-600 hover:underline mt-1">Add one</button>
                        </div>
                      ) : (
                        list.items.map((item, idx) => (
                          <div key={idx} className="group flex items-center justify-between p-2.5 bg-neutral-50 border border-neutral-100 rounded-xl hover:border-neutral-200 transition-all shadow-sm">
                            <input 
                              type="text"
                              value={item}
                              onChange={(e) => updateWildcardItem(list.id, idx, e.target.value)}
                              className="bg-transparent border-none outline-none text-sm text-neutral-700 w-full focus:text-neutral-900 transition-colors"
                            />
                            <button 
                              onClick={() => removeItemFromWildcard(list.id, idx)}
                              className="opacity-0 group-hover:opacity-100 p-1 text-neutral-400 hover:text-red-500 transition-all ml-2"
                            >
                              <X className="w-3 h-3" />
                            </button>
                          </div>
                        ))
                      )}
                    </div>
                    
                    <div className="p-3 bg-neutral-50 border-t border-neutral-200 text-[10px] text-neutral-400 font-bold text-center uppercase tracking-widest">
                      {list.items.length} Items
                    </div>
                  </div>
                ))}
              </div>
            </motion.div>
          )}

          {activeTab === 'history' && (
            <motion.div 
              key="history"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
              className="space-y-6"
            >
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <h2 className="text-2xl font-bold tracking-tight text-neutral-900">Generation History</h2>
                <div className="flex items-center gap-3">
                  <div className="relative flex-1 md:min-w-[300px]">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-400" />
                    <input 
                      type="text"
                      placeholder="Search history..."
                      value={historySearch}
                      onChange={(e) => setHistorySearch(e.target.value)}
                      className="w-full bg-white border border-neutral-200 rounded-xl py-2 pl-10 pr-4 text-sm focus:ring-2 focus:ring-indigo-500/20 outline-none transition-all shadow-sm"
                    />
                  </div>
                  <button 
                    onClick={() => { setHistory([]); addToast('History cleared', 'info'); }}
                    className="flex items-center gap-2 px-4 py-2 bg-red-50 hover:bg-red-100 text-red-600 border border-red-100 rounded-xl text-sm font-bold transition-all shadow-sm"
                  >
                    <Trash2 className="w-4 h-4" />
                    Clear
                  </button>
                </div>
              </div>

              {filteredHistory.length === 0 ? (
                <div className="py-20 text-center space-y-4">
                  <div className="w-16 h-16 bg-white rounded-full flex items-center justify-center mx-auto border border-neutral-200 shadow-sm">
                    <History className="w-8 h-8 text-neutral-300" />
                  </div>
                  <p className="text-neutral-400 italic">No matching history found.</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 gap-4">
                  {filteredHistory.map(item => (
                    <div key={item.id} className="bg-white border border-neutral-200 rounded-2xl p-5 hover:border-indigo-200 transition-all group shadow-sm">
                      <div className="flex items-start justify-between gap-4">
                        <div className="space-y-2 flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="text-[10px] font-bold text-indigo-600 uppercase tracking-widest bg-indigo-50 px-2 py-0.5 rounded border border-indigo-100">Result</span>
                            <span className="text-[10px] text-neutral-400">{new Date(item.timestamp).toLocaleString()}</span>
                          </div>
                          <p className="text-sm text-neutral-800 leading-relaxed italic">"{item.result}"</p>
                          
                          <div className="pt-3 border-t border-neutral-100 mt-3">
                            <span className="text-[10px] font-bold text-neutral-400 uppercase tracking-widest block mb-1">Template Used</span>
                            <p className="text-xs text-neutral-500 font-mono truncate">{item.template}</p>
                          </div>
                        </div>
                        
                        <div className="flex flex-col gap-2">
                          <button 
                            onClick={() => copyToClipboard(item.result)}
                            className="p-2 bg-neutral-50 hover:bg-neutral-100 text-neutral-500 hover:text-neutral-900 rounded-lg transition-all border border-neutral-200"
                            title="Copy Result"
                          >
                            <Copy className="w-4 h-4" />
                          </button>
                          <button 
                            onClick={() => setTemplate(item.template)}
                            className="p-2 bg-neutral-50 hover:bg-neutral-100 text-neutral-500 hover:text-neutral-900 rounded-lg transition-all border border-neutral-200"
                            title="Restore Template"
                          >
                            <RefreshCw className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      {/* Global Styles for Scrollbar */}
      <style>{`
        .custom-scrollbar::-webkit-scrollbar {
          width: 4px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: transparent;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: #e5e5e5;
          border-radius: 10px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: #d4d4d4;
        }
      `}</style>
    </div>
  );
}
