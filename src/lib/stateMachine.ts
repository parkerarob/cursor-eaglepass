import { Pass, Leg, User, PassFormData } from '@/types';
import { getLocationById } from '@/lib/firebase/firestore';
import { generateUUID } from './utils';

export interface ActionState {
  isRestroomTrip: boolean;
  isSimpleTrip: boolean;
  returnLocationName: string;
  canArrive: boolean;
}

export interface StateTransitionResult {
  success: boolean;
  updatedPass?: Pass;
  error?: string;
}

export class PassStateMachine {
  private pass: Pass;
  private student: User;

  constructor(pass: Pass, student: User) {
    this.pass = pass;
    this.student = student;
  }

  /**
   * Get the current leg of the pass
   */
  getCurrentLeg(): Leg | null {
    if (this.pass.legs.length === 0) return null;
    return this.pass.legs[this.pass.legs.length - 1];
  }

  /**
   * Get the next leg number for the pass
   */
  getNextLegNumber(): number {
    return this.pass.legs.length + 1;
  }

  /**
   * Determine the current action state based on the pass and student
   */
  async determineActionState(): Promise<ActionState> {
    const currentLeg = this.getCurrentLeg();
    if (!currentLeg || currentLeg.state !== 'OUT') {
      return {
        isRestroomTrip: false,
        isSimpleTrip: false,
        returnLocationName: 'class',
        canArrive: false,
      };
    }

    const destination = await getLocationById(currentLeg.destinationLocationId);
    const isRestroom = destination?.locationType === 'bathroom';
    
    // For restroom trips, determine return location based on origin of current leg
    let returnLocName = 'class';
    if (isRestroom) {
      const returnLocation = await getLocationById(currentLeg.originLocationId);
      returnLocName = returnLocation?.name ?? 'class';
    }

    const canArrive =
      destination?.locationType !== 'bathroom' &&
      currentLeg.destinationLocationId !== this.student.assignedLocationId;

    return {
      isRestroomTrip: isRestroom,
      isSimpleTrip: false, // Remove simple trip concept - all bathroom trips work the same way
      returnLocationName: returnLocName,
      canArrive: canArrive,
    };
  }

  /**
   * Find the location ID to return to for complex restroom trips
   */
  private async findReturnLocationId(): Promise<string> {
    for (let i = this.pass.legs.length - 2; i >= 0; i--) {
      const leg = this.pass.legs[i];
      const loc = await getLocationById(leg.destinationLocationId);
      if (loc?.locationType !== 'bathroom') {
        return leg.destinationLocationId;
      }
    }
    return this.student.assignedLocationId!;
  }

  /**
   * Create a new pass
   */
  static createPass(formData: PassFormData, student: User): Pass {
    return {
      id: `pass-${Date.now()}`,
      studentId: student.id,
      status: 'OPEN',
      createdAt: new Date(),
      lastUpdatedAt: new Date(),
      legs: [
        {
          id: generateUUID(),
          legNumber: 1,
          originLocationId: student.assignedLocationId!,
          destinationLocationId: formData.destinationLocationId,
          state: 'OUT',
          timestamp: new Date(),
        },
      ],
    };
  }

  /**
   * Add a new leg to the pass
   */
  addLeg(originLocationId: string, destinationLocationId: string, state: 'IN' | 'OUT'): Pass {
    const newLeg: Leg = {
      id: generateUUID(),
      legNumber: this.getNextLegNumber(),
      originLocationId,
      destinationLocationId,
      state,
      timestamp: new Date(),
    };

    return {
      ...this.pass,
      lastUpdatedAt: new Date(),
      legs: [...this.pass.legs, newLeg],
    };
  }

