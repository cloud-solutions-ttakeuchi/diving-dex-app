"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __exportStar = (this && this.__exportStar) || function(m, exports) {
    for (var p in m) if (p !== "default" && !Object.prototype.hasOwnProperty.call(exports, p)) __createBinding(exports, m, p);
};
Object.defineProperty(exports, "__esModule", { value: true });
const app_1 = require("firebase-admin/app");
(0, app_1.initializeApp)();
// Export AI Draft Functions
__exportStar(require("./ai/generateAIDrafts"), exports);
__exportStar(require("./ai/concierge"), exports);
__exportStar(require("./ai/searchCreatureImage"), exports);
// Export Firestore Triggers
__exportStar(require("./triggers/translateTriggers"), exports);
// Export Management APIs
__exportStar(require("./api/cleansing"), exports);
__exportStar(require("./api/auth"), exports);
//# sourceMappingURL=index.js.map