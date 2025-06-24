// Firebase Auth Mock
const mockUser = {
  uid: 'mock-user-id',
  email: 'test@example.com',
  displayName: 'Test User',
  photoURL: 'https://example.com/photo.jpg',
  emailVerified: true,
  providerData: []
};

const mockAuth = {
  currentUser: null,
  onAuthStateChanged: jest.fn(),
  signInWithPopup: jest.fn(),
  signOut: jest.fn(),
};

const mockGoogleAuthProvider = {
  setCustomParameters: jest.fn(),
  // Add any other methods that might be called
  addScope: jest.fn(),
  credential: jest.fn()
};

class MockGoogleAuthProvider {
  constructor() {
    return mockGoogleAuthProvider;
  }
  
  setCustomParameters(params) {
    return mockGoogleAuthProvider.setCustomParameters(params);
  }
}

const mock = {
  __esModule: true,
  getAuth: jest.fn(() => mockAuth),
  onAuthStateChanged: jest.fn(),
  signInWithPopup: jest.fn().mockResolvedValue({
    user: mockUser,
    credential: null,
    operationType: 'signIn'
  }),
  signOut: jest.fn().mockResolvedValue(undefined),
  GoogleAuthProvider: MockGoogleAuthProvider,
  // Export mockAuth for test customization
  mockAuth,
  mockUser,
  mockGoogleAuthProvider
};

module.exports = mock; 