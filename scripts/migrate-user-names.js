// Migration script to convert existing users with 'name' field to 'firstName' and 'lastName'
// Run this script to update existing user data in Firestore

import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs, updateDoc, doc } from 'firebase/firestore';
// We'll implement splitFullName directly in this script to avoid TypeScript import issues
// import { splitFullName } from '../src/lib/utils.js';

// Load environment variables
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

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
if (!firebaseConfig.apiKey || !firebaseConfig.projectId) {
  console.error('Firebase configuration is missing. Please check your .env.local file.');
  process.exit(1);
}

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// Implement splitFullName function directly in this script
function splitFullName(fullName) {
  if (!fullName || typeof fullName !== 'string') {
    return { firstName: '', lastName: '', confidence: 'low' };
  }

  const trimmedName = fullName.trim();
  if (!trimmedName) {
    return { firstName: '', lastName: '', confidence: 'low' };
  }

  // Handle common patterns
  const nameParts = trimmedName.split(/\s+/).filter(part => part.length > 0);
  
  if (nameParts.length === 0) {
    return { firstName: '', lastName: '', confidence: 'low' };
  }
  
  if (nameParts.length === 1) {
    // Single name - assume it's a first name
    return { 
      firstName: nameParts[0], 
      lastName: '', 
      confidence: 'low' 
    };
  }
  
  if (nameParts.length === 2) {
    // Two parts - assume "FirstName LastName"
    return { 
      firstName: nameParts[0], 
      lastName: nameParts[1], 
      confidence: 'high' 
    };
  }
  
  if (nameParts.length === 3) {
    // Three parts - could be "FirstName MiddleName LastName" or "FirstName LastName Suffix"
    // Check if last part looks like a suffix
    const lastPart = nameParts[2].toLowerCase();
    const suffixes = ['jr', 'jr.', 'sr', 'sr.', 'ii', 'iii', 'iv', 'v', 'vi', 'vii', 'viii', 'ix', 'x'];
    
    if (suffixes.includes(lastPart)) {
      // "FirstName LastName Suffix" format
      return { 
        firstName: nameParts[0], 
        lastName: `${nameParts[1]} ${nameParts[2]}`, 
        confidence: 'high' 
      };
    } else {
      // "FirstName MiddleName LastName" format - treat middle as part of first name
      return { 
        firstName: `${nameParts[0]} ${nameParts[1]}`, 
        lastName: nameParts[2], 
        confidence: 'medium' 
      };
    }
  }
  
  // More than 3 parts - assume "FirstName MiddleNames LastName"
  const firstName = nameParts[0];
  const lastName = nameParts[nameParts.length - 1];
  const middleNames = nameParts.slice(1, -1).join(' ');
  
  return { 
    firstName: middleNames ? `${firstName} ${middleNames}` : firstName, 
    lastName, 
    confidence: 'medium' 
  };
}

async function migrateUserNames() {
  console.log('Starting user name migration...');
  console.log(`Using Firebase project: ${firebaseConfig.projectId}`);
  
  try {
    // Get all users
    const usersRef = collection(db, 'users');
    const querySnapshot = await getDocs(usersRef);
    
    let processedCount = 0;
    let updatedCount = 0;
    let skippedCount = 0;
    let errorCount = 0;
    
    for (const userDoc of querySnapshot.docs) {
      const userData = userDoc.data();
      processedCount++;
      
      // Skip users that already have firstName and lastName
      if (userData.firstName && userData.lastName) {
        console.log(`Skipping ${userData.email || userData.name || 'Unknown'}: already has firstName/lastName`);
        skippedCount++;
        continue;
      }
      
      // Skip users without a name field
      if (!userData.name) {
        console.log(`Skipping ${userData.email || 'Unknown'}: no name field`);
        skippedCount++;
        continue;
      }
      
      // Split the name
      const splitResult = splitFullName(userData.name);
      
      if (splitResult.confidence === 'low' && !splitResult.firstName && !splitResult.lastName) {
        console.log(`Skipping ${userData.name}: could not parse name`);
        skippedCount++;
        continue;
      }
      
      // Prepare update data
      const updateData = {};
      if (splitResult.firstName) {
        updateData.firstName = splitResult.firstName;
      }
      if (splitResult.lastName) {
        updateData.lastName = splitResult.lastName;
      }
      
      // Update the user document
      try {
        const userRef = doc(db, 'users', userDoc.id);
        await updateDoc(userRef, updateData);
        
        console.log(`Updated ${userData.name} -> firstName: "${splitResult.firstName}", lastName: "${splitResult.lastName}" (${splitResult.confidence})`);
        updatedCount++;
      } catch (error) {
        console.error(`Error updating ${userData.name}:`, error);
        errorCount++;
      }
    }
    
    console.log('\nMigration completed!');
    console.log(`Total users processed: ${processedCount}`);
    console.log(`Users updated: ${updatedCount}`);
    console.log(`Users skipped: ${skippedCount}`);
    console.log(`Errors: ${errorCount}`);
    
  } catch (error) {
    console.error('Migration failed:', error);
  }
}

// Run the migration
migrateUserNames().then(() => {
  console.log('Migration script finished');
  process.exit(0);
}).catch((error) => {
  console.error('Migration script failed:', error);
  process.exit(1);
}); 