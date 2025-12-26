import { db } from '../firebase';
import { doc, setDoc, updateDoc, arrayUnion, deleteDoc } from 'firebase/firestore';
import { DiveLog } from '../types';

/**
 * WeDive Database Rules (from DATABASE_DESIGN.md):
 * 1. Log ID format: 'l' + timestamp (e.g., l1734963000000)
 * 2. Path: users/{userId}/logs/{logId}
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
   * Saves a new dive log following the sub-collection schema.
   */
  static async addLog(userId: string, logData: Omit<DiveLog, 'id' | 'userId'>): Promise<string> {
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

    // Save to sub-collection: users/{userId}/logs/{logId}
    const logRef = doc(db, 'users', userId, 'logs', logId);
    await setDoc(logRef, sanitizedData);

    return logId;
  }


  static async updateLog(userId: string, logId: string, logData: Partial<DiveLog>): Promise<void> {
    const logRef = doc(db, 'users', userId, 'logs', logId);
    const sanitizedData = sanitizePayload({
      ...logData,
      updatedAt: new Date().toISOString(),
    });
    await updateDoc(logRef, sanitizedData);
  }

  static async deleteLog(userId: string, logId: string): Promise<void> {
    const logRef = doc(db, 'users', userId, 'logs', logId);
    await deleteDoc(logRef);
  }
}
