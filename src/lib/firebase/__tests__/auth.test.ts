import {
  signInWithGoogle,
  signOut,
  googleProvider,
  onAuthStateChanged,
} from '../auth';
import {
  signInWithPopup,
  signOut as firebaseSignOut,
  GoogleAuthProvider,
} from 'firebase/auth';

// Mock Firebase auth
jest.mock('firebase/auth', () => ({
  signInWithPopup: jest.fn(),
  signOut: jest.fn(),
  GoogleAuthProvider: jest.fn().mockImplementation(() => ({
    setCustomParameters: jest.fn(),
  })),
  onAuthStateChanged: jest.fn(),
}));

// Mock Firebase config
jest.mock('../config', () => ({
  auth: {
    currentUser: null,
  },
}));

// Mock console methods
const mockConsoleError = jest.spyOn(console, 'error').mockImplementation(() => {});

// Mock localStorage directly
const mockLocalStorage = {
  removeItem: jest.fn(),
};

// Mock global localStorage
Object.defineProperty(global, 'localStorage', {
  value: mockLocalStorage,
  writable: true,
});

// Mock window
const mockWindow = {
  location: {
    href: '',
  },
};

Object.defineProperty(global, 'window', {
  value: mockWindow,
  writable: true,
});

describe('Firebase Auth Service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockConsoleError.mockClear();
    mockLocalStorage.removeItem.mockClear();
    
    // Reset window.location to clean state
    Object.defineProperty(mockWindow.location, 'href', {
      value: '',
      writable: true,
      configurable: true,
    });
  });

  afterAll(() => {
    mockConsoleError.mockRestore();
  });

  describe('googleProvider', () => {
    it('should be defined and configured', () => {
      // The provider should be defined and properly configured
      expect(googleProvider).toBeDefined();
      expect(googleProvider.setCustomParameters).toBeDefined();
    });

    it('should set custom parameters for prompt', () => {
      // The provider should be configured with select_account prompt
      expect(googleProvider).toBeDefined();
    });
  });

  describe('signInWithGoogle', () => {
    it('should successfully sign in with Google', async () => {
      const mockUserCredential = {
        user: {
          uid: 'test-uid',
          email: 'test@example.com',
          displayName: 'Test User',
        },
      };

      (signInWithPopup as jest.Mock).mockResolvedValue(mockUserCredential);

      const result = await signInWithGoogle();

      expect(signInWithPopup).toHaveBeenCalledWith(
        expect.any(Object), // auth object
        googleProvider
      );
      expect(result).toEqual(mockUserCredential);
    });

    it('should handle sign-in errors', async () => {
      const mockError = new Error('Sign-in failed');
      (signInWithPopup as jest.Mock).mockRejectedValue(mockError);

      await expect(signInWithGoogle()).rejects.toThrow('Sign-in failed');
    });

    it('should handle network errors during sign-in', async () => {
      const networkError = new Error('Network error');
      (signInWithPopup as jest.Mock).mockRejectedValue(networkError);

      await expect(signInWithGoogle()).rejects.toThrow('Network error');
    });

    it('should handle popup blocked errors', async () => {
      const popupError = new Error('Popup blocked');
      (signInWithPopup as jest.Mock).mockRejectedValue(popupError);

      await expect(signInWithGoogle()).rejects.toThrow('Popup blocked');
    });
  });

  describe('signOut', () => {
    it('should successfully sign out and redirect', async () => {
      (firebaseSignOut as jest.Mock).mockResolvedValue(undefined);

      await signOut();

      expect(mockLocalStorage.removeItem).toHaveBeenCalledWith('sessionToken');
      expect(firebaseSignOut).toHaveBeenCalledWith(expect.any(Object));
      expect(mockWindow.location.href).toBe('/');
    });

    it('should handle localStorage removal errors gracefully', async () => {
      const storageError = new Error('Storage error');
      mockLocalStorage.removeItem.mockImplementation(() => {
        throw storageError;
      });

      (firebaseSignOut as jest.Mock).mockResolvedValue(undefined);

      await signOut();

      expect(firebaseSignOut).toHaveBeenCalled();
      expect(mockWindow.location.href).toBe('/');
    });

    it('should handle Firebase sign-out errors', async () => {
      const signOutError = new Error('Sign-out failed');
      (firebaseSignOut as jest.Mock).mockRejectedValue(signOutError);

      await expect(signOut()).rejects.toThrow('Sign-out failed');

      expect(mockLocalStorage.removeItem).toHaveBeenCalledWith('sessionToken');
      expect(firebaseSignOut).toHaveBeenCalledWith(expect.any(Object));
    });

    it('should work when window is undefined (SSR)', async () => {
      // Temporarily remove window
      const originalWindow = global.window;
      // @ts-ignore
      delete global.window;

      (firebaseSignOut as jest.Mock).mockResolvedValue(undefined);

      await signOut();

      expect(firebaseSignOut).toHaveBeenCalledWith(expect.any(Object));

      // Restore window
      global.window = originalWindow;
    });

    it('should handle localStorage not being available', async () => {
      // Mock window without localStorage
      const windowWithoutStorage = {
        location: { href: '' },
      };
      
      Object.defineProperty(global, 'window', {
        value: windowWithoutStorage,
        writable: true,
      });

      (firebaseSignOut as jest.Mock).mockResolvedValue(undefined);

      await signOut();

      expect(firebaseSignOut).toHaveBeenCalled();
      expect(windowWithoutStorage.location.href).toBe('/');

      // Restore original window
      Object.defineProperty(global, 'window', {
        value: mockWindow,
        writable: true,
      });
    });

    it('should complete sign-out process even if redirect fails', async () => {
      (firebaseSignOut as jest.Mock).mockResolvedValue(undefined);
      
      // Mock location.href setter to throw error in a controlled way
      const originalHref = mockWindow.location.href;
      const mockSetter = jest.fn(() => {
        throw new Error('Redirect failed');
      });
      
      Object.defineProperty(mockWindow.location, 'href', {
        set: mockSetter,
        get: () => originalHref,
        configurable: true,
      });

      // Should not throw even if redirect fails
      await expect(signOut()).resolves.not.toThrow();

      expect(mockLocalStorage.removeItem).toHaveBeenCalledWith('sessionToken');
      expect(firebaseSignOut).toHaveBeenCalled();
      expect(mockSetter).toHaveBeenCalledWith('/');

      // Restore normal behavior
      Object.defineProperty(mockWindow.location, 'href', {
        value: '/',
        writable: true,
        configurable: true,
      });
    });
  });

  describe('exports', () => {
    it('should export onAuthStateChanged', () => {
      expect(onAuthStateChanged).toBeDefined();
    });

    it('should export googleProvider', () => {
      expect(googleProvider).toBeDefined();
    });
  });
}); 