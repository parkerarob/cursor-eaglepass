const functions = require("firebase-functions");
const admin = require("firebase-admin");

// Initialize Firebase Admin SDK
admin.initializeApp();

const db = admin.firestore();

/**
 * Cloud Function to validate pass creation
 * Checks if a student already has an open pass before allowing creation of a new one
 * This function is called from Firestore security rules
 */
exports.validatePassCreation = functions.https.onCall(async (data, context) => {
  try {
    // Verify authentication
    if (!context.auth) {
      throw new functions.https.HttpsError("unauthenticated", "User must be authenticated");
    }

    const { studentId } = data;
    
    if (!studentId) {
      throw new functions.https.HttpsError("invalid-argument", "studentId is required");
    }

    // Verify the authenticated user is the student or has appropriate permissions
    if (context.auth.uid !== studentId) {
      // Check if user is admin, teacher, or dev
      const userDoc = await db.collection("users").doc(context.auth.uid).get();
      if (!userDoc.exists) {
        throw new functions.https.HttpsError("permission-denied", "User not found");
      }
      
      const userRole = userDoc.data().role;
      if (!["admin", "teacher", "dev"].includes(userRole)) {
        throw new functions.https.HttpsError("permission-denied", "Insufficient permissions");
      }
    }

    // Query for existing open passes for this student
    const openPassesQuery = await db.collection("passes")
      .where("studentId", "==", studentId)
      .where("status", "==", "OPEN")
      .limit(1)
      .get();

    const hasOpenPass = !openPassesQuery.empty;

    // Log the validation attempt for audit purposes
    await db.collection("eventLogs").add({
      passId: null,
      studentId: studentId,
      actorId: context.auth.uid,
      timestamp: admin.firestore.FieldValue.serverTimestamp(),
      eventType: "PASS_VALIDATION",
      details: `Pass creation validation: hasOpenPass=${hasOpenPass}`,
      notificationLevel: "system"
    });

    return { 
      hasOpenPass: hasOpenPass,
      allowed: !hasOpenPass,
      timestamp: admin.firestore.FieldValue.serverTimestamp()
    };

  } catch (error) {
    console.error("Pass validation error:", error);
    
    // Log the error for monitoring
    await db.collection("eventLogs").add({
      passId: null,
      studentId: data?.studentId || "unknown",
      actorId: context.auth?.uid || "unknown",
      timestamp: admin.firestore.FieldValue.serverTimestamp(),
      eventType: "ERROR",
      details: `Pass validation function error: ${error.message}`,
      notificationLevel: "admin"
    });

    throw new functions.https.HttpsError("internal", "Pass validation failed");
  }
});

/**
 * Cloud Function to get pass validation status
 * Returns whether a student has an open pass (for UI feedback)
 */
exports.getPassValidationStatus = functions.https.onCall(async (data, context) => {
  try {
    // Verify authentication
    if (!context.auth) {
      throw new functions.https.HttpsError("unauthenticated", "User must be authenticated");
    }

    const { studentId } = data;
    
    if (!studentId) {
      throw new functions.https.HttpsError("invalid-argument", "studentId is required");
    }

    // Verify the authenticated user is the student or has appropriate permissions
    if (context.auth.uid !== studentId) {
      const userDoc = await db.collection("users").doc(context.auth.uid).get();
      if (!userDoc.exists) {
        throw new functions.https.HttpsError("permission-denied", "User not found");
      }
      
      const userRole = userDoc.data().role;
      if (!["admin", "teacher", "dev"].includes(userRole)) {
        throw new functions.https.HttpsError("permission-denied", "Insufficient permissions");
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
    console.error("Pass validation status error:", error);
    throw new functions.https.HttpsError("internal", "Failed to get pass validation status");
  }
});

/**
 * Scheduled function to clean up expired passes
 * Runs every hour to close passes that have exceeded their expected duration
 */
exports.cleanupExpiredPasses = functions.pubsub.schedule("every 1 hours").onRun(async (_context) => {
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
      console.log(`Cleaned up ${closedCount} expired passes`);
    }

    return { closedCount, timestamp: now };

  } catch (error) {
    console.error("Pass cleanup error:", error);
    throw error;
  }
}); 