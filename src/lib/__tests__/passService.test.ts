import { PassService } from '../passService';
import { Pass, User, PassFormData } from '../../types';

// Mock Firebase Functions
jest.mock('firebase/functions', () => ({
  getFunctions: jest.fn(() => ({
    app: { name: 'test-app' }
  })),
  httpsCallable: jest.fn(() => jest.fn())
}));

// Mock Firebase Firestore
jest.mock('firebase/firestore', () => ({
  getFirestore: jest.fn(() => ({})),
  runTransaction: jest.fn(),
  query: jest.fn(),
  where: jest.fn(),
  collection: jest.fn(),
  getDocs: jest.fn(),
  doc: jest.fn(),
  db: {}
}));

// Mock dependencies
jest.mock('../firebase/firestore', () => ({
  updatePass: jest.fn(),
  db: {}
}));

// jest.mock('../stateMachine', () => ({
//   PassStateMachine: jest.fn().mockImplementation(() => ({
//     getCurrentLeg: jest.fn(),
//     addLeg: jest.fn(),
//     validateTransition: jest.fn(),
//     arriveAtDestination: jest.fn(),
//     returnToClass: jest.fn(),
//     createPass: jest.fn()
//   }))
// }));

jest.mock('../validation', () => ({
  ValidationService: {
    validatePassFormData: jest.fn(),
    validateUser: jest.fn()
  }
}));

jest.mock('../auditMonitor', () => ({
  AuditMonitor: {
    checkPassCreationActivity: jest.fn()
  }
}));

jest.mock('../eventLogger', () => ({
  logEvent: jest.fn()
}));

import { runTransaction, query, where, collection, getDocs, doc } from 'firebase/firestore';
import { updatePass } from '../firebase/firestore';
import { PassStateMachine } from '../stateMachine';
import { ValidationService } from '../validation/service';
import { AuditMonitor } from '../auditMonitor';
import { logEvent } from '../eventLogger';
import { getFunctions, httpsCallable } from 'firebase/functions';

const mockRunTransaction = runTransaction as jest.MockedFunction<typeof runTransaction>;
const mockQuery = query as jest.MockedFunction<typeof query>;
const mockWhere = where as jest.MockedFunction<typeof where>;
const mockCollection = collection as jest.MockedFunction<typeof collection>;
const mockGetDocs = getDocs as jest.MockedFunction<typeof getDocs>;
const mockDoc = doc as jest.MockedFunction<typeof doc>;
const mockUpdatePass = updatePass as jest.MockedFunction<typeof updatePass>;
const mockAuditMonitor = AuditMonitor as jest.Mocked<typeof AuditMonitor>;
const mockLogEvent = logEvent as jest.MockedFunction<typeof logEvent>;
const mockHttpsCallable = httpsCallable as jest.MockedFunction<typeof httpsCallable>;

