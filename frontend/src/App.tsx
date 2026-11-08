import React, { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { FileText, Image as ImageIcon, File, X, Trash2, Plus } from "lucide-react";

export interface StagedItem {
  id: string;
  item_type: "text" | "image" | "fileuri";
  preview: string;
  data: string;
  mime: string;
  created_at: number;
}

const HTTP_API = "http://127.0.0.1:49152";

// Helper for Electron IPC if running under Electron
const electron = (window as any).require ? (window as any).require("electron") : null;

export default function App() {
  const [isExpanded, setIsExpanded] = useState(false);
  const [items, setItems] = useState<StagedItem[]>([]);
  const isTauriRef = useRef(false);

  // 1. Initialize & Poll Data
  useEffect(() => {
    fetchFromHttp();
    const interval = setInterval(fetchFromHttp, 500);
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
    if (electron?.ipcRenderer) {
      electron.ipcRenderer.send("set-notch-state", "expanded");
    }
  };

  const collapseNotch = () => {
    setIsExpanded(false);
    if (electron?.ipcRenderer) {
      electron.ipcRenderer.send("set-notch-state", "collapsed");
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
        // In desktop wrapper (Electron), file.path has the full local OS path
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
      console.error("Failed to post item to backend:", err);
    }
  };

  // 4. Item Removal
  const handleDeleteItem = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    try {
      await fetch(`${HTTP_API}/api/items/${id}`, { method: "DELETE" });
      fetchFromHttp();
    } catch (err) {
      console.error("Failed to delete item:", err);
    }
  };

  const handleClearBuffer = async (e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await fetch(`${HTTP_API}/api/items/clear`, { method: "POST" });
      fetchFromHttp();
    } catch (err) {
      console.error("Failed to clear buffer:", err);
    }
  };

  // 5 Slot FIFO Layout
  const slots = Array.from({ length: 5 }, (_, idx) => items[idx] || null);

  return (
    <div
      className="w-screen h-screen flex justify-center items-start overflow-hidden pointer-events-none select-none"
      onDragEnter={handleDragEnter}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
    >
      <motion.div
        className="pointer-events-auto bg-[#0B0F19]/95 text-white backdrop-blur-md shadow-2xl border-x border-b border-sky-500/30 overflow-hidden flex flex-col items-center justify-between cursor-pointer"
        initial="collapsed"
        animate={isExpanded ? "expanded" : "collapsed"}
        variants={{
          collapsed: {
            width: 140,
            height: 12,
            borderRadius: "0px 0px 8px 8px",
            transition: { type: "spring", stiffness: 400, damping: 30 },
          },
          expanded: {
            width: 440,
            height: 96,
            borderRadius: "0px 0px 16px 16px",
            transition: { type: "spring", stiffness: 350, damping: 25 },
          },
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
              transition={{ duration: 0.15 }}
              className="w-full h-full flex items-center justify-center relative"
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
              initial={{ opacity: 0, y: -4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              transition={{ duration: 0.2 }}
              className="w-full h-full p-2 flex flex-col justify-between"
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
      </motion.div>
    </div>
  );
}
