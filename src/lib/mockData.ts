import { User, Location, Pass, EventLog } from '@/types';

// Mock Users
export const mockUsers: User[] = [
  // Students
  {
    id: 'student-1',
    name: 'Alex Johnson',
    email: 'alex.johnson@student.nhcs.net',
    role: 'student',
    assignedLocationId: 'location-1', // Classroom 101
  },
  {
    id: 'student-2',
    name: 'Jordan Smith',
    email: 'jordan.smith@student.nhcs.net',
    role: 'student',
    assignedLocationId: 'location-1', // Classroom 101
  },
  {
    id: 'student-3',
    name: 'Taylor Davis',
    email: 'taylor.davis@student.nhcs.net',
    role: 'student',
    assignedLocationId: 'location-2', // Classroom 102
  },
  {
    id: 'student-4',
    name: 'Casey Wilson',
    email: 'casey.wilson@student.nhcs.net',
    role: 'student',
    assignedLocationId: 'location-2', // Classroom 102
  },
  {
    id: 'student-5',
    name: 'Riley Brown',
    email: 'riley.brown@student.nhcs.net',
    role: 'student',
    assignedLocationId: 'location-1', // Classroom 101
  },

  // Teachers
  {
    id: 'teacher-1',
    name: 'Ms. Rodriguez',
    email: 'm.rodriguez@nhcs.net',
    role: 'teacher',
    assignedLocationId: 'location-1', // Classroom 101
  },
  {
    id: 'teacher-2',
    name: 'Mr. Thompson',
    email: 'j.thompson@nhcs.net',
    role: 'teacher',
    assignedLocationId: 'location-2', // Classroom 102
  },

  // Admin
  {
    id: 'admin-1',
    name: 'Principal Williams',
    email: 'p.williams@nhcs.net',
    role: 'admin',
  },
];

// Mock Locations
export const mockLocations: Location[] = [
  {
    id: 'location-1',
    name: 'Classroom 101',
    locationType: 'classroom',
    responsiblePartyId: 'teacher-1',
  },
  {
    id: 'location-2',
    name: 'Classroom 102',
    locationType: 'classroom',
    responsiblePartyId: 'teacher-2',
  },
  {
    id: 'location-3',
    name: 'Bathroom - Main Hall',
    locationType: 'bathroom',
  },
  {
    id: 'location-4',
    name: 'Nurse\'s Office',
    locationType: 'nurse',
  },
  {
    id: 'location-5',
    name: 'Main Office',
    locationType: 'office',
  },
  {
    id: 'location-6',
    name: 'Library',
    locationType: 'library',
  },
  {
    id: 'location-7',
    name: 'Cafeteria',
    locationType: 'cafeteria',
  },
];

// Mock Passes (some active, some closed)
export const mockPasses: Pass[] = [
  {
    id: 'pass-1',
    studentId: 'student-2',
    status: 'OPEN',
    createdAt: new Date(Date.now() - 5 * 60 * 1000),
    lastUpdatedAt: new Date(Date.now() - 5 * 60 * 1000),
    legs: [
      {
        id: 'leg-1-1',
        legNumber: 1,
        originLocationId: 'location-1',
        destinationLocationId: 'location-3',
        state: 'OUT',
        timestamp: new Date(Date.now() - 5 * 60 * 1000),
      },
    ],
  },
  {
    id: 'pass-2',
    studentId: 'student-3',
    status: 'OPEN',
    createdAt: new Date(Date.now() - 10 * 60 * 1000),
    lastUpdatedAt: new Date(Date.now() - 2 * 60 * 1000),
    legs: [
      {
        id: 'leg-2-1',
        legNumber: 1,
        originLocationId: 'location-2',
        destinationLocationId: 'location-4',
        state: 'OUT',
        timestamp: new Date(Date.now() - 10 * 60 * 1000),
      },
      {
        id: 'leg-2-2',
        legNumber: 2,
        originLocationId: 'location-4',
        destinationLocationId: 'location-2',
        state: 'IN',
        timestamp: new Date(Date.now() - 2 * 60 * 1000),
      },
    ],
  },
  {
    id: 'pass-3',
    studentId: 'student-4',
    status: 'CLOSED',
    createdAt: new Date(Date.now() - 25 * 60 * 1000),
    lastUpdatedAt: new Date(Date.now() - 22 * 60 * 1000),
    legs: [
      {
        id: 'leg-3-1',
        legNumber: 1,
        originLocationId: 'location-1',
        destinationLocationId: 'location-5',
        state: 'OUT',
        timestamp: new Date(Date.now() - 25 * 60 * 1000),
      },
      {
        id: 'leg-3-2',
        legNumber: 2,
        originLocationId: 'location-5',
        destinationLocationId: 'location-1',
        state: 'IN',
        timestamp: new Date(Date.now() - 22 * 60 * 1000),
      },
    ],
  },
  {
    id: 'pass-4',
    studentId: 'student-4',
    status: 'CLOSED',
    createdAt: new Date(Date.now() - 30 * 60 * 1000),
    lastUpdatedAt: new Date(Date.now() - 15 * 60 * 1000),
    legs: [
      {
        id: 'leg-4-1',
        legNumber: 1,
        originLocationId: 'location-1',
        destinationLocationId: 'location-5',
        state: 'OUT',
        timestamp: new Date(Date.now() - 30 * 60 * 1000),
      },
      {
        id: 'leg-4-2',
        legNumber: 2,
        originLocationId: 'location-5',
        destinationLocationId: 'location-1',
        state: 'IN',
        timestamp: new Date(Date.now() - 15 * 60 * 1000),
      },
    ],
  },
];

