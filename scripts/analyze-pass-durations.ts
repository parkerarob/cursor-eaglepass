import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs, Timestamp } from 'firebase/firestore';
import fs from 'fs';

/**
 * Script: analyze-pass-durations.ts
 * ---------------------------------
 * Scans the `passes` collection for common data-quality problems:
 *   • CLOSED passes missing `closedAt`
 *   • Negative or zero duration calculations
 *   • `durationMinutes` field out of sync with calculated duration
 *
 * Usage (Node):
 *   ts-node scripts/analyze-pass-durations.ts > duration-report.csv
 *
 * Requires the standard Firebase client env vars (e.g., FIREBASE_API_KEY, etc.)
 */

// ---- Firebase init -------------------------------------------------------
const firebaseConfig = {
  apiKey: process.env.FIREBASE_API_KEY,
  authDomain: process.env.FIREBASE_AUTH_DOMAIN,
  projectId: process.env.FIREBASE_PROJECT_ID,
  // Only projectId is strictly required for admin SDK, but we keep parity.
};

initializeApp(firebaseConfig);
const db = getFirestore();

// ---- Helpers -------------------------------------------------------------
interface PassDoc {
  id: string;
  status: 'OPEN' | 'CLOSED' | string;
  createdAt: Timestamp | Date;
  closedAt?: Timestamp | Date;
  durationMinutes?: number;
}

type AnomalyType =
  | 'MISSING_CLOSED_AT'
  | 'NEGATIVE_DURATION'
  | 'DURATION_MISMATCH';

interface AnomalyRecord {
  passId: string;
  studentId?: string;
  type: AnomalyType;
  calculatedDuration: number;
  storedDuration?: number;
  createdAt: Date;
  closedAt?: Date | null;
}

function tsToDate(value: Timestamp | Date | undefined): Date | null {
  if (!value) return null;
  return value instanceof Timestamp ? value.toDate() : value;
}

// ---- Main ----------------------------------------------------------------
(async () => {
  const passesCol = collection(db, 'passes');
  const snapshot = await getDocs(passesCol);

  const anomalies: AnomalyRecord[] = [];

  snapshot.forEach((docSnap) => {
    const data = docSnap.data() as any;
    const pass: PassDoc = {
      id: docSnap.id,
      status: data.status,
      createdAt: data.createdAt,
      closedAt: data.closedAt,
      durationMinutes: data.durationMinutes,
      studentId: data.studentId,
    } as any;

    const created = tsToDate(pass.createdAt);
    const closed = tsToDate(pass.closedAt);

    // Only evaluate CLOSED passes for duration consistency
    if (pass.status === 'CLOSED') {
      if (!closed) {
        anomalies.push({
          passId: pass.id,
          studentId: (data as any).studentId,
          type: 'MISSING_CLOSED_AT',
          calculatedDuration: 0,
          storedDuration: pass.durationMinutes,
          createdAt: created!,
          closedAt: null,
        });
        return;
      }

      const calcMinutes = Math.round((closed.getTime() - created!.getTime()) / (1000 * 60));

      if (calcMinutes < 0) {
        anomalies.push({
          passId: pass.id,
          studentId: (data as any).studentId,
          type: 'NEGATIVE_DURATION',
          calculatedDuration: calcMinutes,
          storedDuration: pass.durationMinutes,
          createdAt: created!,
          closedAt: closed,
        });
      }

      if (pass.durationMinutes === undefined || Math.abs(calcMinutes - pass.durationMinutes) > 1) {
        anomalies.push({
          passId: pass.id,
          studentId: (data as any).studentId,
          type: 'DURATION_MISMATCH',
          calculatedDuration: calcMinutes,
          storedDuration: pass.durationMinutes,
          createdAt: created!,
          closedAt: closed,
        });
      }
    }
  });

  // Output CSV
  const header = [
    'passId',
    'studentId',
    'anomalyType',
    'calculatedDuration',
    'storedDuration',
    'createdAt',
    'closedAt',
  ].join(',');

  const rows = anomalies.map((a) => [
    a.passId,
    a.studentId || '',
    a.type,
    a.calculatedDuration,
    a.storedDuration ?? '',
    a.createdAt.toISOString(),
    a.closedAt ? a.closedAt.toISOString() : '',
  ].join(','));

  const csv = [header, ...rows].join('\n');
  fs.writeFileSync('duration-anomalies-report.csv', csv);

  console.log(`Analyzed ${snapshot.size} passes. Found ${anomalies.length} anomalies.`);
  console.log('Report saved to duration-anomalies-report.csv');
})(); 