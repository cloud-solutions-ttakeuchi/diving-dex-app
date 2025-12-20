"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.runDataCleansing = void 0;
const https_1 = require("firebase-functions/v2/https");
const logger_1 = require("../utils/logger");
const firestore_1 = require("firebase-admin/firestore");
const run_1 = require("@google-cloud/run");
const db = (0, firestore_1.getFirestore)();
/**
 * Trigger Point-Creature Cleansing Job via Cloud Run Jobs
 */
exports.runDataCleansing = (0, https_1.onCall)({ region: "asia-northeast1", memory: "512MiB", timeoutSeconds: 60 }, async (request) => {
    const { auth, data } = request;
    // 1. Auth Check (Admin or Emulator)
    if (!auth) {
        logger_1.logger.error("No auth context found in request");
        throw new https_1.HttpsError("unauthenticated", "Auth required");
    }
    const isEmulator = process.env.FUNCTIONS_EMULATOR === "true";
    const userDoc = await db.collection("users").doc(auth.uid).get();
    const userData = userDoc.data();
    if (!isEmulator && (!userData || userData.role !== 'admin')) {
        logger_1.logger.warn(`Permission Denied: User ${auth.uid} has role: ${userData?.role || 'none'}`);
        throw new https_1.HttpsError("permission-denied", "Admin role required");
    }
    const { mode, pointId, creatureId, regionId, zoneId, areaId, limit } = data;
    const projectId = process.env.GCLOUD_PROJECT || process.env.VITE_FIREBASE_PROJECT_ID;
    const region = process.env.GCP_REGION || "asia-northeast1";
    // Job name depends on the environment
    const isStaging = projectId?.includes("-stg") || projectId?.includes("-dev");
    const jobName = isStaging ? "cleansing-job-stg" : "cleansing-job-prod";
    logger_1.logger.info(`Triggering Cloud Run Job: ${jobName} in ${region} for Project: ${projectId}`);
    // 2. Prepare Arguments for Python Script
    const args = [];
    if (mode)
        args.push("--mode", mode);
    if (pointId)
        args.push("--pointId", pointId);
    if (creatureId)
        args.push("--creatureId", creatureId);
    if (regionId)
        args.push("--region", regionId);
    if (zoneId)
        args.push("--zone", zoneId);
    if (areaId)
        args.push("--area", areaId);
    if (limit)
        args.push("--limit", String(limit));
    try {
        const runClient = new run_1.JobsClient();
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
        logger_1.logger.info(`Job ${jobName} started successfully. Operation: ${operation.name}`);
        return {
            success: true,
            message: "Cleansing job started in the background (Cloud Run Job).",
            jobName,
            executionId: operation.name,
            args
        };
    }
    catch (error) {
        logger_1.logger.error("Failed to trigger Cloud Run Job:", error);
        // Fallback info for local development/emulator
        if (isEmulator) {
            return {
                success: false,
                message: "Cloud Run Job cannot be triggered from Emulator. Please run 'python scripts/cleansing_pipeline.py' manually.",
                suggestedCommand: `python scripts/cleansing_pipeline.py ${args.join(" ")}`
            };
        }
        throw new https_1.HttpsError("internal", `Failed to start cleansing job: ${error.message}`);
    }
});
//# sourceMappingURL=cleansing.js.map