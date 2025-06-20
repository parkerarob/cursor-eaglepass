import { PassStateMachine } from '../stateMachine';
import { Pass, User, Leg, PassFormData } from '@/types';

// Mock the Firebase function
jest.mock('@/lib/firebase/firestore', () => ({
  getLocationById: jest.fn(),
}));

import { getLocationById } from '@/lib/firebase/firestore';

const mockGetLocationById = getLocationById as jest.MockedFunction<typeof getLocationById>;

describe('PassStateMachine', () => {
  const mockStudent: User = {
    id: 'student-1',
    name: 'John Doe',
    email: 'john@student.nhcs.net',
    role: 'student',
    assignedLocationId: 'classroom-1',
  };

  const mockClassroom = {
    id: 'classroom-1',
    name: 'Math 101',
    locationType: 'classroom' as const,
  };

  const mockBathroom = {
    id: 'bathroom-1',
    name: 'Main Bathroom',
    locationType: 'bathroom' as const,
  };

  const mockLibrary = {
    id: 'library-1',
    name: 'Library',
    locationType: 'library' as const,
  };

  beforeEach(() => {
    jest.clearAllMocks();
    mockGetLocationById.mockImplementation((id: string) => {
      const locations: Record<string, any> = {
        'classroom-1': mockClassroom,
        'bathroom-1': mockBathroom,
        'library-1': mockLibrary,
      };
      return Promise.resolve(locations[id] || null);
    });
  });

  describe('createPass', () => {
    it('should create a new pass with correct structure', () => {
      const formData: PassFormData = {
        destinationLocationId: 'bathroom-1',
      };

      const newPass = PassStateMachine.createPass(formData, mockStudent);

      expect(newPass).toMatchObject({
        studentId: mockStudent.id,
        status: 'OPEN',
        legs: [
          {
            legNumber: 1,
            originLocationId: mockStudent.assignedLocationId,
            destinationLocationId: 'bathroom-1',
            state: 'OUT',
          },
        ],
      });
      expect(newPass.id).toMatch(/^pass-\d+$/);
      expect(newPass.createdAt).toBeInstanceOf(Date);
      expect(newPass.lastUpdatedAt).toBeInstanceOf(Date);
    });
  });

  describe('getCurrentLeg', () => {
    it('should return the last leg of the pass', () => {
      const pass: Pass = {
        id: 'pass-1',
        studentId: mockStudent.id,
        status: 'OPEN',
        createdAt: new Date(),
        lastUpdatedAt: new Date(),
        legs: [
          {
            legNumber: 1,
            originLocationId: 'classroom-1',
            destinationLocationId: 'bathroom-1',
            state: 'OUT',
            timestamp: new Date(),
          },
          {
            legNumber: 2,
            originLocationId: 'bathroom-1',
            destinationLocationId: 'bathroom-1',
            state: 'IN',
            timestamp: new Date(),
          },
        ],
      };

      const stateMachine = new PassStateMachine(pass, mockStudent);
      const currentLeg = stateMachine.getCurrentLeg();

      expect(currentLeg).toEqual(pass.legs[1]);
    });

    it('should return null for empty pass', () => {
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
            legNumber: 1,
            originLocationId: 'classroom-1',
            destinationLocationId: 'bathroom-1',
            state: 'OUT',
            timestamp: new Date(),
          },
        ],
      };

      const stateMachine = new PassStateMachine(pass, mockStudent);
      const updatedPass = stateMachine.addLeg('bathroom-1', 'bathroom-1', 'IN');

      expect(updatedPass.legs).toHaveLength(2);
      expect(updatedPass.legs[1]).toMatchObject({
        legNumber: 2,
        originLocationId: 'bathroom-1',
        destinationLocationId: 'bathroom-1',
        state: 'IN',
      });
      expect(updatedPass.lastUpdatedAt).toBeInstanceOf(Date);
    });
  });

  describe('closePass', () => {
    it('should close the pass and add return leg', () => {
      const pass: Pass = {
        id: 'pass-1',
        studentId: mockStudent.id,
        status: 'OPEN',
        createdAt: new Date(),
        lastUpdatedAt: new Date(),
        legs: [
          {
            legNumber: 1,
            originLocationId: 'classroom-1',
            destinationLocationId: 'bathroom-1',
            state: 'OUT',
            timestamp: new Date(),
          },
        ],
      };

      const stateMachine = new PassStateMachine(pass, mockStudent);
      const closedPass = stateMachine.closePass();

      expect(closedPass.status).toBe('CLOSED');
      expect(closedPass.legs).toHaveLength(2);
      expect(closedPass.legs[1]).toMatchObject({
        legNumber: 2,
        originLocationId: 'bathroom-1',
        destinationLocationId: mockStudent.assignedLocationId,
        state: 'IN',
      });
    });

    it('should throw error if no current leg', () => {
      const pass: Pass = {
        id: 'pass-1',
        studentId: mockStudent.id,
        status: 'OPEN',
        createdAt: new Date(),
        lastUpdatedAt: new Date(),
        legs: [],
      };

      const stateMachine = new PassStateMachine(pass, mockStudent);
      expect(() => stateMachine.closePass()).toThrow('Cannot close pass: no current leg');
    });
  });

  describe('arriveAtDestination', () => {
    it('should mark student as arrived at destination', () => {
      const pass: Pass = {
        id: 'pass-1',
        studentId: mockStudent.id,
        status: 'OPEN',
        createdAt: new Date(),
        lastUpdatedAt: new Date(),
        legs: [
          {
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

  describe('returnToClass', () => {
    it('should start journey back to assigned location', () => {
      const pass: Pass = {
        id: 'pass-1',
        studentId: mockStudent.id,
        status: 'OPEN',
        createdAt: new Date(),
        lastUpdatedAt: new Date(),
        legs: [
          {
            legNumber: 1,
            originLocationId: 'classroom-1',
            destinationLocationId: 'library-1',
            state: 'OUT',
            timestamp: new Date(),
          },
          {
            legNumber: 2,
            originLocationId: 'library-1',
            destinationLocationId: 'library-1',
            state: 'IN',
            timestamp: new Date(),
          },
        ],
      };

      const stateMachine = new PassStateMachine(pass, mockStudent);
      const updatedPass = stateMachine.returnToClass();

      expect(updatedPass.legs).toHaveLength(3);
      expect(updatedPass.legs[2]).toMatchObject({
        legNumber: 3,
        originLocationId: 'library-1',
        destinationLocationId: mockStudent.assignedLocationId,
        state: 'OUT',
      });
    });
  });

  describe('handleRestroomReturn', () => {
    it('should close simple restroom trip', async () => {
      const pass: Pass = {
        id: 'pass-1',
        studentId: mockStudent.id,
        status: 'OPEN',
        createdAt: new Date(),
        lastUpdatedAt: new Date(),
        legs: [
          {
            legNumber: 1,
            originLocationId: 'classroom-1',
            destinationLocationId: 'bathroom-1',
            state: 'OUT',
            timestamp: new Date(),
          },
        ],
      };

      const stateMachine = new PassStateMachine(pass, mockStudent);
      const updatedPass = await stateMachine.handleRestroomReturn();

      expect(updatedPass.status).toBe('CLOSED');
      expect(updatedPass.legs).toHaveLength(2);
      expect(updatedPass.legs[1]).toMatchObject({
        legNumber: 2,
        originLocationId: 'bathroom-1',
        destinationLocationId: mockStudent.assignedLocationId,
        state: 'IN',
      });
    });

    it('should return to previous location for complex restroom trip', async () => {
      const pass: Pass = {
        id: 'pass-1',
        studentId: mockStudent.id,
        status: 'OPEN',
        createdAt: new Date(),
        lastUpdatedAt: new Date(),
        legs: [
          {
            legNumber: 1,
            originLocationId: 'classroom-1',
            destinationLocationId: 'library-1',
            state: 'OUT',
            timestamp: new Date(),
          },
          {
            legNumber: 2,
            originLocationId: 'library-1',
            destinationLocationId: 'library-1',
            state: 'IN',
            timestamp: new Date(),
          },
          {
            legNumber: 3,
            originLocationId: 'library-1',
            destinationLocationId: 'bathroom-1',
            state: 'OUT',
            timestamp: new Date(),
          },
        ],
      };

      const stateMachine = new PassStateMachine(pass, mockStudent);
      const updatedPass = await stateMachine.handleRestroomReturn();

      expect(updatedPass.status).toBe('OPEN');
      expect(updatedPass.legs).toHaveLength(4);
      expect(updatedPass.legs[3]).toMatchObject({
        legNumber: 4,
        originLocationId: 'bathroom-1',
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

    it('should reject invalid arrive action', () => {
      const pass: Pass = {
        id: 'pass-1',
        studentId: mockStudent.id,
        status: 'OPEN',
        createdAt: new Date(),
        lastUpdatedAt: new Date(),
        legs: [
          {
            legNumber: 1,
            originLocationId: 'classroom-1',
            destinationLocationId: 'library-1',
            state: 'IN',
            timestamp: new Date(),
          },
        ],
      };

      const stateMachine = new PassStateMachine(pass, mockStudent);
      const result = stateMachine.validateTransition('arrive');

      expect(result.valid).toBe(false);
      expect(result.error).toBe('Cannot arrive: not currently out');
    });

    it('should reject unknown action', () => {
      const pass: Pass = {
        id: 'pass-1',
        studentId: mockStudent.id,
        status: 'OPEN',
        createdAt: new Date(),
        lastUpdatedAt: new Date(),
        legs: [],
      };

      const stateMachine = new PassStateMachine(pass, mockStudent);
      const result = stateMachine.validateTransition('unknown_action');

      expect(result.valid).toBe(false);
      expect(result.error).toBe('Unknown action: unknown_action');
    });
  });

  describe('determineActionState', () => {
    it('should determine action state for restroom trip', async () => {
      const pass: Pass = {
        id: 'pass-1',
        studentId: mockStudent.id,
        status: 'OPEN',
        createdAt: new Date(),
        lastUpdatedAt: new Date(),
        legs: [
          {
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
        isSimpleTrip: true,
        returnLocationName: 'class',
        canArrive: false,
      });
    });

    it('should determine action state for library trip', async () => {
      const pass: Pass = {
        id: 'pass-1',
        studentId: mockStudent.id,
        status: 'OPEN',
        createdAt: new Date(),
        lastUpdatedAt: new Date(),
        legs: [
          {
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

    it('should return default state when not out', async () => {
      const pass: Pass = {
        id: 'pass-1',
        studentId: mockStudent.id,
        status: 'OPEN',
        createdAt: new Date(),
        lastUpdatedAt: new Date(),
        legs: [
          {
            legNumber: 1,
            originLocationId: 'classroom-1',
            destinationLocationId: 'library-1',
            state: 'IN',
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
        canArrive: false,
      });
    });
  });
}); 