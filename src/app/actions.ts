'use server';

import {
  Timestamp,
  getFirestore,
} from 'firebase-admin/firestore';
import { adminApp } from '@/lib/firebase/config.server';
import { Pass, PassFormData, User } from '@/types';
import { passFormDataSchema } from '@/lib/validation/schemas';
import { PolicyEngine } from '@/lib/policyEngine';
import { FERPAAuditLogger } from '@/lib/ferpaAuditLogger';
import { revalidatePath } from 'next/cache';

// Use the Admin SDK Firestore instance
const adminDb = getFirestore(adminApp);

// This is the new, secure Server Action for creating a pass.
export async function createPassAction(
  student: User,
  formData: PassFormData
): Promise<{ success: boolean; error?: string }> {
  try {
    // 1. Validate input payload
    const validatedFormData = passFormDataSchema.parse(formData);
    const { destinationLocationId } = validatedFormData;

    if (!student || !student.id || !student.assignedLocationId) {
      throw new Error('Invalid student data provided.');
    }

    // 2. Evaluate Policy
    const policyEngine = new PolicyEngine();
    const policyContext = {
      studentId: student.id,
      origin: student.assignedLocationId,
      destination: destinationLocationId,
      locationId: student.assignedLocationId,
      passType: 'Immediate' as const,
    };
    // Note: Groups and restrictions would be fetched here in a real scenario
    const policyResult = await policyEngine.evaluatePolicy(policyContext, student, [], []);

    if (!policyResult.allowed) {
      await FERPAAuditLogger.logRecordAccess(
        student.id,
        'student',
        student.id,
        [],
        `Pass creation denied by policy: ${policyResult.reason}`,
        'Policy Engine Evaluation'
      );
      return { success: false, error: policyResult.reason || 'Action denied by school policy.' };
    }

    // 3. Run as an atomic transaction
    let newPassId: string | null = null;
    await adminDb.runTransaction(async (transaction) => {
      const passesRef = adminDb.collection('passes');

      // Re-verify no active pass exists within the transaction
      const openPassQuery = passesRef
        .where('studentId', '==', student.id)
        .where('status', '==', 'OPEN');
        
      const openPassSnapshot = await transaction.get(openPassQuery);

      if (!openPassSnapshot.empty) {
        throw new Error('An active pass already exists for this student.');
      }

      // 4. Create the new pass object
      const now = Timestamp.now();
      newPassId = passesRef.doc().id;
      const newPass: Pass = {
        id: newPassId,
        studentId: student.id,
        status: 'OPEN',
        createdAt: now.toDate(),
        lastUpdatedAt: now.toDate(),
        legs: [
          {
            id: adminDb.collection('legs').doc().id,
            legNumber: 1,
            originLocationId: student.assignedLocationId!,
            destinationLocationId: destinationLocationId,
            state: 'OUT',
            timestamp: now.toDate(),
          },
        ],
      };
      
      const passDocRef = passesRef.doc(newPass.id);
      transaction.set(passDocRef, newPass);
    });

    if (!newPassId) {
        throw new Error('Failed to create pass ID during transaction.');
    }

    // 5. Audit the successful creation
    await FERPAAuditLogger.logRecordAccess(
      student.id,
      'student',
      student.id,
      [newPassId],
      `Pass created to destination ${destinationLocationId}`,
      'Student pass creation'
    );

    // 6. Revalidate the page to show the new pass
    revalidatePath('/');
    return { success: true };

  } catch (error) {
    console.error('createPassAction failed:', error);
    // Log the error to the audit service for monitoring
    await FERPAAuditLogger.logRecordAccess(
        student?.id || 'unknown',
        'student',
        student?.id || 'unknown',
        [],
        `Pass creation failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        'System Error'
      );
    return {
      success: false,
      error: error instanceof Error ? error.message : 'An unexpected error occurred.',
    };
  }
} 