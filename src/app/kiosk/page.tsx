'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { addDoc, collection, serverTimestamp, query, where, orderBy, limit, getDocs, onSnapshot, doc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import type { LinkRequest } from '@/types';
import { v4 as uuidv4 } from 'uuid';
import Image from 'next/image';

type KioskMode = 'waiting' | 'register_prompt' | 'register_qr' | 'success' | 'error';

export default function KioskPage() {
  const [mode, setMode] = useState<KioskMode>('waiting');
  const [message, setMessage] = useState('NFCタグをタッチしてください');
  const [qrCodeUrl, setQrCodeUrl] = useState('');
  const [linkRequestToken, setLinkRequestToken] = useState<string | null>(null);

  const inputBuffer = useRef('');
  const inputTimeout = useRef<NodeJS.Timeout | null>(null);

  const resetToWaiting = useCallback(() => {
    setMode('waiting');
    setMessage('NFCタグをタッチしてください');
    setQrCodeUrl('');
    setLinkRequestToken(null);
    inputBuffer.current = '';
  }, []);
  
  const showTemporaryMessage = useCallback((msg: string, duration: number, nextMode: KioskMode = 'waiting') => {
    setMessage(msg);
    setMode(nextMode === 'waiting' ? 'success' : 'error');
    setTimeout(() => {
      if(nextMode === 'waiting') {
        resetToWaiting();
      } else {
        setMode(nextMode);
      }
    }, duration);
  }, [resetToWaiting]);

  const handleAttendance = useCallback(async (cardId: string) => {
    try {
      const usersRef = collection(db, 'users');
      const userQuery = query(usersRef, where('cardId', '==', cardId), limit(1));
      const userSnapshot = await getDocs(userQuery);

      if (userSnapshot.empty) {
        showTemporaryMessage('未登録のカードです', 2000, 'waiting');
        return;
      }
      const userData = userSnapshot.docs[0].data();
      const userId = userSnapshot.docs[0].id;
      
      const logsRef = collection(db, 'attendance_logs');
      const lastLogQuery = query(logsRef, where('cardId', '==', cardId), orderBy('timestamp', 'desc'), limit(1));
      const lastLogSnapshot = await getDocs(lastLogQuery);

      let logType: 'entry' | 'exit' = 'entry';
      if (!lastLogSnapshot.empty) {
        const lastLog = lastLogSnapshot.docs[0].data();
        if (lastLog.type === 'entry') {
          logType = 'exit';
        }
      }

      await addDoc(logsRef, {
        uid: userId,
        cardId: cardId,
        type: logType,
        timestamp: serverTimestamp(),
      });
      
      const welcomeMsg = `こんにちは, ${userData.firstname}さん！`;
      const actionMsg = logType === 'entry' ? '入室しました' : '退室しました';
      showTemporaryMessage(`${welcomeMsg}\n${actionMsg}`, 2000);

    } catch (err) {
      console.error(err);
      showTemporaryMessage('エラーが発生しました', 2000);
    }
  }, [showTemporaryMessage]);

  const handleRegistration = useCallback(async (cardId: string) => {
    try {
        const token = uuidv4();
        const docRef = await addDoc(collection(db, 'link_requests'), {
            token: token,
            cardId: cardId,
            status: 'waiting',
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
        });
        
        const registrationUrl = `${window.location.origin}/register?token=${token}`;
        setQrCodeUrl(`https://api.qrserver.com/v1/create-qr-code/?size=256x256&data=${encodeURIComponent(registrationUrl)}`);
        setLinkRequestToken(docRef.id);
        setMode('register_qr');
        setMessage('QRコードをスキャンして登録を完了してください');

    } catch (err) {
        console.error(err);
        showTemporaryMessage('登録エラー', 2000, 'register_prompt');
    }
  }, [showTemporaryMessage]);

  const processInput = useCallback((input: string) => {
    if (mode === 'waiting') {
      handleAttendance(input);
    } else if (mode === 'register_prompt') {
      handleRegistration(input);
    }
  }, [mode, handleAttendance, handleRegistration]);

  useEffect(() => {
    const handleKeyPress = (e: KeyboardEvent) => {
      if (e.key === '/') {
        setMode('register_prompt');
        setMessage('登録するNFCタグをタッチしてください');
        return;
      }
      
      if(e.key === 'Escape'){
        resetToWaiting();
        return;
      }

      if (/^[a-z0-9]$/i.test(e.key)) {
        inputBuffer.current += e.key;

        if (inputTimeout.current) {
          clearTimeout(inputTimeout.current);
        }

        inputTimeout.current = setTimeout(() => {
          if (inputBuffer.current.length > 0) {
            processInput(inputBuffer.current);
            inputBuffer.current = '';
          }
        }, 500); // 500ms timeout to detect end of input
      }
    };

    window.addEventListener('keydown', handleKeyPress);
    return () => {
      window.removeEventListener('keydown', handleKeyPress);
      if (inputTimeout.current) clearTimeout(inputTimeout.current);
    };
  }, [processInput, resetToWaiting]);
  
  useEffect(() => {
    if (mode === 'register_qr' && linkRequestToken) {
      const docRef = doc(db, 'link_requests', linkRequestToken);
      const unsubscribe = onSnapshot(docRef, (doc) => {
        const data = doc.data() as LinkRequest | undefined;
        if (data && data.status === 'done') {
            showTemporaryMessage('登録が完了しました！', 3000, 'waiting');
            unsubscribe();
        }
      });

      return () => unsubscribe();
    }
  }, [mode, linkRequestToken, showTemporaryMessage]);

  const renderContent = () => {
    switch (mode) {
      case 'register_qr':
        return qrCodeUrl ? <Image src={qrCodeUrl} alt="Registration QR Code" width={256} height={256} /> : <div className="h-10 w-10 animate-spin rounded-full border-4 border-white border-t-transparent" />;
      case 'waiting':
      case 'register_prompt':
      case 'success':
      case 'error':
      default:
        return null;
    }
  }

  return (
    <div className="flex h-full w-full flex-col items-center justify-center p-8 text-center">
      <h1 className="text-6xl font-bold whitespace-pre-wrap">{message}</h1>
      <div className="mt-12">
        {renderContent()}
      </div>
      <div className="absolute bottom-8 text-2xl text-gray-500">
        {mode === 'waiting' && <p>新規登録は[/]キーを押してください</p>}
        {mode !== 'waiting' && <p>[ESC]キーで待機画面に戻ります</p>}
      </div>
    </div>
  );
}
