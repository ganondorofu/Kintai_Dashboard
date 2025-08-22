
'use client';

import Link from 'next/link';
import { Button } from '@/components/ui/button';

export default function Home() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50 space-y-8">
      <div className="text-center space-y-4">
        <h1 className="text-4xl font-bold text-gray-900">IT勤怠管理システム</h1>
        <p className="text-xl text-gray-600">STEM研究部</p>
      </div>
      
      <div className="flex flex-col sm:flex-row gap-4">
        <Link href="/kiosk">
          <Button size="lg" className="w-full sm:w-auto">
            NFC勤怠記録
          </Button>
        </Link>
        <Link href="/login">
          <Button variant="outline" size="lg" className="w-full sm:w-auto">
            管理画面ログイン
          </Button>
        </Link>
      </div>
      
      <div className="text-center text-sm text-gray-500 space-y-1">
        <p>NFCカードをタッチして出退勤を記録</p>
        <p>管理者は勤怠状況を確認できます</p>
      </div>
    </div>
  );
}
