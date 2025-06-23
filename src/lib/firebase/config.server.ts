// Server-side Firebase configuration for Eagle Pass
// This file should NEVER be exposed to the client

import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { getAuth } from 'firebase-admin/auth';

// Validate required environment variables
const requiredEnvVars = [
  'FIREBASE_PROJECT_ID',
  'FIREBASE_CLIENT_EMAIL',
  'FIREBASE_PRIVATE_KEY'
];

for (const envVar of requiredEnvVars) {
  if (!process.env[envVar]) {
    throw new Error(`Missing required environment variable: ${envVar}`);
  }
}

const serviceAccount = {
  projectId: process.env.FIREBASE_PROJECT_ID,
  clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
  privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
};

// Initialize Firebase Admin SDK
export const adminApp = initializeApp({
  credential: cert(serviceAccount),
});

// Export Firestore and Auth instances
export const adminDb = getFirestore(adminApp);
export const adminAuth = getAuth(adminApp);

// Health check function
export async function checkFirebaseConnection(): Promise<boolean> {
  try {
    await adminDb.collection('health').doc('test').get();
    return true;
  } catch (error) {
    console.error('Firebase connection check failed:', error);
    return false;
  }
} 