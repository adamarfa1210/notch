import React, { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { FileText, File, X, Trash2, Plus, GripVertical, Pin } from "lucide-react";

export interface StagedItem {
  id: string;
  item_type: "text" | "image" | "fileuri";
  preview: string;
  data: string;
  mime: string;
  created_at: number;
}

const HTTP_API = "http://127.0.0.1:49152";

// Safe Electron & webUtils extraction
let ipcRenderer: any = null;
let webUtils: any = null;
if (typeof window !== "undefined" && (window as any).require) {
  try {
    const electron = (window as any).require("electron");
    ipcRenderer = electron.ipcRenderer;
    webUtils = electron.webUtils;
    console.log("[Notch] Electron IPC & webUtils initialized.");
  } catch (e) {
    console.warn("[Notch] Electron modules unavailable:", e);
  }
}

export default function App() {
  const [isExpanded, setIsExpanded] = useState(false);
  const [isPinned, setIsPinned] = useState(false);
  const [isDraggingOut, setIsDraggingOut] = useState(false);
  const [items, setItems] = useState<StagedItem[]>([]);
  const leaveTimeoutRef = useRef<any>(null);

  // 1. Initial Data Fetch & Polling
  useEffect(() => {
    fetchFromHttp();
    const interval = setInterval(fetchFromHttp, 400);
    return () => clearInterval(interval);
  }, []);

  async function fetchFromHttp() {
    try {
      const res = await fetch(`${HTTP_API}/api/items`);
      if (res.ok) {
        const data = await res.json();
        setItems(data);
      }
    } catch {
      // Backend offline or starting
    }
  }

  // 2. Expand / Collapse Window States
  const expandNotch = () => {
    if (leaveTimeoutRef.current) {
      clearTimeout(leaveTimeoutRef.current);
      leaveTimeoutRef.current = null;
    }
    setIsExpanded(true);
    if (ipcRenderer) {
      ipcRenderer.send("set-notch-state", "expanded");
    }
  };

  const collapseNotch = (force = false) => {
    if (!force && (isPinned || isDraggingOut)) {
      return;
    }
    if (leaveTimeoutRef.current) {
      clearTimeout(leaveTimeoutRef.current);
      leaveTimeoutRef.current = null;
    }
    setIsExpanded(false);
    if (ipcRenderer) {
      ipcRenderer.send("set-notch-state", "collapsed");
    }
  };

  // 3. Mouse & Drag Handlers
  const handleMouseEnter = () => {
    expandNotch();
  };

  const handleMouseLeave = () => {
    if (isDraggingOut || isPinned) return;
    if (leaveTimeoutRef.current) clearTimeout(leaveTimeoutRef.current);
    leaveTimeoutRef.current = setTimeout(() => {
      collapseNotch();
    }, 300);
  };

  const handleDragEnter = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    expandNotch();
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    e.dataTransfer.dropEffect = "copy";
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();

    // 1. Files dropped in (Ingress)
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const files = Array.from(e.dataTransfer.files);
      for (const file of files) {
        let filePath = "";
        // Modern Electron: webUtils.getPathForFile gives exact physical path
        if (webUtils && typeof webUtils.getPathForFile === "function") {
          try {
            filePath = webUtils.getPathForFile(file);
          } catch (err) {
            console.warn("[Notch] webUtils error:", err);
          }
        }
        if (!filePath) {
          filePath = (file as any).path || file.name;
        }
        console.log("[Notch Ingress] File resolved to:", filePath);
        await postItem("file", filePath);
      }
      fetchFromHttp();
      return;
    }

    // 2. Text / URI dropped in
    const textData = e.dataTransfer.getData("text/plain");
    if (textData && textData.trim()) {
      await postItem("text", textData.trim());
      fetchFromHttp();
    }
  };

  // 4. Native OLE Drag-Out (Egress to other Apps)
  const handleSlotDragStart = (e: React.DragEvent, item: StagedItem) => {
    // Set HTML5 dataTransfer attributes to keep drag active
    e.dataTransfer.effectAllowed = "copyMove";
    e.dataTransfer.setData("text/plain", item.data);
    setIsDraggingOut(true);

    if (ipcRenderer) {
      console.log("[Notch Egress] Initiating native drag-out for:", item.preview);
      ipcRenderer.send("start-drag-item", item);
    }
  };

  const handleSlotDragEnd = () => {
    console.log("[Notch Egress] Drag completed or cancelled.");
    setIsDraggingOut(false);
    setTimeout(() => {
      collapseNotch();
    }, 400);
  };

  const postItem = async (itemType: string, content: string) => {
    try {
      await fetch(`${HTTP_API}/api/items`, {
        method: "POST",
        headers: { "Content-Type": "application/json; charset=utf-8" },
        body: JSON.stringify({ item_type: itemType, content }),
      });
    } catch (err) {
      console.error("[Notch] Failed to post item to backend:", err);
    }
  };

  // 5. Item Removal
  const handleDeleteItem = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    try {
      await fetch(`${HTTP_API}/api/items/${id}`, { method: "DELETE" });
      fetchFromHttp();
    } catch (err) {
      console.error("[Notch] Failed to delete item:", err);
    }
  };

  const handleClearBuffer = async (e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await fetch(`${HTTP_API}/api/items/clear`, { method: "POST" });
      fetchFromHttp();
    } catch (err) {
      console.error("[Notch] Failed to clear buffer:", err);
    }
  };

  // 5 Slot FIFO Layout
  const slots = Array.from({ length: 5 }, (_, idx) => items[idx] || null);

  return (
    <div
      className="w-full h-full flex justify-center items-start overflow-hidden select-none bg-transparent"
      onDragEnter={handleDragEnter}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
    >
      <div
        className="w-full h-full bg-[#0B0F19] text-white shadow-2xl border-x border-b border-sky-500/50 overflow-hidden flex flex-col items-center justify-between cursor-pointer transition-all duration-200"
        style={{
          borderRadius: isExpanded ? "0px 0px 16px 16px" : "0px 0px 14px 14px",
        }}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        onDragEnter={handleDragEnter}
        onDragOver={handleDragOver}
        onDrop={handleDrop}
      >
        <AnimatePresence mode="wait">
          {!isExpanded ? (
            // ================= STATE A: COLLAPSED NOTCH (180x30px) =================
            <motion.div
              key="collapsed-content"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.12 }}
              onClick={expandNotch}
              className="w-full h-full flex items-center justify-center gap-2 px-3 py-1 bg-black/95 relative"
            >
              {/* Active Volatile RAM Indicator LED */}
              <span className="relative flex h-2.5 w-2.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
              </span>
              <span className="text-[11px] font-semibold tracking-wider text-slate-200 uppercase font-mono">
                RAM NOTCH {items.length > 0 ? `(${items.length}/5)` : ""}
              </span>
            </motion.div>
          ) : (
            // ================= STATE B: EXPANDED SHELF (460x110px) =================
            <motion.div
              key="expanded-content"
              initial={{ opacity: 0, scale: 0.98 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.98 }}
              transition={{ duration: 0.15 }}
              className="w-full h-full p-2.5 flex flex-col justify-between bg-[#0B0F19]"
            >
              {/* Header Status Bar */}
              <div className="w-full flex items-center justify-between px-1 text-[11px] font-semibold text-slate-300 uppercase tracking-wider">
                <div className="flex items-center gap-2">
                  <span className="h-2 w-2 rounded-full bg-emerald-400"></span>
                  <span>RAM FIFO BUFFER ({items.length}/5)</span>
                </div>
                <div className="flex items-center gap-1">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setIsPinned(!isPinned);
                    }}
                    title={isPinned ? "Unpin Notch" : "Pin Notch Open"}
                    className={`p-1 rounded transition-colors ${
                      isPinned
                        ? "text-sky-400 bg-sky-950/70"
                        : "text-slate-400 hover:text-slate-200 hover:bg-slate-800"
                    }`}
                  >
                    <Pin className={`w-3.5 h-3.5 ${isPinned ? "fill-sky-400" : ""}`} />
                  </button>
                  {items.length > 0 && (
                    <button
                      onClick={handleClearBuffer}
                      title="Clear Buffer"
                      className="hover:text-red-400 text-slate-400 transition-colors p-1 rounded hover:bg-slate-800"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </div>

              {/* 5 Thumbnail Slots */}
              <div className="flex items-center justify-between gap-2 w-full mt-1">
                {slots.map((item, index) => (
                  <div
                    key={item?.id || `empty-${index}`}
                    draggable={!!item}
                    onDragStart={(e) => item && handleSlotDragStart(e, item)}
                    onDragEnd={handleSlotDragEnd}
                    className={`w-[80px] h-[66px] rounded-lg relative overflow-hidden flex flex-col items-center justify-center transition-all ${
                      item
                        ? "bg-slate-800/90 border border-slate-700 hover:border-sky-400/80 shadow-md group cursor-grab active:cursor-grabbing hover:scale-105"
                        : "border border-dashed border-slate-700/60 bg-slate-900/40"
                    }`}
                  >
                    {item ? (
                      <>
                        {/* Delete Button */}
                        <button
                          onClick={(e) => handleDeleteItem(e, item.id)}
                          className="absolute top-1 right-1 z-10 w-4 h-4 rounded-full bg-black/70 text-slate-300 hover:text-white hover:bg-red-500 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                        >
                          <X className="w-3 h-3" />
                        </button>

                        {/* Slot Content Preview */}
                        {item.item_type === "image" ? (
                          <img
                            src={`data:${item.mime};base64,${item.data}`}
                            alt="Preview"
                            className="w-full h-full object-cover pointer-events-none"
                          />
                        ) : item.item_type === "fileuri" ? (
                          <div className="flex flex-col items-center justify-center p-1 text-center w-full pointer-events-none">
                            <File className="w-5 h-5 text-sky-400 mb-1" />
                            <span className="text-[9px] text-slate-300 truncate w-full px-1">
                              {item.preview}
                            </span>
                          </div>
                        ) : (
                          <div className="flex flex-col items-center justify-center p-1.5 text-center w-full pointer-events-none">
                            <FileText className="w-4 h-4 text-emerald-400 mb-0.5" />
                            <span className="text-[9px] text-slate-200 line-clamp-2 leading-tight">
                              {item.preview}
                            </span>
                          </div>
                        )}

                        {/* Slot Drag Handle Cue & Index */}
                        <div className="absolute bottom-0.5 left-1 flex items-center gap-0.5 text-[8px] font-mono text-slate-400 opacity-60">
                          <GripVertical className="w-2.5 h-2.5" />
                          #{index + 1}
                        </div>
                      </>
                    ) : (
                      // Empty Slot - Active Drop Target
                      <div className="flex flex-col items-center justify-center text-slate-600">
                        <Plus className="w-4 h-4 stroke-[1.5]" />
                        <span className="text-[9px] font-mono mt-0.5 opacity-60">
                          #{index + 1}
                        </span>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
