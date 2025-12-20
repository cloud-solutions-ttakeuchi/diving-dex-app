"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.logger = void 0;
const baseLogger = require("firebase-functions/logger");
/**
 * Standardized Logger Utility (Centralized Log Level Control)
 * Usage:
 *   import { logger } from '../utils/logger';
 *   logger.debug("detailed info");
 *
 * Configured via LOG_LEVEL environment variable.
 */
const currentLogLevel = (process.env.LOG_LEVEL || 'info').toLowerCase();
const levels = {
    debug: 0,
    info: 1,
    warn: 2,
    error: 3
};
const currentPriority = levels[currentLogLevel] ?? 1;
exports.logger = {
    debug: (message, ...args) => {
        if (currentPriority <= levels.debug)
            baseLogger.debug(message, ...args);
    },
    info: (message, ...args) => {
        if (currentPriority <= levels.info)
            baseLogger.info(message, ...args);
    },
    warn: (message, ...args) => {
        if (currentPriority <= levels.warn)
            baseLogger.warn(message, ...args);
    },
    error: (message, ...args) => {
        if (currentPriority <= levels.error)
            baseLogger.error(message, ...args);
    }
};
//# sourceMappingURL=logger.js.map