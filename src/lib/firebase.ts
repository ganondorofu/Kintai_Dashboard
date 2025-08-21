import { initializeApp, getApps, getApp } from "firebase/app";
import { getAuth, signInWithRedirect, GithubAuthProvider, signOut, getRedirectResult } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

// Initialize Firebase
const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();
const auth = getAuth(app);
const db = getFirestore(app);

const githubProvider = new GithubAuthProvider();
// Request access to check organization membership
githubProvider.addScope('read:org');


const signInWithGitHub = () => {
  // Use signInWithRedirect instead of signInWithPopup
  return signInWithRedirect(auth, githubProvider);
};

const getGitHubRedirectResult = () => {
  return getRedirectResult(auth);
};

const signOutUser = () => {
  return signOut(auth);
};


export { app, auth, db, githubProvider, signInWithGitHub, signOutUser, getGitHubRedirectResult };
