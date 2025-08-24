
import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * 期生番号を日本語の学年表記に変換
 * @param grade 期生番号（数値）
 * @returns 日本語学年表記（例：「2年生 (9期生)」）
 */
export function convertToJapaneseGrade(grade: number): string {
  const currentYear = new Date().getFullYear();
  // 2025年を基準: 10期生が1年生
  const baseYear = 2025;
  const gradeFromKisei = (baseYear - grade) + 1 + (currentYear - baseYear);
  
  if (gradeFromKisei >= 1 && gradeFromKisei <= 3) {
    return `${gradeFromKisei}年生 (${grade}期生)`;
  }
  return `${grade}期生`;
}

export function convertGradeToDisplay(grade: any): string {
  if (typeof grade === 'number') {
    return convertToJapaneseGrade(grade);
  }
  
  if (typeof grade === 'string') {
    const num = parseInt(grade);
    if (!isNaN(num)) {
      return convertToJapaneseGrade(num);
    }
    return grade;
  }
  
  return '不明';
};
