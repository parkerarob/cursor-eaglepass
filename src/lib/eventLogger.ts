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
  | 'NOTIFICATION_FAILED'
  | 'STUDENT_CLAIMED'
  | 'SESSION_CREATED'
  | 'SESSION_REFRESHED'
  | 'SESSION_INVALIDATED'
  | 'ALL_SESSIONS_INVALIDATED'
  | 'SESSION_LIMIT_ENFORCED';

export interface EventLog {
  id?: string;
  passId?: string;
  studentId?: string;
  actorId: string;
  timestamp: Date;
  eventType: EventType;
  details?: string | Record<string, unknown>;
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