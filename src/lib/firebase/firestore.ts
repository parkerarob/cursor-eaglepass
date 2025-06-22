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
  addDoc,
  deleteDoc,
  onSnapshot,
} from "firebase/firestore";
import { firebaseApp } from "./config";
import { User, Location, Pass } from "@/types";
import { Group, Restriction, ClassroomPolicy, StudentPolicyOverride } from "@/types/policy";
import { EventLog } from '@/lib/eventLogger';

const db = getFirestore(firebaseApp);

export { db };

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

export const getUserById = async (id: string): Promise<User | null> => {
  const userDocRef = doc(db, "users", id);
  const userSnap = await getDoc(userDocRef);
  if (userSnap.exists()) {
    const userData = userSnap.data();
    return { id: userSnap.id, ...userData } as User;
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

export const getAllLocations = async (): Promise<Location[]> => {
  const locationsRef = collection(db, "locations");
  const querySnapshot = await getDocs(locationsRef);
  return querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Location));
};

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

export const getClassroomDestinations = async (): Promise<Location[]> => {
  const locationsRef = collection(db, "locations");
  const q = query(locationsRef, where("locationType", "==", "classroom"));
  const querySnapshot = await getDocs(q);
  return querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Location));
};

export const getStudentsByAssignedLocation = async (locationId: string): Promise<User[]> => {
  const usersRef = collection(db, "users");
  const q = query(
    usersRef, 
    where("role", "==", "student"),
    where("assignedLocationId", "==", locationId)
  );
  const querySnapshot = await getDocs(q);
  return querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as User));
};

export const getAllStudents = async (): Promise<User[]> => {
  const usersRef = collection(db, "users");
  const q = query(usersRef, where("role", "==", "student"));
  const querySnapshot = await getDocs(q);
  return querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as User));
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

export const createUser = async (userData: Omit<User, 'id'>): Promise<User> => {
  const usersRef = collection(db, 'users');
  const docRef = await addDoc(usersRef, userData);
  const newUser = {
    id: docRef.id,
    ...userData,
  } as User;
  return newUser;
};

export const updateUser = async (userId: string, updates: Partial<User>): Promise<void> => {
  const userRef = doc(db, "users", userId);
  await updateDoc(userRef, updates);
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

// Policy-related functions

export const getGroups = async (): Promise<Group[]> => {
  const groupsCollection = collection(db, 'groups');
  const querySnapshot = await getDocs(groupsCollection);
  return querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }) as Group);
};

export const getGroupsByOwner = async (ownerId: string): Promise<Group[]> => {
  const groupsRef = collection(db, "groups");
  const q = query(groupsRef, where("ownerId", "==", ownerId));
  const querySnapshot = await getDocs(q);
  return querySnapshot.docs.map(doc => {
    const groupData = convertTimestamps(doc.data()) as Omit<Group, 'id'>;
    return { id: doc.id, ...groupData };
  });
};

export const getGroupById = async (id: string): Promise<Group | null> => {
  const groupDocRef = doc(db, "groups", id);
  const groupSnap = await getDoc(groupDocRef);
  if (groupSnap.exists()) {
    const groupData = convertTimestamps(groupSnap.data()) as Omit<Group, 'id'>;
    return { id: groupSnap.id, ...groupData };
  }
  return null;
};

export const createGroup = async (group: Omit<Group, 'id'>): Promise<string> => {
  const groupsRef = collection(db, "groups");
  const groupData = convertDatesToTimestamps(group);
  const docRef = await addDoc(groupsRef, groupData);
  return docRef.id;
};

export const updateGroup = async (groupId: string, updates: Partial<Group>): Promise<void> => {
  const groupRef = doc(db, "groups", groupId);
  const updateData = convertDatesToTimestamps(updates);
  await updateDoc(groupRef, updateData as Partial<Group>);
};

export const deleteGroup = async (groupId: string): Promise<void> => {
  const groupRef = doc(db, "groups", groupId);
  await deleteDoc(groupRef);
};

