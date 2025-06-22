import { PassStateMachine } from '../stateMachine';
import { Pass, User, PassFormData } from '@/types';
import { generateUUID } from '../utils';

// Mock Firebase functions
jest.mock('../firebase/firestore', () => ({
  getLocationById: jest.fn(),
}));

import { getLocationById } from '../firebase/firestore';
const mockGetLocationById = getLocationById as jest.MockedFunction<typeof getLocationById>;

// Mock data
const mockStudent: User = {
  id: 'student-1',
  name: 'Test Student',
  email: 'test@student.nhcs.net',
  role: 'student',
  assignedLocationId: 'classroom-1',
};

const mockLocations = {
  'classroom-1': { id: 'classroom-1', name: 'Classroom 1', locationType: 'classroom' as const },
  'library-1': { id: 'library-1', name: 'Library', locationType: 'library' as const },
  'bathroom-1': { id: 'bathroom-1', name: 'Bathroom', locationType: 'bathroom' as const },
};

beforeEach(() => {
  jest.clearAllMocks();
  
  mockGetLocationById.mockImplementation(async (id: string) => {
    return mockLocations[id as keyof typeof mockLocations] || null;
  });
});

describe('PassStateMachine', () => {
  describe('createPass', () => {
    it('should create a new pass', () => {
      const formData: PassFormData = { destinationLocationId: 'library-1' };
      const pass = PassStateMachine.createPass(formData, mockStudent);

      expect(pass.id).toMatch(/^pass-\d+$/);
      expect(pass.studentId).toBe(mockStudent.id);
      expect(pass.status).toBe('OPEN');
      expect(pass.legs).toHaveLength(1);
      expect(pass.legs[0]).toMatchObject({
        legNumber: 1,
        originLocationId: mockStudent.assignedLocationId,
        destinationLocationId: formData.destinationLocationId,
        state: 'OUT',
      });
    });
  });

  describe('getCurrentLeg', () => {
    it('should return the most recent leg', () => {
      const pass: Pass = {
        id: 'pass-1',
        studentId: mockStudent.id,
        status: 'OPEN',
        createdAt: new Date(),
        lastUpdatedAt: new Date(),
        legs: [
          {
            id: generateUUID(),
            legNumber: 1,
            originLocationId: 'classroom-1',
            destinationLocationId: 'library-1',
            state: 'OUT',
            timestamp: new Date(),
          },
          {
            id: generateUUID(),
            legNumber: 2,
            originLocationId: 'library-1',
            destinationLocationId: 'library-1',
            state: 'IN',
            timestamp: new Date(),
          },
        ],
      };

      const stateMachine = new PassStateMachine(pass, mockStudent);
      const currentLeg = stateMachine.getCurrentLeg();

      expect(currentLeg).toMatchObject({
        legNumber: 2,
        state: 'IN',
      });
    });

    it('should return null when no legs exist', () => {
      const pass: Pass = {
        id: 'pass-1',
        studentId: mockStudent.id,
        status: 'OPEN',
        createdAt: new Date(),
        lastUpdatedAt: new Date(),
        legs: [],
      };

      const stateMachine = new PassStateMachine(pass, mockStudent);
      const currentLeg = stateMachine.getCurrentLeg();

      expect(currentLeg).toBeNull();
    });
  });

  describe('addLeg', () => {
    it('should add a new leg to the pass', () => {
      const pass: Pass = {
        id: 'pass-1',
        studentId: mockStudent.id,
        status: 'OPEN',
        createdAt: new Date(),
        lastUpdatedAt: new Date(),
        legs: [
          {
            id: generateUUID(),
            legNumber: 1,
            originLocationId: 'classroom-1',
            destinationLocationId: 'library-1',
            state: 'OUT',
            timestamp: new Date(),
          },
        ],
      };

      const stateMachine = new PassStateMachine(pass, mockStudent);
      const updatedPass = stateMachine.addLeg('library-1', 'bathroom-1', 'OUT');

      expect(updatedPass.legs).toHaveLength(2);
      expect(updatedPass.legs[1]).toMatchObject({
        legNumber: 2,
        originLocationId: 'library-1',
        destinationLocationId: 'bathroom-1',
        state: 'OUT',
      });
    });
  });

  describe('arriveAtDestination', () => {
    it('should mark student as IN at current destination', () => {
      const pass: Pass = {
        id: 'pass-1',
        studentId: mockStudent.id,
        status: 'OPEN',
        createdAt: new Date(),
        lastUpdatedAt: new Date(),
        legs: [
          {
            id: generateUUID(),
            legNumber: 1,
            originLocationId: 'classroom-1',
            destinationLocationId: 'library-1',
            state: 'OUT',
            timestamp: new Date(),
          },
        ],
      };

      const stateMachine = new PassStateMachine(pass, mockStudent);
      const updatedPass = stateMachine.arriveAtDestination();

      expect(updatedPass.legs).toHaveLength(2);
      expect(updatedPass.legs[1]).toMatchObject({
        legNumber: 2,
        originLocationId: 'library-1',
        destinationLocationId: 'library-1',
        state: 'IN',
      });
    });
  });

  describe('validateTransition', () => {
    it('should validate arrive action correctly', () => {
      const pass: Pass = {
        id: 'pass-1',
        studentId: mockStudent.id,
        status: 'OPEN',
        createdAt: new Date(),
        lastUpdatedAt: new Date(),
        legs: [
          {
            id: generateUUID(),
            legNumber: 1,
            originLocationId: 'classroom-1',
            destinationLocationId: 'library-1',
            state: 'OUT',
            timestamp: new Date(),
          },
        ],
      };

      const stateMachine = new PassStateMachine(pass, mockStudent);
      const result = stateMachine.validateTransition('arrive');

      expect(result.valid).toBe(true);
    });

    it('should handle unknown actions', () => {
      const pass: Pass = {
        id: 'pass-1',
        studentId: mockStudent.id,
        status: 'OPEN',
        createdAt: new Date(),
        lastUpdatedAt: new Date(),
        legs: [
          {
            id: generateUUID(),
            legNumber: 1,
            originLocationId: 'classroom-1',
            destinationLocationId: 'library-1',
            state: 'OUT',
            timestamp: new Date(),
          },
        ],
      };

      const stateMachine = new PassStateMachine(pass, mockStudent);
      const result = stateMachine.validateTransition('invalid_action');

      expect(result.valid).toBe(false);
      expect(result.error).toBe('Unknown action: invalid_action');
    });
  });

  describe('determineActionState', () => {
    it('should identify restroom trip correctly', async () => {
      const pass: Pass = {
        id: 'pass-1',
        studentId: mockStudent.id,
        status: 'OPEN',
        createdAt: new Date(),
        lastUpdatedAt: new Date(),
        legs: [
          {
            id: generateUUID(),
            legNumber: 1,
            originLocationId: 'classroom-1',
            destinationLocationId: 'bathroom-1',
            state: 'OUT',
            timestamp: new Date(),
          },
        ],
      };

      const stateMachine = new PassStateMachine(pass, mockStudent);
      const actionState = await stateMachine.determineActionState();

      expect(actionState).toMatchObject({
        isRestroomTrip: true,
        returnLocationName: 'Classroom 1',
        canArrive: false,
      });
    });

    it('should identify supervised location trip correctly', async () => {
      const pass: Pass = {
        id: 'pass-1',
        studentId: mockStudent.id,
        status: 'OPEN',
        createdAt: new Date(),
        lastUpdatedAt: new Date(),
        legs: [
          {
            id: generateUUID(),
            legNumber: 1,
            originLocationId: 'classroom-1',
            destinationLocationId: 'library-1',
            state: 'OUT',
            timestamp: new Date(),
          },
        ],
      };

      const stateMachine = new PassStateMachine(pass, mockStudent);
      const actionState = await stateMachine.determineActionState();

      expect(actionState).toMatchObject({
        isRestroomTrip: false,
        isSimpleTrip: false,
        returnLocationName: 'class',
        canArrive: true,
      });
    });
  });
}); 