  /**
   * Close the pass (return to specified location and mark as closed)
   */
  closePass(destinationLocationId?: string): Pass {
    const currentLeg = this.getCurrentLeg();
    if (!currentLeg) {
      throw new Error('Cannot close pass: no current leg');
    }

    // Use provided destination or default to assigned class
    const destinationId = destinationLocationId || this.student.assignedLocationId!;

    const newLeg: Leg = {
      id: generateUUID(),
      legNumber: this.getNextLegNumber(),
      originLocationId: currentLeg.destinationLocationId,
      destinationLocationId: destinationId,
      state: 'IN',
      timestamp: new Date(),
    };

    return {
      ...this.pass,
      status: 'CLOSED',
      lastUpdatedAt: new Date(),
      legs: [...this.pass.legs, newLeg],
    };
  }

  /**
   * Handle "I've Arrived" action (mark as IN at current destination)
   */
  arriveAtDestination(): Pass {
    const currentLeg = this.getCurrentLeg();
    if (!currentLeg) {
      throw new Error('Cannot arrive: no current leg');
    }

    return this.addLeg(
      currentLeg.destinationLocationId,
      currentLeg.destinationLocationId,
      'IN'
    );
  }

  /**
   * Handle "Return to Class" action (start journey back to assigned location)
   */
  returnToClass(): Pass {
    const currentLeg = this.getCurrentLeg();
    if (!currentLeg) {
      throw new Error('Cannot return to class: no current leg');
    }

    return this.addLeg(
      currentLeg.destinationLocationId,
      this.student.assignedLocationId!,
      'OUT'
    );
  }

  /**
   * Handle restroom return logic (complex state machine for restroom trips)
   */
  async handleRestroomReturn(): Promise<Pass> {
    const currentLeg = this.getCurrentLeg();
    if (!currentLeg) {
      throw new Error('Cannot handle restroom return: no current leg');
    }

    const destination = await getLocationById(currentLeg.destinationLocationId);
    const isRestroom = destination?.locationType === 'bathroom';
    
    if (!isRestroom) {
      throw new Error('Current destination is not a restroom');
    }

    // Always return to the location the student left from (origin of current leg)
    const returnLocationId = currentLeg.originLocationId;
    
    // Check if returning to assigned class
    const isReturningToAssignedClass = returnLocationId === this.student.assignedLocationId;
    
    if (isReturningToAssignedClass) {
      // Returning to assigned class - close the pass
      return this.closePass(returnLocationId);
    } else {
      // Returning to a different location - add new leg and keep pass open
      return this.addLeg(
        currentLeg.destinationLocationId,
        returnLocationId,
        'IN'
      );
    }
  }

  /**
   * Validate if a state transition is allowed
   */
  validateTransition(action: string): { valid: boolean; error?: string } {
    const currentLeg = this.getCurrentLeg();

    // If the action is not recognized, return unknown action error first
    const validActions = ['arrive', 'return_to_class', 'close_pass', 'restroom_return'];
    if (!validActions.includes(action)) {
      return { valid: false, error: `Unknown action: ${action}` };
    }

    if (!currentLeg) {
      return { valid: false, error: 'No current leg to transition from' };
    }

    switch (action) {
      case 'arrive':
        if (currentLeg.state !== 'OUT') {
          return { valid: false, error: 'Cannot arrive: not currently out' };
        }
        break;
      case 'return_to_class':
        if (currentLeg.state !== 'IN') {
          return { valid: false, error: 'Cannot return to class: not currently in' };
        }
        break;
      case 'close_pass':
        if (currentLeg.state !== 'OUT') {
          return { valid: false, error: 'Cannot close pass: not currently out' };
        }
        break;
      case 'restroom_return':
        if (currentLeg.state !== 'OUT') {
          return { valid: false, error: 'Cannot return from restroom: not currently out' };
        }
        break;
    }

    return { valid: true };
  }

  /**
   * Get the current pass state
   */
  getCurrentState(): { status: string; state: string; locationId: string } {
    const currentLeg = this.getCurrentLeg();
    return {
      status: this.pass.status,
      state: currentLeg?.state ?? 'NONE',
      locationId: currentLeg?.destinationLocationId ?? 'NONE',
    };
  }
} 