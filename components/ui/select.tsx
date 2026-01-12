"use client";
import React, { createContext, useContext, useState, useRef, useEffect } from "react";

type Ctx = {
  value?: string;
  label?: string;
  onValueChange?: (v: string) => void;
  open: boolean;
  setOpen: (o: boolean) => void;
  setLabel: (s: string) => void;
};
const SelectCtx = createContext<Ctx | null>(null);

export function Select({
  children, value, onValueChange,
}: { children: React.ReactNode; value?: string; onValueChange?: (v: string) => void; }) {
  const [open, setOpen] = useState(false);
  const [label, setLabel] = useState<string>("");
  return (
    <SelectCtx.Provider value={{ value, onValueChange, open, setOpen, label, setLabel }}>
      <div className="relative w-full">{children}</div>
    </SelectCtx.Provider>
  );
}

export function SelectTrigger(
  { className, children, ...props }: React.ComponentPropsWithoutRef<"button">
) {
  const ctx = useContext(SelectCtx)!;
  return (
    <button type="button"
      onClick={() => ctx.setOpen(!ctx.open)}
      className={`flex h-10 w-full items-center justify-between rounded-md border px-3 text-sm bg-white hover:bg-gray-50 transition-colors ${className || ""}`}
      {...props}
    >
      {children}
      <svg className={`h-4 w-4 opacity-50 transition-transform ${ctx.open ? 'rotate-180' : ''}`} xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <polyline points="6 9 12 15 18 9"></polyline>
      </svg>
    </button>
  );
}

export function SelectValue({ placeholder }: { placeholder?: string }) {
  const ctx = useContext(SelectCtx)!;
  return <span className="truncate">{ctx.label || ctx.value || placeholder || "Seç"}</span>;
}

export function SelectContent(
  { children, className }: { children: React.ReactNode; className?: string }
) {
  const ctx = useContext(SelectCtx)!;
  const ref = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    function onDocClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) ctx.setOpen(false);
    }
    if (ctx.open) document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, [ctx]);

  if (!ctx.open) return null;
  return (
    <div
      ref={ref}
      className={`absolute left-0 right-0 z-[9999] mt-1 rounded-md border bg-white shadow-lg ${className || ""}`}
      style={{ maxHeight: '240px', overflowY: 'auto' }}
    >
      <div className="p-1">
        {children}
      </div>
    </div>
  );
}

export function SelectItem(
  { children, value, className, ...props }:
    { children: React.ReactNode; value: string; className?: string } & React.ComponentPropsWithoutRef<"div">
) {
  const ctx = useContext(SelectCtx)!;
  const isSelected = ctx.value === value;
  return (
    <div
      role="option"
      aria-selected={isSelected}
      onClick={() => { ctx.onValueChange?.(value); ctx.setLabel(String(children)); ctx.setOpen(false); }}
      className={`cursor-pointer px-3 py-2 text-sm rounded-md transition-colors ${isSelected ? 'bg-blue-100 text-blue-900 font-medium' : 'hover:bg-gray-100'} ${className || ""}`}
      {...props}
    >
      {children}
    </div>
  );
}
