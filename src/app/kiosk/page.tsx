
'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { handleAttendanceByCardId } from '@/lib/data-adapter';
import { createLinkRequest, watchTokenStatus } from '@/lib/data-adapter';
import type { LinkRequest } from '@/types';
import { v4 as uuidv4 } from 'uuid';
import Image from 'next/image';
import { CheckCircle, Nfc, QrCode, Wifi, WifiOff, XCircle, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

type KioskMode = 'waiting' | 'register_prompt' | 'register_qr' | 'loading_qr';
type TemporaryState = 'success' | 'error' | null;

export default function KioskPage() {
  const [mode, setMode] = useState<KioskMode>('waiting');
  const [tempState, setTempState] = useState<TemporaryState>(null);
  const [message, setMessage] = useState('NFCタグをタッチしてください');
  const [subMessage, setSubMessage] = useState('');
  const [qrCodeUrl, setQrCodeUrl] = useState('');
  const [registrationUrl, setRegistrationUrl] = useState('');
  const [linkRequestToken, setLinkRequestToken] = useState<string | null>(null);
  const [isOnline, setIsOnline] = useState(true);
  const [inputBuffer, setInputBuffer] = useState('');
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  const resetToWaiting = useCallback(() => {
    setMode('waiting');
    setTempState(null);
    setMessage('NFCタグをタッチしてください');
    setSubMessage('');
    setQrCodeUrl('');
    setRegistrationUrl('');
    setLinkRequestToken(null);
    setInputBuffer('');
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
  }, []);

  const showTemporaryMessage = useCallback((mainMsg: string, subMsg = '', state: TemporaryState = 'success', duration = 3000) => {
    setMessage(mainMsg);
    setSubMessage(subMsg);
    setTempState(state);
    setInputBuffer('');
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    timeoutRef.current = setTimeout(resetToWaiting, duration);
  }, [resetToWaiting]);

  useEffect(() => {
    const updateOnlineStatus = () => setIsOnline(navigator.onLine);
    window.addEventListener('online', updateOnlineStatus);
    window.addEventListener('offline', updateOnlineStatus);
    updateOnlineStatus();
    return () => {
      window.removeEventListener('online', updateOnlineStatus);
      window.removeEventListener('offline', updateOnlineStatus);
    };
  }, []);

  const handleAttendance = useCallback(async (cardId: string) => {
    const result = await handleAttendanceByCardId(cardId);
    if (result.status === 'unregistered') {
      showTemporaryMessage(result.message, result.subMessage || '', 'error');
    } else {
      showTemporaryMessage(result.message, result.subMessage, result.status);
    }
  }, [showTemporaryMessage]);

  const handleRegistration = useCallback(async (cardId: string) => {
    setMode('loading_qr');
    setMessage('登録用リンクを生成中...');
    setSubMessage('しばらくお待ちください');

    try {
        const token = uuidv4();
        await createLinkRequest(token);
        
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost';
  const url = `${appUrl.replace(/\/+$/, '')}/register?token=${token}`;
        setRegistrationUrl(url);
        setQrCodeUrl(`https://api.qrserver.com/v1/create-qr-code/?size=256x256&data=${encodeURIComponent(url)}`);
        setLinkRequestToken(token);
        setMode('register_qr');
        setMessage('QRコードをスキャンしてカードを登録');
        setSubMessage('ESCキーでキャンセル');

    } catch (err) {
        console.error("登録リンク生成エラー:", err);
        showTemporaryMessage('登録エラー', 'リンクを生成できませんでした。接続を確認してください。', 'error');
    }
  }, [showTemporaryMessage]);

 const processInput = useCallback((input: string) => {
    if (!isOnline) {
      showTemporaryMessage('ネットワークがオフラインです', '接続を確認してください。', 'error');
      return;
    }
    const trimmedInput = input.trim();
    if (trimmedInput.length < 3) return;

    if (mode === 'waiting') {
      handleAttendance(trimmedInput);
    } else if (mode === 'register_prompt') {
      handleRegistration(trimmedInput);
    }
  }, [mode, handleAttendance, handleRegistration, showTemporaryMessage, isOnline]);

  useEffect(() => {
    const handleKeyPress = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        resetToWaiting();
        return;
      }
      
      if (mode === 'waiting' && e.key === '/') {
        e.preventDefault();
        setMode('register_prompt');
        setMessage('登録したいNFCタグをタッチしてください');
        setSubMessage('');
        setInputBuffer('');
        return;
      }
      
      if (mode === 'register_qr' || mode === 'loading_qr') return;

      if (e.key === 'Enter') {
        processInput(inputBuffer);
        setInputBuffer(''); 
      } else if (e.key.length === 1 && /^[a-z0-9]+$/i.test(e.key)) {
        setInputBuffer(prev => prev + e.key);
      }
    };

    window.addEventListener('keydown', handleKeyPress);
    return () => {
      window.removeEventListener('keydown', handleKeyPress);
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, [inputBuffer, processInput, resetToWaiting, mode]);
  
  useEffect(() => {
    if (mode === 'register_qr' && linkRequestToken) {
      const q = query(collection(db, "link_requests"), where("token", "==", linkRequestToken), limit(1));
      const unsubscribe = onSnapshot(q, (snapshot) => {
        if (snapshot.empty) return;
        const data = snapshot.docs[0].data() as LinkRequest;
        if (data.status === 'done') {
            showTemporaryMessage('登録が完了しました！', 'カードを使って出退勤を記録できます。', 'success', 4000);
            unsubscribe();
        }
      });

      return () => unsubscribe();
    }
  }, [mode, linkRequestToken, showTemporaryMessage]);

  const KioskIcon = () => {
    const iconClass = "size-48 text-gray-400 transition-all duration-500";
    if (tempState === 'success') return <CheckCircle className={cn(iconClass, "text-green-400")} />;
    if (tempState === 'error') return <XCircle className={cn(iconClass, "text-red-400")} />;
    
    switch (mode) {
      case 'waiting':
        return <Nfc className={cn(iconClass, "animate-pulse")} />;
      case 'register_prompt':
        return <QrCode className={cn(iconClass)} />;
      case 'loading_qr':
          return <Loader2 className={cn(iconClass, "animate-spin")} />;
      default:
        return <Nfc className={cn(iconClass, "animate-pulse")} />;
    }
  };

  const renderContent = () => {
    if (mode === 'register_qr' && qrCodeUrl) {
      return (
        <div className="flex flex-col items-center gap-4 bg-white p-6 rounded-lg shadow-2xl">
          <Image src={qrCodeUrl} alt="Registration QR Code" width={256} height={256} priority />
          <p className="text-sm text-gray-800 break-all">{registrationUrl}</p>
        </div>
      );
    }
    return <KioskIcon />;
  }

  const getSubMessage = () => {
    if(subMessage) return subMessage;
    if(inputBuffer) return inputBuffer;
    return ' ';
  }
  
  return (
    <div className="flex h-full w-full flex-col items-center justify-between p-8 text-center text-white bg-gray-900 bg-gradient-to-br from-gray-900 via-black to-gray-900 overflow-hidden">
       <div className="absolute top-4 right-4 flex items-center gap-2 text-lg font-medium text-gray-300">
        {isOnline ? <Wifi className="text-green-400" /> : <WifiOff className="text-red-400" />}
        <span>{isOnline ? 'オンライン' : 'オフライン'}</span>
      </div>
      
      <div className="w-full" />

      <div className="flex-grow flex flex-col items-center justify-center w-full max-w-4xl">
        <div className="min-h-[224px] flex items-center justify-center mb-8 transition-all duration-500">
          {renderContent()}
        </div>
        <h1 className="text-7xl font-bold whitespace-pre-wrap transition-all duration-500">{message}</h1>
        <p className="text-3xl text-gray-400 mt-4 h-10">{getSubMessage()}</p>
      </div>

      <div className="text-xl text-gray-500 pb-4">
        {mode === 'waiting' && !tempState && <p>新しいカードを登録するには <kbd className="p-1 px-2 bg-gray-700 rounded-md text-gray-300 font-mono">/</kbd> キーを押してください</p>}
        {(mode === 'register_prompt' || mode === 'register_qr') && <p><kbd className="p-1 px-2 bg-gray-700 rounded-md text-gray-300 font-mono">ESC</kbd> キーでキャンセル</p>}
      </div>
    </div>
  );
}

