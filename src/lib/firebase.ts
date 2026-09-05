import { initializeApp, getApps, getApp } from 'firebase/app';
import { connectAuthEmulator, getAuth, GoogleAuthProvider } from 'firebase/auth';
import { connectFirestoreEmulator, getFirestore } from 'firebase/firestore';
import { connectFunctionsEmulator, getFunctions } from 'firebase/functions';

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY || 'AIzaSyAINMPrTeemW6gsIOnHzsHicY9JedL7BVc',
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN || 'pulse-app-93.firebaseapp.com',
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || 'pulse-app-93',
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET || 'pulse-app-93.firebasestorage.app',
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID || '775779828067',
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID || '1:775779828067:web:4995015968d3216c8f5356',
};

// Initialize Firebase App
const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();

export const auth = getAuth(app);
export const db = getFirestore(app);
export const functions = getFunctions(app, 'us-east4');
export const googleProvider = new GoogleAuthProvider();

// Point the client SDK at local emulators instead of production Firebase.
// Guarded by a global flag so hot-reloads in dev don't try to reconnect
// (each of these throws if called more than once per app instance) and so
// this never accidentally runs against production.
declare global {
  var __pulseEmulatorsConnected: boolean | undefined;
}

if (process.env.NEXT_PUBLIC_USE_EMULATORS === 'true' && !globalThis.__pulseEmulatorsConnected) {
  globalThis.__pulseEmulatorsConnected = true;
  connectAuthEmulator(auth, 'http://127.0.0.1:9099', { disableWarnings: true });
  connectFirestoreEmulator(db, '127.0.0.1', 8080);
  connectFunctionsEmulator(functions, '127.0.0.1', 5001);
  console.info('[Firebase] Connected to local emulators (auth:9099, firestore:8080, functions:5001).');
}

export default app;
