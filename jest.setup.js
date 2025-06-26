// Learn more: https://github.com/testing-library/jest-dom
import '@testing-library/jest-dom'

// Mock crypto.randomUUID for tests
Object.defineProperty(global, 'crypto', {
  value: {
    randomUUID: () => 'test-uuid-' + Math.random().toString(36).substr(2, 9),
    getRandomValues: (arr) => {
      for (let i = 0; i < arr.length; i++) {
        arr[i] = Math.floor(Math.random() * 256);
      }
      return arr;
    }
  }
});

// Mock Next.js environment variables for tests
process.env.FIREBASE_PROJECT_ID = 'test-project-id';
process.env.FIREBASE_PRIVATE_KEY = '-----BEGIN PRIVATE KEY-----\nMIIEvQIBADANBgkqhkiG9w0BAQEFAASCBKcwggSjAgEAAoIBAQC7VJTUt9Us8cKB\nAgEAAoIBAQC7VJTUt9Us8cKB\n-----END PRIVATE KEY-----';
process.env.FIREBASE_CLIENT_EMAIL = 'test@test.com';

// Mock Next.js Request and Response for API route tests
jest.mock('next/server', () => ({
  NextRequest: class NextRequest {
    constructor(url, options = {}) {
      this.url = url;
      this.method = options.method || 'GET';
      this.headers = new Map(Object.entries(options.headers || {}));
      this.body = options.body;
    }

    async json() {
      if (typeof this.body === 'string') {
        return JSON.parse(this.body);
      }
      return this.body || {};
    }

    async text() {
      return typeof this.body === 'string' ? this.body : JSON.stringify(this.body || {});
    }
  },
  NextResponse: {
    json: (data, options = {}) => ({
      json: async () => data,
      status: options.status || 200,
      headers: new Map(Object.entries(options.headers || {})),
    }),
  },
}));

// Suppress console.error for expected errors in tests
const originalError = console.error;
console.error = (...args) => {
  if (
    typeof args[0] === 'string' &&
    (args[0].includes('Warning: An update to') ||
     args[0].includes('Warning: ReactDOM.render is no longer supported') ||
     args[0].includes('Warning: componentWillReceiveProps has been renamed'))
  ) {
    return;
  }
  originalError.call(console, ...args);
};
