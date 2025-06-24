import {
  onAuthStateChanged,
  signInWithPopup,
  signOut as firebaseSignOut,
  GoogleAuthProvider,
  type User as FirebaseUser,
} from 'firebase/auth';
import { auth } from './config';

export const googleProvider = new GoogleAuthProvider();

googleProvider.setCustomParameters({
  prompt: 'select_account',
});

export const signInWithGoogle = async () => {
  try {
    return await signInWithPopup(auth, googleProvider);
  } catch (error) {
    console.error('Google sign-in failed:', error);
    throw error;
  }
};

export const signOut = async () => {
  try {
    // Remove session token from localStorage (if any)
    if (typeof window !== 'undefined') {
      localStorage.removeItem('sessionToken');
    }
  } catch (error) {
    console.error('Session token removal failed during logout:', error);
  }

  // Sign out of Firebase
  await firebaseSignOut(auth);
  
  // Redirect to homepage after sign out to ensure clean state
  if (typeof window !== 'undefined') {
    try {
      window.location.href = '/';
    } catch (error) {
      console.error('Redirect failed during logout:', error);
    }
  }
};

export { onAuthStateChanged };
export type { FirebaseUser }; 