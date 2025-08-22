import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * 期生番号を日本語の学年表記に変換
 * @param grade 期生番号（数値）
 * @returns 日本語学年表記（例：「2年生」）
 */
export function convertToJapaneseGrade(grade: number): string {
  // 2025年基準: 10期生=1年生, 9期生=2年生, 8期生=3年生
  switch (grade) {
    case 10: return '1年生';
    case 9: return '2年生';
    case 8: return '3年生';
    default: return `${grade}期生`;
  }
}