export const getRestrictions = async (): Promise<Restriction[]> => {
  const restrictionsRef = collection(db, "restrictions");
  const querySnapshot = await getDocs(restrictionsRef);
  return querySnapshot.docs.map(doc => {
    const restrictionData = convertTimestamps(doc.data()) as Omit<Restriction, 'id'>;
    return { id: doc.id, ...restrictionData };
  });
};

export const getRestrictionsByStudentId = async (studentId: string): Promise<Restriction[]> => {
  const restrictionsRef = collection(db, "restrictions");
  const q = query(restrictionsRef, where("studentId", "==", studentId));
  const querySnapshot = await getDocs(q);
  return querySnapshot.docs.map(doc => {
    const restrictionData = convertTimestamps(doc.data()) as Omit<Restriction, 'id'>;
    return { id: doc.id, ...restrictionData };
  });
};

export const getActiveRestrictionsByStudentId = async (studentId: string): Promise<Restriction[]> => {
  const restrictionsRef = collection(db, "restrictions");
  const q = query(
    restrictionsRef, 
    where("studentId", "==", studentId),
    where("isActive", "==", true)
  );
  const querySnapshot = await getDocs(q);
  return querySnapshot.docs.map(doc => {
    const restrictionData = convertTimestamps(doc.data()) as Omit<Restriction, 'id'>;
    return { id: doc.id, ...restrictionData };
  });
};

export const createRestriction = async (restriction: Omit<Restriction, 'id'>): Promise<string> => {
  const restrictionsRef = collection(db, "restrictions");
  const restrictionData = convertDatesToTimestamps(restriction);
  const docRef = await addDoc(restrictionsRef, restrictionData);
  return docRef.id;
};

export const updateRestriction = async (restrictionId: string, updates: Partial<Restriction>): Promise<void> => {
  const restrictionRef = doc(db, "restrictions", restrictionId);
  const updateData = convertDatesToTimestamps(updates);
  await updateDoc(restrictionRef, updateData as Partial<Restriction>);
};

export const deleteRestriction = async (restrictionId: string): Promise<void> => {
  const restrictionRef = doc(db, "restrictions", restrictionId);
  await deleteDoc(restrictionRef);
};

// New Classroom Policy Functions
export const getClassroomPolicy = async (locationId: string): Promise<ClassroomPolicy | null> => {
  const policyDocRef = doc(db, "classroomPolicies", locationId);
  const policySnap = await getDoc(policyDocRef);
  if (policySnap.exists()) {
    const data = convertTimestamps(policySnap.data());
    return data as unknown as ClassroomPolicy;
  }
  return null;
};

export const updateClassroomPolicy = async (locationId: string, updates: Partial<ClassroomPolicy>): Promise<void> => {
  const policyDocRef = doc(db, "classroomPolicies", locationId);
  await setDoc(policyDocRef, { ...updates, locationId, lastUpdatedAt: new Date() }, { merge: true });
};

// New Student Policy Override Functions
export const getStudentPolicyOverrides = async (locationId: string): Promise<StudentPolicyOverride[]> => {
  const overridesRef = collection(db, "studentPolicyOverrides");
  const q = query(overridesRef, where("locationId", "==", locationId));
  const querySnapshot = await getDocs(q);
  return querySnapshot.docs.map(doc => convertTimestamps(doc.data()) as unknown as StudentPolicyOverride);
};

export const getStudentPolicyOverridesForStudent = async (locationId: string, studentId: string): Promise<StudentPolicyOverride | null> => {
  const overridesCollection = collection(db, 'studentPolicyOverrides');
  const q = query(overridesCollection, where('locationId', '==', locationId), where('studentId', '==', studentId));
  const querySnapshot = await getDocs(q);

  if (!querySnapshot.empty) {
    const doc = querySnapshot.docs[0];
    return { id: doc.id, ...doc.data() } as StudentPolicyOverride;
  }
  return null;
};

export const createStudentPolicyOverride = async (override: Omit<StudentPolicyOverride, 'id'>): Promise<string> => {
  const docRef = await addDoc(collection(db, 'studentPolicyOverrides'), override);
  return docRef.id;
};

