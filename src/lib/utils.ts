import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function generateId(): string {
  return Date.now().toString(36) + Math.random().toString(36).substr(2, 9);
}

export function generateOrderNumber(): string {
  const prefix = "ORD";
  const num = Math.floor(1000 + Math.random() * 9000);
  return `${prefix}-${num}`;
}