// Mock Event Logs
export const mockEventLogs: EventLog[] = [
  {
    id: 'event-1',
    passId: 'pass-1',
    studentId: 'student-1',
    actorId: 'student-1',
    timestamp: new Date(Date.now() - 5 * 60 * 1000),
    eventType: 'PASS_CREATED',
  },
  {
    id: 'event-2',
    passId: 'pass-1',
    studentId: 'student-1',
    actorId: 'student-1',
    timestamp: new Date(Date.now() - 5 * 60 * 1000),
    eventType: 'DEPARTED',
  },
  {
    id: 'event-3',
    passId: 'pass-2',
    studentId: 'student-3',
    actorId: 'student-3',
    timestamp: new Date(Date.now() - 10 * 60 * 1000),
    eventType: 'PASS_CREATED',
  },
  {
    id: 'event-4',
    passId: 'pass-2',
    studentId: 'student-3',
    actorId: 'student-3',
    timestamp: new Date(Date.now() - 10 * 60 * 1000),
    eventType: 'DEPARTED',
  },
  {
    id: 'event-5',
    passId: 'pass-2',
    studentId: 'student-3',
    actorId: 'student-3',
    timestamp: new Date(Date.now() - 2 * 60 * 1000),
    eventType: 'RETURNED',
  },
  {
    id: 'event-6',
    passId: 'pass-3',
    studentId: 'student-2',
    actorId: 'student-2',
    timestamp: new Date(Date.now() - 25 * 60 * 1000),
    eventType: 'PASS_CREATED',
  },
  {
    id: 'event-7',
    passId: 'pass-3',
    studentId: 'student-2',
    actorId: 'student-2',
    timestamp: new Date(Date.now() - 25 * 60 * 1000),
    eventType: 'DEPARTED',
  },
  {
    id: 'event-8',
    passId: 'pass-3',
    studentId: 'student-2',
    actorId: 'student-2',
    timestamp: new Date(Date.now() - 22 * 60 * 1000),
    eventType: 'RETURNED',
  },
  {
    id: 'event-9',
    passId: 'pass-3',
    studentId: 'student-2',
    actorId: 'student-2',
    timestamp: new Date(Date.now() - 22 * 60 * 1000),
    eventType: 'PASS_CLOSED',
  },
];

// Helper functions
export const getAllLocations = (): Location[] => {
  return mockLocations;
};

export const getTeacherById = (id: string): User | undefined => {
  return mockUsers.find(user => user.id === id && user.role === 'teacher');
};

export const getLocationById = (id: string): Location | undefined => {
  return mockLocations.find(location => location.id === id);
};

export const getActivePassByStudentId = (studentId: string): Pass | undefined => {
  return mockPasses.find(pass => pass.studentId === studentId && pass.status === 'OPEN');
};

export const getStudentsByLocation = (locationId: string): User[] => {
  return mockUsers.filter(user => 
    user.role === 'student' && user.assignedLocationId === locationId
  );
};

export const getAvailableDestinations = (): Location[] => {
  return mockLocations.filter(location => location.locationType !== 'classroom');
}; 