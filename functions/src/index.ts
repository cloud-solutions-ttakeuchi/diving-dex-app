import { initializeApp } from "firebase-admin/app";

initializeApp();

// Export AI Draft Functions
export * from "./ai/generateAIDrafts";
export * from "./ai/concierge";

// Export Firestore Triggers
export * from "./triggers/translateTriggers";
