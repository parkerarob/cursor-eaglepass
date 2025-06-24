// @ts-nocheck

const admin = require('firebase-admin');

jest.mock('firebase-admin', () => {
  const mockCollection = {
    where: jest.fn().mockReturnThis(),
    limit: jest.fn().mockReturnThis(),
    get: jest.fn(),
    doc: jest.fn(),
    add: jest.fn(),
  };

  const firestoreFn: any = jest.fn(() => ({/* inner db placeholder */}));
  firestoreFn.collection = jest.fn(() => mockCollection);

  // Wrapper function returned by admin.firestore()
  const firestoreWrapper: any = jest.fn(() => firestoreFn);
  firestoreWrapper.FieldValue = { serverTimestamp: jest.fn() };
  firestoreWrapper.collection = firestoreFn.collection;

  return {
    initializeApp: jest.fn(),
    firestore: jest.fn(() => firestoreWrapper),
    credential: { applicationDefault: jest.fn() },
  };
});

const mockCollection = {
  where: jest.fn(),
  doc: jest.fn(),
  add: jest.fn(),
};

const mockWhere = {
  where: jest.fn(),
  limit: jest.fn(),
  get: jest.fn(),
};

const mockRawRequest = { rawBody: Buffer.from('') };

describe('validatePassCreation cloud function', () => {
  let adminMock, firestore, mockDb;
  let validatePassCreation;

  beforeAll(() => {
    adminMock = require('firebase-admin');
    firestore = adminMock.firestore();
    // Ensure FieldValue and Timestamp exist on the mock function itself
    adminMock.firestore.FieldValue = { serverTimestamp: jest.fn() };
    adminMock.firestore.Timestamp = { now: jest.fn(), fromDate: jest.fn() };
    mockDb = firestore();
    if (!mockDb.collection) {
      mockDb.collection = jest.fn();
    }
    ({ validatePassCreation } = require('./index'));
  });

  beforeEach(() => {
    jest.clearAllMocks();
    if (!mockDb.collection) {
      mockDb.collection = jest.fn();
    }
    mockDb.collection.mockReturnValue(mockCollection);
    mockCollection.where.mockReturnValue(mockWhere);
    mockWhere.where.mockReturnValue(mockWhere);
    mockWhere.limit.mockReturnValue(mockWhere);
    mockDb.FieldValue = { serverTimestamp: jest.fn() };
  });

  function makeRequest(data, auth = { uid: 'student1', token: {} }) {
    return {
      data,
      auth,
      rawRequest: mockRawRequest,
      acceptsStreaming: false,
    };
  }

  it('allows pass creation when no open pass exists', async () => {
    mockWhere.get.mockResolvedValue({ empty: true });
    mockDb.collection.mockReturnValueOnce(mockCollection); // eventLogs
    mockCollection.add.mockResolvedValue({});
    const req = makeRequest({ studentId: 'student1' });
    const result = await validatePassCreation.run(req);
    expect(result.allowed).toBe(true);
    expect(result.hasOpenPass).toBe(false);
  });

  it('blocks pass creation when open pass exists', async () => {
    mockWhere.get.mockResolvedValue({ empty: false });
    mockDb.collection.mockReturnValueOnce(mockCollection); // eventLogs
    mockCollection.add.mockResolvedValue({});
    const req = makeRequest({ studentId: 'student1' });
    const result = await validatePassCreation.run(req);
    expect(result.allowed).toBe(false);
    expect(result.hasOpenPass).toBe(true);
  });

  it('throws error if studentId is missing', async () => {
    const req = makeRequest({});
    await expect(validatePassCreation.run(req)).rejects.toThrow('studentId is required');
  });

  it('throws error if not authenticated', async () => {
    const req = makeRequest({ studentId: 'student1' }, undefined);
    await expect(validatePassCreation.run(req)).rejects.toThrow('User must be authenticated');
  });

  it('throws error if user is not student or allowed role', async () => {
    // Simulate user not matching studentId and not admin/teacher/dev
    mockDb.collection.mockReturnValueOnce({ doc: () => ({ get: async () => ({ exists: true, data: () => ({ role: 'parent' }) }) }) });
    const req = makeRequest({ studentId: 'student1' }, { uid: 'otheruser', token: {} });
    await expect(validatePassCreation.run(req)).rejects.toThrow('Insufficient permissions');
  });
}); 