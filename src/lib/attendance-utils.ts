/**
 * 学年・期生変換ユーティリティ
 */

// 学年変換関数（チーム名から学年へ）
export const convertPeriodToGrade = (teamName: string): string => {
  if (teamName?.includes('10期生')) return '1年生';
  if (teamName?.includes('9期生')) return '2年生';
  if (teamName?.includes('8期生')) return '3年生';
  return teamName || '未所属';
};

// 数値やperiod情報を表示用学年に変換
export const convertGradeToDisplay = (grade: any): string => {
  if (typeof grade === 'number') {
    // 数値の場合（10, 9, 8 など）
    if (grade === 10) return '1年生';
    if (grade === 9) return '2年生';
    if (grade === 8) return '3年生';
    return `${grade}期生`;
  }
  
  if (typeof grade === 'string') {
    // 文字列の場合
    if (grade.includes('10期生') || grade.includes('10')) return '1年生';
    if (grade.includes('9期生') || grade.includes('9')) return '2年生';
    if (grade.includes('8期生') || grade.includes('8')) return '3年生';
    return grade;
  }
  
  return '不明';
};

// 時間帯による挨拶を取得
export const getGreeting = (): string => {
  const hour = new Date().getHours();
  if (hour < 6) return 'お疲れ様です';
  if (hour < 12) return 'おはようございます';
  if (hour < 18) return 'こんにちは';
  return 'お疲れ様です';
};

// 現在時刻をフォーマット
export const formatCurrentTime = (): string => {
  return new Date().toLocaleString('ja-JP', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
};
