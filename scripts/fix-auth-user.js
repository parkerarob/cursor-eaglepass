/**
 * Fix authentication user mapping
 * Creates a Firestore user document for the authenticated Firebase user
 */

const admin = require('firebase-admin');
const path = require('path');

// Function to resolve service account
const resolveServiceAccount = () => {
  const candidates = [
    process.argv[2],
    process.env.SERVICE_ACCOUNT_PATH,
    './serviceAccountKey.json',
    path.join(process.cwd(), 'serviceAccountKey.json')
  ].filter(Boolean);

  for (const candidate of candidates) {
    try {
      const resolvedPath = path.resolve(candidate);
      console.log(`ℹ️ Trying to load service account from: ${resolvedPath}`);
      const key = require(resolvedPath);
      console.log(`✅ Successfully loaded service account from: ${resolvedPath}`);
      return key;
    } catch (err) {
      if (err.code === 'MODULE_NOT_FOUND') {
        console.log(`⚠️  File not found at '${candidate}'.`);
      } else {
        console.warn(`⚠️  Error loading service account from '${candidate}':`, err.message);
      }
      continue;
    }
  }
  
  console.error('❌ Could not find or load a valid service account key. Please provide the path as an argument or set the SERVICE_ACCOUNT_PATH env var.');
  process.exit(1);
};

// Initialize Firebase Admin
const serviceAccount = resolveServiceAccount();
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

const db = admin.firestore();

// Get user info from environment variables
const firebaseAuthUID = process.env.DEV_USER_UID;
const email = process.env.DEV_USER_EMAIL;
const legacyDevUserId = process.env.LEGACY_DEV_USER_ID;

// Validate environment variables
if (!firebaseAuthUID || typeof firebaseAuthUID !== 'string' || firebaseAuthUID.length < 1) {
    console.error('❌ Invalid or missing DEV_USER_UID. Please check your environment variables.');
    process.exit(1);
}
if (!email || !legacyDevUserId) {
    console.error('❌ Missing environment variables. Please set DEV_USER_EMAIL and LEGACY_DEV_USER_ID.');
    process.exit(1);
}

async function fixAuthUser() {
  console.log('🔧 Fixing Firebase Auth user mapping...');
  
  try {
    // Check if user document already exists
    const userDoc = await db.collection('users').doc(firebaseAuthUID).get();
    
    if (userDoc.exists) {
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
    
    await db.collection('users').doc(firebaseAuthUID).set(devUserData);
    console.log('✅ Created dev user document with Firebase Auth UID');
    console.log('📋 User data:', devUserData);
    
    // Also update the legacy dev user mapping if it exists
    const legacyDevDoc = await db.collection('users').doc(legacyDevUserId).get();
    if (legacyDevDoc.exists) {
      await db.collection('users').doc(legacyDevUserId).delete();
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