import { logEvent, EventLog, EventType } from '../eventLogger';
import { addDoc, collection } from 'firebase/firestore';
import { getFirebaseFirestore } from '@/lib/firebase/config';

// Mock Firebase
jest.mock('firebase/firestore', () => ({
  addDoc: jest.fn(),
  collection: jest.fn()
}));

jest.mock('@/lib/firebase/config', () => ({
  getFirebaseFirestore: jest.fn()
}));

const mockAddDoc = addDoc as jest.MockedFunction<typeof addDoc>;
const mockCollection = collection as jest.MockedFunction<typeof collection>;
const mockGetFirebaseFirestore = getFirebaseFirestore as jest.MockedFunction<typeof getFirebaseFirestore>;

// Mock console.error
const mockConsoleError = jest.spyOn(console, 'error').mockImplementation(() => {});

describe('EventLogger', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockConsoleError.mockClear();
  });

  afterAll(() => {
    mockConsoleError.mockRestore();
  });

  describe('logEvent', () => {
    const mockDb = { type: 'mock-firestore' };
    const mockCollectionRef = { type: 'mock-collection' };

    it('should log event successfully', async () => {
      mockGetFirebaseFirestore.mockReturnValue(mockDb as any);
      mockCollection.mockReturnValue(mockCollectionRef as any);
      mockAddDoc.mockResolvedValue({ id: 'test-id' } as any);

      const event: Omit<EventLog, 'id'> = {
        passId: 'pass-123',
        studentId: 'student-123',
        actorId: 'teacher-123',
        timestamp: new Date('2024-01-01T10:00:00Z'),
        eventType: 'PASS_CREATED',
        details: 'Pass created for bathroom visit',
        notificationLevel: 'teacher'
      };

      await logEvent(event);

      expect(mockGetFirebaseFirestore).toHaveBeenCalled();
      expect(mockCollection).toHaveBeenCalledWith(mockDb, 'eventLogs');
      expect(mockAddDoc).toHaveBeenCalledWith(mockCollectionRef, {
        ...event,
        timestamp: event.timestamp
      });
    });

    it('should add timestamp if not provided', async () => {
      mockGetFirebaseFirestore.mockReturnValue(mockDb as any);
      mockCollection.mockReturnValue(mockCollectionRef as any);
      mockAddDoc.mockResolvedValue({ id: 'test-id' } as any);

      const event: Omit<EventLog, 'id' | 'timestamp'> = {
        actorId: 'teacher-123',
        eventType: 'PASS_CREATED'
      };

      const beforeCall = new Date();
      await logEvent(event as any);
      const afterCall = new Date();

      expect(mockAddDoc).toHaveBeenCalledWith(
        mockCollectionRef,
        expect.objectContaining({
          ...event,
          timestamp: expect.any(Date)
        })
      );

      const callArgs = mockAddDoc.mock.calls[0][1];
      const loggedTimestamp = callArgs.timestamp;
      expect(loggedTimestamp.getTime()).toBeGreaterThanOrEqual(beforeCall.getTime());
      expect(loggedTimestamp.getTime()).toBeLessThanOrEqual(afterCall.getTime());
    });

    it('should handle all event types', async () => {
      mockGetFirebaseFirestore.mockReturnValue(mockDb as any);
      mockCollection.mockReturnValue(mockCollectionRef as any);
      mockAddDoc.mockResolvedValue({ id: 'test-id' } as any);

      const eventTypes: EventType[] = [
        'PASS_CREATED',
        'DEPARTED',
        'ARRIVED',
        'RETURNED',
        'PASS_CLOSED',
        'CLAIMED',
        'EMERGENCY_ACTIVATED',
        'INVALID_TRANSITION',
        'POLICY_DENIED',
        'POLICY_APPROVED',
        'ERROR',
        'INFO',
        'NOTIFICATION_SENT',
        'NOTIFICATION_FAILED',
        'STUDENT_CLAIMED',
        'SESSION_CREATED',
        'SESSION_REFRESHED',
        'SESSION_INVALIDATED',
        'ALL_SESSIONS_INVALIDATED',
        'SESSION_LIMIT_ENFORCED'
      ];

      for (const eventType of eventTypes) {
        const event: Omit<EventLog, 'id'> = {
          actorId: 'user-123',
          timestamp: new Date(),
          eventType
        };

        await logEvent(event);
      }

      expect(mockAddDoc).toHaveBeenCalledTimes(eventTypes.length);
    });

    it('should handle event with string details', async () => {
      mockGetFirebaseFirestore.mockReturnValue(mockDb as any);
      mockCollection.mockReturnValue(mockCollectionRef as any);
      mockAddDoc.mockResolvedValue({ id: 'test-id' } as any);

      const event: Omit<EventLog, 'id'> = {
        actorId: 'teacher-123',
        timestamp: new Date(),
        eventType: 'ERROR',
        details: 'Something went wrong'
      };

      await logEvent(event);

      expect(mockAddDoc).toHaveBeenCalledWith(
        mockCollectionRef,
        expect.objectContaining({
          details: 'Something went wrong'
        })
      );
    });

    it('should handle event with object details', async () => {
      mockGetFirebaseFirestore.mockReturnValue(mockDb as any);
      mockCollection.mockReturnValue(mockCollectionRef as any);
      mockAddDoc.mockResolvedValue({ id: 'test-id' } as any);

      const details = {
        reason: 'Bathroom',
        expectedDuration: 5,
        location: 'Building A'
      };

      const event: Omit<EventLog, 'id'> = {
        actorId: 'teacher-123',
        timestamp: new Date(),
        eventType: 'PASS_CREATED',
        details
      };

      await logEvent(event);

      expect(mockAddDoc).toHaveBeenCalledWith(
        mockCollectionRef,
        expect.objectContaining({
          details
        })
      );
    });

    it('should handle event with policy context', async () => {
      mockGetFirebaseFirestore.mockReturnValue(mockDb as any);
      mockCollection.mockReturnValue(mockCollectionRef as any);
      mockAddDoc.mockResolvedValue({ id: 'test-id' } as any);

      const policyContext = {
        policyId: 'policy-123',
        ruleId: 'rule-456',
        result: 'approved'
      };

      const event: Omit<EventLog, 'id'> = {
        actorId: 'teacher-123',
        timestamp: new Date(),
        eventType: 'POLICY_APPROVED',
        policyContext
      };

      await logEvent(event);

      expect(mockAddDoc).toHaveBeenCalledWith(
        mockCollectionRef,
        expect.objectContaining({
          policyContext
        })
      );
    });

    it('should handle all notification levels', async () => {
      mockGetFirebaseFirestore.mockReturnValue(mockDb as any);
      mockCollection.mockReturnValue(mockCollectionRef as any);
      mockAddDoc.mockResolvedValue({ id: 'test-id' } as any);

      const notificationLevels: Array<'student' | 'teacher' | 'admin'> = [
        'student',
        'teacher',
        'admin'
      ];

      for (const level of notificationLevels) {
        const event: Omit<EventLog, 'id'> = {
          actorId: 'user-123',
          timestamp: new Date(),
          eventType: 'NOTIFICATION_SENT',
          notificationLevel: level
        };

        await logEvent(event);
      }

      expect(mockAddDoc).toHaveBeenCalledTimes(notificationLevels.length);
    });

    it('should handle Firebase not initialized', async () => {
      mockGetFirebaseFirestore.mockReturnValue(null as any);

      const event: Omit<EventLog, 'id'> = {
        actorId: 'teacher-123',
        timestamp: new Date(),
        eventType: 'ERROR'
      };

      await logEvent(event);

      expect(mockConsoleError).toHaveBeenCalledWith('Firebase not initialized, cannot log event');
      expect(mockCollection).not.toHaveBeenCalled();
      expect(mockAddDoc).not.toHaveBeenCalled();
    });

    it('should handle Firebase undefined', async () => {
      mockGetFirebaseFirestore.mockReturnValue(undefined as any);

      const event: Omit<EventLog, 'id'> = {
        actorId: 'teacher-123',
        timestamp: new Date(),
        eventType: 'ERROR'
      };

      await logEvent(event);

      expect(mockConsoleError).toHaveBeenCalledWith('Firebase not initialized, cannot log event');
      expect(mockCollection).not.toHaveBeenCalled();
      expect(mockAddDoc).not.toHaveBeenCalled();
    });

    it('should handle Firestore errors gracefully', async () => {
      mockGetFirebaseFirestore.mockReturnValue(mockDb as any);
      mockCollection.mockReturnValue(mockCollectionRef as any);
      mockAddDoc.mockRejectedValue(new Error('Firestore error'));

      const event: Omit<EventLog, 'id'> = {
        actorId: 'teacher-123',
        timestamp: new Date(),
        eventType: 'ERROR'
      };

      // Should not throw
      await expect(logEvent(event)).rejects.toThrow('Firestore error');
    });

    it('should handle minimal event data', async () => {
      mockGetFirebaseFirestore.mockReturnValue(mockDb as any);
      mockCollection.mockReturnValue(mockCollectionRef as any);
      mockAddDoc.mockResolvedValue({ id: 'test-id' } as any);

      const event: Omit<EventLog, 'id'> = {
        actorId: 'user-123',
        timestamp: new Date(),
        eventType: 'INFO'
      };

      await logEvent(event);

      expect(mockAddDoc).toHaveBeenCalledWith(
        mockCollectionRef,
        expect.objectContaining({
          actorId: 'user-123',
          eventType: 'INFO',
          timestamp: expect.any(Date)
        })
      );
    });
  });
}); 