"use client";

import { PanelResizeHandle } from "react-resizable-panels";
import { cn } from "@/lib/utils";

// Divisoria arrastavel entre os paineis, com area de clique generosa e realce no hover/drag.
export function ResizeHandle({
  disabled,
  hidden,
  onDragging,
}: {
  disabled?: boolean;
  hidden?: boolean;
  onDragging?: (isDragging: boolean) => void;
}) {
  return (
    <PanelResizeHandle
      disabled={disabled}
      onDragging={onDragging}
      className={cn(
        "group relative w-1.5 bg-transparent hover:bg-primary/15 data-[resize-handle-state=drag]:bg-primary/25 transition-colors",
        hidden && "w-0 pointer-events-none opacity-0"
      )}
    >
      {!hidden && (
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 h-9 w-[3px] rounded-full bg-border group-hover:bg-primary/60 group-data-[resize-handle-state=drag]:bg-primary transition-colors" />
      )}
    </PanelResizeHandle>
  );
}
