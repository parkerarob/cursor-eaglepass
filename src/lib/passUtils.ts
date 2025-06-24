import { Firestore } from 'firebase/firestore';
import { query, where, collection, getDocs } from 'firebase/firestore';

/**
 * Checks if a student has an open pass in Firestore.
 * Returns true if an open pass exists, false otherwise.
 */
export async function checkStudentHasOpenPass(db: Firestore, studentId: string): Promise<boolean> {
  const passQuery = query(
    collection(db, 'passes'),
    where('studentId', '==', studentId),
    where('status', '==', 'OPEN')
  );
  const snapshot = await getDocs(passQuery);
  return !snapshot.empty;
} 