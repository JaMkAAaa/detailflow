"use client";

import { useEffect, useId, useLayoutEffect, useRef, useState, type KeyboardEvent as ReactKeyboardEvent } from "react";
import { createPortal } from "react-dom";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const triggerVariants = cva(
  "flex w-full min-w-0 items-center gap-2 bg-df-raised text-left text-df-text outline-none disabled:cursor-not-allowed disabled:opacity-40",
  {
    variants: {
      size: {
        form: "h-11 rounded-lg px-3.5 text-df-body",
        filter: "h-10 rounded-lg px-3 text-df-label font-medium",
        dense: "h-9 rounded-lg px-2 text-df-body",
        studio: "h-[60px] rounded-[10px] px-3.5 text-df-body",
      },
    },
    defaultVariants: { size: "form" },
  },
);

export type SelectOption = {
  value: string;
  label: string;
  description?: string;
  disabled?: boolean;
};

type SelectProps = VariantProps<typeof triggerVariants> & {
  options: readonly SelectOption[];
  value?: string;
  defaultValue?: string;
  onChange?: (event: { target: { value: string } }) => void;
  name?: string;
  id?: string;
  disabled?: boolean;
  required?: boolean;
  placeholder?: string;
  className?: string;
  "aria-label"?: string;
};

function firstEnabled(options: readonly SelectOption[]) {
  return options.find((option) => !option.disabled)?.value ?? "";
}

function moveActive(options: readonly SelectOption[], current: number, direction: 1 | -1) {
  const indexes = options.flatMap((option, index) => option.disabled ? [] : [index]);
  if (!indexes.length) return current;
  const position = indexes.indexOf(current);
  if (position === -1) return direction === 1 ? indexes[0]! : indexes[indexes.length - 1]!;
  return indexes[(position + direction + indexes.length) % indexes.length]!;
}

function placeMenu(trigger: HTMLElement, menu: HTMLElement) {
  const view = trigger.ownerDocument.defaultView ?? window;
  const rect = trigger.getBoundingClientRect();
  const gap = 6;
  const margin = 8;
  const below = view.innerHeight - rect.bottom - gap - margin;
  const above = rect.top - gap - margin;
  const openUp = below < Math.min(menu.scrollHeight, 160) && above > below;
  const maxHeight = Math.max(72, Math.min(220, openUp ? above : below));
  menu.style.maxHeight = `${maxHeight}px`;
  menu.style.minWidth = `${rect.width}px`;
  menu.style.width = "max-content";
  const width = Math.min(Math.max(rect.width, menu.offsetWidth), Math.max(0, view.innerWidth - margin * 2));
  if (width > 0) menu.style.width = `${width}px`;
  let left = rect.left;
  if (left + width > view.innerWidth - margin) left = Math.max(margin, view.innerWidth - margin - width);
  const height = Math.min(menu.scrollHeight, maxHeight);
  menu.style.left = `${left}px`;
  menu.style.top = `${openUp ? Math.max(margin, rect.top - gap - height) : rect.bottom + gap}px`;
}

function showInTopLayer(menu: HTMLElement) {
  if (typeof menu.showPopover !== "function") return;
  try {
    menu.popover = "manual";
    if (!menu.matches(":popover-open")) menu.showPopover();
  } catch {
    menu.removeAttribute("popover");
  }
}

