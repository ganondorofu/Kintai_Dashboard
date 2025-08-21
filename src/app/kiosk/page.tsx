'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { addDoc, collection, serverTimestamp, query, where, orderBy, limit, getDocs, onSnapshot, doc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import type { LinkRequest } from '@/types';
import { v4 as uuidv4 } from 'uuid';
import Image from 'next/image';
import { CheckCircle, Nfc, QrCode, Wifi, WifiOff, XCircle, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

type KioskMode = 'waiting' | 'register_prompt' | 'register_qr' | 'loading_qr' | 'success' | 'error';

const KioskIcon = ({ mode }: { mode: KioskMode }) => {
  const iconClass = "size-48 text-gray-400 transition-all duration-500";
  
  switch (mode) {
    case 'waiting':
      return <Nfc className={cn(iconClass, "animate-pulse")} />;
    case 'register_prompt':
      return <QrCode className={cn(iconClass)} />;
    case 'loading_qr':
        return <Loader2 className={cn(iconClass, "animate-spin")} />;
    case 'success':
      return <CheckCircle className={cn(iconClass, "text-green-400")} />;
    case 'error':
      return <XCircle className={cn(iconClass, "text-red-400")} />;
    default:
      return null;
  }
};


export default function KioskPage() {
  const [mode, setMode] = useState<KioskMode>('waiting');
  const [message, setMessage] = useState('Touch NFC tag');
  const [subMessage, setSubMessage] = useState('');
  const [qrCodeUrl, setQrCodeUrl] = useState('');
  const [linkRequestToken, setLinkRequestToken] = useState<string | null>(null);
  const [isOnline, setIsOnline] = useState(true);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);


  const inputBuffer = useRef('');
  const inputTimeout = useRef<NodeJS.Timeout | null>(null);
  
  const resetToWaiting = useCallback(() => {
    setMode('waiting');
    setMessage('Touch NFC tag');
    setSubMessage('');
    setQrCodeUrl('');
    setLinkRequestToken(null);
    inputBuffer.current = '';
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
  }, []);

  const showTemporaryState = useCallback((mode: KioskMode, mainMsg: string, subMsg = '', duration = 3000) => {
    setMode(mode);
    setMessage(mainMsg);
    setSubMessage(subMsg);
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
    try {
      const usersRef = collection(db, 'users');
      const userQuery = query(usersRef, where('cardId', '==', cardId), limit(1));
      const userSnapshot = await getDocs(userQuery);

      if (userSnapshot.empty) {
        showTemporaryState('error', 'Unregistered Card', 'Press "/" to register this card.');
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
      
      const welcomeMsg = `Welcome, ${userData.firstname}!`;
      const actionMsg = logType === 'entry' ? 'Checked In' : 'Checked Out';
      showTemporaryState('success', welcomeMsg, actionMsg);

    } catch (err) {
      console.error(err);
      showTemporaryState('error', 'An Error Occurred', 'Please try again.');
    }
  }, [showTemporaryState]);

  const handleRegistration = useCallback(async (cardId: string) => {
    setMode('loading_qr');
    setMessage('Generating Registration Link...');
    setSubMessage('Please wait a moment.');

    try {
        const token = uuidv4();
        await addDoc(collection(db, 'link_requests'), {
            token: token,
            cardId: cardId,
            status: 'waiting',
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
        });
        
        const registrationUrl = `${window.location.origin}/register?token=${token}`;
        setQrCodeUrl(`https://api.qrserver.com/v1/create-qr-code/?size=256x256&data=${encodeURIComponent(registrationUrl)}`);
        setLinkRequestToken(token); // Use token to listen for changes
        setMode('register_qr');
        setMessage('Scan QR code to link your card');
        setSubMessage('Press ESC to cancel');

    } catch (err) {
        console.error(err);
        showTemporaryState('error', 'Registration Error', 'Could not generate link. Please try again.');
    }
  }, [showTemporaryState]);

  const processInput = useCallback((input: string) => {
    if (!isOnline) {
      showTemporaryState('error', 'Network Offline', 'Please check connection.');
      return;
    }
    const trimmedInput = input.trim();
    if (trimmedInput.length < 3) return; // Ignore very short inputs

    if (mode === 'waiting') {
      handleAttendance(trimmedInput);
    } else if (mode === 'register_prompt') {
      handleRegistration(trimmedInput);
    }
  }, [mode, handleAttendance, handleRegistration, showTemporaryState, isOnline]);

  useEffect(() => {
    const handleKeyPress = (e: KeyboardEvent) => {
      // Allow Escape key to work anytime to reset
      if (e.key === 'Escape') {
        resetToWaiting();
        return;
      }
      
      // Allow '/' key only in waiting mode to start registration
      if (mode === 'waiting' && e.key === '/') {
        e.preventDefault();
        setMode('register_prompt');
        setMessage('Touch the new NFC tag to register');
        setSubMessage('');
        return;
      }

      // If QR is shown, don't accept other inputs
      if (mode === 'register_qr' || mode === 'loading_qr' || mode === 'success' || mode === 'error') return;

      if (e.key === 'Enter') {
        processInput(inputBuffer.current);
        inputBuffer.current = ''; // Reset buffer after processing
      } else if (e.key.length === 1 && /^[a-z0-9]+$/i.test(e.key)) {
        // Only add alphanumeric characters to the buffer
        inputBuffer.current += e.key;
      }
    };

    window.addEventListener('keydown', handleKeyPress);
    return () => {
      window.removeEventListener('keydown', handleKeyPress);
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, [mode, processInput, resetToWaiting]);
  
  useEffect(() => {
    if (mode === 'register_qr' && linkRequestToken) {
      const q = query(collection(db, "link_requests"), where("token", "==", linkRequestToken), limit(1));
      const unsubscribe = onSnapshot(q, (snapshot) => {
        if (snapshot.empty) return;
        const data = snapshot.docs[0].data() as LinkRequest;
        if (data.status === 'done') {
            showTemporaryState('success', 'Registration Complete!', 'You can now use your tag to check in.', 4000);
            unsubscribe();
        }
      });

      return () => unsubscribe();
    }
  }, [mode, linkRequestToken, showTemporaryState]);

  const renderContent = () => {
    if (mode === 'register_qr' && qrCodeUrl) {
      return (
        <div className="bg-white p-4 rounded-lg shadow-2xl">
          <Image src={qrCodeUrl} alt="Registration QR Code" width={256} height={256} priority />
        </div>
      );
    }
    return <KioskIcon mode={mode} />;
  }

  return (
    <div className="flex h-full w-full flex-col items-center justify-between p-8 text-center text-white bg-gray-900 bg-gradient-to-br from-gray-900 via-black to-gray-900 overflow-hidden">
       <div className="absolute top-4 right-4 flex items-center gap-2 text-lg font-medium text-gray-300">
        {isOnline ? <Wifi className="text-green-400" /> : <WifiOff className="text-red-400" />}
        <span>{isOnline ? 'Online' : 'Offline'}</span>
      </div>
      
      <div className="w-full" />

      <div className="flex-grow flex flex-col items-center justify-center w-full max-w-4xl">
        <div className="min-h-[224px] flex items-center justify-center mb-8 transition-all duration-500">
          {renderContent()}
        </div>
        <h1 className="text-7xl font-bold whitespace-pre-wrap transition-all duration-500">{message}</h1>
        {subMessage && <p className="text-3xl text-gray-400 mt-4">{subMessage}</p>}
      </div>

      <div className="text-xl text-gray-500 pb-4">
        {mode === 'waiting' && <p>Press <kbd className="p-1 px-2 bg-gray-700 rounded-md text-gray-300 font-mono">/</kbd> for new registration</p>}
        {(mode === 'register_prompt' || mode === 'register_qr') && <p>Press <kbd className="p-1 px-2 bg-gray-700 rounded-md text-gray-300 font-mono">ESC</kbd> to cancel</p>}
      </div>
    </div>
  );
}
