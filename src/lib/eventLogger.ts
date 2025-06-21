import { addDoc, collection, getFirestore } from 'firebase/firestore';
import { firebaseApp } from '@/lib/firebase/config';

const db = getFirestore(firebaseApp);

export type EventType =
  | 'PASS_CREATED'
  | 'DEPARTED'
  | 'ARRIVED'
  | 'RETURNED'
  | 'PASS_CLOSED'
  | 'CLAIMED'
  | 'EMERGENCY_ACTIVATED'
  | 'INVALID_TRANSITION'
  | 'POLICY_DENIED'
  | 'POLICY_APPROVED'
  | 'ERROR'
  | 'INFO'
  | 'NOTIFICATION_SENT'
  | 'NOTIFICATION_FAILED';

export interface EventLog {
  id?: string;
  passId?: string;
  studentId?: string;
  actorId: string;
  timestamp: Date;
  eventType: EventType;
  details?: string;
  policyContext?: unknown;
  notificationLevel?: 'student' | 'teacher' | 'admin';
}

export async function logEvent(event: Omit<EventLog, 'id'>): Promise<void> {
  const eventWithTimestamp = {
    ...event,
    timestamp: event.timestamp || new Date(),
  };
  await addDoc(collection(db, 'eventLogs'), eventWithTimestamp);
} 