import { onCall, HttpsError } from "firebase-functions/v2/https";
import { logger } from "../utils/logger";
import { getFirestore } from "firebase-admin/firestore";
import { JobsClient } from "@google-cloud/run";

const db = getFirestore();

/**
 * Trigger Point-Creature Cleansing Job via Cloud Run Jobs
 */
export const runDataCleansing = onCall({ region: "asia-northeast1", memory: "512MiB", timeoutSeconds: 60 }, async (request) => {
  const { auth, data } = request;

  // 1. Auth Check (Admin or Emulator)
  if (!auth) {
    logger.error("No auth context found in request");
    throw new HttpsError("unauthenticated", "Auth required");
  }

  const isEmulator = process.env.FUNCTIONS_EMULATOR === "true";
  const userDoc = await db.collection("users").doc(auth.uid).get();
  const userData = userDoc.data();

  if (!isEmulator && (!userData || userData.role !== 'admin')) {
    logger.warn(`Permission Denied: User ${auth.uid} has role: ${userData?.role || 'none'}`);
    throw new HttpsError("permission-denied", "Admin role required");
  }

  const { mode, pointId, creatureId, regionId, zoneId, areaId, limit } = data;

  const projectId = process.env.GCLOUD_PROJECT;
  if (!projectId) {
    throw new HttpsError("failed-precondition", "GCLOUD_PROJECT environment variable is not set");
  }
  const region = process.env.GCP_REGION || "asia-northeast1";

  // Get Job name from environment variable (default: cleansing-job)
  const jobName = process.env.CLEANSING_JOB_NAME || "cleansing-job";

  logger.info(`Triggering Cloud Run Job: ${jobName} in ${region} for Project: ${projectId}`);

  // 2. Prepare Arguments for Python Script
  const args: string[] = [];
  if (mode) args.push("--mode", mode);
  if (pointId) args.push("--pointId", pointId);
  if (creatureId) args.push("--creatureId", creatureId);
  if (regionId) args.push("--region", regionId);
  if (zoneId) args.push("--zone", zoneId);
  if (areaId) args.push("--area", areaId);
  if (limit) args.push("--limit", String(limit));

  try {
    const runClient = new JobsClient();

    // Construct the fully qualified job name
    const name = `projects/${projectId}/locations/${region}/jobs/${jobName}`;

    // Execute the job with container overrides
    const [operation] = await runClient.runJob({
      name,
      overrides: {
        containerOverrides: [
          {
            args: args
          }
        ]
      }
    });

    logger.info(`Job ${jobName} started successfully. Operation: ${operation.name}`);

    return {
      success: true,
      message: "Cleansing job started in the background (Cloud Run Job).",
      jobName,
      executionId: operation.name,
      args
    };

  } catch (error: any) {
    logger.error("Failed to trigger Cloud Run Job:", error);

    // Fallback info for local development/emulator
    if (isEmulator) {
      return {
        success: false,
        message: "Cloud Run Job cannot be triggered from Emulator. Please run 'python scripts/cleansing_pipeline.py' manually.",
        suggestedCommand: `python scripts/cleansing_pipeline.py ${args.join(" ")}`
      };
    }

    throw new HttpsError("internal", `Failed to start cleansing job: ${error.message}`);
  }
});
