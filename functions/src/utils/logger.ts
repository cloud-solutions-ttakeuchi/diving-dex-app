import * as baseLogger from "firebase-functions/logger";

/**
 * Standardized Logger Utility (Centralized Log Level Control)
 * Usage:
 *   import { logger } from '../utils/logger';
 *   logger.debug("detailed info");
 *
 * Configured via LOG_LEVEL environment variable.
 */

const currentLogLevel = (process.env.LOG_LEVEL || 'info').toLowerCase();

const levels: Record<string, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3
};

const currentPriority = levels[currentLogLevel] ?? 1;

export const logger = {
  debug: (message: string, ...args: any[]) => {
    if (currentPriority <= levels.debug) baseLogger.debug(message, ...args);
  },
  info: (message: string, ...args: any[]) => {
    if (currentPriority <= levels.info) baseLogger.info(message, ...args);
  },
  warn: (message: string, ...args: any[]) => {
    if (currentPriority <= levels.warn) baseLogger.warn(message, ...args);
  },
  error: (message: string, ...args: any[]) => {
    if (currentPriority <= levels.error) baseLogger.error(message, ...args);
  }
};
