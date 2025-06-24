import { 
  db, 
  auth, 
  getFirebaseApp, 
  getFirebaseFirestore, 
  getFirebaseAuth,
  firebaseApp,
  firestore
} from '../firebase/config';

// Mock Firebase modules
jest.mock('firebase/app', () => ({
  initializeApp: jest.fn(() => ({ name: 'mock-app' })),
  getApps: jest.fn(() => [])
}));

jest.mock('firebase/firestore', () => ({
  getFirestore: jest.fn(() => ({ type: 'mock-firestore' }))
}));

jest.mock('firebase/auth', () => ({
  getAuth: jest.fn(() => ({ type: 'mock-auth' }))
}));

describe('Firebase Config', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should export db service', () => {
    expect(db).toBeDefined();
    expect(db).toHaveProperty('type', 'mock-firestore');
  });

  it('should export auth service', () => {
    expect(auth).toBeDefined();
    expect(auth).toHaveProperty('type', 'mock-auth');
  });

  it('should provide getter functions', () => {
    expect(getFirebaseApp()).toBeDefined();
    expect(getFirebaseFirestore()).toBeDefined();
    expect(getFirebaseAuth()).toBeDefined();
  });

  it('should provide legacy exports', () => {
    expect(firebaseApp).toBeDefined();
    expect(firestore).toBeDefined();
  });

  it('should return same instances', () => {
    expect(getFirebaseFirestore()).toBe(db);
    expect(getFirebaseAuth()).toBe(auth);
    expect(firestore).toBe(db);
  });
}); 