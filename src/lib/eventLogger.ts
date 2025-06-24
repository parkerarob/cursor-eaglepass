import { addDoc, collection, getFirestore } from 'firebase/firestore';
import { getFirebaseFirestore } from '@/lib/firebase/config';

// Use lazy initialization instead of module-level initialization
const getDb = () => getFirebaseFirestore();

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
  const db = getDb();
  if (!db) {
    console.error('Firebase not initialized, cannot log event');
    return;
  }
  
  const eventWithTimestamp = {
    ...event,
    timestamp: event.timestamp || new Date(),
  };
  await addDoc(collection(db, 'eventLogs'), eventWithTimestamp);
} 