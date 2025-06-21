const { initializeApp } = require('firebase/app');
const { getFirestore, collection, addDoc, getDocs, query, where } = require('firebase/firestore');
require('dotenv').config({ path: '.env.local' });

// --- CONFIGURATION ---
const TEACHER_EMAIL = 'robert.parker@nhcs.net'; // The email of the teacher to generate passes for.
// Note: The script will find the teacher's assigned classroom automatically.

// Firebase config from environment variables
const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// Helper to create a pass object
function createPassData(student, origin, destination, state, duration, notification) {
  return {
    studentId: student.id,
    status: 'OPEN',
    createdAt: new Date(Date.now() - duration * 60 * 1000),
    lastUpdatedAt: new Date(),
    legs: [{
      legNumber: 1,
      originLocationId: origin.id,
      destinationLocationId: destination.id,
      state: state,
      timestamp: new Date(Date.now() - (duration / 2) * 60 * 1000)
    }],
    durationMinutes: duration,
    notificationLevel: notification
  };
}


async function createTargetedPasses() {
  try {
    console.log(`🚀 Creating targeted test passes for teacher: ${TEACHER_EMAIL}`);

    // --- 1. Fetch Data ---
    const usersRef = collection(db, 'users');
    const locationsRef = collection(db, 'locations');
    
    // Find the target teacher and their classroom
    const teacherQuery = query(usersRef, where('email', '==', TEACHER_EMAIL));
    const teacherSnapshot = await getDocs(teacherQuery);
    if (teacherSnapshot.empty) {
      throw new Error(`Teacher with email ${TEACHER_EMAIL} not found.`);
    }
    const teacher = { id: teacherSnapshot.docs[0].id, ...teacherSnapshot.docs[0].data() };
    if (!teacher.assignedLocationId) {
      throw new Error(`Teacher ${teacher.name} is not assigned to any location.`);
    }

    const teacherClassroomSnap = await getDocs(query(locationsRef, where('__name__', '==', teacher.assignedLocationId)));
    if (teacherClassroomSnap.empty) {
        throw new Error(`Classroom with ID ${teacher.assignedLocationId} not found.`);
    }
    const teacherClassroom = { id: teacherClassroomSnap.docs[0].id, ...teacherClassroomSnap.docs[0].data() };

    console.log(`🧑‍🏫 Found teacher: ${teacher.name} in classroom ${teacherClassroom.name} (${teacherClassroom.id})`);

    // Get all students and other locations
    const allUsersSnapshot = await getDocs(usersRef);
    const allLocationsSnapshot = await getDocs(locationsRef);
    const allStudents = allUsersSnapshot.docs
      .map(doc => ({ id: doc.id, ...doc.data() }))
      .filter(user => user.role === 'student');
    const allLocations = allLocationsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    const otherLocations = allLocations.filter(loc => loc.id !== teacherClassroom.id);
    const bathroom = otherLocations.find(loc => loc.locationType === 'bathroom');
    const nurse = otherLocations.find(loc => loc.locationType === 'nurse');

    // Get students assigned to the teacher's class and students from other classes
    const myStudents = allStudents.filter(s => s.assignedLocationId === teacherClassroom.id).slice(0, 5);
    const otherStudents = allStudents.filter(s => s.assignedLocationId !== teacherClassroom.id).slice(0, 5);

    if (myStudents.length < 3 || otherStudents.length < 2) {
        console.warn('Warning: Not enough students found to create a full set of demo passes.');
    }

    // --- 2. Generate Pass Scenarios ---
    const testPasses = [];

    // Scenario A: My students going places (will appear in "Students OUT")
    if (myStudents.length > 0 && bathroom) {
      testPasses.push(createPassData(myStudents[0], teacherClassroom, bathroom, 'OUT', 5, 'none'));
    }
    if (myStudents.length > 1 && nurse) {
      testPasses.push(createPassData(myStudents[1], teacherClassroom, nurse, 'OUT', 12, 'teacher')); // Escalated
    }
    if (myStudents.length > 2) {
        const anotherClassroom = otherLocations.find(l => l.locationType === 'classroom');
        if (anotherClassroom) {
            testPasses.push(createPassData(myStudents[2], teacherClassroom, anotherClassroom, 'IN', 20, 'none')); // Arrived elsewhere
        }
    }

    // Scenario B: Other students coming to my class (will appear in "Students IN")
    if (otherStudents.length > 0) {
        const studentOrigin = allLocations.find(l => l.id === otherStudents[0].assignedLocationId)
        if (studentOrigin) {
            testPasses.push(createPassData(otherStudents[0], studentOrigin, teacherClassroom, 'IN', 8, 'none'));
        }
    }
    if (otherStudents.length > 1) {
        const studentOrigin = allLocations.find(l => l.id === otherStudents[1].assignedLocationId)
         if (studentOrigin) {
            testPasses.push(createPassData(otherStudents[1], studentOrigin, teacherClassroom, 'IN', 2, 'none'));
        }
    }
    
    console.log(`📝 Generated ${testPasses.length} targeted pass scenarios.`);

    // --- 3. Add Passes to Firestore ---
    let createdCount = 0;
    for (const pass of testPasses) {
      try {
        await addDoc(collection(db, 'passes'), pass);
        createdCount++;
      } catch (error) {
        console.error(`❌ Failed to create pass for student ${pass.studentId}:`, error.message);
      }
    }

    console.log(`\n🎉 Successfully created ${createdCount} new passes.`);
    console.log('✅ The teacher dashboard should now be populated with relevant data.');
    console.log(`\n🔧 Login as ${TEACHER_EMAIL} to see the results.`);

  } catch (error) {
    console.error('❌ An error occurred while creating targeted test passes:', error);
  }
}

// Run the script
createTargetedPasses(); 