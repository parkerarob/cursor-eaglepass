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

// ---------------------------------------------------------------------------
// Validate Add Destination (multi-leg support)
// ---------------------------------------------------------------------------
export const validateAddDestination = onCall(
  {
    maxInstances: 10,
    timeoutSeconds: 30,
    memory: "256MiB"
  },
  async (request: any) => {
    try {
      if (!request.auth || !request.auth.uid) {
        throw new Error("User must be authenticated");
      }

      const { passId, studentId } = request.data || {};
      if (!passId || !studentId) {
        throw new Error("passId and studentId are required");
      }

      // Permission check – student themselves or staff
      if (request.auth.uid !== studentId) {
        const userDoc = await db.collection("users").doc(request.auth.uid).get();
        if (!userDoc.exists) throw new Error("User not found");
        const role = userDoc.data()?.role;
        if (!["admin", "teacher", "dev"].includes(role)) {
          throw new Error("Insufficient permissions");
        }
      }

      const passDoc = await db.collection("passes").doc(passId).get();
      if (!passDoc.exists) throw new Error("Pass not found");
      const passData = passDoc.data()!;

      const isOpen = passData.status === "OPEN";
      const legs = passData.legs || [];
      const lastLeg = legs[legs.length - 1];
      const lastLegIn = lastLeg && lastLeg.state === "IN";

      const allowed = isOpen && lastLegIn;

      await db.collection("eventLogs").add({
        passId,
        studentId,
        actorId: request.auth.uid,
        timestamp: admin.firestore.FieldValue.serverTimestamp(),
        eventType: "PASS_VALIDATION",
        details: `AddDestination validation: allowed=${allowed}`,
        notificationLevel: "system"
      });

      return { allowed };
    } catch (error) {
      logger.error("AddDestination validation error", error);
      // propagate
      throw error instanceof Error ? error : new Error("Validation failed");
    }
  }
);
