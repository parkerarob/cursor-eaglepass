// Enhanced Firestore mock with proper data handling
const mockQuerySnapshot = (docs) => ({
  empty: docs.length === 0,
  size: docs.length,
  docs: docs.map((doc, index) => ({
    id: doc.id || `doc-${index}`,
    data: () => doc.data || doc,
    exists: () => true,
    ref: { id: doc.id || `doc-${index}` }
  })),
  forEach: (callback) => docs.forEach((doc, index) => callback({
    id: doc.id || `doc-${index}`,
    data: () => doc.data || doc,
    exists: () => true,
    ref: { id: doc.id || `doc-${index}` }
  }))
});

const mockDocSnapshot = (doc) => ({
  id: doc.id || 'mock-doc-id',
  data: () => doc.data || doc,
  exists: () => true,
  ref: { id: doc.id || 'mock-doc-id' }
});

const mock = {
  __esModule: true,
  collection: jest.fn((db, collectionName) => ({
    doc: jest.fn((docId) => ({ id: docId, collection: collectionName })),
    add: jest.fn(),
    get: jest.fn()
  })),
  doc: jest.fn((db, collectionName, docId) => ({ id: docId, collection: collectionName })),
  setDoc: jest.fn().mockResolvedValue(undefined),
  getDoc: jest.fn().mockResolvedValue(mockDocSnapshot({ id: 'mock-doc', data: {} })),
  getDocs: jest.fn().mockResolvedValue(mockQuerySnapshot([])),
  addDoc: jest.fn().mockResolvedValue({ id: 'mock-added-doc' }),
  updateDoc: jest.fn().mockResolvedValue(undefined),
  deleteDoc: jest.fn().mockResolvedValue(undefined),
  query: jest.fn((collectionRef, ...queryConstraints) => ({
    collection: collectionRef.collection,
    constraints: queryConstraints
  })),
  where: jest.fn((field, op, value) => ({ field, op, value })),
  orderBy: jest.fn((field, direction) => ({ field, direction })),
  limit: jest.fn((count) => ({ count })),
  onSnapshot: jest.fn(),
  writeBatch: jest.fn(() => ({
    set: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
    commit: jest.fn().mockResolvedValue(undefined)
  })),
  runTransaction: jest.fn().mockImplementation(async (updateFunction) => {
    return await updateFunction({});
  }),
  serverTimestamp: jest.fn(() => new Date()),
  Timestamp: {
    now: jest.fn(() => ({ toDate: () => new Date() })),
    fromDate: jest.fn((date) => ({ toDate: () => date }))
  },
  getFirestore: jest.fn(() => ({})),
};

// Helper function to set up mock data for specific tests
mock.setupMockData = (collectionName, mockData) => {
  const docs = Array.isArray(mockData) ? mockData : [mockData];
  mock.getDocs.mockResolvedValueOnce(mockQuerySnapshot(docs));
};

// Helper function to set up mock error for specific tests
mock.setupMockError = (error) => {
  mock.getDocs.mockRejectedValueOnce(error);
};

module.exports = mock; 