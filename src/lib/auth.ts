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
import { createUserWorkspace, processPendingInvitations, UserDoc } from './firestore';

export interface UserProfile {
  uid: string;
  email: string;
  displayName: string;
  photoURL?: string;
  createdAt?: string;
}

export async function signUpWithEmail(
  email: string,
  pass: string,
  displayName: string,
  workspaceName?: string
): Promise<User> {
  const cred = await createUserWithEmailAndPassword(auth, email, pass);
  const user = cred.user;

  const finalName = displayName || email.split('@')[0];
  const wsName = workspaceName?.trim() || `Workspace de ${finalName}`;

  await createUserWorkspace(user.uid, user.email || email, finalName, wsName);
  await processPendingInvitations(user.uid, user.email || email, finalName);

  return user;
}

export async function signInWithEmail(email: string, pass: string): Promise<User> {
  const cred = await signInWithEmailAndPassword(auth, email, pass);
  return cred.user;
}

export async function signInWithGoogle(): Promise<User> {
  const cred = await signInWithPopup(auth, googleProvider);
  const user = cred.user;

  const userRef = doc(db, 'users', user.uid);
  const userSnap = await getDoc(userRef);

  if (!userSnap.exists()) {
    const finalName = user.displayName || user.email?.split('@')[0] || 'User';
    const wsName = `Workspace de ${finalName}`;
    await createUserWorkspace(user.uid, user.email || '', finalName, wsName);
    await processPendingInvitations(user.uid, user.email || '', finalName);
  }

  return user;
}

export async function logoutUser(): Promise<void> {
  await firebaseSignOut(auth);
}

export function subscribeAuthState(callback: (user: UserProfile | null) => void) {
  return firebaseOnAuthStateChanged(auth, async (firebaseUser: User | null) => {
    if (firebaseUser) {
      let name = firebaseUser.displayName || firebaseUser.email?.split('@')[0] || 'Usuario';
      try {
        const userSnap = await getDoc(doc(db, 'users', firebaseUser.uid));
        if (userSnap.exists()) {
          const data = userSnap.data() as UserDoc;
          if (data.displayName) name = data.displayName;
        }
      } catch (e) {
        // Fallback
      }

      callback({
        uid: firebaseUser.uid,
        email: firebaseUser.email || '',
        displayName: name,
        photoURL: firebaseUser.photoURL || undefined,
      });
    } else {
      callback(null);
    }
  });
}

// Detailed Error translator helper
export function getFirebaseErrorMessage(errorCode: string): string {
  console.error('Firebase Auth Exception Code:', errorCode);
  switch (errorCode) {
    case 'auth/unauthorized-domain':
      return 'Dominio no autorizado: El dominio pulse-app--pulse-app-93.us-east4.hosted.app debe agregarse en Firebase Console (Authentication > Settings > Authorized Domains).';
    case 'auth/operation-not-allowed':
      return 'Proveedor desactivado: Habilita el inicio de sesión con Google en Firebase Console (Authentication > Sign-in method > Google).';
    case 'auth/popup-closed-by-user':
      return 'El cuadro emergente de Google se cerró antes de completar el inicio de sesión.';
    case 'auth/popup-blocked':
      return 'El navegador bloqueó la ventana emergente de Google. Permite ventanas emergentes para este sitio.';
    case 'auth/invalid-email':
      return 'El correo electrónico ingresado no es válido.';
    case 'auth/user-disabled':
      return 'Esta cuenta de usuario ha sido deshabilitada.';
    case 'auth/user-not-found':
      return 'No existe una cuenta registrada con este correo electrónico.';
    case 'auth/wrong-password':
    case 'auth/invalid-credential':
      return 'La contraseña ingresada es incorrecta o las credenciales no son válidas.';
    case 'auth/email-already-in-use':
      return 'Ya existe una cuenta registrada con este correo electrónico.';
    case 'auth/weak-password':
      return 'La contraseña debe tener al menos 6 caracteres.';
    case 'auth/network-request-failed':
      return 'Error de conexión de red. Verifica tu conexión a internet.';
    default:
      return `Error de autenticación (${errorCode}). Por favor verifica la configuración de Firebase Auth.`;
  }
}
