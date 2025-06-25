// Learn more: https://github.com/testing-library/jest-dom
import '@testing-library/jest-dom'
import { configure as configureRTL } from '@testing-library/react'

// Mock environment variables
process.env.NEXT_PUBLIC_FIREBASE_API_KEY = 'test-api-key'
process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN = 'test.firebaseapp.com'
process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID = 'test-project'
process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET = 'test.appspot.com'
process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID = '123456789'
process.env.NEXT_PUBLIC_FIREBASE_APP_ID = 'test-app-id'

// Server-side environment variables
process.env.FIREBASE_PROJECT_ID = 'test-project'
process.env.FIREBASE_CLIENT_EMAIL = 'test@test.com'
process.env.FIREBASE_PRIVATE_KEY = 'test-private-key'
process.env.REDIS_URL = 'redis://localhost:6379'

// Add fetch polyfill for Node.js test environment
global.fetch = jest.fn();

// Add Response global for Firebase Auth
global.Response = class Response {
  constructor(body, init = {}) {
    this.body = body;
    this.status = init.status || 200;
    this.statusText = init.statusText || 'OK';
    this.headers = new Map(Object.entries(init.headers || {}));
  }
  
  json() {
    return Promise.resolve(JSON.parse(this.body));
  }
  
  text() {
    return Promise.resolve(this.body);
  }
};

// Add Request global for Next.js API routes
global.Request = class Request {
  constructor(input, init = {}) {
    this.url = typeof input === 'string' ? input : input.url;
    this.method = init.method || 'GET';
    this.headers = new Map(Object.entries(init.headers || {}));
    this.body = init.body;
  }
  
  json() {
    return Promise.resolve(JSON.parse(this.body));
  }
  
  text() {
    return Promise.resolve(this.body);
  }
};

// Mock NextResponse for API route testing
jest.mock('next/server', () => ({
  NextResponse: {
    json: (data, init = {}) => {
      const response = {
        status: init.status || 200,
        json: () => Promise.resolve(data),
        headers: new Map(Object.entries(init.headers || {})),
        cookies: {
          delete: jest.fn(),
          get: jest.fn(),
          set: jest.fn(),
        }
      };
      return response;
    }
  },
  NextRequest: global.Request
}));

// Mock crypto.randomUUID for tests
Object.defineProperty(global, 'crypto', {
  value: {
    randomUUID: () => 'test-uuid-' + Math.random().toString(36).substr(2, 9)
  }
});

// Mock Firebase Firestore
jest.mock('firebase/firestore', () => ({
  getFirestore: jest.fn(),
  collection: jest.fn(),
  doc: jest.fn(),
  setDoc: jest.fn(),
  getDoc: jest.fn(),
  getDocs: jest.fn(),
  addDoc: jest.fn(),
  updateDoc: jest.fn(),
  deleteDoc: jest.fn(),
  query: jest.fn(),
  where: jest.fn(),
  orderBy: jest.fn(),
  limit: jest.fn(),
  onSnapshot: jest.fn(),
  writeBatch: jest.fn(),
  runTransaction: jest.fn(),
  serverTimestamp: jest.fn(() => new Date()),
  Timestamp: {
    now: jest.fn(() => ({ toDate: () => new Date() })),
    fromDate: jest.fn((date) => ({ toDate: () => date }))
  }
}));

// Mock Firebase Auth
jest.mock('firebase/auth', () => ({
  getAuth: jest.fn(),
  signInWithPopup: jest.fn(),
  signOut: jest.fn(),
  onAuthStateChanged: jest.fn(),
  GoogleAuthProvider: class MockGoogleAuthProvider {
    constructor() {
      return {
        setCustomParameters: jest.fn(),
        addScope: jest.fn(),
        credential: jest.fn()
      };
    }
  },
  User: class MockUser {
    constructor() {
      this.uid = 'test-user-id';
      this.email = 'test@example.com';
      this.displayName = 'Test User';
    }
  }
}));

// Mock Redis
jest.mock('redis', () => ({
  createClient: jest.fn(() => ({
    connect: jest.fn(),
    disconnect: jest.fn(),
    get: jest.fn(),
    set: jest.fn(),
    setex: jest.fn(),
    del: jest.fn(),
    incr: jest.fn(),
    expire: jest.fn(),
    on: jest.fn(),
    isReady: true
  }))
}));

// Mock Firebase Admin
jest.mock('firebase-admin/app', () => ({
  initializeApp: jest.fn(),
  cert: jest.fn(),
  getApps: jest.fn(() => []),
  getApp: jest.fn()
}));

jest.mock('firebase-admin/firestore', () => ({
  getFirestore: jest.fn(() => ({
    collection: jest.fn(),
    doc: jest.fn(),
    batch: jest.fn(() => ({
      set: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      commit: jest.fn()
    }))
  }))
}));

// Mock console methods to reduce noise in tests
const originalConsoleError = console.error;
const originalConsoleWarn = console.warn;
const originalConsoleLog = console.log;

beforeAll(() => {
  // Suppress console output during tests unless it's an actual error
  console.error = jest.fn();
  console.warn = jest.fn();
  console.log = jest.fn();
});

afterAll(() => {
  // Restore console methods
  console.error = originalConsoleError;
  console.warn = originalConsoleWarn;
  console.log = originalConsoleLog;
});

// Global test utilities
global.testUtils = {
  createMockPass: (overrides = {}) => ({
    id: 'test-pass-id',
    studentId: 'test-student-id',
    status: 'OPEN',
    createdAt: new Date(),
    legs: [{
      id: 'leg-1',
      originLocationId: 'classroom-1',
      destinationLocationId: 'bathroom-1',
      startTime: new Date(),
      endTime: null
    }],
    ...overrides
  }),
  
  createMockUser: (overrides = {}) => ({
    id: 'test-user-id',
    name: 'Test User',
    email: 'test@example.com',
    role: 'student',
    ...overrides
  }),
  
  createMockLocation: (overrides = {}) => ({
    id: 'test-location-id',
    name: 'Test Location',
    type: 'classroom',
    ...overrides
  })
};

configureRTL({ asyncUtilTimeout: 5000 }) 