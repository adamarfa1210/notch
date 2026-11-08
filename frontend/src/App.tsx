import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { FileText, File, X, Trash2, Plus } from "lucide-react";

export interface StagedItem {
  id: string;
  item_type: "text" | "image" | "fileuri";
  preview: string;
  data: string;
  mime: string;
  created_at: number;
}

const HTTP_API = "http://127.0.0.1:49152";

// Safe Electron IPC extraction
let ipcRenderer: any = null;
if (typeof window !== "undefined" && (window as any).require) {
  try {
    ipcRenderer = (window as any).require("electron").ipcRenderer;
    console.log("[Notch] Electron IPC renderer connected.");
  } catch (e) {
    console.warn("[Notch] Electron IPC not available:", e);
  }
}

export default function App() {
  const [isExpanded, setIsExpanded] = useState(false);
  const [items, setItems] = useState<StagedItem[]>([]);

  // 1. Initial Data Fetch & Fast Polling
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
    setIsExpanded(true);
    if (ipcRenderer) {
      ipcRenderer.send("set-notch-state", "expanded");
    }
  };

  const collapseNotch = () => {
    setIsExpanded(false);
    if (ipcRenderer) {
      ipcRenderer.send("set-notch-state", "collapsed");
    }
  };

  // 3. Mouse & Drag Event Handlers
  const handleMouseEnter = () => {
    expandNotch();
  };

  const handleMouseLeave = () => {
    collapseNotch();
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

    // 1. Files dropped
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const files = Array.from(e.dataTransfer.files);
      for (const file of files) {
        const filePath = (file as any).path || file.name;
        await postItem("file", filePath);
      }
      fetchFromHttp();
      return;
    }

    // 2. Text / URI dropped
    const textData = e.dataTransfer.getData("text/plain");
    if (textData && textData.trim()) {
      await postItem("text", textData.trim());
      fetchFromHttp();
    }
  };

  const postItem = async (itemType: string, content: string) => {
    try {
      await fetch(`${HTTP_API}/api/items`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ item_type: itemType, content }),
      });
    } catch (err) {
      console.error("[Notch] Failed to post item to backend:", err);
    }
  };

  // 4. Item Removal
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
        className="w-full h-full bg-[#0B0F19] text-white shadow-2xl border-x border-b border-sky-500/40 overflow-hidden flex flex-col items-center justify-between cursor-pointer transition-all duration-200"
        style={{
          borderRadius: isExpanded ? "0px 0px 16px 16px" : "0px 0px 8px 8px",
        }}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        onDragEnter={handleDragEnter}
        onDragOver={handleDragOver}
        onDrop={handleDrop}
      >
        <AnimatePresence mode="wait">
          {!isExpanded ? (
            // ================= STATE A: COLLAPSED NOTCH =================
            <motion.div
              key="collapsed-content"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.1 }}
              className="w-full h-full flex items-center justify-center relative bg-black/90"
            >
              {/* Active Volatile RAM Indicator LED */}
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
              </span>
            </motion.div>
          ) : (
            // ================= STATE B: EXPANDED SHELF =================
            <motion.div
              key="expanded-content"
              initial={{ opacity: 0, scale: 0.98 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.98 }}
              transition={{ duration: 0.15 }}
              className="w-full h-full p-2 flex flex-col justify-between bg-[#0B0F19]"
            >
              {/* Header Status Bar */}
              <div className="w-full flex items-center justify-between px-1 text-[10px] font-semibold text-slate-400 uppercase tracking-wider">
                <div className="flex items-center gap-1.5">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-400"></span>
                  <span>RAM FIFO BUFFER ({items.length}/5)</span>
                </div>
                {items.length > 0 && (
                  <button
                    onClick={handleClearBuffer}
                    title="Clear Buffer"
                    className="hover:text-red-400 transition-colors p-0.5 rounded"
                  >
                    <Trash2 className="w-3 h-3" />
                  </button>
                )}
              </div>

              {/* 5 Thumbnail Slots */}
              <div className="flex items-center justify-between gap-2 w-full mt-1">
                {slots.map((item, index) => (
                  <div
                    key={item?.id || `empty-${index}`}
                    className={`w-[76px] h-[62px] rounded-lg relative overflow-hidden flex flex-col items-center justify-center transition-all ${
                      item
                        ? "bg-slate-800/90 border border-slate-700 hover:border-sky-400/60 shadow-md group"
                        : "border border-dashed border-slate-700/60 bg-slate-900/40"
                    }`}
                  >
                    {item ? (
                      <>
                        {/* Delete Button */}
                        <button
                          onClick={(e) => handleDeleteItem(e, item.id)}
                          className="absolute top-1 right-1 z-10 w-4 h-4 rounded-full bg-black/60 text-slate-300 hover:text-white hover:bg-red-500/80 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                        >
                          <X className="w-2.5 h-2.5" />
                        </button>

                        {/* Slot Content Preview */}
                        {item.item_type === "image" ? (
                          <img
                            src={`data:${item.mime};base64,${item.data}`}
                            alt="Preview"
                            className="w-full h-full object-cover"
                          />
                        ) : item.item_type === "fileuri" ? (
                          <div className="flex flex-col items-center justify-center p-1 text-center w-full">
                            <File className="w-5 h-5 text-sky-400 mb-1" />
                            <span className="text-[9px] text-slate-300 truncate w-full px-1">
                              {item.preview}
                            </span>
                          </div>
                        ) : (
                          <div className="flex flex-col items-center justify-center p-1.5 text-center w-full">
                            <FileText className="w-4 h-4 text-emerald-400 mb-0.5" />
                            <span className="text-[9px] text-slate-200 line-clamp-2 leading-tight">
                              {item.preview}
                            </span>
                          </div>
                        )}

                        {/* Slot Index Badge */}
                        <div className="absolute bottom-0.5 left-1 text-[8px] font-mono text-slate-500 opacity-60">
                          #{index + 1}
                        </div>
                      </>
                    ) : (
                      // Empty Slot - Active Drop Target
                      <div className="flex flex-col items-center justify-center text-slate-600">
                        <Plus className="w-3.5 h-3.5 stroke-[1.5]" />
                        <span className="text-[8px] font-mono mt-0.5 opacity-60">
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
