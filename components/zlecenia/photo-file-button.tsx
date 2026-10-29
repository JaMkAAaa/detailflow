"use client";

import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export function PhotoFileButton({
  ariaLabel,
  className,
  children,
  multiple = false,
  capture = false,
  disabled = false,
  onFiles,
}: {
  ariaLabel: string;
  className?: string;
  children: ReactNode;
  multiple?: boolean;
  capture?: boolean;
  disabled?: boolean;
  onFiles: (files: File[]) => void;
}) {
  return (
    <label className={cn(className, disabled && "pointer-events-none opacity-60")}>
      <input
        type="file"
        aria-label={ariaLabel}
        accept="image/jpeg,image/png,image/webp,image/heic,.heic,.heif"
        multiple={multiple}
        disabled={disabled}
        capture={capture ? "environment" : undefined}
        className="sr-only"
        onChange={(event) => {
          const files = [...(event.currentTarget.files ?? [])];
          event.currentTarget.value = "";
          if (files.length) onFiles(files);
        }}
      />
      {children}
    </label>
  );
}
