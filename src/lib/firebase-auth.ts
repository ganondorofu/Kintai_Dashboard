import { 
  signInWithPopup, 
  GithubAuthProvider, 
  signOut as firebaseSignOut,
  onAuthStateChanged,
  User
} from 'firebase/auth';
import { auth } from './firebase';

/**
 * Firebase Authentication（stem-comプロジェクト）を使ったGitHub認証
 * 既存システムと同じFirebase Auth UIDを生成
 */

const githubProvider = new GithubAuthProvider();

// GitHub認証でサインイン
export const signInWithGitHub = async () => {
  try {
    const result = await signInWithPopup(auth, githubProvider);
    return result.user;
  } catch (error) {
    console.error('GitHub認証エラー:', error);
    throw error;
  }
};

// サインアウト
export const signOut = async () => {
  try {
    await firebaseSignOut(auth);
  } catch (error) {
    console.error('サインアウトエラー:', error);
    throw error;
  }
};

// 認証状態の監視
export const onAuthStateChange = (callback: (user: User | null) => void) => {
  return onAuthStateChanged(auth, callback);
};

// 現在のユーザーを取得
export const getCurrentUser = () => {
  return auth.currentUser;
};

// Firebase Auth User型をエクスポート
export type { User as FirebaseUser } from 'firebase/auth';
