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
      return require(path.resolve(candidate));
    } catch (err) {
      continue;
    }
  }
  
  console.error('❌ Could not find service account key. Please provide path as argument or set SERVICE_ACCOUNT_PATH env var');
  process.exit(1);
};

// Initialize Firebase Admin
const serviceAccount = resolveServiceAccount();
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

const db = admin.firestore();

async function fixAuthUser() {
  console.log('🔧 Fixing Firebase Auth user mapping...');
  
  try {
    // The actual Firebase Auth UID from users.json
    const firebaseAuthUID = 'OcfLegbLZAeC1EuWuZcWNpywiKq1';
    const email = 'robert.parker@nhcs.net';
    
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
    const legacyDevDoc = await db.collection('users').doc('59d6dM275YRP9a6cqqr6').get();
    if (legacyDevDoc.exists) {
      await db.collection('users').doc('59d6dM275YRP9a6cqqr6').delete();
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