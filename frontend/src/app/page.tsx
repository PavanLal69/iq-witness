"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Shield, Lock, AlertTriangle, Cpu, FolderOpen, Plus, Trash2, ArrowRight, Layers, Loader2 } from "lucide-react";

export default function Home() {
  const router = useRouter();
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [cases, setCases] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [newTitle, setNewTitle] = useState("");
  const [newDesc, setNewDesc] = useState("");
  const [showModal, setShowModal] = useState(false);
  const [isSeeding, setIsSeeding] = useState(false);
  const [isLoadingEnron, setIsLoadingEnron] = useState(false);

  useEffect(() => {
    const logged = localStorage.getItem("wiq_logged_in");
    if (logged === "true") {
      setIsLoggedIn(true);
      fetchCases();
    } else {
      setLoading(false);
    }
  }, []);

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (username.trim() && password.trim()) {
      localStorage.setItem("wiq_logged_in", "true");
      setIsLoggedIn(true);
      fetchCases();
    }
  };

  const handleDemoLogin = () => {
    localStorage.setItem("wiq_logged_in", "true");
    setIsLoggedIn(true);
    fetchCases();
  };

  const fetchCases = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/cases");
      if (!res.ok) throw new Error("Failed to fetch cases");
      const data = await res.json();
      setCases(data);
    } catch (err: any) {
      setError("Failed to connect to server. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleCreateCase = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim()) return;

    try {
      const res = await fetch("/api/cases", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: newTitle,
          description: newDesc,
          status: "Active"
        })
      });
      if (!res.ok) throw new Error("Failed to create case");
      const data = await res.json();
      setShowModal(false);
      setNewTitle("");
      setNewDesc("");
      fetchCases();
      router.push(`/cases/${data.id}`);
    } catch (err) {
      alert("Error initializing case.");
    }
  };

  const handleDeleteCase = async (id: number, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm("Confirm permanent deletion of this case and all associated evidence?")) return;

    try {
      const res = await fetch(`/api/cases/${id}`, {
        method: "DELETE"
      });
      if (!res.ok) throw new Error("Delete failed");
      fetchCases();
    } catch (err) {
      alert("Failed to delete case.");
    }
  };

  const handleLoadDemo = async () => {
    setIsSeeding(true);
    try {
      const res = await fetch("/api/cases/load-demo", {
        method: "POST"
      });
      if (!res.ok) throw new Error("Demo load failed");
      const data = await res.json();
      router.push(`/cases/${data.id}`);
    } catch (err) {
      alert("Failed to seed demo case. Is the backend running?");
    } finally {
      setIsSeeding(false);
    }
  };

  const handleLoadEnron = async () => {
    setIsLoadingEnron(true);
    try {
      const res = await fetch("/api/cases/load-enron", {
        method: "POST"
      });
      if (!res.ok) throw new Error("Enron load failed");
      const data = await res.json();
      router.push(`/cases/${data.id}`);
    } catch (err) {
      alert("Failed to seed Enron case.");
    } finally {
      setIsLoadingEnron(false);
    }
  };

  if (!isLoggedIn) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background px-4 select-none">
        <div className="w-full max-w-[360px] rounded border border-card-border bg-card-bg p-8 shadow-md">
          <div className="flex flex-col items-center mb-6">
            <div className="flex h-10 w-10 items-center justify-center rounded border border-zinc-700 bg-[#0d1117] text-zinc-350 mb-3">
              <Shield className="h-5 w-5 text-brand-light" />
            </div>
            <h1 className="text-md font-bold tracking-tight text-white font-mono uppercase">
              WitnessIQ
            </h1>
            <p className="mt-1 text-[10px] text-zinc-500 font-mono tracking-wider">
              Forensic Evidence Portal
            </p>
          </div>

          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="block text-[9px] font-mono text-zinc-400 uppercase tracking-wider mb-1.5">Investigator ID</label>
              <input
                type="text"
                required
                placeholder="Ex: badge_9982"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="w-full bg-background border border-card-border rounded px-3 py-1.5 text-xs text-foreground placeholder:text-zinc-600 focus:outline-none font-mono"
              />
            </div>

            <div>
              <label className="block text-[9px] font-mono text-zinc-400 uppercase tracking-wider mb-1.5">Access Passcode</label>
              <div className="relative">
                <input
                  type="password"
                  required
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full bg-background border border-card-border rounded px-3 py-1.5 text-xs text-foreground placeholder:text-zinc-600 focus:outline-none font-mono"
                />
                <Lock className="absolute right-3 top-2.5 h-3.5 w-3.5 text-zinc-500" />
              </div>
            </div>

            <button
              type="submit"
              className="w-full bg-brand hover:bg-brand-hover text-white font-semibold py-2 rounded text-xs transition-colors cursor-pointer"
            >
              Sign In
            </button>
          </form>

          <div className="mt-6 pt-4 border-t border-card-border flex items-center justify-between text-[10px] font-mono">
            <span className="text-zinc-500">Evaluation</span>
            <button
              onClick={handleDemoLogin}
              className="text-brand-light hover:underline font-medium transition-colors cursor-pointer"
            >
              Enter Console →
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-background">
      {/* Top Header */}
      <header className="border-b border-card-border bg-card-bg px-8 py-3.5 flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <div className="flex h-8 w-8 items-center justify-center rounded border border-card-border bg-background text-zinc-300">
            <Shield className="h-4 w-4 text-brand-light" />
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <span className="text-xs font-bold tracking-wider text-zinc-150 uppercase font-mono">WitnessIQ</span>
              <span className="text-[8px] font-mono bg-zinc-800 text-zinc-400 px-1 py-0.5 rounded border border-card-border">
                v1.2
              </span>
            </div>
            <p className="text-[8px] text-zinc-500 font-mono tracking-widest uppercase">Forensic Directory</p>
          </div>
        </div>

        <div className="flex items-center space-x-4">
          <div className="flex items-center space-x-2 bg-background border border-card-border px-2 py-0.5 rounded">
            <span className="h-1.5 w-1.5 rounded-full bg-zinc-400"></span>
            <span className="text-[9px] font-mono text-zinc-400 uppercase tracking-wide">Ready</span>
          </div>
          <button
            onClick={() => {
              localStorage.removeItem("wiq_logged_in");
              setIsLoggedIn(false);
            }}
            className="text-[10px] text-zinc-400 hover:text-zinc-200 border border-card-border px-2.5 py-1 rounded bg-background transition-colors"
          >
            Lock Terminal
          </button>
        </div>
      </header>

      {/* Main Container */}
      <main className="flex-1 w-full px-8 py-8 flex flex-col justify-start">
        {error && (
          <div className="mb-6 border border-red-500/30 bg-red-500/5 p-4 rounded flex items-start space-x-3">
            <AlertTriangle className="h-4 w-4 text-red-accent shrink-0 mt-0.5" />
            <div>
              <h3 className="font-semibold text-red-200 text-xs uppercase tracking-wider font-mono">System Offline</h3>
              <p className="text-[11px] text-red-400/80 mt-1">{error}</p>
              <button 
                onClick={fetchCases} 
                className="mt-2 text-[9px] bg-card-bg border border-card-border text-zinc-300 px-2 py-1 rounded font-mono transition-colors"
              >
                Retry Link
              </button>
            </div>
          </div>
        )}

        {/* Action Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-card-border pb-6 mb-6">
          <div>
            <h2 className="text-xs font-bold tracking-wider text-zinc-300 uppercase font-mono">Case Directories</h2>
            <p className="text-[11px] text-zinc-550 mt-1">
              Select an ongoing investigation or run the simulation seeder below.
            </p>
          </div>
          <div className="flex items-center gap-2.5 shrink-0">
            <button
              onClick={handleLoadDemo}
              disabled={isSeeding}
              className="flex items-center space-x-1.5 bg-card-bg hover:bg-zinc-800 border border-card-border text-zinc-300 font-semibold text-xs px-3.5 py-1.5 rounded transition-all cursor-pointer"
            >
              <Cpu className={`h-3.5 w-3.5 text-brand-light ${isSeeding ? 'animate-spin' : ''}`} />
              <span>{isSeeding ? "Analyzing..." : "Seed Case Simulation"}</span>
            </button>
            <button
              onClick={handleLoadEnron}
              disabled={isLoadingEnron}
              className="flex items-center space-x-1.5 bg-card-bg hover:bg-zinc-800 border border-card-border text-zinc-300 font-semibold text-xs px-3.5 py-1.5 rounded transition-all cursor-pointer"
            >
              <Cpu className={`h-3.5 w-3.5 text-brand-light ${isLoadingEnron ? 'animate-spin' : ''}`} />
              <span>{isLoadingEnron ? "Loading..." : "Load Enron Case"}</span>
            </button>
            <button
              onClick={() => setShowModal(true)}
              className="flex items-center space-x-1.5 bg-zinc-100 hover:bg-white text-zinc-950 font-semibold text-xs px-3.5 py-1.5 rounded transition-colors cursor-pointer"
            >
              <Plus className="h-3.5 w-3.5" />
              <span>New Case</span>
            </button>
          </div>
        </div>

        {/* Cases Grid */}
        {loading ? (
          <div className="flex flex-col items-center justify-center py-20">
            <Loader2 className="h-5 w-5 text-zinc-600 animate-spin" />
            <p className="text-zinc-550 text-[9px] mt-2 font-mono uppercase tracking-widest">Querying Directory...</p>
          </div>
        ) : (
          <div>
            {cases.length === 0 ? (
              <div className="text-center py-16 border border-dashed border-card-border rounded bg-card-bg/20">
                <FolderOpen className="h-6 w-6 text-zinc-700 mx-auto mb-2" />
                <h3 className="text-xs font-semibold text-zinc-400">Empty Directory</h3>
                <p className="text-[10px] text-zinc-500 mt-1 max-w-[240px] mx-auto leading-relaxed">
                  Start by initializing a new investigation file or seeding the default case.
                </p>
              </div>
            ) : (
              <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {cases.map((c) => (
                  <div
                    key={c.id}
                    onClick={() => router.push(`/cases/${c.id}`)}
                    className="group border border-card-border bg-card-bg/30 hover:bg-card-bg/90 rounded p-4 cursor-pointer transition-all duration-150 flex flex-col justify-between"
                  >
                    <div>
                      <div className="flex items-center justify-between mb-3">
                        <span className="text-[9px] font-mono bg-[#0d1117] border border-card-border text-zinc-500 px-1.5 py-0.5 rounded">
                          C-{c.id.toString().padStart(3, '0')}
                        </span>
                        <span className={`inline-flex items-center text-[8px] font-mono px-1.5 py-0.5 rounded border ${
                          c.status === 'Active' 
                            ? 'bg-zinc-800/40 text-zinc-400 border-zinc-700' 
                            : 'bg-background text-zinc-650 border-card-border'
                        }`}>
                          {c.status}
                        </span>
                      </div>
                      <h3 className="font-bold text-zinc-300 group-hover:text-white text-xs transition-colors line-clamp-1">
                        {c.title}
                      </h3>
                      <p className="text-[11px] text-zinc-500 mt-1.5 line-clamp-3 leading-relaxed">
                        {c.description || "No description provided."}
                      </p>
                    </div>

                    <div className="mt-5 pt-3 border-t border-card-border/60 flex items-center justify-between">
                      <span className="text-[9px] text-zinc-600 font-mono">
                        Date: {new Date(c.created_at).toLocaleDateString()}
                      </span>
                      <div className="flex items-center space-x-3">
                        <span className="text-[9px] text-zinc-500 group-hover:text-brand-light transition-colors flex items-center space-x-1 font-mono uppercase">
                          <span>Open</span>
                          <ArrowRight className="h-2.5 w-2.5" />
                        </span>
                        <button
                          onClick={(e) => handleDeleteCase(c.id, e)}
                          className="text-zinc-600 hover:text-red-accent p-1 rounded hover:bg-red-500/5 transition-all cursor-pointer"
                          title="Purge Record"
                        >
                          <Trash2 className="h-3 w-3" />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </main>

      {/* Creation Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
          <div className="bg-card-bg border border-card-border rounded max-w-sm w-full p-5 shadow-xl">
            <div className="flex items-center space-x-2 mb-3.5 border-b border-card-border pb-2.5">
              <Layers className="h-4 w-4 text-zinc-400" />
              <h3 className="text-xs font-bold text-zinc-350 uppercase tracking-wider font-mono">Initialize Case</h3>
            </div>
            
            <form onSubmit={handleCreateCase} className="space-y-3.5">
              <div>
                <label className="block text-[8px] font-mono text-zinc-500 uppercase tracking-widest mb-1.5">Case Title</label>
                <input
                  type="text"
                  required
                  placeholder="Ex: Industrial Incident 04"
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  className="w-full bg-background border border-card-border rounded py-1.5 px-2.5 text-xs text-zinc-200 focus:outline-none transition-colors"
                />
              </div>

              <div>
                <label className="block text-[8px] font-mono text-zinc-500 uppercase tracking-widest mb-1.5">Overview / Context</label>
                <textarea
                  placeholder="Briefly state target scope..."
                  value={newDesc}
                  rows={3}
                  onChange={(e) => setNewDesc(e.target.value)}
                  className="w-full bg-background border border-card-border rounded py-1.5 px-2.5 text-xs text-zinc-200 focus:outline-none transition-colors resize-none"
                />
              </div>

              <div className="flex items-center justify-end space-x-2.5 pt-2 border-t border-card-border">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="text-[10px] text-zinc-400 hover:text-white px-2.5 py-1 rounded border border-card-border bg-background"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="text-[10px] bg-zinc-100 hover:bg-white text-zinc-950 font-semibold px-3.5 py-1 rounded cursor-pointer"
                >
                  Create
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
