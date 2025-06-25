import { collection, doc, setDoc, getDocs, query, where, Timestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase/firestore';
import { FERPAAuditLogger } from './ferpaAuditLogger';

export interface ParentStudentRelationship {
  id: string;
  parentId: string;
  parentEmail: string;
  studentId: string;
  studentName: string;
  relationshipType: 'parent' | 'guardian' | 'authorized_representative';
  verifiedAt: Date;
  verificationMethod: 'school_records' | 'admin_confirmation' | 'document_verification';
  active: boolean;
  schoolYear: string;
  verifiedBy: string;
}

export class ParentRelationshipVerifier {
  
  /**
   * Verify parent-student relationship exists and is active
   */
  static async verifyRelationship(
    parentId: string,
    studentId: string
  ): Promise<ParentStudentRelationship | null> {
    try {
      const relationshipsRef = collection(db, 'parentStudentRelationships');
      const q = query(
        relationshipsRef,
        where('parentId', '==', parentId),
        where('studentId', '==', studentId),
        where('active', '==', true)
      );

      const querySnapshot = await getDocs(q);
      
      if (querySnapshot.empty) {
        // Log failed relationship check
        try {
          await FERPAAuditLogger.logRelationshipCheck(
            parentId,
            'parent',
            parentId,
            studentId,
            'failure',
            'system_lookup'
          );
        } catch (loggingError) {
          console.error('FERPA audit logging failed:', loggingError);
        }
        return null;
      }

      const data = querySnapshot.docs[0].data();
      
      const relationship: ParentStudentRelationship = {
        ...data,
        verifiedAt: data.verifiedAt.toDate()
      } as ParentStudentRelationship;

      // Log successful check
      try {
        await FERPAAuditLogger.logRelationshipCheck(
          parentId,
          'parent',
          parentId,
          studentId,
          'success',
          'system_lookup'
        );
      } catch (loggingError) {
        console.error('FERPA audit logging failed:', loggingError);
      }

      return relationship;

    } catch (error) {
      console.error('ParentRelationshipVerifier: Error verifying relationship:', error);
      return null;
    }
  }

  /**
   * Create new parent-student relationship (admin function)
   */
  static async createRelationship(
    parentId: string,
    parentEmail: string,
    studentId: string,
    studentName: string,
    relationshipType: ParentStudentRelationship['relationshipType'],
    verifiedBy: string,
    verificationMethod: ParentStudentRelationship['verificationMethod'] = 'admin_confirmation'
  ): Promise<ParentStudentRelationship> {
    try {
      const relationship: ParentStudentRelationship = {
        id: this.generateRelationshipId(),
        parentId,
        parentEmail,
        studentId,
        studentName,
        relationshipType,
        verifiedAt: new Date(),
        verificationMethod,
        active: true,
        schoolYear: this.getCurrentSchoolYear(),
        verifiedBy
      };

      await this.storeRelationship(relationship);

      // Log relationship creation for FERPA compliance
      await FERPAAuditLogger.logRecordAccess(
        verifiedBy,
        'admin',
        studentId,
        [],
        `Parent-student relationship created for ${parentEmail}`,
        'Administrative verification of parent relationship'
      );


      return relationship;

    } catch (error) {
      console.error('ParentRelationshipVerifier: Error creating relationship:', error);
      throw error;
    }
  }

  /**
   * Get all relationships for a parent
   */
  static async getParentRelationships(parentId: string): Promise<ParentStudentRelationship[]> {
    try {
      const relationshipsRef = collection(db, 'parentStudentRelationships');
      const q = query(
        relationshipsRef,
        where('parentId', '==', parentId),
        where('active', '==', true)
      );

      const querySnapshot = await getDocs(q);
      
      return querySnapshot.docs.map(doc => {
        const data = doc.data();
        return {
          ...data,
          verifiedAt: data.verifiedAt.toDate()
        } as ParentStudentRelationship;
      });

    } catch (error) {
      console.error('ParentRelationshipVerifier: Error getting parent relationships:', error);
      return [];
    }
  }

  /**
   * Get all relationships for a student (admin function)
   */
  static async getStudentRelationships(studentId: string): Promise<ParentStudentRelationship[]> {
    try {
      const relationshipsRef = collection(db, 'parentStudentRelationships');
      const q = query(
        relationshipsRef,
        where('studentId', '==', studentId),
        where('active', '==', true)
      );

      const querySnapshot = await getDocs(q);
      
      return querySnapshot.docs.map(doc => {
        const data = doc.data();
        return {
          ...data,
          verifiedAt: data.verifiedAt.toDate()
        } as ParentStudentRelationship;
      });

    } catch (error) {
      console.error('ParentRelationshipVerifier: Error getting student relationships:', error);
      return [];
    }
  }

  /**
   * Store relationship in Firestore
   */
  private static async storeRelationship(relationship: ParentStudentRelationship): Promise<void> {
    try {
      const relationshipRef = doc(collection(db, 'parentStudentRelationships'), relationship.id);
      
      const firestoreRelationship = {
        ...relationship,
        verifiedAt: Timestamp.fromDate(relationship.verifiedAt)
      };
      
      await setDoc(relationshipRef, firestoreRelationship);

    } catch (error) {
      console.error('ParentRelationshipVerifier: Error storing relationship:', error);
      throw error;
    }
  }

  /**
   * Generate unique relationship ID
   */
  private static generateRelationshipId(): string {
    const timestamp = Date.now();
    const random = Math.random().toString(36).substr(2, 9);
    return `rel-${timestamp}-${random}`;
  }

  /**
   * Get current school year
   */
  private static getCurrentSchoolYear(): string {
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth() + 1;
    
    if (month >= 8) {
      return `${year}-${year + 1}`;
    } else {
      return `${year - 1}-${year}`;
    }
  }
} 