import {
  getAuth,
  onAuthStateChanged,
  signInWithPopup,
  signOut as firebaseSignOut,
  GoogleAuthProvider,
  type User as FirebaseUser,
} from 'firebase/auth';
import { firebaseApp } from './config';
import { useRouter } from 'next/navigation';

export const auth = getAuth(firebaseApp);
export const googleProvider = new GoogleAuthProvider();

googleProvider.setCustomParameters({
  prompt: 'select_account',
});

export const signInWithGoogle = () => signInWithPopup(auth, googleProvider);

export const signOut = () => firebaseSignOut(auth);

export const signOutAndRedirect = () => {
  const router = typeof window !== 'undefined' ? require('next/navigation').useRouter() : null;
  return firebaseSignOut(auth).then(() => {
    if (router) router.push('/');
    else if (typeof window !== 'undefined') window.location.href = '/';
  });
};

export { onAuthStateChanged };
export type { FirebaseUser }; 