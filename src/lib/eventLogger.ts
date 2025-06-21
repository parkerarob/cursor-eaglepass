import { addDoc, collection, getFirestore } from 'firebase/firestore';
import { firebaseApp } from '@/lib/firebase/config';

const db = getFirestore(firebaseApp);

export type EventType =
  | 'PASS_CREATED'
  | 'DEPARTED'
  | 'ARRIVED'
  | 'RETURNED'
  | 'CLAIMED'
  | 'EMERGENCY_ACTIVATED'
  | 'INVALID_TRANSITION'
  | 'POLICY_DENIED'
  | 'POLICY_APPROVED'
  | 'ERROR'
  | 'INFO';

export interface EventLog {
  id?: string;
  passId?: string;
  studentId?: string;
  actorId: string;
  timestamp: Date;
  eventType: EventType;
  details?: string;
  policyContext?: unknown;
}

export async function logEvent(event: Omit<EventLog, 'id'>): Promise<void> {
  const eventWithTimestamp = {
    ...event,
    timestamp: event.timestamp || new Date(),
  };
  await addDoc(collection(db, 'eventLogs'), eventWithTimestamp);
} 