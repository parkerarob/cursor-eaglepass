/**
 * Simple fix for authentication user mapping using Firebase CLI
 */

// Using the Firebase client SDK to directly add the user to Firestore
const { initializeApp } = require('firebase/app');
const { getFirestore, doc, setDoc, getDoc, deleteDoc } = require('firebase/firestore');

// Load environment variables
require('dotenv').config({ path: '.env.local' });

// Firebase config using environment variables
const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

// Validate Firebase config
const requiredConfig = ['apiKey', 'authDomain', 'projectId', 'storageBucket', 'messagingSenderId', 'appId'];
const missingConfig = requiredConfig.filter(key => !firebaseConfig[key]);

if (missingConfig.length > 0) {
  console.error(`❌ Missing Firebase configuration keys: ${missingConfig.join(', ')}. Please check your .env.local file.`);
  process.exit(1);
}

// The actual Firebase Auth UID from environment variables
const firebaseAuthUID = process.env.DEV_USER_UID;
const email = process.env.DEV_USER_EMAIL;
const legacyDevUserId = process.env.LEGACY_DEV_USER_ID;

// Validate environment variables for the script
if (!firebaseAuthUID || !email || !legacyDevUserId) {
  console.error('❌ Missing environment variables. Please set DEV_USER_UID, DEV_USER_EMAIL, and LEGACY_DEV_USER_ID.');
  process.exit(1);
}

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

async function fixAuthUser() {
  console.log('🔧 Fixing Firebase Auth user mapping...');
  
  try {
    // Check if user document already exists
    const userDocRef = doc(db, 'users', firebaseAuthUID);
    const userDoc = await getDoc(userDocRef);
    
    if (userDoc.exists()) {
      console.log('✅ User document already exists:', userDoc.data());
      return;
    }
    
    // Create the missing user document
    const devUserData = {
      id: firebaseAuthUID,
      email: email,
      role: 'dev',
      firstName: 'Robert',
      lastName: 'Parker',
      assignedLocationId: 'main-office-100'
    };
    
    await setDoc(userDocRef, devUserData);
    console.log('✅ Created dev user document with Firebase Auth UID');
    console.log('📋 User data:', devUserData);
    
    // Also remove the legacy dev user mapping if it exists
    const legacyDevDocRef = doc(db, 'users', legacyDevUserId);
    const legacyDevDoc = await getDoc(legacyDevDocRef);
    if (legacyDevDoc.exists()) {
      await deleteDoc(legacyDevDocRef);
      console.log('🗑️  Removed legacy dev user document');
    }
    
    console.log('✅ Authentication mapping fixed!');
    
  } catch (error) {
    console.error('❌ Error fixing auth user:', error);
    process.exit(1);
  }
}

// Run the fix
fixAuthUser()
  .then(() => {
    console.log('🎉 Auth user fix completed successfully!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Auth user fix failed:', error);
    process.exit(1);
  }); 