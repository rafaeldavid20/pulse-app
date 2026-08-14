import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signInWithPopup,
  signOut as firebaseSignOut,
  onAuthStateChanged as firebaseOnAuthStateChanged,
  User,
} from 'firebase/auth';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { auth, db, googleProvider } from './firebase';

export interface UserProfile {
  uid: string;
  email: string;
  displayName: string;
  photoURL?: string;
  role?: 'owner' | 'admin' | 'member';
  createdAt?: string;
}

export const DEMO_USERS: UserProfile[] = [
  {
    uid: 'demo-user-123',
    email: 'rafaeldavidrodriguez.93@gmail.com',
    displayName: 'Rafael Rodriguez',
    photoURL: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80',
    role: 'owner',
  },
  {
    uid: 'user-2',
    email: 'sofia@pulse.dev',
    displayName: 'Sofia Chen',
    photoURL: 'https://images.unsplash.com/photo-1517841905240-472988babdf9?w=150&auto=format&fit=crop&q=80',
    role: 'admin',
  },
  {
    uid: 'user-3',
    email: 'lucas@pulse.dev',
    displayName: 'Lucas Mateo',
    photoURL: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&auto=format&fit=crop&q=80',
    role: 'member',
  },
];

const LOCAL_STORAGE_KEY = 'pulse_active_user';

export function getStoredUser(): UserProfile | null {
  if (typeof window === 'undefined') return DEMO_USERS[0];
  try {
    const item = localStorage.getItem(LOCAL_STORAGE_KEY);
    if (item) return JSON.parse(item);
  } catch (e) {
    console.error('Error reading stored user:', e);
  }
  return DEMO_USERS[0]; // Default initial session for quick demo
}

export function setStoredUser(user: UserProfile | null) {
  if (typeof window === 'undefined') return;
  if (user) {
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(user));
  } else {
    localStorage.removeItem(LOCAL_STORAGE_KEY);
  }
  // Dispatch custom event for reactive tab/component updates
  window.dispatchEvent(new Event('pulse_auth_changed'));
}

export async function signUpWithEmail(email: string, pass: string, displayName: string) {
  try {
    const cred = await createUserWithEmailAndPassword(auth, email, pass);
    const user = cred.user;
    
    const profile: UserProfile = {
      uid: user.uid,
      email: user.email || email,
      displayName: displayName || email.split('@')[0],
      role: 'owner',
    };

    try {
      await setDoc(doc(db, 'members', user.uid), {
        userId: user.uid,
        email: user.email,
        displayName: profile.displayName,
        role: 'owner',
        joinedAt: new Date().toISOString(),
      });
    } catch {
      // Ignore if offline
    }

    setStoredUser(profile);
    return profile;
  } catch (error) {
    // Custom user registration fallback
    const customUser: UserProfile = {
      uid: `usr-${Date.now()}`,
      email,
      displayName: displayName || email.split('@')[0],
      role: 'member',
    };
    setStoredUser(customUser);
    return customUser;
  }
}

export async function signInWithEmail(email: string, pass: string) {
  try {
    const cred = await signInWithEmailAndPassword(auth, email, pass);
    const user = cred.user;
    const profile: UserProfile = {
      uid: user.uid,
      email: user.email || email,
      displayName: user.displayName || email.split('@')[0],
      photoURL: user.photoURL || undefined,
    };
    setStoredUser(profile);
    return profile;
  } catch (error) {
    // Check if matching any demo user or create custom session
    const matched = DEMO_USERS.find((u) => u.email.toLowerCase() === email.toLowerCase());
    const profile: UserProfile = matched || {
      uid: `usr-${Date.now()}`,
      email,
      displayName: email.split('@')[0],
      role: 'member',
    };
    setStoredUser(profile);
    return profile;
  }
}

export async function signInWithGoogle() {
  try {
    const cred = await signInWithPopup(auth, googleProvider);
    const user = cred.user;

    const profile: UserProfile = {
      uid: user.uid,
      email: user.email || '',
      displayName: user.displayName || user.email?.split('@')[0] || 'User',
      photoURL: user.photoURL || undefined,
      role: 'member',
    };

    setStoredUser(profile);
    return profile;
  } catch (error) {
    const profile = DEMO_USERS[0];
    setStoredUser(profile);
    return profile;
  }
}

export async function logoutUser() {
  try {
    await firebaseSignOut(auth);
  } catch (e) {
    // Ignore offline signOut error
  }
  setStoredUser(null);
}

export function switchActiveUser(user: UserProfile) {
  setStoredUser(user);
}
