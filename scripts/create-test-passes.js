const { initializeApp } = require('firebase/app');
const { getFirestore, collection, addDoc, getDocs } = require('firebase/firestore');
require('dotenv').config({ path: '.env.local' });

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

// Get teacher email from command line arguments
const args = process.argv.slice(2);
const teacherEmailArg = args.find(arg => arg.startsWith('--teacher='));
const teacherEmail = teacherEmailArg ? teacherEmailArg.split('=')[1] : null;

async function createTestPasses() {
  try {
    if (teacherEmail) {
      console.log(`🎯 Creating test passes specifically for teacher: ${teacherEmail}`);
    } else {
      console.log('🚀 Creating generic test passes for teacher dashboard demo...');
    }

    // Get all users and locations
    const usersSnapshot = await getDocs(collection(db, 'users'));
    const locationsSnapshot = await getDocs(collection(db, 'locations'));

    const allUsers = usersSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    const allLocations = locationsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

    let teacher;
    let students;
    
    if (teacherEmail) {
      teacher = allUsers.find(u => u.role === 'teacher' && u.email === teacherEmail);
      if (!teacher) {
        console.error(`❌ Error: Could not find teacher with email: ${teacherEmail}`);
        return;
      }
      if (!teacher.assignedLocationId) {
        console.error(`❌ Error: Teacher ${teacherEmail} is not assigned to a classroom.`);
        return;
      }
      
      // Get students assigned to this teacher and some other students
      const myStudents = allUsers.filter(u => u.role === 'student' && u.assignedLocationId === teacher.assignedLocationId);
      const otherStudents = allUsers.filter(u => u.role === 'student' && u.assignedLocationId !== teacher.assignedLocationId);
      
      students = [...myStudents.slice(0, 10), ...otherStudents.slice(0, 10)];
      
    } else {
      students = allUsers
        .filter(user => user.role === 'student')
        .slice(0, 20); // Take first 20 students for demo
    }

    const locations = allLocations;
    const classrooms = locations.filter(loc => loc.locationType === 'classroom');
    const otherLocations = locations.filter(loc => loc.locationType !== 'classroom');

    console.log(`📊 Found ${students.length} students, ${classrooms.length} classrooms, ${otherLocations.length} other locations`);

    // Create some test passes
    const testPasses = [];

    // 1. Students going to bathroom (common scenario)
    for (let i = 0; i < 5; i++) {
      const student = students[i];
      const bathroom = otherLocations.find(loc => loc.locationType === 'bathroom');
      
      if (student && bathroom) {
        testPasses.push({
          id: `test-pass-bathroom-${i}`,
          studentId: student.id,
          status: 'OPEN',
          createdAt: new Date(Date.now() - Math.random() * 30 * 60 * 1000), // Random time in last 30 min
          lastUpdatedAt: new Date(),
          legs: [{
            legNumber: 1,
            originLocationId: student.assignedLocationId,
            destinationLocationId: bathroom.id,
            state: 'OUT', // Student is currently OUT
            timestamp: new Date(Date.now() - Math.random() * 20 * 60 * 1000)
          }],
          durationMinutes: Math.floor(Math.random() * 15) + 1, // 1-15 minutes
          notificationLevel: 'none'
        });
      }
    }

    // 2. Students visiting other classrooms (or this teacher's class)
    for (let i = 5; i < 10; i++) {
      const student = students[i];
      // If a teacher is specified, have students visit THEIR classroom
      const targetClassroom = teacher ? 
        classrooms.find(c => c.id === teacher.assignedLocationId) :
        classrooms.find(c => c.id !== student.assignedLocationId);
      
      if (student && targetClassroom) {
        testPasses.push({
          id: `test-pass-classroom-${i}`,
          studentId: student.id,
          status: 'OPEN',
          createdAt: new Date(Date.now() - Math.random() * 45 * 60 * 1000), // Random time in last 45 min
          lastUpdatedAt: new Date(),
          legs: [{
            legNumber: 1,
            originLocationId: student.assignedLocationId,
            destinationLocationId: targetClassroom.id,
            state: 'IN', // Student has arrived at the classroom
            timestamp: new Date(Date.now() - Math.random() * 30 * 60 * 1000)
          }],
          durationMinutes: Math.floor(Math.random() * 25) + 5, // 5-30 minutes
          notificationLevel: Math.random() > 0.7 ? 'teacher' : 'none'
        });
      }
    }

    // 3. Students going to nurse/office (some overdue)
    for (let i = 10; i < 15; i++) {
      const student = students[i];
      const nurse = otherLocations.find(loc => loc.locationType === 'nurse');
      
      if (student && nurse) {
        const isOverdue = i >= 13; // Make some overdue
        testPasses.push({
          id: `test-pass-nurse-${i}`,
          studentId: student.id,
          status: 'OPEN',
          createdAt: new Date(Date.now() - (isOverdue ? 25 : 8) * 60 * 1000), // Overdue or recent
          lastUpdatedAt: new Date(),
          legs: [{
            legNumber: 1,
            originLocationId: student.assignedLocationId,
            destinationLocationId: nurse.id,
            state: 'OUT',
            timestamp: new Date(Date.now() - (isOverdue ? 25 : 8) * 60 * 1000)
          }],
          durationMinutes: isOverdue ? 25 : 8,
          notificationLevel: isOverdue ? 'admin' : 'teacher'
        });
      }
    }

    // 4. Students going to library
    for (let i = 15; i < 20; i++) {
      const student = students[i];
      const library = otherLocations.find(loc => loc.locationType === 'library');
      
      if (student && library) {
        testPasses.push({
          id: `test-pass-library-${i}`,
          studentId: student.id,
          status: 'OPEN',
          createdAt: new Date(Date.now() - Math.random() * 60 * 60 * 1000), // Random time in last hour
          lastUpdatedAt: new Date(),
          legs: [{
            legNumber: 1,
            originLocationId: student.assignedLocationId,
            destinationLocationId: library.id,
            state: 'IN', // Student has arrived at library
            timestamp: new Date(Date.now() - Math.random() * 45 * 60 * 1000)
          }],
          durationMinutes: Math.floor(Math.random() * 40) + 10, // 10-50 minutes
          notificationLevel: 'none'
        });
      }
    }

    console.log(`📝 Created ${testPasses.length} test passes`);

    // Add passes to Firestore
    for (const pass of testPasses) {
      try {
        await addDoc(collection(db, 'passes'), {
          ...pass,
          createdAt: pass.createdAt,
          lastUpdatedAt: pass.lastUpdatedAt,
          legs: pass.legs.map(leg => ({
            ...leg,
            timestamp: leg.timestamp
          }))
        });
        console.log(`✅ Created pass for student ${pass.studentId} to ${pass.legs[0].destinationLocationId}`);
      } catch (error) {
        console.error(`❌ Failed to create pass for student ${pass.studentId}:`, error.message);
      }
    }

    console.log('🎉 Test passes created successfully!');
    console.log('\n📋 Summary:');
    console.log('- 5 students going to bathroom (OUT)');
    console.log('- 5 students visiting other classrooms (IN)');
    console.log('- 5 students going to nurse (some overdue)');
    console.log('- 5 students at library (IN)');
    console.log('\n🔧 You can now:');
    console.log('1. Login as a teacher to see these passes in the teacher dashboard');
    console.log('2. Use the dev-tools to close passes later');
    console.log('3. Test the filtering and responsibility logic');

  } catch (error) {
    console.error('❌ Error creating test passes:', error);
  }
}

// Run the script
createTestPasses(); 