export function Select({
  options,
  value,
  defaultValue,
  onChange,
  name,
  id,
  disabled = false,
  required = false,
  placeholder = "Wybierz",
  size = "form",
  className,
  "aria-label": ariaLabel,
}: SelectProps) {
  const listId = useId();
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const [uncontrolled, setUncontrolled] = useState(defaultValue ?? firstEnabled(options));
  const current = value !== undefined ? value : uncontrolled;
  const selected = options.find((option) => option.value === current);
  const display = selected?.label ?? placeholder;
  // A portaled menu outside an open modal <dialog> is inert, so keep it in the dialog.
  const portalTarget = open && triggerRef.current
    ? triggerRef.current.closest("dialog[open]") ?? document.body
    : null;

  function commit(option: SelectOption) {
    if (disabled || option.disabled) return;
    setOpen(false);
    triggerRef.current?.focus();
    if (option.value === current) return;
    if (value === undefined) setUncontrolled(option.value);
    onChange?.({ target: { value: option.value } });
  }

  function openMenu() {
    if (disabled) return;
    const index = options.findIndex((option) => option.value === current && !option.disabled);
    setActive(index >= 0 ? index : Math.max(0, options.findIndex((option) => !option.disabled)));
    setOpen(true);
  }

  function onKeyDown(event: ReactKeyboardEvent<HTMLButtonElement>) {
    if (disabled) return;
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      if (!open) {
        openMenu();
        return;
      }
      setActive((index) => moveActive(options, index, event.key === "ArrowDown" ? 1 : -1));
    } else if (event.key === "Home" && open) {
      event.preventDefault();
      setActive(Math.max(0, options.findIndex((option) => !option.disabled)));
    } else if (event.key === "End" && open) {
      event.preventDefault();
      let last = 0;
      for (let index = options.length - 1; index >= 0; index -= 1) {
        if (!options[index]?.disabled) { last = index; break; }
      }
      setActive(last);
    } else if ((event.key === "Enter" || event.key === " ") && open) {
      event.preventDefault();
      const option = options[active];
      if (option) commit(option);
    } else if (event.key === "Escape" && open) {
      event.preventDefault();
      event.stopPropagation();
      setOpen(false);
    } else if (event.key === "Tab") {
      setOpen(false);
    }
  }

  useEffect(() => {
    if (disabled) setOpen(false);
  }, [disabled]);

  useEffect(() => {
    if (!open) return;
    function onKey(event: KeyboardEvent) {
      if (event.key !== "Escape") return;
      event.preventDefault();
      event.stopPropagation();
      setOpen(false);
      triggerRef.current?.focus();
    }
    function onPointer(event: PointerEvent) {
      const target = event.target;
      if (!(target instanceof Node)) return;
      if (triggerRef.current?.contains(target) || menuRef.current?.contains(target)) return;
      setOpen(false);
    }
    document.addEventListener("keydown", onKey, true);
    document.addEventListener("pointerdown", onPointer);
    return () => {
      document.removeEventListener("keydown", onKey, true);
      document.removeEventListener("pointerdown", onPointer);
    };
  }, [open]);

  useLayoutEffect(() => {
    if (!open) return;
    const trigger = triggerRef.current;
    const menu = menuRef.current;
    if (!trigger || !menu) return;
    showInTopLayer(menu);
    const update = () => placeMenu(trigger, menu);
    update();
    const view = trigger.ownerDocument.defaultView;
    view?.addEventListener("resize", update);
    view?.addEventListener("scroll", update, true);
    return () => {
      view?.removeEventListener("resize", update);
      view?.removeEventListener("scroll", update, true);
      if (typeof menu.hidePopover === "function" && menu.matches(":popover-open")) {
        try { menu.hidePopover(); } catch { /* already closed */ }
      }
    };
  }, [open, options]);

  useEffect(() => {
    if (!open) return;
    const option = document.getElementById(`${listId}-${active}`);
    if (typeof option?.scrollIntoView === "function") option.scrollIntoView({ block: "nearest" });
  }, [open, active, listId]);

  const menu = (
    <div
      ref={menuRef}
      id={listId}
      role="listbox"
      aria-label={ariaLabel}
      tabIndex={-1}
      className="fixed z-50 overflow-auto rounded-lg border border-df-line bg-df-panel p-1 shadow-[0_16px_36px_rgb(0_0_0/45%)] [scrollbar-width:thin]"
      onMouseDown={(event) => event.preventDefault()}
    >
      {options.map((option, index) => {
        const isSelected = option.value === current;
        const highlighted = index === active && !option.disabled;
        return (
          <div
            key={`${option.value}:${index}`}
            id={`${listId}-${index}`}
            role="option"
            aria-label={option.label}
            data-value={option.value}
            aria-selected={isSelected}
            aria-disabled={option.disabled || undefined}
            className={cn(
              "flex min-h-9 cursor-pointer items-center gap-2 rounded-md px-2.5 text-df-body",
              option.description && "min-h-12",
              highlighted && !isSelected && "bg-df-hover",
              isSelected && "bg-df-lime-dark text-df-lime",
              !isSelected && option.value === "" && "text-df-muted",
              option.disabled && "cursor-not-allowed text-df-muted",
            )}
            onMouseEnter={() => { if (!option.disabled) setActive(index); }}
            onClick={() => commit(option)}
          >
            <span className="min-w-0 flex-1">
              <span className="block truncate">{option.label}</span>
              {option.description && (
                <span className={cn("block truncate text-df-label", isSelected ? "text-df-lime/80" : "text-df-muted")}>{option.description}</span>
              )}
            </span>
            <span className="flex size-3.5 shrink-0 items-center justify-center" aria-hidden="true">
              {isSelected && (
                <svg viewBox="0 0 14 14" className="size-3.5">
                  <path d="M2.8 7.2 5.4 9.8 11.2 4" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              )}
            </span>
          </div>
        );
      })}
    </div>
  );

  return (
    <div className={cn("relative min-w-0", className)}>
      <button
        ref={triggerRef}
        id={id}
        type="button"
        role="combobox"
        aria-label={ariaLabel}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={open ? listId : undefined}
        aria-activedescendant={open ? `${listId}-${active}` : undefined}
        aria-required={required || undefined}
        disabled={disabled}
        data-value={current}
        className={cn(triggerVariants({ size }), open && "outline outline-2 outline-offset-2 outline-df-lime")}
        onClick={() => open ? setOpen(false) : openMenu()}
        onKeyDown={onKeyDown}
      >
        <span className="min-w-0 flex-1">
          <span className={cn("block truncate", !selected && "text-df-muted")}>{display}</span>
          {size === "studio" && selected?.description ? <span className="block truncate text-df-label text-df-muted">{selected.description}</span> : null}
        </span>
        <svg
          viewBox="0 0 16 16"
          aria-hidden="true"
          className={cn("size-4 shrink-0 text-df-muted motion-safe:transition-transform motion-safe:duration-150", open && "rotate-180 text-df-lime")}
        >
          <path d="M4 6.2 8 10l4-3.8" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>
      {name && <input type="hidden" name={name} value={current} disabled={disabled} onChange={() => undefined} />}
      {open && portalTarget ? createPortal(menu, portalTarget) : null}
    </div>
  );
}
