// ============================================
// RAM Dosya Atama - Utility Fonksiyonları
// ============================================

import { type ClassValue } from "clsx";
import clsx from "clsx";
import { twMerge } from "tailwind-merge";
import type { CaseType } from "@/types";
import { CASE_TYPE_LABELS } from "@/lib/constants";

/**
 * Tailwind class'larını birleştirir
 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Benzersiz ID üretir
 */
export function uid(): string {
  return Math.random().toString(36).slice(2, 9);
}

/**
 * Dosya türünü insan okunur formata çevirir
 */
export function humanType(type?: CaseType): string {
  return type ? CASE_TYPE_LABELS[type] : "—";
}

/**
 * CSV için string'i escape eder
 */
export function csvEscape(value: string | number): string {
  const s = String(value ?? "");
  if (s.includes(",") || s.includes("\n") || s.includes('"')) {
    return '"' + s.replaceAll('"', '""') + '"';
  }
  return s;
}

/**
 * Değeri güvenli bir şekilde parse eder
 */
export function safeParse<T>(json: string, defaultValue: T): T {
  try {
    return JSON.parse(json) as T;
  } catch {
    return defaultValue;
  }
}

/**
 * Değeri güvenli bir şekilde string'e çevirir
 */
export function safeStringify(value: unknown): string {
  try {
    return JSON.stringify(value);
  } catch {
    return "{}";
  }
}

/**
 * LocalStorage'dan güvenli bir şekilde okur
 */
export function safeGetItem(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

/**
 * LocalStorage'a güvenli bir şekilde yazar
 */
export function safeSetItem(key: string, value: string): boolean {
  try {
    localStorage.setItem(key, value);
    return true;
  } catch {
    return false;
  }
}

/**
 * LocalStorage'dan güvenli bir şekilde siler
 */
export function safeRemoveItem(key: string): boolean {
  try {
    localStorage.removeItem(key);
    return true;
  } catch {
    return false;
  }
}

