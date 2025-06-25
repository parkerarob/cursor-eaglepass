/**
 * Seed sample data into Firestore for local/staging environments.
 *
 * Usage:
 *   node scripts/seed-sample-data.js /absolute/path/to/serviceAccountKey.json
 *
 * If the path argument is omitted, the script will attempt to read
 * SERVICE_ACCOUNT_PATH env var or fall back to './serviceAccountKey.json'.
 */

/* eslint-disable no-console */

const path = require('path');
const admin = require('firebase-admin');

// ------------------------------------------------------------------------------------------
// 1️⃣  Initialise Firebase Admin
// ------------------------------------------------------------------------------------------
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

const serviceAccount = resolveServiceAccount();
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

const db = admin.firestore();

// ------------------------------------------------------------------------------------------
// 2️⃣  Configurable constants
// ------------------------------------------------------------------------------------------
const TOTAL_STUDENTS = 2000;
const TOTAL_TEACHERS = 150;
const TOTAL_ADMINS = 5;
const BATCH_LIMIT = 500; // Firestore writes per batch

// ------------------------------------------------------------------------------------------
// 3️⃣  Utility helpers
// ------------------------------------------------------------------------------------------
const pad = (num, size = 5) => String(num).padStart(size, '0');

/**
 * Write an array of documents to a collection with batching.
 * @param {string} collection - Target Firestore collection name.
 * @param {Array<{id: string, data: Record<string, unknown>}>} docs - Documents to write.
 */
async function batchWrite(collection, docs) {
  let batch = db.batch();
  let count = 0;

  for (let i = 0; i < docs.length; i++) {
    const { id, data } = docs[i];
    const ref = db.collection(collection).doc(id);
    batch.set(ref, data);
    count += 1;

    if (count === BATCH_LIMIT || i === docs.length - 1) {
      await batch.commit();
      console.log(`   ↳ committed ${count} docs to ${collection}`);
      batch = db.batch();
      count = 0;
    }
  }
}

// ------------------------------------------------------------------------------------------
// 4️⃣  Generate Locations
// ------------------------------------------------------------------------------------------
function generateLocations() {
  const locations = [];

  // Helper to push location objects
  const add = (id, name, type, responsiblePartyId) => {
    locations.push({ id, name, locationType: type, ...(responsiblePartyId && { responsiblePartyId }) });
  };

  // Hallway 100 specials
  add('main-office-100', 'Main Office', 'office');
  add('gym-100', 'Gym', 'gym');
  add('nurse-100', 'Nurse', 'nurse');
  add('cafeteria-100', 'Cafeteria', 'cafeteria');
  add('restroom-100', 'Restroom 100', 'bathroom');

  // Hallway 200 specials
  add('student-services-200', 'Student Services', 'office');
  add('library-200', 'Library', 'library');
  add('restroom-200', 'Restroom 200', 'bathroom');

  // Classroom wings 300–700
  [300, 400, 500, 600, 700].forEach((wing) => {
    for (let i = 1; i <= 25; i++) {
      const roomNumber = wing + i; // e.g., 301..325
      add(`room-${roomNumber}`, `Room ${roomNumber}`, 'classroom');
    }
    add(`restroom-${wing}`, `Restroom ${wing}`, 'bathroom');
  });

  // Arts wing 800
  for (let i = 1; i <= 25; i++) {
    const roomNumber = 800 + i; // 801..825
    add(`room-${roomNumber}`, `Room ${roomNumber}`, 'classroom');
  }
  add('restroom-800', 'Restroom 800', 'bathroom');

  // Mobile units 900
  for (let i = 1; i <= 15; i++) {
    const unitNumber = 900 + i; // 901..915
    add(`mobile-${unitNumber}`, `Mobile ${unitNumber}`, 'classroom');
  }
  add('restroom-900', 'Restroom 900', 'bathroom');

  return locations;
}

// ------------------------------------------------------------------------------------------
// 5️⃣  Generate Users (admins, teachers, students)
// ------------------------------------------------------------------------------------------
function generateUsers(locations) {
  const admins = [];
  const teachers = [];
  const students = [];

  // Admins (assigned to main office)
  for (let i = 1; i <= TOTAL_ADMINS; i++) {
    const id = `admin-${pad(i, 5)}`;
    admins.push({
      id,
      email: `admin${pad(i, 5)}@school.org`,
      role: 'admin',
      firstName: `Admin${i}`,
      lastName: 'Test',
      assignedLocationId: 'main-office-100',
    });
  }

  // Determine classroom locations to assign to teachers
  const classroomLocations = locations.filter((loc) => loc.locationType === 'classroom');
  if (classroomLocations.length < TOTAL_TEACHERS) {
    throw new Error('Not enough classroom locations to assign to teachers');
  }

  for (let i = 1; i <= TOTAL_TEACHERS; i++) {
    const id = `teacher-${pad(i, 5)}`;
    const classroom = classroomLocations[i - 1];
    classroom.responsiblePartyId = id; // Assign teacher ownership

    teachers.push({
      id,
      email: `teacher${pad(i, 5)}@school.org`,
      role: 'teacher',
      firstName: `Teacher${i}`,
      lastName: 'Test',
      assignedLocationId: classroom.id,
    });
  }

  // Students evenly distributed among teachers
  for (let i = 1; i <= TOTAL_STUDENTS; i++) {
    const teacherIndex = (i - 1) % TOTAL_TEACHERS; // 0-based
    const teacher = teachers[teacherIndex];
    students.push({
      id: `student-${pad(i, 5)}`,
      email: `student${pad(i, 5)}@school.org`,
      role: 'student',
      firstName: `Student${i}`,
      lastName: 'Test',
      assignedLocationId: teacher.assignedLocationId,
    });
  }

  return { admins, teachers, students };
}

// ------------------------------------------------------------------------------------------
// 6️⃣  Main execution
// ------------------------------------------------------------------------------------------
(async function main() {
  try {
    console.log('🛠️  Generating seed data …');
    const locations = generateLocations();
    const { admins, teachers, students } = generateUsers(locations);

    console.log(`📌 Locations: ${locations.length}`);
    console.log(`📌 Admins   : ${admins.length}`);
    console.log(`📌 Teachers : ${teachers.length}`);
    console.log(`📌 Students : ${students.length}`);

    // Seed data
    console.log('\n🚀  Seeding locations …');
    await batchWrite('locations', locations.map((l) => ({ id: l.id, data: l })));

    console.log('\n🚀  Seeding admins …');
    await batchWrite('users', admins.map((u) => ({ id: u.id, data: u })));

    console.log('\n🚀  Seeding teachers …');
    await batchWrite('users', teachers.map((u) => ({ id: u.id, data: u })));

    console.log('\n🚀  Seeding students …');
    await batchWrite('users', students.map((u) => ({ id: u.id, data: u })));

    console.log('\n✅  All seed data written successfully!');
    process.exit(0);
  } catch (err) {
    console.error('❌  Seeding failed:', err);
    process.exit(1);
  }
})(); 