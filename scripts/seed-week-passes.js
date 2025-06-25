/**
 * Seed a week of realistic pass data into the Firestore database.
 *
 * Assumptions:
 *   • Users & locations already seeded via scripts/seed-sample-data.js
 *   • 2 000 students, 150 teachers, 5 admins exist.
 *   • Collection 'passes' will receive ~2 000 closed passes dated within the last 5 school days.
 *
 * Usage:
 *   node scripts/seed-week-passes.js /absolute/path/to/serviceAccountKey.json
 *
 * If the path argument is omitted, the script will attempt to read SERVICE_ACCOUNT_PATH env var
 * or fall back to './serviceAccountKey.json'.
 */

/* eslint-disable no-console */

const admin = require('firebase-admin');
const path = require('path');
const { randomUUID } = require('crypto');

// ---------------------------------------------------------------------------
// 1️⃣  Initialise Firebase Admin
// ---------------------------------------------------------------------------
const resolveServiceAccount = () => {
  const candidate = process.argv[2] || process.env.SERVICE_ACCOUNT_PATH || './serviceAccountKey.json';
  try {
    // eslint-disable-next-line import/no-dynamic-require, global-require
    return require(path.resolve(candidate));
  } catch (err) {
    console.error(`❌  Unable to load service account key at "${candidate}"\n${err.message}`);
    process.exit(1);
  }
};

admin.initializeApp({
  credential: admin.credential.cert(resolveServiceAccount()),
});

const db = admin.firestore();

// ---------------------------------------------------------------------------
// 2️⃣  Constants & helpers
// ---------------------------------------------------------------------------
const TOTAL_PASSES = 2000; // one per student for demo purposes
const BATCH_LIMIT = 500;
const pad = (num, size = 5) => String(num).padStart(size, '0');

/**
 * Returns a random Date object within the last 5 weekdays (Mon-Fri),
 * between 08:00 and 15:00 local time.
 */
function randomSchoolDate() {
  const now = new Date();
  // Go back up to 4 full days (0-4) and set time window 8-15h
  const daysBack = Math.floor(Math.random() * 5); // 0-4
  const date = new Date(now);
  date.setDate(now.getDate() - daysBack);
  date.setHours(8 + Math.floor(Math.random() * 8)); // 8-15
  date.setMinutes(Math.floor(Math.random() * 60));
  date.setSeconds(Math.floor(Math.random() * 60));
  date.setMilliseconds(0);
  return date;
}

function minutesLater(date, min, max) {
  const minutes = min + Math.floor(Math.random() * (max - min + 1));
  return new Date(date.getTime() + minutes * 60 * 1000);
}

// Pick a random destination type for realism
const DESTINATION_POOL = [
  'restroom-100',
  'restroom-200',
  'restroom-300',
  'restroom-400',
  'restroom-500',
  'restroom-600',
  'restroom-700',
  'restroom-800',
  'restroom-900',
  'nurse-100',
  'library-200',
  'cafeteria-100',
  'gym-100',
];

// ---------------------------------------------------------------------------
// 3️⃣  Core logic
// ---------------------------------------------------------------------------
(async function seedPasses() {
  try {
    console.log('🔄  Fetching students …');
    const studentsSnap = await db.collection('users').where('role', '==', 'student').get();
    const students = studentsSnap.docs.map((d) => d.data());

    if (students.length === 0) {
      console.error('❌  No students found. Make sure you ran the user seeding script first.');
      process.exit(1);
    }

    console.log('🔄  Fetching teachers …');
    const teachersSnap = await db.collection('users').where('role', '==', 'teacher').get();
    const teacherIds = teachersSnap.docs.map((d) => (d.data().id || d.id));

    if (teacherIds.length === 0) {
      console.error('❌  No teachers found.');
      process.exit(1);
    }

    console.log(`👥  Found ${students.length} students. Generating pass data …`);

    // Batch writer
    let batch = db.batch();
    let batchCount = 0;
    let total = 0;

    for (let i = 0; i < TOTAL_PASSES; i++) {
      const student = students[i % students.length];

      const createdAt = randomSchoolDate();
      const closedAt = minutesLater(createdAt, 5, 15);
      const durationMinutes = Math.round((closedAt - createdAt) / 60000);

      // Pick a random teacher to act as closedBy
      const teacherId = teacherIds[Math.floor(Math.random() * teacherIds.length)];

      const origin = student.assignedLocationId || 'room-000';
      const destination = DESTINATION_POOL[Math.floor(Math.random() * DESTINATION_POOL.length)];

      const passId = `pass-${pad(i + 1, 6)}`;

      const pass = {
        id: passId,
        studentId: student.id,
        status: 'CLOSED',
        createdAt,
        lastUpdatedAt: closedAt,
        legs: [
          {
            id: randomUUID(),
            legNumber: 1,
            originLocationId: origin,
            destinationLocationId: destination,
            state: 'OUT',
            timestamp: createdAt,
          },
          {
            id: randomUUID(),
            legNumber: 2,
            originLocationId: destination,
            destinationLocationId: origin,
            state: 'IN',
            timestamp: closedAt,
          },
        ],
        closedBy: teacherId,
        closedAt,
        durationMinutes,
      };

      const ref = db.collection('passes').doc(passId);
      batch.set(ref, pass);
      batchCount += 1;
      total += 1;

      if (batchCount === BATCH_LIMIT || i === TOTAL_PASSES - 1) {
        await batch.commit();
        console.log(`   ↳ committed ${batchCount} passes (total ${total})`);
        batch = db.batch();
        batchCount = 0;
      }
    }

    console.log('✅  Week-long passes seeded successfully!');
    process.exit(0);
  } catch (err) {
    console.error('❌  Pass seeding failed:', err);
    process.exit(1);
  }
})(); 