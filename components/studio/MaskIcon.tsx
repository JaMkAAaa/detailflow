import { cn } from "@/lib/utils";

/**
 * Ikona SVG z Figmy (`public/mobile`) kolorowana przez `currentColor`, jak ikony tab bara.
 * `size` to rozmiar slotu z Figmy; SVG skaluje się razem z grubością linii.
 */
export function MaskIcon({ name, size, className }: { name: string; size: number; className?: string }) {
  return (
    <span
      aria-hidden="true"
      className={cn("inline-block shrink-0 bg-current", className)}
      style={{ width: size, height: size, mask: `url(/mobile/${name}.svg) center / contain no-repeat` }}
    />
  );
}
