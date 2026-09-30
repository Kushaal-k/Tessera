import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";

export const DEFAULT_SIDEBAR_WIDTH = 224;
export const MIN_SIDEBAR_WIDTH = 180;
export const MAX_SIDEBAR_WIDTH = 450;

export const DEFAULT_BOTTOM_HEIGHT = 224;
export const MIN_BOTTOM_HEIGHT = 100;
export const MAX_BOTTOM_HEIGHT_PERCENT = 0.7;

export const SIDEBAR_WIDTH_STORAGE_KEY = "tessera:sidebar-width";
export const BOTTOM_HEIGHT_STORAGE_KEY = "tessera:bottom-panel-height";

export interface ResizableLayoutProps {
  readonly sidebar: ReactNode;
  readonly editor: ReactNode;
  readonly bottomPanel: ReactNode;
  readonly className?: string;
}

export function ResizableLayout({
  sidebar,
  editor,
  bottomPanel,
  className,
}: ResizableLayoutProps) {
  const [sidebarWidth, setSidebarWidth] = useState<number>(() => {
    try {
      const saved = localStorage.getItem(SIDEBAR_WIDTH_STORAGE_KEY);
      if (saved) {
        const parsed = Number.parseInt(saved, 10);
        if (
          !Number.isNaN(parsed) &&
          parsed >= MIN_SIDEBAR_WIDTH &&
          parsed <= MAX_SIDEBAR_WIDTH
        ) {
          return parsed;
        }
      }
    } catch {
      // localStorage may fail in restricted/SSR environments
    }
    return DEFAULT_SIDEBAR_WIDTH;
  });

  const [bottomHeight, setBottomHeight] = useState<number>(() => {
    try {
      const saved = localStorage.getItem(BOTTOM_HEIGHT_STORAGE_KEY);
      if (saved) {
        const parsed = Number.parseInt(saved, 10);
        if (!Number.isNaN(parsed) && parsed >= MIN_BOTTOM_HEIGHT) {
          return parsed;
        }
      }
    } catch {
      // localStorage may fail in restricted/SSR environments
    }
    return DEFAULT_BOTTOM_HEIGHT;
  });

  const [isDraggingSidebar, setIsDraggingSidebar] = useState<boolean>(false);
  const [isDraggingBottom, setIsDraggingBottom] = useState<boolean>(false);

  const containerRef = useRef<HTMLDivElement>(null);

  const handleSidebarMouseDown = (e: React.MouseEvent): void => {
    e.preventDefault();
    setIsDraggingSidebar(true);
  };

  const handleBottomMouseDown = (e: React.MouseEvent): void => {
    e.preventDefault();
    setIsDraggingBottom(true);
  };

  const resetSidebarWidth = useCallback((): void => {
    setSidebarWidth(DEFAULT_SIDEBAR_WIDTH);
    try {
      localStorage.setItem(
        SIDEBAR_WIDTH_STORAGE_KEY,
        DEFAULT_SIDEBAR_WIDTH.toString()
      );
    } catch {
      // Ignore storage errors
    }
  }, []);

  const resetBottomHeight = useCallback((): void => {
    setBottomHeight(DEFAULT_BOTTOM_HEIGHT);
    try {
      localStorage.setItem(
        BOTTOM_HEIGHT_STORAGE_KEY,
        DEFAULT_BOTTOM_HEIGHT.toString()
      );
    } catch {
      // Ignore storage errors
    }
  }, []);

  useEffect(() => {
    if (!isDraggingSidebar) {
      return;
    }

    const onMouseMove = (e: MouseEvent): void => {
      const clampedWidth = Math.min(
        Math.max(e.clientX, MIN_SIDEBAR_WIDTH),
        MAX_SIDEBAR_WIDTH
      );
      setSidebarWidth(clampedWidth);
    };

    const onMouseUp = (): void => {
      setIsDraggingSidebar(false);
      try {
        localStorage.setItem(
          SIDEBAR_WIDTH_STORAGE_KEY,
          sidebarWidth.toString()
        );
      } catch {
        // Ignore storage errors
      }
    };

    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseup", onMouseUp);

    return () => {
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseup", onMouseUp);
    };
  }, [isDraggingSidebar, sidebarWidth]);

  useEffect(() => {
    if (!isDraggingBottom) {
      return;
    }

    const onMouseMove = (e: MouseEvent): void => {
      const container = containerRef.current;
      if (!container) {
        return;
      }
      const containerRect = container.getBoundingClientRect();
      const rawHeight = containerRect.bottom - e.clientY;
      const maxHeight = containerRect.height * MAX_BOTTOM_HEIGHT_PERCENT;
      const clampedHeight = Math.min(
        Math.max(rawHeight, MIN_BOTTOM_HEIGHT),
        maxHeight
      );
      setBottomHeight(clampedHeight);
    };

    const onMouseUp = (): void => {
      setIsDraggingBottom(false);
      try {
        localStorage.setItem(
          BOTTOM_HEIGHT_STORAGE_KEY,
          bottomHeight.toString()
        );
      } catch {
        // Ignore storage errors
      }
    };

    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseup", onMouseUp);

    return () => {
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseup", onMouseUp);
    };
  }, [isDraggingBottom, bottomHeight]);

  return (
    <div
      ref={containerRef}
      className={`flex flex-1 flex-col overflow-hidden ${
        isDraggingSidebar || isDraggingBottom ? "select-none" : ""
      } ${className ?? ""}`}
    >
      <div className="flex flex-1 overflow-hidden relative">
        {/* Sidebar Container */}
        <div
          style={{ width: `${sidebarWidth}px` }}
          className="shrink-0 flex flex-col h-full overflow-hidden"
          data-testid="resizable-sidebar"
        >
          {sidebar}
        </div>

        {/* Vertical Resizer Handle */}
        <div
          role="separator"
          aria-orientation="vertical"
          aria-label="Resize sidebar"
          tabIndex={0}
          onMouseDown={handleSidebarMouseDown}
          onDoubleClick={resetSidebarWidth}
          className={`w-1.5 shrink-0 bg-transparent hover:bg-sky-500/50 cursor-col-resize transition-colors relative z-10 ${
            isDraggingSidebar ? "bg-sky-500" : ""
          }`}
          data-testid="sidebar-resizer"
        />

        {/* Editor Container */}
        <div className="flex-1 flex flex-col h-full min-w-0 overflow-hidden" data-testid="resizable-editor">
          {editor}
        </div>
      </div>

      {/* Horizontal Resizer Handle */}
      <div
        role="separator"
        aria-orientation="horizontal"
        aria-label="Resize bottom panel"
        tabIndex={0}
        onMouseDown={handleBottomMouseDown}
        onDoubleClick={resetBottomHeight}
        className={`h-1.5 shrink-0 bg-transparent hover:bg-sky-500/50 cursor-row-resize transition-colors relative z-10 ${
          isDraggingBottom ? "bg-sky-500" : ""
        }`}
        data-testid="bottom-resizer"
      />

      {/* Bottom Panel Container */}
      <div
        style={{ height: `${bottomHeight}px` }}
        className="shrink-0 flex flex-col overflow-hidden"
        data-testid="resizable-bottom"
      >
        {bottomPanel}
      </div>
    </div>
  );
}
