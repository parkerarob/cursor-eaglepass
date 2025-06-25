/**
 * Import function triggers from their respective submodules:
 *
 * import {onCall} from "firebase-functions/v2/https";
 * import {onDocumentWritten} from "firebase-functions/v2/firestore";
 *
 * See a full list of supported triggers at https://firebase.google.com/docs/functions
 */

import { onCall } from "firebase-functions/v2/https";
import { onSchedule } from "firebase-functions/v2/scheduler";
import * as admin from "firebase-admin";
import * as logger from "firebase-functions/logger";

// Initialize Firebase Admin SDK
admin.initializeApp();

const db = admin.firestore();

// Utility to check if a student has an open pass (mirrors app logic)
async function checkStudentHasOpenPass(db, studentId) {
  const openPassesQuery = await db.collection("passes")
    .where("studentId", "==", studentId)
    .where("status", "==", "OPEN")
    .limit(1)
    .get();
  return !openPassesQuery.empty;
}

/**
 * Cloud Function to validate pass creation
 * Checks if a student already has an open pass before allowing creation of a new one
 * This function is called from the client before creating a pass
 */
export const validatePassCreation = onCall(
  { 
    maxInstances: 10,
    timeoutSeconds: 30,
    memory: "256MiB"
  },
  async (request) => {
    try {
      // Verify authentication
      if (!request.auth || !request.auth.uid) {
        throw new Error("User must be authenticated");
      }

      const { studentId } = request.data;
      
      if (!studentId) {
        throw new Error("studentId is required");
      }

      // Verify the authenticated user is the student or has appropriate permissions
      if (request.auth.uid !== studentId) {
        // Check if user is admin, teacher, or dev
        const userDoc = await db.collection("users").doc(request.auth.uid).get();
        if (!userDoc.exists) {
          throw new Error("User not found");
        }
        
        const userRole = userDoc.data()?.role;
        if (!["admin", "teacher", "dev"].includes(userRole)) {
          throw new Error("Insufficient permissions");
        }
      }

      // Query for existing open passes for this student
      const hasOpenPass = await checkStudentHasOpenPass(db, studentId);

      // Log the validation attempt for audit purposes
      await db.collection("eventLogs").add({
        passId: null,
        studentId: studentId,
        actorId: request.auth.uid,
        timestamp: admin.firestore.FieldValue.serverTimestamp(),
        eventType: "PASS_VALIDATION",
        details: `Pass creation validation: hasOpenPass=${hasOpenPass}`,
        notificationLevel: "system"
      });

      logger.info("Pass validation completed", {
        studentId,
        hasOpenPass,
        actorId: request.auth.uid
      });

      return { 
        hasOpenPass: hasOpenPass,
        allowed: !hasOpenPass,
        timestamp: admin.firestore.FieldValue.serverTimestamp()
      };

    } catch (error) {
      logger.error("Pass validation error:", error);
      
      // Log the error for monitoring
      await db.collection("eventLogs").add({
        passId: null,
        studentId: request.data?.studentId || "unknown",
        actorId: request.auth?.uid || "unknown",
        timestamp: admin.firestore.FieldValue.serverTimestamp(),
        eventType: "ERROR",
        details: `Pass validation function error: ${error instanceof Error ? error.message : "Unknown error"}`,
        notificationLevel: "admin"
      });

      // Propagate original error to allow clients and tests to inspect specific failure reasons
      if (error instanceof Error) {
        throw error;
      }
      throw new Error("Pass validation failed");
    }
  }
);

/**
 * Cloud Function to get pass validation status
 * Returns whether a student has an open pass (for UI feedback)
 */
export const getPassValidationStatus = onCall(
  { 
    maxInstances: 10,
    timeoutSeconds: 30,
    memory: "256MiB"
  },
  async (request) => {
    try {
      // Verify authentication
      if (!request.auth || !request.auth.uid) {
        throw new Error("User must be authenticated");
      }

      const { studentId } = request.data;
      
      if (!studentId) {
        throw new Error("studentId is required");
      }

      // Verify the authenticated user is the student or has appropriate permissions
      if (request.auth.uid !== studentId) {
        const userDoc = await db.collection("users").doc(request.auth.uid).get();
        if (!userDoc.exists) {
          throw new Error("User not found");
        }
        
        const userRole = userDoc.data()?.role;
        if (!["admin", "teacher", "dev"].includes(userRole)) {
          throw new Error("Insufficient permissions");
        }
      }

      // Query for existing open passes for this student
      const openPassesQuery = await db.collection("passes")
        .where("studentId", "==", studentId)
        .where("status", "==", "OPEN")
        .limit(1)
        .get();

      const hasOpenPass = !openPassesQuery.empty;
      let openPassDetails = null;

      if (hasOpenPass) {
        const openPass = openPassesQuery.docs[0];
        openPassDetails = {
          passId: openPass.id,
          createdAt: openPass.data().createdAt,
          destinationLocationId: openPass.data().destinationLocationId,
          reason: openPass.data().reason
        };
      }

      return { 
        hasOpenPass: hasOpenPass,
        openPassDetails: openPassDetails,
        timestamp: admin.firestore.FieldValue.serverTimestamp()
      };

    } catch (error) {
      logger.error("Pass validation status error:", error);
      throw new Error("Failed to get pass validation status");
    }
  }
);

/**
 * Scheduled function to clean up expired passes
 * Runs every hour to close passes that have exceeded their expected duration
 */
export const cleanupExpiredPasses = onSchedule(
  {
    schedule: "every 1 hours",
    timeZone: "America/New_York"
  },
  async (_event) => {
    try {
      const now = admin.firestore.Timestamp.now();
      const oneHourAgo = new Date(now.toDate().getTime() - 60 * 60 * 1000);
      
      // Find passes that have been open for more than 1 hour
      const expiredPassesQuery = await db.collection("passes")
        .where("status", "==", "OPEN")
        .where("createdAt", "<", oneHourAgo)
        .get();

      const batch = db.batch();
      let closedCount = 0;

      expiredPassesQuery.docs.forEach(doc => {
        const passData = doc.data();
        
        // Update pass status to CLOSED
        batch.update(doc.ref, {
          status: "CLOSED",
          closedAt: now,
          closedBy: "system",
          closeReason: "expired"
        });

        // Log the automatic closure
        const logRef = db.collection("eventLogs").doc();
        batch.set(logRef, {
          passId: doc.id,
          studentId: passData.studentId,
          actorId: "system",
          timestamp: now,
          eventType: "PASS_AUTO_CLOSED",
          details: "Pass automatically closed due to expiration (1 hour)",
          notificationLevel: "system"
        });

        closedCount++;
      });

      if (closedCount > 0) {
        await batch.commit();
        logger.info(`Cleaned up ${closedCount} expired passes`);
      }

      // Log the cleanup operation
      logger.info("Pass cleanup completed", { closedCount, timestamp: now });

    } catch (error) {
      logger.error("Pass cleanup error:", error);
      throw error;
    }
  }
);
