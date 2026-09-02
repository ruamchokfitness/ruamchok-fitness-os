
'use client';

import { collection, addDoc, serverTimestamp, Firestore } from 'firebase/firestore';
import type { User } from '@/lib/types';

export type AuditModule = 
  | 'Sales' 
  | 'HRM' 
  | 'Maintenance' 
  | 'GroupClass' 
  | 'PTTracker' 
  | 'Settings' 
  | 'Assessment';

export type AuditAction = 'create' | 'update' | 'delete';

interface AuditLogEntry {
  action: AuditAction;
  module: AuditModule;
  resourceId: string;
  details: string;
  previousData?: any;
  newData?: any;
}

/**
 * Utility to record an audit log entry in Firestore.
 * This should be called after any successful mutation.
 */
export async function recordAuditLog(
  db: Firestore,
  user: User | null,
  entry: AuditLogEntry
) {
  if (!db || !user) {
    console.warn('AuditLog: Database or User not available. Log skipped.');
    return;
  }

  try {
    const logsRef = collection(db, 'auditLogs');
    await addDoc(logsRef, {
      ...entry,
      userId: user.uid,
      userName: user.name || user.email || 'Unknown User',
      timestamp: serverTimestamp(),
    });
  } catch (error) {
    console.error('Failed to record audit log:', error);
  }
}
