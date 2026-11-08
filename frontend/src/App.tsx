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

    if (ipcRenderer) {
      const handleNativeDragFinished = (_: any, data: any) => {
        console.log("[Notch] Native OLE drag finished:", data);
        setIsDraggingOut(false);
      };
      ipcRenderer.on("native-drag-finished", handleNativeDragFinished);
      return () => {
        clearInterval(interval);
        ipcRenderer.removeListener("native-drag-finished", handleNativeDragFinished);
      };
    }

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

  // Progressive adaptive slots for up to 20 items (DESIGN_SPEC.md):
  // Oldest items on left, newest on right, followed by active "+ Drop next" slot
  const orderedItems = [...items].reverse();
  const allSlots: (StagedItem | null)[] =
    orderedItems.length < 20 ? [...orderedItems, null] : orderedItems.slice(0, 20);

  const isMultiRow = allSlots.length > 10;
  const row1Slots = allSlots.slice(0, 10);
  const row2Slots = isMultiRow ? allSlots.slice(10) : [];

  const getExpandedDimensions = (slotsCount = allSlots.length) => {
    const multi = slotsCount > 10;
    const r1 = multi ? 10 : slotsCount;
    // Formula from DESIGN_SPEC.md: (N * 76) + ((N - 1) * 8) + 32
    const width = multi ? 864 : Math.max(220, r1 * 76 + (r1 - 1) * 8 + 32);
    const height = multi ? 188 : 112;
    return { width, height };
  };

  // Synchronize window dimensions when items change while expanded
  useEffect(() => {
    if (isExpanded && ipcRenderer) {
      const { width, height } = getExpandedDimensions(allSlots.length);
      ipcRenderer.send("set-notch-state", "expanded", width, height);
    }
  }, [allSlots.length, isExpanded]);

  // 2. Expand / Collapse Window States
  const expandNotch = () => {
    if (leaveTimeoutRef.current) {
      clearTimeout(leaveTimeoutRef.current);
      leaveTimeoutRef.current = null;
    }
    setIsExpanded(true);
    if (ipcRenderer) {
      const { width, height } = getExpandedDimensions();
      ipcRenderer.send("set-notch-state", "expanded", width, height);
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
    // Crucial: preventDefault() stops Chromium's HTML5 text drag from colliding with Windows OLE DoDragDrop
    e.preventDefault();
    setIsDraggingOut(true);

    if (ipcRenderer) {
      console.log("[Notch Egress] Initiating native drag-out for:", item.preview);
      ipcRenderer.send("start-drag-item", item);
    }
  };

  const handleSlotDragEnd = () => {
    // Keep notch open while interacting; will reset when native-drag-finished or user leaves
    console.log("[Notch Egress] DOM Drag lifecycle finished.");
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

  const renderSlot = (item: StagedItem | null, index: number) => {
    const isNewest = item && orderedItems.length > 0 && item.id === orderedItems[orderedItems.length - 1]?.id;
    const boxHeight = isMultiRow ? "h-[56px]" : "h-[62px]";

    return (
      <div
        key={item?.id || `empty-${index}`}
        draggable={!!item}
        onDragStart={(e) => item && handleSlotDragStart(e, item)}
        onDragEnd={handleSlotDragEnd}
        className={`w-[76px] ${boxHeight} rounded-lg relative overflow-hidden flex flex-col items-center justify-center transition-all ${
          item
            ? "bg-slate-800/90 border border-slate-700 hover:border-sky-400/80 shadow-md group cursor-grab active:cursor-grabbing hover:scale-105"
            : "border border-dashed border-slate-700/60 bg-slate-900/40 hover:border-sky-500/50 hover:bg-slate-800/50 transition-colors"
        }`}
      >
        {item ? (
          <>
            {/* Delete Button */}
            <button
              onClick={(e) => handleDeleteItem(e, item.id)}
              className="absolute top-1 right-1 z-10 w-3.5 h-3.5 rounded-full bg-black/70 text-slate-300 hover:text-white hover:bg-red-500 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
            >
              <X className="w-2.5 h-2.5" />
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
                <File className={`${isMultiRow ? "w-4 h-4" : "w-5 h-5"} text-sky-400 mb-0.5`} />
                <span className="text-[9px] text-slate-300 truncate w-full px-1">
                  {item.preview}
                </span>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center p-1 text-center w-full pointer-events-none">
                <FileText className={`${isMultiRow ? "w-3.5 h-3.5" : "w-4 h-4"} text-emerald-400 mb-0.5`} />
                <span className="text-[9px] text-slate-200 line-clamp-2 leading-tight">
                  {item.preview}
                </span>
              </div>
            )}

            {/* Slot Cue (Newest or Index) */}
            <div className="absolute bottom-0.5 left-1 flex items-center gap-0.5 text-[8px] font-mono text-slate-400 opacity-70">
              <GripVertical className="w-2.5 h-2.5" />
              {isNewest ? (
                <span className="text-sky-400 font-semibold">NEW</span>
              ) : (
                <span>#{index + 1}</span>
              )}
            </div>
          </>
        ) : (
          // Empty Slot (Drop next)
          <div className="flex flex-col items-center justify-center text-slate-500">
            <Plus className="w-4 h-4 stroke-[1.5]" />
            <span className="text-[8px] font-mono mt-0.5 opacity-70">
              Drop next
            </span>
          </div>
        )}
      </div>
    );
  };

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
                RAM NOTCH {items.length > 0 ? `(${items.length}/20)` : ""}
              </span>
            </motion.div>
          ) : (
            // ================= STATE B: EXPANDED SHELF (Adaptive 1-20 Items) =================
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
                  <span>RAM FIFO BUFFER ({items.length}/20)</span>
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

              {/* Row 1 (Up to 10 Slots) */}
              <div className="flex items-center justify-center gap-2 w-full mt-1">
                {row1Slots.map((item, index) => renderSlot(item, index))}
              </div>

              {/* Row 2 (Slots 11-20, Center-Aligned if Multi-Row) */}
              {isMultiRow && (
                <div className="flex items-center justify-center gap-2 w-full mt-2">
                  {row2Slots.map((item, index) => renderSlot(item, 10 + index))}
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
