import { initializeApp } from "firebase-admin/app";

initializeApp();

// Export AI Draft Functions
export * from "./ai/generateAIDrafts";
export * from "./ai/concierge";
export * from "./ai/searchCreatureImage";

// Export Firestore Triggers
export * from "./triggers/translateTriggers";
export * from "./triggers/userStatsTriggers";

// Export Management APIs
export * from "./api/cleansing";
export * from "./api/auth";