export const updateStudentPolicyOverride = async (overrideId: string, updates: Partial<StudentPolicyOverride>): Promise<void> => {
  const overrideRef = doc(db, "studentPolicyOverrides", overrideId);
  const updateData = convertDatesToTimestamps({ ...updates, lastUpdatedAt: new Date() });
  await updateDoc(overrideRef, updateData as Partial<StudentPolicyOverride>);
};

export const deleteStudentPolicyOverride = async (overrideId: string): Promise<void> => {
  const overrideRef = doc(db, "studentPolicyOverrides", overrideId);
  await deleteDoc(overrideRef);
};

// Event Log functions

export const getEventLogs = async (): Promise<EventLog[]> => {
  const eventLogsRef = collection(db, "eventLogs");
  const querySnapshot = await getDocs(eventLogsRef);
  return querySnapshot.docs.map(doc => {
    const eventLogData = convertTimestamps(doc.data()) as Omit<EventLog, 'id'>;
    return { id: doc.id, ...eventLogData };
  });
};

export const getEventLogsByStudentId = async (studentId: string): Promise<EventLog[]> => {
  const eventLogsRef = collection(db, "eventLogs");
  const q = query(eventLogsRef, where("studentId", "==", studentId));
  const querySnapshot = await getDocs(q);
  return querySnapshot.docs.map(doc => {
    const eventLogData = convertTimestamps(doc.data()) as Omit<EventLog, 'id'>;
    return { id: doc.id, ...eventLogData };
  });
};

export const getEventLogsByPassId = async (passId: string): Promise<EventLog[]> => {
  const eventLogsRef = collection(db, "eventLogs");
  const q = query(eventLogsRef, where("passId", "==", passId));
  const querySnapshot = await getDocs(q);
  return querySnapshot.docs.map(doc => {
    const eventLogData = convertTimestamps(doc.data()) as Omit<EventLog, 'id'>;
    return { id: doc.id, ...eventLogData };
  });
};

export const getEventLogsByType = async (eventType: string): Promise<EventLog[]> => {
  const eventLogsRef = collection(db, "eventLogs");
  const q = query(eventLogsRef, where("eventType", "==", eventType));
  const querySnapshot = await getDocs(q);
  return querySnapshot.docs.map(doc => {
    const eventLogData = convertTimestamps(doc.data()) as Omit<EventLog, 'id'>;
    return { id: doc.id, ...eventLogData };
  });
};

export const getEventLogsByDateRange = async (startDate: Date, endDate: Date): Promise<EventLog[]> => {
  const eventLogsRef = collection(db, "eventLogs");
  const q = query(
    eventLogsRef, 
    where("timestamp", ">=", startDate),
    where("timestamp", "<=", endDate)
  );
  const querySnapshot = await getDocs(q);
  return querySnapshot.docs.map(doc => {
    const eventLogData = convertTimestamps(doc.data()) as Omit<EventLog, 'id'>;
    return { id: doc.id, ...eventLogData };
  });
};

// Emergency Freeze State

export const getEmergencyState = async (): Promise<{ active: boolean; activatedBy?: string; activatedAt?: Date } | null> => {
  const docRef = doc(db, 'system', 'emergency');
  const snap = await getDoc(docRef);
  if (!snap.exists()) return null;
  const data = convertTimestamps(snap.data());
  return data as { active: boolean; activatedBy?: string; activatedAt?: Date };
};

export const setEmergencyState = async (active: boolean, activatedBy: string): Promise<void> => {
  const docRef = doc(db, 'system', 'emergency');
  await setDoc(docRef, {
    active,
    activatedBy,
    activatedAt: new Date(),
  });
};

export const subscribeToEmergencyState = (callback: (state: { active: boolean; activatedBy?: string; activatedAt?: Date } | null) => void) => {
  const docRef = doc(db, 'system', 'emergency');
  return onSnapshot(docRef, (snap) => {
    if (!snap.exists()) {
      callback(null);
    } else {
      const data = convertTimestamps(snap.data());
      callback(data as { active: boolean; activatedBy?: string; activatedAt?: Date });
    }
  });
};

export const getUsers = async (): Promise<User[]> => {
  const usersCollection = collection(db, 'users');
  const querySnapshot = await getDocs(usersCollection);
  return querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }) as User);
}; 