describe('PassService', () => {
  let mockStudent: User;
  let mockTeacher: User;
  let mockPass: Pass;
  let mockFormData: PassFormData;
  let mockStateMachine: jest.Mocked<PassStateMachine>;

  beforeEach(() => {
    jest.clearAllMocks();

    mockStudent = {
      id: 'student-1',
      name: 'Test Student',
      email: 'student@test.com',
      role: 'student',
      assignedLocationId: 'classroom-1'
    };

    mockTeacher = {
      id: 'teacher-1',
      name: 'Test Teacher',
      email: 'teacher@test.com',
      role: 'teacher',
      assignedLocationId: 'classroom-1'
    };

    mockFormData = {
      destinationLocationId: 'bathroom-1'
    };

    mockPass = {
      id: 'pass-1',
      studentId: 'student-1',
      status: 'OPEN',
      createdAt: new Date(),
      lastUpdatedAt: new Date(),
      legs: [{
        id: 'leg-1',
        legNumber: 1,
        originLocationId: 'classroom-1',
        destinationLocationId: 'bathroom-1',
        state: 'OUT',
        timestamp: new Date()
      }]
    };

    mockStateMachine = {
      getCurrentLeg: jest.fn(() => ({
        id: 'leg-1',
        legNumber: 1,
        originLocationId: 'classroom-1',
        destinationLocationId: 'bathroom-1',
        state: 'OUT',
        timestamp: new Date()
      })),
      addLeg: jest.fn(),
      validateTransition: jest.fn(),
      arriveAtDestination: jest.fn(),
      returnToClass: jest.fn(),
      createPass: jest.fn(),
      determineActionState: jest.fn().mockReturnValue({ canArrive: true, canReturn: false, canClose: true }),
      getCurrentState: jest.fn().mockReturnValue({ status: 'OPEN', currentLeg: 1 }),
      handleRestroomReturn: jest.fn(() => mockPass)
    } as any;

    // Setup default mock implementations
    jest.spyOn(ValidationService, 'validatePassFormData').mockImplementation((arg) => arg as PassFormData);
    jest.spyOn(ValidationService, 'validateUser').mockImplementation((arg) => arg as User);
    mockUpdatePass.mockResolvedValue();
    mockAuditMonitor.checkPassCreationActivity.mockResolvedValue();
    mockLogEvent.mockResolvedValue();
    const callableFn = Object.assign(jest.fn().mockResolvedValue({ data: { hasOpenPass: false } }), { stream: jest.fn() });
    mockHttpsCallable.mockImplementation(() => callableFn);
    jest.spyOn(PassStateMachine.prototype, 'getCurrentLeg').mockImplementation(() => ({
      id: 'leg-1',
      legNumber: 1,
      originLocationId: 'classroom-1',
      destinationLocationId: 'bathroom-1',
      state: 'OUT',
      timestamp: new Date()
    }));
    jest.spyOn(PassStateMachine.prototype, 'addLeg').mockImplementation(jest.fn());
    jest.spyOn(PassStateMachine.prototype, 'validateTransition').mockImplementation(jest.fn());
    jest.spyOn(PassStateMachine.prototype, 'arriveAtDestination').mockImplementation(jest.fn());
    jest.spyOn(PassStateMachine.prototype, 'returnToClass').mockImplementation(jest.fn());
    jest.spyOn(PassStateMachine.prototype, 'determineActionState').mockImplementation(jest.fn().mockReturnValue({ canArrive: true, canReturn: false, canClose: true }));
    jest.spyOn(PassStateMachine.prototype, 'getCurrentState').mockImplementation(jest.fn().mockReturnValue({ status: 'OPEN', currentLeg: 1 }));
    jest.spyOn(PassStateMachine.prototype, 'handleRestroomReturn').mockImplementation(jest.fn(() => Promise.resolve(mockPass)));
    jest.spyOn(PassStateMachine, 'createPass').mockReturnValue({ ...mockPass, id: 'pass-1' });
  });

  describe('createPass', () => {
    it('should create a pass successfully', async () => {
      mockRunTransaction.mockImplementation(async (db, updateFunction) => {
        return updateFunction({
          get: jest.fn().mockResolvedValue({ exists: () => false }),
          set: jest.fn(),
          update: jest.fn(),
          delete: jest.fn()
        });
      });

      mockGetDocs.mockResolvedValue({ empty: true } as any);
      mockDoc.mockReturnValue({ id: 'pass-1' } as any);

      const result = await PassService.createPass(mockFormData, mockStudent);

      expect(result.success).toBe(true);
      expect(result.updatedPass).toBeDefined();
      expect(ValidationService.validatePassFormData).toHaveBeenCalledWith(mockFormData);
      expect(ValidationService.validateUser).toHaveBeenCalledWith(mockStudent);
    });

    it('should reject when validation fails', async () => {
      jest.spyOn(ValidationService, 'validatePassFormData').mockImplementation(() => {
        throw new Error('Invalid destination location');
      });

      const result = await PassService.createPass(mockFormData, mockStudent);

      expect(result.success).toBe(false);
      expect(result.error).toContain('Input validation failed');
    });

    it('should reject when student has open pass', async () => {
      const callableFn = Object.assign(jest.fn().mockResolvedValue({ data: { hasOpenPass: true } }), { stream: jest.fn() });
      mockHttpsCallable.mockReturnValue(callableFn);

      const result = await PassService.createPass(mockFormData, mockStudent);

      expect(result.success).toBe(false);
      expect(result.error).toContain('already has an open pass');
    });

    it('should handle emergency mode', async () => {
      mockRunTransaction.mockImplementation(async (db, updateFunction) => {
        return updateFunction({
          get: jest.fn().mockResolvedValue({ 
            exists: () => true, 
            data: () => ({ active: true }) 
          }),
          set: jest.fn(),
          update: jest.fn(),
          delete: jest.fn()
        });
      });

      const result = await PassService.createPass(mockFormData, mockStudent);

      expect(result.success).toBe(false);
      expect(result.error).toContain('emergency mode');
    });

    it('should handle database errors', async () => {
      mockRunTransaction.mockRejectedValue(new Error('Database error'));

      const result = await PassService.createPass(mockFormData, mockStudent);

      expect(result.success).toBe(false);
      expect(result.error).toContain('Database error');
    });
  });

  describe('arriveAtDestination', () => {
    it('should arrive at destination successfully', async () => {
      jest.spyOn(PassStateMachine.prototype, 'validateTransition').mockReturnValue({ valid: true });
      jest.spyOn(PassStateMachine.prototype, 'arriveAtDestination').mockReturnValue(mockPass);
      const result = await PassService.arriveAtDestination(mockPass, mockStudent);
      expect(result.success).toBe(true);
      expect(result.updatedPass).toEqual(mockPass);
      expect(PassStateMachine.prototype.validateTransition).toHaveBeenCalledWith('arrive');
      expect(PassStateMachine.prototype.arriveAtDestination).toHaveBeenCalled();
    });
    it('should reject invalid transition', async () => {
      jest.spyOn(PassStateMachine.prototype, 'validateTransition').mockReturnValue({ valid: false, error: 'Cannot arrive at destination' });
      const result = await PassService.arriveAtDestination(mockPass, mockStudent);
      expect(result.success).toBe(false);
      expect(result.error).toContain('Cannot arrive at destination');
    });
    it('should handle database errors', async () => {
      jest.spyOn(PassStateMachine.prototype, 'validateTransition').mockImplementation(() => { throw new Error('Database error'); });
      const result = await PassService.arriveAtDestination(mockPass, mockStudent);
      expect(result.success).toBe(false);
      expect(result.error).toMatch(/Database error|Failed to arrive at destination/);
    });
  });

  describe('returnToClass', () => {
    it('should return to class successfully', async () => {
      jest.spyOn(PassStateMachine.prototype, 'validateTransition').mockReturnValue({ valid: true });
      jest.spyOn(PassStateMachine.prototype, 'returnToClass').mockReturnValue(mockPass);
      const result = await PassService.returnToClass(mockPass, mockStudent);
      expect(result.success).toBe(true);
      expect(result.updatedPass).toEqual(mockPass);
      expect(PassStateMachine.prototype.validateTransition).toHaveBeenCalledWith('return_to_class');
      expect(PassStateMachine.prototype.returnToClass).toHaveBeenCalled();
    });
    it('should reject invalid transition', async () => {
      jest.spyOn(PassStateMachine.prototype, 'validateTransition').mockReturnValue({ valid: false, error: 'Cannot return to class' });
      const result = await PassService.returnToClass(mockPass, mockStudent);
      expect(result.success).toBe(false);
      expect(result.error).toContain('Cannot return to class');
    });
  });

  describe('closePass', () => {
    it('should close pass successfully', async () => {
      const result = await PassService.closePass(mockPass, mockTeacher);

      expect(result.success).toBe(true);
      expect(result.updatedPass?.status).toBe('CLOSED');
      expect(result.updatedPass?.closedBy).toBe(mockTeacher.id);
      expect(mockUpdatePass).toHaveBeenCalledWith(mockPass.id, expect.objectContaining({
        status: 'CLOSED',
        closedBy: mockTeacher.id
      }));
    });

    it('should reject when pass is already closed', async () => {
      const closedPass = { ...mockPass, status: 'CLOSED' as const };

      const result = await PassService.closePass(closedPass, mockTeacher);

      expect(result.success).toBe(false);
      expect(result.error).toContain('already closed');
    });

    it('should handle database errors', async () => {
      mockUpdatePass.mockRejectedValue(new Error('Database error'));

      const result = await PassService.closePass(mockPass, mockTeacher);

      expect(result.success).toBe(false);
      expect(result.error).toMatch(/Database error|Failed to close pass/);
    });
  });

  describe('handleRestroomReturn', () => {
    it('should handle restroom return successfully', async () => {
      jest.spyOn(PassStateMachine.prototype, 'validateTransition').mockReturnValue({ valid: true });
      jest.spyOn(PassStateMachine.prototype, 'handleRestroomReturn').mockResolvedValue(mockPass);
      const result = await PassService.handleRestroomReturn(mockPass, mockStudent);
      expect(result.success).toBe(true);
      expect(PassStateMachine.prototype.validateTransition).toHaveBeenCalledWith('restroom_return');
      expect(PassStateMachine.prototype.handleRestroomReturn).toHaveBeenCalled();
    });
    it('should reject invalid restroom return', async () => {
      jest.spyOn(PassStateMachine.prototype, 'validateTransition').mockReturnValue({ valid: false, error: 'Invalid restroom return' });
      const result = await PassService.handleRestroomReturn(mockPass, mockStudent);
      expect(result.success).toBe(false);
      expect(result.error).toContain('Invalid restroom return');
    });
  });

  describe('claimPass', () => {
    it('should claim pass successfully', async () => {
      const result = await PassService.claimPass(mockPass, mockTeacher);

      expect(result.success).toBe(true);
      expect(result.updatedPass?.claimedBy).toEqual({
        userId: mockTeacher.id,
        userName: mockTeacher.name,
        timestamp: expect.any(Date)
      });
      expect(mockUpdatePass).toHaveBeenCalledWith(mockPass.id, expect.objectContaining({
        claimedBy: expect.objectContaining({
          userId: mockTeacher.id
        })
      }));
    });

    it('should handle database errors when claiming', async () => {
      mockUpdatePass.mockRejectedValue(new Error('Database error'));

      const result = await PassService.claimPass(mockPass, mockTeacher);

      expect(result.success).toBe(false);
      expect(result.error).toMatch(/Database error|Failed to claim pass/);
    });
  });

  describe('getActionState', () => {
    it('should return action state', async () => {
      const mockActionState = { canArrive: true, canReturn: false, canClose: true };
      mockStateMachine.determineActionState = jest.fn().mockReturnValue(mockActionState);

      const result = await PassService.getActionState(mockPass, mockStudent);

      expect(result).toEqual(mockActionState);
    });
  });

  describe('getCurrentState', () => {
    it('should return current state', () => {
      const mockState = { status: 'OPEN', currentLeg: 1 };
      mockStateMachine.getCurrentState = jest.fn().mockReturnValue(mockState);

      const result = PassService.getCurrentState(mockPass, mockStudent);

      expect(result).toEqual(mockState);
    });
  });

  describe('canCreatePass', () => {
    it('should return true when no current pass', () => {
      const result = PassService.canCreatePass(null);
      expect(result).toBe(true);
    });

    it('should return false when current pass exists', () => {
      const result = PassService.canCreatePass(mockPass);
      expect(result).toBe(false);
    });
  });

  describe('canClosePass', () => {
    it('should return true for open pass', () => {
      mockStateMachine.getCurrentLeg.mockReturnValue({
        id: 'leg-1',
        legNumber: 1,
        originLocationId: 'classroom-1',
        destinationLocationId: 'bathroom-1',
        state: 'OUT',
        timestamp: new Date()
      });
      const openPass = { ...mockPass, status: 'OPEN' as const };
      const result = PassService.canClosePass(openPass);
      expect(result).toBe(true);
    });

    it('should return false for closed pass', () => {
      const closedPass = { ...mockPass, status: 'CLOSED' as const };
      const result = PassService.canClosePass(closedPass);
      expect(result).toBe(false);
    });
  });

  describe('canArriveAtDestination', () => {
    it('should return true for open pass', () => {
      mockStateMachine.getCurrentLeg.mockReturnValue({
        id: 'leg-1',
        legNumber: 1,
        originLocationId: 'classroom-1',
        destinationLocationId: 'bathroom-1',
        state: 'OUT',
        timestamp: new Date()
      });
      const openPass = { ...mockPass, status: 'OPEN' as const };
      const result = PassService.canArriveAtDestination(openPass);
      expect(result).toBe(true);
    });

    it('should return false for closed pass', () => {
      const closedPass = { ...mockPass, status: 'CLOSED' as const };
      const result = PassService.canArriveAtDestination(closedPass);
      expect(result).toBe(false);
    });
  });

  describe('canReturnToClass', () => {
    it('should return true for open pass', () => {
      jest.spyOn(PassStateMachine.prototype, 'getCurrentLeg').mockReturnValue({
        id: 'leg-1',
        legNumber: 1,
        originLocationId: 'classroom-1',
        destinationLocationId: 'bathroom-1',
        state: 'IN',
        timestamp: new Date()
      });
      const openPass = { ...mockPass, status: 'OPEN' as const };
      const result = PassService.canReturnToClass(openPass);
      expect(result).toBe(true);
    });
    it('should return false for closed pass', () => {
      const closedPass = { ...mockPass, status: 'CLOSED' as const };
      const result = PassService.canReturnToClass(closedPass);
      expect(result).toBe(false);
    });
  });

  describe('addDestination', () => {
    const { httpsCallable } = require('firebase/functions');
    let mockValidateAddDestination: jest.Mock;

    beforeEach(() => {
      mockValidateAddDestination = jest.fn();
      httpsCallable.mockReturnValue(mockValidateAddDestination);
    });

    it('should add new destination successfully', async () => {
      mockValidateAddDestination.mockResolvedValue({ data: { allowed: true } });
      jest.spyOn(PassStateMachine.prototype, 'validateTransition').mockReturnValue({ valid: true });
      jest.spyOn(PassStateMachine.prototype, 'startNewDestination').mockReturnValue(mockPass);
      const result = await PassService.addDestination(mockFormData, mockPass, mockStudent);
      expect(result.success).toBe(true);
      expect(result.updatedPass).toEqual(mockPass);
      expect(PassStateMachine.prototype.validateTransition).toHaveBeenCalledWith('new_destination');
      expect(PassStateMachine.prototype.startNewDestination).toHaveBeenCalledWith(mockFormData.destinationLocationId);
    });

    it('should reject when transition invalid', async () => {
      mockValidateAddDestination.mockResolvedValue({ data: { allowed: true } });
      jest.spyOn(PassStateMachine.prototype, 'validateTransition').mockReturnValue({ valid: false, error: 'Cannot start new destination' });
      const result = await PassService.addDestination(mockFormData, mockPass, mockStudent);
      expect(result.success).toBe(false);
      expect(result.error).toContain('Cannot start new destination');
    });

    it('should reject when server validation fails', async () => {
      mockValidateAddDestination.mockResolvedValue({ data: { allowed: false } });
      const result = await PassService.addDestination(mockFormData, mockPass, mockStudent);
      expect(result.success).toBe(false);
      expect(result.error).toContain('Server validation failed');
    });
  });
}); 