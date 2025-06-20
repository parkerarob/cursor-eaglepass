import {
  getFirestore,
  doc,
  getDoc,
  collection,
  query,
  where,
  getDocs,
  setDoc,
  updateDoc,
  Timestamp,
} from "firebase/firestore";
import { firebaseApp } from "./config";
import { User, Location, Pass } from "@/types";

const db = getFirestore(firebaseApp);

// Function to convert Firestore Timestamps to JS Dates in a deeply nested object
const convertTimestamps = (data: unknown): unknown => {
  if (data instanceof Timestamp) {
    return data.toDate();
  }
  if (Array.isArray(data)) {
    return data.map(convertTimestamps);
  }
  if (typeof data === 'object' && data !== null) {
    return Object.fromEntries(
      Object.entries(data as object).map(([key, value]) => [
        key,
        convertTimestamps(value),
      ])
    );
  }
  return data;
};

// Function to convert JS Dates back to Firestore Timestamps
const convertDatesToTimestamps = (data: unknown): unknown => {
    if (data instanceof Date) {
        return Timestamp.fromDate(data);
    }
    if (Array.isArray(data)) {
        return data.map(convertDatesToTimestamps);
    }
    if (typeof data === 'object' && data !== null) {
        return Object.fromEntries(
            Object.entries(data as object).map(([key, value]) => [
                key,
                convertDatesToTimestamps(value),
            ])
        );
    }
    return data;
}

export const getStudentById = async (id: string): Promise<User | null> => {
  const userDocRef = doc(db, "users", id);
  const userSnap = await getDoc(userDocRef);
  if (userSnap.exists()) {
    const userData = userSnap.data();
    if (userData.role === 'student') {
      return { id: userSnap.id, ...userData } as User;
    }
  }
  return null;
};

export const getLocationById = async (id: string): Promise<Location | null> => {
  if (!id) return null;
  const locDocRef = doc(db, "locations", id);
  const locSnap = await getDoc(locDocRef);
  if (locSnap.exists()) {
    return { id: locSnap.id, ...locSnap.data() } as Location;
  }
  return null;
}

export const getActivePassByStudentId = async (studentId: string): Promise<Pass | null> => {
  const passesRef = collection(db, "passes");
  const q = query(passesRef, where("studentId", "==", studentId), where("status", "==", "OPEN"));
  const querySnapshot = await getDocs(q);
  if (!querySnapshot.empty) {
    const passDoc = querySnapshot.docs[0];
    const passData = convertTimestamps(passDoc.data());
    return { id: passDoc.id, ...(passData as Omit<Pass, 'id'>) };
  }
  return null;
};

export const getAvailableDestinations = async (): Promise<Location[]> => {
  const locationsRef = collection(db, "locations");
  const q = query(locationsRef, where("locationType", "!=", "classroom"));
  const querySnapshot = await getDocs(q);
  return querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Location));
};

export const createPass = async (pass: Pass): Promise<void> => {
    const passRef = doc(db, "passes", pass.id);
    const passData = convertDatesToTimestamps(pass);
    await setDoc(passRef, passData);
};

export const updatePass = async (passId: string, updates: Partial<Pass>): Promise<void> => {
    const passRef = doc(db, "passes", passId);
    const updateData = convertDatesToTimestamps(updates);
    await updateDoc(passRef, updateData as Partial<Pass>);
};

export const getUserByEmail = async (email: string): Promise<User | null> => {
  if (!email) return null;
  const usersRef = collection(db, "users");
  const q = query(usersRef, where("email", "==", email));
  const querySnapshot = await getDocs(q);

  if (querySnapshot.empty) {
    console.warn(`No user found with email: ${email}`);
    return null;
  }
  const userDoc = querySnapshot.docs[0];
  return { id: userDoc.id, ...userDoc.data() } as User;
};

export const getAllPasses = async (): Promise<Pass[]> => {
  const passesRef = collection(db, "passes");
  const querySnapshot = await getDocs(passesRef);
  return querySnapshot.docs.map(doc => {
    const passData = convertTimestamps(doc.data());
    return { id: doc.id, ...(passData as Omit<Pass, 'id'>) };
  });
}; 