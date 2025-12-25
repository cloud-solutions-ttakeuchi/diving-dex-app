import { db } from '../firebase';
import { doc, setDoc, updateDoc, arrayUnion } from 'firebase/firestore';
import { DiveLog } from '../types';

/**
 * WeDive Database Rules (from DATABASE_DESIGN.md):
 * 1. Log ID format: 'l' + timestamp (e.g., l1734963000000)
 * 2. Path: users/{userId}/logs/{logId}
 * 3. Log ID must also be added to user's 'logs' array in users/{userId}
 */

/**
 * Removes undefined values from payload to prevent Firestore errors.
 */
export const sanitizePayload = (data: any): any => {
  if (Array.isArray(data)) {
    return data.map(item => sanitizePayload(item));
  }
  if (data !== null && typeof data === 'object') {
    return Object.entries(data).reduce((acc, [key, value]) => {
      if (value !== undefined) {
        acc[key] = sanitizePayload(value);
      }
      return acc;
    }, {} as any);
  }
  return data;
};

export class LogService {
  /**
   * Generates a Log ID following the spec: 'l' + timestamp + random suffix (for safety)
   */
  static generateLogId(): string {
    return `l${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
  }

  /**
   * Saves a new dive log following the sub-collection schema and updating the user array.
   */
  static async addLog(userId: string, logData: Omit<DiveLog, 'id' | 'userId'>, options?: { skipUserUpdate?: boolean }): Promise<string> {
    const logId = this.generateLogId();
    const now = new Date().toISOString();

    const finalLogData: DiveLog = {
      ...logData,
      id: logId,
      userId: userId,
      createdAt: now,
      updatedAt: now,
    } as DiveLog;

    const sanitizedData = sanitizePayload(finalLogData);

    // 1. Save to sub-collection: users/{userId}/logs/{logId}
    const logRef = doc(db, 'users', userId, 'logs', logId);
    await setDoc(logRef, sanitizedData);

    // 2. Update user's logs array (Skip if in bulk mode)
    if (!options?.skipUserUpdate) {
      const userRef = doc(db, 'users', userId);
      updateDoc(userRef, {
        logs: arrayUnion(logId)
      }).catch(e => {
        console.warn("Non-critical: User array update failed:", e);
      });
    }

    return logId;
  }

  static async updateUserLogList(userId: string, logIds: string[]): Promise<void> {
    const userRef = doc(db, 'users', userId);
    await updateDoc(userRef, {
      logs: arrayUnion(...logIds)
    });
  }
}
