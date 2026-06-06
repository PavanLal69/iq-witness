"use client";

import React, { useState, useEffect, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import { 
  Shield, ArrowLeft, Loader2, Upload, FileText, Video, Music, MessageSquare, 
  Network, Download, RefreshCw, AlertCircle, FileCheck, Layers
} from "lucide-react";
import { getCase, getTimeline, getEntities, getRelationships } from "@/lib/firestore";

export default function CaseDetail() {
  const params = useParams();
  const router = useRouter();
  const caseId = params.id;

  const [activeTab, setActiveTab] = useState("locker"); // locker, timeline, graph, reports, audit
  const [caseDetails, setCaseDetails] = useState<any>(null);
  const [timeline, setTimeline] = useState<any[]>([]);
  const [graphData, setGraphData] = useState<{ nodes: any[]; links: any[] }>({ nodes: [], links: [] });
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  
  // File upload state
  const [uploadFiles, setUploadFiles] = useState<File[]>([]);
  const [uploadProgress, setUploadProgress] = useState<{ [name: string]: number }>({});
  
  // Report generation state
  const [reportType, setReportType] = useState("police");
  const [customNotes, setCustomNotes] = useState("");
  const [generatingReport, setGeneratingReport] = useState(false);
  
  // Graph interaction state
  const [nodes, setNodes] = useState<any[]>([]);
  const [links, setLinks] = useState<any[]>([]);
  const [selectedNode, setSelectedNode] = useState<any>(null);
  const [draggedNodeId, setDraggedNodeId] = useState<number | null>(null);
  const svgRef = useRef<SVGSVGElement>(null);

  // Playback Simulation state
  const [isPlaying, setIsPlaying] = useState(false);
  const [activePlaybackIndex, setActivePlaybackIndex] = useState<number | null>(null);
  const [playbackSpeed, setPlaybackSpeed] = useState(3000); // ms per step (1x: 4000, 2x: 2000, 4x: 1000)

  // Create Connection State
  const [newLinkTargetId, setNewLinkTargetId] = useState("");
  const [newLinkLabel, setNewLinkLabel] = useState("");

  const isEntityMentioned = (entityLabel: string, event: any) => {
    if (!event) return false;
    const labelLower = entityLabel.toLowerCase();
    const descLower = (event.description || "").toLowerCase();
    const titleLower = (event.title || "").toLowerCase();
    return descLower.includes(labelLower) || titleLower.includes(labelLower);
  };

  useEffect(() => {
    if (caseId) {
      fetchCaseData();
    }
  }, [caseId]);

  // Playback Simulation Interval
  useEffect(() => {
    if (!isPlaying) return;
    if (timeline.length === 0) return;

    if (activePlaybackIndex === null) {
      setActivePlaybackIndex(0);
    }

    const interval = setInterval(() => {
      setActivePlaybackIndex((prev) => {
        if (prev === null || prev >= timeline.length - 1) {
          return 0; // loop back to start
        }
        return prev + 1;
      });
    }, playbackSpeed);

    return () => clearInterval(interval);
  }, [isPlaying, timeline.length, playbackSpeed, activePlaybackIndex]);

  // Force-Directed Physics Graph Loop
  useEffect(() => {
    if (activeTab !== "graph" || nodes.length === 0) return;

    let animFrameId: number;

    const tick = () => {
      setNodes((prevNodes) => {
        if (prevNodes.length === 0) return prevNodes;

        const updatedNodes = prevNodes.map(node => ({ ...node }));

        // 1. Repulsion
        for (let i = 0; i < updatedNodes.length; i++) {
          const n1 = updatedNodes[i];
          for (let j = 0; j < updatedNodes.length; j++) {
            if (i === j) continue;
            const n2 = updatedNodes[j];
            const dx = n1.x - n2.x;
            const dy = n1.y - n2.y;
            const dist = Math.sqrt(dx * dx + dy * dy) || 1.0;
            
            if (dist < 180) {
              const force = (180 - dist) * 0.05;
              n1.vx += (dx / dist) * force;
              n1.vy += (dy / dist) * force;
            }
          }
        }

        // 2. Attraction
        links.forEach(link => {
          const sNode = updatedNodes.find(n => n.id === link.source);
          const tNode = updatedNodes.find(n => n.id === link.target);
          if (sNode && tNode) {
            const dx = tNode.x - sNode.x;
            const dy = tNode.y - sNode.y;
            const dist = Math.sqrt(dx * dx + dy * dy) || 1.0;
            const targetLen = 160;
            const force = (dist - targetLen) * 0.02;
            
            sNode.vx += (dx / dist) * force;
            sNode.vy += (dy / dist) * force;
            tNode.vx -= (dx / dist) * force;
            tNode.vy -= (dy / dist) * force;
          }
        });

        // 3. Gravity and damping
        const centerX = 450;
        const centerY = 250;
        
        updatedNodes.forEach(node => {
          if (node.id === draggedNodeId) {
            node.vx = 0;
            node.vy = 0;
            return;
          }

          node.vx += (centerX - node.x) * 0.004;
          node.vy += (centerY - node.y) * 0.004;

          node.vx *= 0.84;
          node.vy *= 0.84;

          node.x += node.vx;
          node.y += node.vy;

          node.x = Math.max(50, Math.min(850, node.x));
          node.y = Math.max(50, Math.min(450, node.y));
        });

        return updatedNodes;
      });

      animFrameId = requestAnimationFrame(tick);
    };

    animFrameId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(animFrameId);
  }, [activeTab, links, draggedNodeId]);

  const fetchCaseData = async () => {
    setLoading(true);
    try {
      // Fetch from Firebase directly (much faster)
      const caseData = await getCase(caseId as string);
      if (!caseData) throw new Error("Case not found");
      
      setCaseDetails({
        id: caseData.id,
        title: caseData.title,
        description: caseData.description || "",
        status: caseData.status,
        created_at: caseData.created_at,
        updated_at: caseData.updated_at,
        evidence: [] // Firebase doesn't store evidence directly, will be fetched separately
      });

      // Fetch timeline events from Firebase
      const timelineData = await getTimeline(caseId as string);
      setTimeline(Array.isArray(timelineData) ? timelineData : []);

      // Fetch entities from Firebase
      const entitiesData = await getEntities(caseId as string);
      
      // Fetch relationships
      const relationshipsData = await getRelationships(caseId as string);
      
      // Build graph data from entities and relationships
      const gData = {
        nodes: entitiesData.map((e: any) => ({
          id: e.id,
          label: e.name,
          type: e.type,
          details: e.details
        })),
        links: relationshipsData.map((r: any) => ({
          id: r.id,
          source: r.source_id,
          target: r.target_id,
          label: r.relation_type
        }))
      };
      
      setGraphData(gData);
      updateGraphPositions(gData.nodes, gData.links);

    } catch (err) {
      console.error("Error fetching case data from Firebase:", err);
      setTimeline([]);
      setGraphData({ nodes: [], links: [] });
      setNodes([]);
      setLinks([]);
    } finally {
      setLoading(false);
    }
  };

  const updateGraphPositions = (rawNodes: any[], rawLinks: any[]) => {
    if (!Array.isArray(rawNodes) || !Array.isArray(rawLinks)) {
      setNodes([]);
      setLinks([]);
      return;
    }

    const width = 900;
    const height = 500;
    setNodes(prevNodes => {
      return rawNodes.map((node, index) => {
        const existing = prevNodes.find(n => n.id === node.id);
        if (existing) {
          return { ...node, x: existing.x, y: existing.y, vx: existing.vx, vy: existing.vy };
        } else {
          const angle = (index / rawNodes.length) * 2 * Math.PI;
          const x = width / 2 + 250 * Math.cos(angle);
          const y = height / 2 + 180 * Math.sin(angle);
          return { ...node, x, y, vx: 0, vy: 0 };
        }
      });
    });
    setLinks(rawLinks || []);
  };

  const handleProcessEvidence = async () => {
    setProcessing(true);
    try {
      const res = await fetch(`/api/cases/${caseId}/process`, {
        method: "POST"
      });
      if (!res.ok) throw new Error("Processing failed");
      await fetchCaseData();
    } catch (err) {
      alert("Error processing evidence. Verify backend console.");
    } finally {
      setProcessing(false);
    }
  };

  const handleCreateConnection = async () => {
    if (!selectedNode || !newLinkTargetId || !newLinkLabel.trim()) return;
    
    try {
      const res = await fetch(`/api/cases/${caseId}/relationships`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          source_id: selectedNode.id,
          target_id: parseInt(newLinkTargetId),
          relation_type: newLinkLabel.trim(),
          details: `Manually established connection from ${selectedNode.label} to ${nodes.find(n => n.id === parseInt(newLinkTargetId))?.label || 'target'}.`
        })
      });
      
      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.detail || "Link failed");
      }
      
      setNewLinkTargetId("");
      setNewLinkLabel("");
      
      await fetchCaseData();
    } catch (err: any) {
      alert(`Connection failed: ${err.message}`);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      setUploadFiles(Array.from(e.target.files));
    }
  };

  const handleUploadSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (uploadFiles.length === 0) return;

    const uploadPromises = uploadFiles.map(async (file) => {
      const formData = new FormData();
      formData.append("file", file);

      setUploadProgress(prev => ({ ...prev, [file.name]: 10 }));
      
      const interval = setInterval(() => {
        setUploadProgress(prev => {
          const current = prev[file.name] || 10;
          if (current >= 90) {
            clearInterval(interval);
            return prev;
          }
          return { ...prev, [file.name]: current + 20 };
        });
      }, 120);

      try {
        const res = await fetch(`/api/cases/${caseId}/upload`, {
          method: "POST",
          body: formData
        });
        
        clearInterval(interval);
        if (!res.ok) throw new Error("Upload failed");
        
        setUploadProgress(prev => ({ ...prev, [file.name]: 100 }));
        return true;
      } catch (err) {
        clearInterval(interval);
        setUploadProgress(prev => ({ ...prev, [file.name]: -1 }));
        return false;
      }
    });

    const results = await Promise.all(uploadPromises);
    const allSuccessful = results.every(res => res === true);

    setTimeout(async () => {
      setUploadFiles([]);
      setUploadProgress({});
      await fetchCaseData();
      
      if (allSuccessful) {
        await handleProcessEvidence();
      } else {
        alert("Some files failed to upload. Please try again.");
      }
    }, 800);
  };

  const handleDownloadReport = async (format: "pdf" | "docx") => {
    setGeneratingReport(true);
    try {
      const res = await fetch(`/api/cases/${caseId}/reports/${format}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          report_type: reportType,
          custom_notes: customNotes
        })
      });

      if (!res.ok) throw new Error("Report generation failed");
      
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      
      const isHtmlResponse = res.headers.get("content-type")?.includes("text/html");
      const ext = isHtmlResponse ? "html" : format;
      
      a.download = `WitnessIQ_Report_Case_${caseId}.${ext}`;
      document.body.appendChild(a);
      a.click();
      a.remove();
    } catch (err) {
      alert("Failed to export report.");
    } finally {
      setGeneratingReport(false);
    }
  };

  const handleNodeMouseDown = (id: number) => {
    setDraggedNodeId(id);
  };

  const handleSvgMouseMove = (e: React.MouseEvent<SVGSVGElement>) => {
    if (draggedNodeId === null || !svgRef.current) return;
    
    const rect = svgRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    setNodes(prev => prev.map(node => {
      if (node.id === draggedNodeId) {
        return { ...node, x, y };
      }
      return node;
    }));
  };

  const handleSvgMouseUp = () => {
    setDraggedNodeId(null);
  };

  const getNodeBorderColor = (type: string) => {
    switch(type) {
      case "person": return "#52525b"; // Muted zinc
      case "vehicle": return "#d29922"; // Amber
      case "location": return "#3fb950"; // Green
      case "organization": return "#58a6ff"; // Blue
      case "phone": return "#21262d"; // Gray
      case "email": return "#f85149"; // Red
      default: return "#30363d";
    }
  };

  const getMonoTypeTag = (type: string) => {
    switch (type) {
      case "video": return "VID";
      case "audio": return "AUD";
      case "chat": return "MSG";
      case "pdf": return "PDF";
      default: return "DOC";
    }
  };

  const getSourceIcon = (type: string) => {
    switch (type) {
      case "video": return <Video className="h-3.5 w-3.5 text-brand-light" />;
      case "audio": return <Music className="h-3.5 w-3.5 text-zinc-400" />;
      case "chat": return <MessageSquare className="h-3.5 w-3.5 text-green-accent" />;
      default: return <FileText className="h-3.5 w-3.5 text-zinc-500" />;
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center">
        <Loader2 className="h-5 w-5 text-zinc-600 animate-spin mb-2" />
        <p className="text-zinc-650 font-mono text-[9px] uppercase tracking-widest">Accessing File Vault...</p>
      </div>
    );
  }

  if (!caseDetails) return null;

  return (
    <div className="min-h-screen flex flex-col bg-background">
      {/* Header bar */}
      <header className="border-b border-card-border bg-card-bg px-8 py-3 flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <button
            onClick={() => router.push("/")}
            className="flex items-center space-x-1 text-xs text-zinc-450 hover:text-white border border-card-border bg-background px-2.5 py-1 rounded transition-all cursor-pointer"
          >
            <ArrowLeft className="h-3 w-3" />
            <span>Files</span>
          </button>
          <div className="h-5 w-px bg-card-border"></div>
          <div>
            <div className="flex items-center space-x-2.5">
              <h1 className="text-xs font-bold text-zinc-200 font-mono uppercase tracking-wide">{caseDetails.title}</h1>
              <span className="text-[9px] font-mono bg-background text-zinc-500 px-1.5 py-0.5 rounded border border-card-border">
                C-{caseDetails.id.toString().padStart(3, '0')}
              </span>
            </div>
            <p className="text-[11px] text-zinc-500 line-clamp-1 max-w-[500px]">{caseDetails.description}</p>
          </div>
        </div>

        <div className="flex items-center space-x-3">
          <button
            onClick={handleProcessEvidence}
            disabled={processing || caseDetails.evidence.length === 0}
            className="flex items-center space-x-2 bg-zinc-100 hover:bg-white disabled:bg-zinc-800 disabled:text-zinc-600 disabled:border-zinc-850 border border-zinc-300 text-zinc-950 font-semibold text-xs px-3.5 py-1.5 rounded shadow-sm transition-all cursor-pointer"
          >
            {processing ? (
              <>
                <Loader2 className="h-3 w-3 animate-spin" />
                <span>Processing...</span>
              </>
            ) : (
              <>
                <RefreshCw className="h-3.5 w-3.5" />
                <span>Reconstruct Case</span>
              </>
            )}
          </button>
        </div>
      </header>

      {/* Main Container */}
      <div className="flex-1 flex flex-col md:flex-row">
        {/* Navigation Sidebar */}
        <aside className="w-full md:w-56 border-r border-card-border bg-sidebar-bg p-4 flex flex-col justify-between">
          <div className="space-y-1">
            <button
              onClick={() => setActiveTab("locker")}
              className={`w-full flex items-center justify-between px-3 py-2 rounded text-xs font-semibold transition-all ${
                activeTab === "locker" 
                  ? "bg-card-bg text-white border border-card-border" 
                  : "text-zinc-500 hover:bg-card-bg/50 hover:text-zinc-300"
              }`}
            >
              <div className="flex items-center space-x-2">
                <Layers className="h-3.5 w-3.5" />
                <span>Evidence Locker</span>
              </div>
              <span className="bg-background px-1.5 py-0.5 rounded text-[10px] font-mono border border-card-border text-zinc-500">
                {caseDetails.evidence.length}
              </span>
            </button>

            <button
              onClick={() => setActiveTab("timeline")}
              disabled={timeline.length === 0}
              className={`w-full flex items-center justify-between px-3 py-2 rounded text-xs font-semibold transition-all ${
                timeline.length === 0 ? "opacity-30 cursor-not-allowed" : "cursor-pointer"
              } ${
                activeTab === "timeline" 
                  ? "bg-card-bg text-white border border-card-border" 
                  : "text-zinc-500 hover:bg-card-bg/50 hover:text-zinc-300"
              }`}
            >
              <div className="flex items-center space-x-2">
                <FileText className="h-3.5 w-3.5" />
                <span>Chronology Stream</span>
              </div>
              <span className="bg-background px-1.5 py-0.5 rounded text-[10px] font-mono border border-card-border text-zinc-500">
                {timeline.length}
              </span>
            </button>

            <button
              onClick={() => setActiveTab("graph")}
              disabled={nodes.length === 0}
              className={`w-full flex items-center justify-between px-3 py-2 rounded text-xs font-semibold transition-all ${
                nodes.length === 0 ? "opacity-30 cursor-not-allowed" : "cursor-pointer"
              } ${
                activeTab === "graph" 
                  ? "bg-card-bg text-white border border-card-border" 
                  : "text-zinc-500 hover:bg-card-bg/50 hover:text-zinc-300"
              }`}
            >
              <div className="flex items-center space-x-2">
                <Network className="h-3.5 w-3.5" />
                <span>Relationship Board</span>
              </div>
              <span className="bg-background px-1.5 py-0.5 rounded text-[10px] font-mono border border-card-border text-zinc-500">
                {nodes.length}
              </span>
            </button>

            <button
              onClick={() => setActiveTab("reports")}
              disabled={timeline.length === 0}
              className={`w-full flex items-center justify-between px-3 py-2 rounded text-xs font-semibold transition-all ${
                timeline.length === 0 ? "opacity-30 cursor-not-allowed" : "cursor-pointer"
              } ${
                activeTab === "reports" 
                  ? "bg-card-bg text-white border border-card-border" 
                  : "text-zinc-500 hover:bg-card-bg/50 hover:text-zinc-300"
              }`}
            >
              <div className="flex items-center space-x-2">
                <FileCheck className="h-3.5 w-3.5" />
                <span>Report Exporter</span>
              </div>
            </button>

            <button
              onClick={() => setActiveTab("audit")}
              className={`w-full flex items-center justify-between px-3 py-2 rounded text-xs font-semibold transition-all ${
                activeTab === "audit" 
                  ? "bg-card-bg text-white border border-card-border" 
                  : "text-zinc-500 hover:bg-card-bg/50 hover:text-zinc-300"
              }`}
            >
              <div className="flex items-center space-x-2">
                <Shield className="h-3.5 w-3.5" />
                <span>Audit Trail</span>
              </div>
              <span className="bg-background px-1.5 py-0.5 rounded text-[10px] font-mono border border-card-border text-zinc-500">
                {caseDetails.audit_logs.length}
              </span>
            </button>
          </div>
          <div className="border-t border-card-border pt-4 text-center">
            <span className="text-[9px] font-mono text-zinc-700 block">WITNESSIQ SECURE DIRECTORY</span>
          </div>
        </aside>

        {/* Workspace Display */}
        <main className="flex-1 bg-background p-6 overflow-y-auto">
          
          {/* TAB: EVIDENCE LOCKER */}
          {activeTab === "locker" && (
            <div className="space-y-6">
              <div className="grid md:grid-cols-4 gap-6 items-start">
                
                {/* Upload Form */}
                <div className="md:col-span-1 border border-card-border bg-card-bg rounded p-4">
                  <h3 className="text-[9px] font-bold text-zinc-400 uppercase tracking-widest mb-3.5 font-mono">Ingest Materials</h3>
                  <form onSubmit={handleUploadSubmit} className="space-y-4">
                    <div className="border border-dashed border-zinc-700 rounded p-5 text-center cursor-pointer transition-colors relative bg-background">
                      <input 
                        type="file" 
                        multiple 
                        onChange={handleFileChange}
                        className="absolute inset-0 opacity-0 cursor-pointer"
                      />
                      <Upload className="h-5 w-5 text-zinc-650 mx-auto mb-2" />
                      <p className="text-[11px] text-zinc-400">Drag files here or click to browse</p>
                      <p className="text-[9px] text-zinc-600 mt-1 font-mono">MP4, WAV, TXT, PDF, PNG</p>
                    </div>

                    {uploadFiles.length > 0 && (
                      <div className="space-y-2 max-h-36 overflow-y-auto pr-1">
                        {uploadFiles.map((file, i) => (
                          <div key={i} className="bg-background p-2 rounded border border-card-border text-[10px]">
                            <div className="flex justify-between font-mono mb-1 text-zinc-500">
                              <span className="truncate max-w-[120px]">{file.name}</span>
                              <span>{(file.size / 1024).toFixed(0)}KB</span>
                            </div>
                            {uploadProgress[file.name] !== undefined && (
                              <div className="w-full bg-zinc-800 h-1 rounded overflow-hidden">
                                <div 
                                  className={`h-full ${uploadProgress[file.name] === -1 ? 'bg-red-accent' : 'bg-zinc-400'}`}
                                  style={{ width: `${uploadProgress[file.name] === -1 ? 100 : uploadProgress[file.name]}%` }}
                                ></div>
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    )}

                    {uploadFiles.length > 0 && (
                      <button
                        type="submit"
                        className="w-full bg-zinc-100 hover:bg-white text-zinc-950 font-semibold py-1.5 rounded text-xs transition-colors"
                      >
                        Start Upload
                      </button>
                    )}
                  </form>
                </div>

                {/* Evidence Table */}
                <div className="md:col-span-3 border border-card-border bg-card-bg rounded p-5">
                  <div className="flex items-center justify-between mb-4 border-b border-card-border pb-3">
                    <h3 className="text-[9px] font-bold text-zinc-400 uppercase tracking-widest font-mono">Evidence Vault</h3>
                  </div>

                  {caseDetails.evidence.length === 0 ? (
                    <div className="text-center py-16 text-zinc-700">
                      <FileText className="h-8 w-8 mx-auto mb-2 text-zinc-800" />
                      <p className="text-xs font-mono">No evidence records uploaded.</p>
                    </div>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full text-left border-collapse">
                        <thead>
                          <tr className="border-b border-card-border text-zinc-500 font-mono text-[9px] uppercase tracking-wider">
                            <th className="pb-2.5 pl-2 w-16">Format</th>
                            <th className="pb-2.5">Source Identity</th>
                            <th className="pb-2.5 w-24 text-right">File Size</th>
                            <th className="pb-2.5 w-32 text-center">Index Status</th>
                            <th className="pb-2.5 pr-2">Analytical Extract Summary</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-zinc-900 text-xs font-mono">
                          {caseDetails.evidence.map((ev: any) => (
                            <tr key={ev.id} className="hover:bg-background transition-colors">
                              <td className="py-2.5 pl-2.5">
                                <span className="inline-flex text-[9px] font-bold text-zinc-400 bg-background border border-card-border px-1.5 py-0.5 rounded">
                                  {getMonoTypeTag(ev.file_type)}
                                </span>
                              </td>
                              <td className="py-2.5 font-bold text-zinc-300 max-w-[180px] truncate" title={ev.filename}>
                                {ev.filename}
                              </td>
                              <td className="py-2.5 text-right text-zinc-500 text-[11px] pr-2">
                                {(ev.file_size / 1024).toFixed(0)} KB
                              </td>
                              <td className="py-2.5 text-center">
                                <span className={`inline-flex items-center text-[8px] px-1.5 py-0.5 rounded border ${
                                  ev.status === 'Processed' ? 'bg-background text-zinc-400 border-card-border' :
                                  ev.status === 'Processing' ? 'bg-background text-brand-light border-brand' :
                                  'bg-background text-zinc-600 border-zinc-800'
                                }`}>
                                  {ev.status}
                                </span>
                              </td>
                              <td className="py-2.5 pr-2 text-zinc-500 line-clamp-1 italic max-w-[320px]" title={ev.summary}>
                                {ev.summary || "Pending reconstruction..."}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>

              </div>
            </div>
          )}

          {/* TAB: TIMELINE EXPLORER */}
          {activeTab === "timeline" && (
            <div className="border border-card-border bg-card-bg rounded p-6 w-full">
              <h3 className="text-[9px] font-bold text-zinc-400 uppercase tracking-widest mb-6 border-b border-card-border pb-3 font-mono">
                Reconstructed Chronology
              </h3>

              <div className="relative pl-6 border-l border-zinc-800 space-y-6">
                {timeline.map((event: any, index: number) => {
                  const dateObj = new Date(event.timestamp);
                  const formattedTime = dateObj.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false });
                  const isCorrelated = event.event_type === "correlated_activity";
                  const isPlaybackActive = activePlaybackIndex === index;

                  return (
                    <div key={event.id} className="relative">
                      {/* Quiet timeline node indicator */}
                      <span className={`absolute -left-[30px] top-1.5 h-2 w-2 rounded-full border border-background transition-all ${
                        isPlaybackActive ? 'bg-emerald-400 scale-125 animate-ping' : isCorrelated ? 'bg-brand-light' : 'bg-zinc-600'
                      }`}></span>

                      <div className={`p-4 rounded border transition-all ${
                        isPlaybackActive
                          ? 'bg-zinc-900 border-emerald-500 shadow-[0_0_15px_rgba(16,185,129,0.15)] scale-[1.01]'
                          : isCorrelated 
                            ? 'bg-background border-brand/40' 
                            : 'bg-background border-card-border hover:border-zinc-700'
                      }`}>
                        <div className="flex flex-wrap items-center justify-between gap-2 mb-2 font-mono text-[9px]">
                          <div className="flex items-center space-x-2.5">
                            <span className="font-semibold text-zinc-300">{formattedTime}</span>
                            <span className="text-zinc-700">|</span>
                            <span className="bg-card-bg px-1.5 py-0.5 rounded text-zinc-400 border border-card-border uppercase tracking-wider">
                              {event.event_type}
                            </span>
                          </div>
                          <div className="text-zinc-500 font-semibold uppercase">
                            MATCH SCORE: <span className="text-zinc-300">{Math.round(event.confidence * 100)}%</span>
                          </div>
                        </div>

                        <h4 className="font-bold text-zinc-200 text-xs">
                          {event.title}
                        </h4>

                        <p className="text-[11px] text-zinc-500 mt-2 leading-relaxed whitespace-pre-line pl-3 border-l border-card-border">
                          {event.description}
                        </p>

                        {event.evidence_sources && event.evidence_sources.length > 0 && (
                          <div className="mt-3.5 pt-2.5 border-t border-card-border flex flex-wrap gap-1.5 items-center">
                            <span className="text-[8px] text-zinc-600 font-mono uppercase">Source Index:</span>
                            {event.evidence_sources.map((s: any) => (
                              <span key={s.id} className="inline-flex items-center bg-card-bg border border-card-border px-1.5 py-0.5 rounded text-[9px] text-zinc-500 font-mono">
                                {s.filename}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Playback Controls Panel */}
              <div className="border border-card-border bg-card-bg rounded p-4 mt-6 flex items-center justify-between font-mono text-xs">
                <div className="flex items-center space-x-3">
                  <button
                    onClick={() => {
                      if (activePlaybackIndex === null) {
                        setActivePlaybackIndex(0);
                      }
                      setIsPlaying(!isPlaying);
                    }}
                    className="bg-zinc-100 hover:bg-white text-zinc-950 font-bold px-3 py-1.5 rounded transition-colors"
                  >
                    {isPlaying ? "Pause Simulation" : "Start Simulation"}
                  </button>
                  <button
                    onClick={() => {
                      setIsPlaying(false);
                      setActivePlaybackIndex(null);
                    }}
                    className="text-zinc-400 hover:text-white px-2 py-1.5 border border-card-border rounded bg-background transition-colors"
                  >
                    Reset
                  </button>
                  <span className="text-zinc-500 font-semibold">
                    Step: {activePlaybackIndex !== null ? activePlaybackIndex + 1 : 0} / {timeline.length}
                  </span>
                </div>
                
                {/* Scrubber */}
                <div className="flex-1 mx-6">
                  <input
                    type="range"
                    min={0}
                    max={timeline.length - 1}
                    value={activePlaybackIndex || 0}
                    onChange={(e) => {
                      setIsPlaying(false);
                      setActivePlaybackIndex(parseInt(e.target.value));
                    }}
                    className="w-full h-1 bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-emerald-400"
                  />
                </div>
                
                {/* Speed Selectors */}
                <div className="flex items-center space-x-1">
                  <button
                    onClick={() => setPlaybackSpeed(4000)}
                    className={`px-2 py-1 rounded text-[10px] ${playbackSpeed === 4000 ? 'bg-zinc-800 text-emerald-405 border border-card-border' : 'text-zinc-500 hover:text-zinc-350'}`}
                  >
                    1x
                  </button>
                  <button
                    onClick={() => setPlaybackSpeed(2000)}
                    className={`px-2 py-1 rounded text-[10px] ${playbackSpeed === 2000 ? 'bg-zinc-800 text-emerald-405 border border-card-border' : 'text-zinc-500 hover:text-zinc-350'}`}
                  >
                    2x
                  </button>
                  <button
                    onClick={() => setPlaybackSpeed(1000)}
                    className={`px-2 py-1 rounded text-[10px] ${playbackSpeed === 1000 ? 'bg-zinc-800 text-emerald-405 border border-card-border' : 'text-zinc-500 hover:text-zinc-350'}`}
                  >
                    4x
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* TAB: RELATION GRAPH (no transparency, no glassmorphism) */}
          {activeTab === "graph" && (
            <div className="border border-card-border bg-card-bg rounded p-5 flex flex-col h-[600px] w-full">
              <div className="border-b border-card-border pb-3 mb-4 flex items-center justify-between">
                <div>
                  <h3 className="text-[9px] font-bold text-zinc-400 uppercase tracking-widest font-mono">Entity Association Map</h3>
                  <p className="text-[10px] text-zinc-600 mt-0.5 font-mono">DRAG NODES TO ORGANIZE. CLICK CARD TO INSPECT LINKS.</p>
                </div>
                {selectedNode && (
                  <button 
                    onClick={() => setSelectedNode(null)}
                    className="text-[9px] text-brand-light hover:underline font-mono uppercase"
                  >
                    Clear Select
                  </button>
                )}
              </div>

              <div className="flex-1 flex flex-col md:flex-row gap-5 relative">
                {/* SVG Graph Canvas with Dot Grid */}
                <div className="flex-1 grid-bg rounded border border-card-border overflow-hidden min-h-[300px] relative">
                  <svg
                    ref={svgRef}
                    className="w-full h-full cursor-crosshair select-none"
                    onMouseMove={handleSvgMouseMove}
                    onMouseUp={handleSvgMouseUp}
                    onMouseLeave={handleSvgMouseUp}
                  >
                    {/* Render Lines */}
                    {links.map((link) => {
                      const sNode = nodes.find(n => n.id === link.source);
                      const tNode = nodes.find(n => n.id === link.target);
                      if (!sNode || !tNode) return null;
                      
                      const isHighlighted = selectedNode && (selectedNode.id === sNode.id || selectedNode.id === tNode.id);
                      const midX = (sNode.x + tNode.x) / 2;
                      const pathData = `M ${sNode.x} ${sNode.y} C ${midX} ${sNode.y}, ${midX} ${tNode.y}, ${tNode.x} ${tNode.y}`;

                      return (
                        <g key={link.id}>
                          <path
                            d={pathData}
                            fill="none"
                            stroke={isHighlighted ? "#58a6ff" : "#21262d"}
                            strokeWidth={isHighlighted ? 1.5 : 1}
                            className="transition-colors"
                          />
                          <text
                            x={midX}
                            y={(sNode.y + tNode.y) / 2 - 4}
                            fill={isHighlighted ? "#58a6ff" : "#30363d"}
                            fontSize="8"
                            fontFamily="monospace"
                            textAnchor="middle"
                          >
                            {link.label}
                          </text>
                        </g>
                      );
                    })}

                    {/* Render Node Rectangles */}
                    {nodes.map((node) => {
                      const isSelected = selectedNode && selectedNode.id === node.id;
                      const cardW = 120;
                      const cardH = 34;
                      const color = getNodeBorderColor(node.type);

                      const activeEvent = activePlaybackIndex !== null ? timeline[activePlaybackIndex] : null;
                      const isMentioned = activePlaybackIndex !== null && activeEvent && isEntityMentioned(node.label, activeEvent);
                      const strokeColor = isMentioned ? "#10b981" : isSelected ? "#58a6ff" : "#21262d";
                      const strokeW = isMentioned ? 2 : isSelected ? 1.5 : 1;
                      const classNameVal = `transition-colors hover:fill-zinc-900 ${isMentioned ? 'animate-pulse' : ''}`;

                      return (
                        <g
                          key={node.id}
                          transform={`translate(${node.x - cardW / 2}, ${node.y - cardH / 2})`}
                          onMouseDown={() => {
                            handleNodeMouseDown(node.id);
                            setSelectedNode(node);
                          }}
                        >
                          <rect
                            width={cardW}
                            height={cardH}
                            rx="1"
                            ry="1"
                            fill="#0d1117"
                            stroke={strokeColor}
                            strokeWidth={strokeW}
                            className={classNameVal}
                          />
                          
                          {/* Accent left line */}
                          <line
                            x1="0"
                            y1="0"
                            x2="0"
                            y2={cardH}
                            stroke={color}
                            strokeWidth="3.5"
                          />

                          <text
                            x="8"
                            y="13"
                            fill="#8b949e"
                            fontSize="8"
                            fontFamily="monospace"
                            fontWeight="bold"
                            className="pointer-events-none uppercase tracking-wide"
                          >
                            {node.type}
                          </text>
                          <text
                            x="8"
                            y="25"
                            fill="#e6edf3"
                            fontSize="9"
                            fontFamily="sans-serif"
                            fontWeight="500"
                            className="pointer-events-none truncate"
                          >
                            {node.label.length > 18 ? node.label.substring(0, 16) + '..' : node.label}
                          </text>
                        </g>
                      );
                    })}
                  </svg>
                </div>

                {/* Selected Entity Inspector Panel */}
                <div className="w-full md:w-56 bg-background border border-card-border rounded p-4 flex flex-col justify-between">
                  {selectedNode ? (
                    <div>
                      <div className="flex items-center space-x-1.5 border-b border-card-border pb-2 mb-3">
                        <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: getNodeBorderColor(selectedNode.type) }}></span>
                        <span className="text-[8px] font-mono uppercase tracking-wider text-zinc-500">{selectedNode.type}</span>
                      </div>
                      
                      <h4 className="font-bold text-zinc-300 text-xs font-mono">{selectedNode.label}</h4>
                      <p className="text-[10px] text-zinc-500 mt-2 leading-relaxed bg-card-bg p-2.5 rounded border border-card-border">{selectedNode.details || "No supplementary metadata."}</p>
                      
                      <div className="mt-4 pt-3 border-t border-card-border">
                        <h5 className="text-[8px] font-bold uppercase font-mono text-zinc-600 mb-2">Associations</h5>
                        <ul className="space-y-1.5">
                          {links
                            .filter(l => l.source === selectedNode.id || l.target === selectedNode.id)
                            .map(l => {
                              const otherId = l.source === selectedNode.id ? l.target : l.source;
                              const otherNode = nodes.find(n => n.id === otherId);
                              if (!otherNode) return null;
                              return (
                                <li key={l.id} className="text-[9px] text-zinc-400 font-mono flex items-center justify-between border-b border-card-border pb-1">
                                  <span className="text-zinc-650">({l.label})</span>
                                  <span className="text-zinc-300 font-semibold">{otherNode.label}</span>
                                </li>
                              );
                            })}
                        </ul>
                      </div>

                      <div className="mt-4 pt-3 border-t border-card-border">
                        <h5 className="text-[8px] font-bold uppercase font-mono text-zinc-600 mb-2">Create Connection</h5>
                        <div className="space-y-2 mt-2">
                          <div>
                            <label className="block text-[7px] font-mono text-zinc-500 uppercase tracking-wider mb-1">Target Entity</label>
                            <select
                              value={newLinkTargetId}
                              onChange={(e) => setNewLinkTargetId(e.target.value)}
                              className="w-full bg-background border border-card-border rounded py-1 px-1.5 text-[10px] text-zinc-200 focus:outline-none focus:border-zinc-500"
                            >
                              <option value="">-- Select Target --</option>
                              {nodes
                                .filter(n => n.id !== selectedNode.id)
                                .map(n => (
                                  <option key={n.id} value={n.id}>
                                    {n.label} ({n.type.toUpperCase()})
                                  </option>
                                ))}
                            </select>
                          </div>

                          <div>
                            <label className="block text-[7px] font-mono text-zinc-500 uppercase tracking-wider mb-1">Relationship</label>
                            <input
                              type="text"
                              placeholder="e.g. partner, suspect_of"
                              value={newLinkLabel}
                              onChange={(e) => setNewLinkLabel(e.target.value)}
                              className="w-full bg-background border border-card-border rounded py-1 px-1.5 text-[10px] text-zinc-200 focus:outline-none focus:border-zinc-500 font-mono"
                            />
                          </div>

                          <button
                            onClick={handleCreateConnection}
                            disabled={!newLinkTargetId || !newLinkLabel.trim()}
                            className="w-full mt-1 flex items-center justify-center space-x-1 bg-zinc-100 hover:bg-white text-zinc-950 font-bold py-1 px-2 rounded text-[9px] cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed transition-all"
                          >
                            <Network className="h-3 w-3" />
                            <span>Link Entities</span>
                          </button>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center justify-center text-center h-full text-zinc-700 py-10 font-mono text-[9px] uppercase tracking-wide">
                      <p>Select node to inspect details.</p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* TAB: REPORTS ROOM */}
          {activeTab === "reports" && (
            <div className="grid md:grid-cols-4 gap-6 w-full">
              
              {/* Report Options Form */}
              <div className="md:col-span-1 border border-card-border bg-card-bg rounded p-4">
                <h3 className="text-[9px] font-bold text-zinc-400 uppercase tracking-widest mb-4 font-mono">Report Parameters</h3>
                <div className="space-y-4">
                  <div>
                    <label className="block text-[8px] font-mono text-zinc-500 uppercase tracking-widest mb-1.5">Target Template</label>
                    <select
                      value={reportType}
                      onChange={(e) => setReportType(e.target.value)}
                      className="w-full bg-background border border-card-border rounded py-1.5 px-2 text-xs text-zinc-200 focus:outline-none"
                    >
                      <option value="police">Police Complaint Summary</option>
                      <option value="insurance">Insurance Claim Summary</option>
                      <option value="hr">HR Investigation Report</option>
                      <option value="disciplinary">College Disciplinary Brief</option>
                      <option value="legal">Legal Evidence Brief</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-[8px] font-mono text-zinc-500 uppercase tracking-widest mb-1.5">Addendum Notes</label>
                    <textarea
                      placeholder="Add custom annotations to include in report output..."
                      value={customNotes}
                      rows={5}
                      onChange={(e) => setCustomNotes(e.target.value)}
                      className="w-full bg-background border border-card-border rounded py-1.5 px-2 text-xs text-zinc-200 focus:outline-none resize-none font-mono"
                    />
                  </div>

                  <div className="space-y-2 pt-2 border-t border-card-border">
                    <button
                      onClick={() => handleDownloadReport("pdf")}
                      disabled={generatingReport}
                      className="w-full flex items-center justify-center space-x-1.5 bg-zinc-100 hover:bg-white text-zinc-950 font-semibold py-1.5 rounded text-xs cursor-pointer transition-colors"
                    >
                      <Download className="h-3.5 w-3.5" />
                      <span>{generatingReport ? "Exporting..." : "Download PDF"}</span>
                    </button>
                    <button
                      onClick={() => handleDownloadReport("docx")}
                      disabled={generatingReport}
                      className="w-full flex items-center justify-center space-x-1.5 bg-background hover:bg-zinc-900 border border-card-border text-zinc-300 font-semibold py-1.5 rounded text-xs cursor-pointer transition-colors"
                    >
                      <FileText className="h-3.5 w-3.5" />
                      <span>Download DOCX</span>
                    </button>
                  </div>
                </div>
              </div>

              {/* Report Preview Panel */}
              <div className="md:col-span-3 border border-card-border bg-card-bg rounded p-5 flex flex-col h-[520px]">
                <div className="border-b border-card-border pb-2 mb-3.5 flex items-center justify-between">
                  <h3 className="text-[9px] font-bold text-zinc-400 uppercase tracking-widest font-mono">
                    Document Render Canvas
                  </h3>
                </div>
                
                <div className="flex-1 bg-white text-zinc-800 p-8 rounded shadow-sm overflow-y-auto border border-zinc-300 select-text font-serif text-[12px] leading-relaxed max-w-[720px] mx-auto w-full">
                  <div className="text-center font-bold tracking-widest text-red-600 border-b pb-2 mb-5 text-[9px] uppercase font-sans">
                    CONFIDENTIAL // FORENSIC INVESTIGATION BRIEF
                  </div>
                  
                  <h1 className="text-[16px] font-bold text-zinc-900 border-b border-zinc-300 pb-1.5 capitalize mb-4 font-sans">
                    {reportType} Incident Brief: {caseDetails.title}
                  </h1>

                  <div className="bg-zinc-50 p-3 border border-zinc-200 rounded mb-5 font-sans text-[10px] text-zinc-600">
                    <table className="w-full text-left border-collapse">
                      <tbody>
                        <tr>
                          <td className="font-bold text-zinc-400 w-1/4 pb-0.5">Case Reference:</td>
                          <td className="pb-0.5 font-mono text-zinc-900">CASE-{caseDetails.id.toString().padStart(3, '0')}</td>
                        </tr>
                        <tr>
                          <td className="font-bold text-zinc-400 pb-0.5">Date compiled:</td>
                          <td className="pb-0.5 text-zinc-900">{new Date(caseDetails.created_at).toLocaleDateString()}</td>
                        </tr>
                        <tr>
                          <td className="font-bold text-zinc-400">Context:</td>
                          <td className="text-zinc-900">
                            {reportType === "police" && "Criminal activity timeline mapping."}
                            {reportType === "insurance" && "Property damage/liability verification."}
                            {reportType === "hr" && "Workplace code of conduct audit."}
                            {reportType === "disciplinary" && "Student disciplinary council brief."}
                            {reportType === "legal" && "Litigation evidence packet."}
                          </td>
                        </tr>
                      </tbody>
                    </table>
                  </div>

                  <h3 className="font-bold text-zinc-900 text-[10px] border-b pb-0.5 mb-2 font-sans uppercase tracking-wide">Executive Summary</h3>
                  <p className="text-zinc-700 mb-5">
                    {caseDetails.description || "No description provided."}
                    {customNotes && (
                      <span className="block mt-2.5 pt-2.5 border-t border-dashed border-zinc-300 text-zinc-650 italic">
                        <strong>Analyst Addendum:</strong> {customNotes}
                      </span>
                    )}
                  </p>

                  <h3 className="font-bold text-zinc-900 text-[10px] border-b pb-0.5 mb-2.5 font-sans uppercase tracking-wide">Correlated Timeline</h3>
                  <div className="space-y-3.5 mb-5 font-sans text-[10px] text-zinc-700">
                    {timeline.map((ev) => (
                      <div key={ev.id} className="border-l border-zinc-300 pl-3 py-0.5">
                        <div className="text-[9px] font-mono font-bold text-zinc-450">{new Date(ev.timestamp).toLocaleTimeString()}</div>
                        <div className="font-bold text-zinc-800 text-[11px]">{ev.title}</div>
                        <div className="text-zinc-600 mt-0.5">{ev.description}</div>
                      </div>
                    ))}
                  </div>

                  <h3 className="font-bold text-zinc-900 text-[10px] border-b pb-0.5 mb-2.5 font-sans uppercase tracking-wide">Key Entities</h3>
                  <div className="flex flex-wrap gap-1.5 mb-5">
                    {nodes.map(n => (
                      <span key={n.id} className="inline-block bg-zinc-105 border border-zinc-250 px-2 py-0.5 rounded text-[10px] font-sans text-zinc-750">
                        <strong className="text-[8px] text-zinc-500 uppercase mr-1">{n.type}</strong>
                        {n.label}
                      </span>
                    ))}
                  </div>
                  
                  <div className="mt-10 text-[9px] text-zinc-400 border-t pt-3 font-sans italic leading-relaxed">
                    This document was compiled automatically using multi-source evidence synthesis technology by WitnessIQ.
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB: AUDIT LEDGER */}
          {activeTab === "audit" && (
            <div className="border border-card-border bg-card-bg rounded p-6 w-full">
              <h3 className="text-[9px] font-bold text-zinc-400 uppercase tracking-widest mb-6 border-b border-card-border pb-3 font-mono">
                System Activity Log
              </h3>

              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-card-border text-zinc-500 font-mono text-[9px] uppercase tracking-wider">
                      <th className="pb-2 w-1/4 font-semibold">Timestamp</th>
                      <th className="pb-2 w-1/4 font-semibold">Event Action</th>
                      <th className="pb-2 w-1/6 font-semibold">Operator</th>
                      <th className="pb-2 w-2/5 font-semibold">Parameters / Details</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-900/60 text-xs font-mono text-zinc-500">
                    {caseDetails.audit_logs.map((log: any) => (
                      <tr key={log.id} className="hover:bg-background/40">
                        <td className="py-2.5 text-zinc-400">{new Date(log.timestamp).toLocaleString()}</td>
                        <td className="py-2.5 font-bold text-zinc-350">{log.action}</td>
                        <td className="py-2.5 text-zinc-500">{log.performed_by}</td>
                        <td className="py-2.5 text-zinc-600">{log.details || "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

        </main>
      </div>
    </div>
  );
}
