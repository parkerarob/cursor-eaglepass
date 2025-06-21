const { initializeApp } = require('firebase/app');
const { getFirestore, collection, getDocs, query, where, deleteDoc, doc } = require('firebase/firestore');
require('dotenv').config({ path: '.env.local' });

// Firebase config from environment variables
const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

async function cleanupOpenPasses() {
  try {
    console.log('🧹 Starting cleanup of all open passes...');

    const passesRef = collection(db, 'passes');
    const q = query(passesRef, where('status', '==', 'OPEN'));
    const querySnapshot = await getDocs(q);

    if (querySnapshot.empty) {
      console.log('👍 No open passes found. Nothing to do.');
      return;
    }

    console.log(`🔎 Found ${querySnapshot.size} open passes to delete.`);

    let deletedCount = 0;
    for (const passDoc of querySnapshot.docs) {
      try {
        await deleteDoc(doc(db, 'passes', passDoc.id));
        console.log(`✅ Deleted pass ${passDoc.id}`);
        deletedCount++;
      } catch (error) {
        console.error(`❌ Failed to delete pass ${passDoc.id}:`, error.message);
      }
    }

    console.log(`\n🎉 Cleanup complete. Successfully deleted ${deletedCount} open passes.`);

  } catch (error) {
    console.error('❌ An error occurred during the cleanup process:', error);
  }
}

// Run the script
cleanupOpenPasses(); 