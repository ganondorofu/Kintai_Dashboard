
import { initializeApp, getApps, getApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getAuth } from "firebase/auth";

// データ用Firebase設定（既存のプロジェクト）
const dataFirebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_DATA_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_DATA_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_DATA_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_DATA_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_DATA_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_DATA_APP_ID,
};

// 認証用Firebase設定（stem-comプロジェクト）
const authFirebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_AUTH_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_AUTH_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_AUTH_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_AUTH_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_AUTH_APP_ID,
  measurementId: process.env.NEXT_PUBLIC_FIREBASE_AUTH_MEASUREMENT_ID
};

// Firebase appの初期化
const dataApp = getApps().find(app => app.name === 'data') || initializeApp(dataFirebaseConfig, 'data');
const authApp = getApps().find(app => app.name === 'auth') || initializeApp(authFirebaseConfig, 'auth');

// Firestore（データ用）とAuth（認証用）をエクスポート
export const db = getFirestore(dataApp);
export const auth = getAuth(authApp);
export { dataApp as app }; // 既存のコードとの互換性のため

