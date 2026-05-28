import NetInfo from '@react-native-community/netinfo';
import { getDatabase } from '../database/db';
import { SyncQueueItem } from '../database/schema';
import ApiService from './ApiService';

class SyncService {
  private isSyncing = false;
  private isConnected = true;
  private onStatusChangeCallback: ((connected: boolean) => void) | null = null;
  private onQueueChangeCallback: (() => void) | null = null;

  constructor() {
    // Monitor real-time connection status
    NetInfo.addEventListener(state => {
      const wasOffline = !this.isConnected;
      this.isConnected = state.isConnected ?? false;
      
      console.log(`[SyncService] Connection State: ${this.isConnected ? 'ONLINE' : 'OFFLINE'}`);
      
      if (this.onStatusChangeCallback) {
        this.onStatusChangeCallback(this.isConnected);
      }

      // If transition from OFFLINE -> ONLINE, fire sync queue automatically
      if (this.isConnected && wasOffline) {
        console.log('[SyncService] Internet re-established. Initiating automatic sync...');
        this.syncPendingItems().catch(err => {
          console.error('[SyncService] Auto-sync failed:', err);
        });
      }
    });
  }

  /**
   * Set callback to update UI when network state changes
   */
  registerStatusListener(callback: (connected: boolean) => void) {
    this.onStatusChangeCallback = callback;
    // Initial call
    callback(this.isConnected);
  }

  /**
   * Set callback to refresh UI when queue changes
   */
  registerQueueListener(callback: () => void) {
    this.onQueueChangeCallback = callback;
  }

  /**
   * Gets current network connection status
   */
  isOnline(): boolean {
    return this.isConnected;
  }

  /**
   * Enqueues a transaction into the local sync queue.
   * If online, it schedules a sync task immediately.
   */
  async enqueueAction(
    actionType: 'CREATE_TIMING' | 'CREATE_VET_INSPECTION' | 'UPDATE_ENTRY_STATUS',
    tableName: 'timing_records' | 'vet_inspections' | 'competition_entries',
    payload: any
  ): Promise<void> {
    try {
      const db = await getDatabase();
      const payloadString = JSON.stringify(payload);
      const now = new Date().toISOString();

      await db.runAsync(
        `INSERT INTO sync_queue (action_type, table_name, payload, created_at, attempts)
         VALUES (?, ?, ?, ?, 0);`,
        [actionType, tableName, payloadString, now]
      );

      console.log(`[SyncQueue] Action '${actionType}' stored locally.`);
      
      if (this.onQueueChangeCallback) {
        this.onQueueChangeCallback();
      }

      // Attempt to sync immediately if online
      if (this.isConnected) {
        this.syncPendingItems().catch(err => {
          console.error('[SyncQueue] Immediate sync failed, will retry later:', err);
        });
      }
    } catch (error) {
      console.error('[SyncQueue] Error enqueuing action:', error);
      throw error;
    }
  }

  /**
   * Synchronizes queued actions in exact FIFO (First-In, First-Out) order.
   * Halts on first error to prevent structural database misalignment (Foreign Key failures on postgres).
   */
  async syncPendingItems(): Promise<void> {
    if (this.isSyncing) return;
    if (!this.isConnected) {
      console.log('[SyncService] Cannot sync: currently OFFLINE.');
      return;
    }

    this.isSyncing = true;
    console.log('[SyncService] Commencing sync queue verification...');

    try {
      const db = await getDatabase();
      
      // Select queued items sorted chronologically (ascending ID)
      const pending = await db.getAllAsync<SyncQueueItem>(
        'SELECT * FROM sync_queue ORDER BY id ASC;'
      );

      if (pending.length === 0) {
        console.log('[SyncService] No pending items in sync queue.');
        this.isSyncing = false;
        return;
      }

      console.log(`[SyncService] ${pending.length} pending items found.`);

      for (const item of pending) {
        try {
          const payload = JSON.parse(item.payload);

          // Distribute action to corresponding Api endpoint
          switch (item.action_type) {
            case 'CREATE_TIMING':
              await ApiService.syncTimingRecord(payload);
              break;
            case 'CREATE_VET_INSPECTION':
              await ApiService.syncVetInspection(payload);
              break;
            case 'UPDATE_ENTRY_STATUS':
              await ApiService.syncEntryStatus(payload.id, payload.status);
              break;
            default:
              throw new Error(`Unsupported sync action type: ${item.action_type}`);
          }

          // Successfully synced -> Remove from queue
          await db.runAsync('DELETE FROM sync_queue WHERE id = ?;', [item.id]);
          console.log(`[SyncService] Synced item #${item.id} (${item.action_type}) successfully.`);
          
          if (this.onQueueChangeCallback) {
            this.onQueueChangeCallback();
          }
        } catch (error: any) {
          const errMsg = error?.message || 'Network endpoint unreachable';
          const nextAttempt = item.attempts + 1;
          
          console.error(`[SyncService] Synchronization failed for item #${item.id} (Attempt ${nextAttempt}). Error: ${errMsg}`);

          // Update local status with retry count and log message
          await db.runAsync(
            'UPDATE sync_queue SET attempts = ?, error_message = ? WHERE id = ?;',
            [nextAttempt, errMsg, item.id]
          );

          if (this.onQueueChangeCallback) {
            this.onQueueChangeCallback();
          }

          // CRITICAL: We stop processing the queue.
          // In Offline-First architectures, we MUST preserve serial ordering (FIFO).
          // Continuing would trigger failures in dependent rows (e.g. Vet Inspection for a Timing Record that wasn't created).
          console.warn('[SyncService] Order integrity block: Halting remaining sync operations.');
          break;
        }
      }
    } catch (error) {
      console.error('[SyncService] Operational database error during sync:', error);
    } finally {
      this.isSyncing = false;
      console.log('[SyncService] Sync cycle ended.');
    }
  }

  /**
   * Returns total size of the queue
   */
  async getQueueSize(): Promise<number> {
    try {
      const db = await getDatabase();
      const result = await db.getFirstAsync<{ count: number }>('SELECT COUNT(*) as count FROM sync_queue;');
      return result ? result.count : 0;
    } catch (e) {
      return 0;
    }
  }

  /**
   * Returns list of all pending items in the queue (useful for debug panels)
   */
  async getQueueItems(): Promise<SyncQueueItem[]> {
    try {
      const db = await getDatabase();
      return await db.getAllAsync<SyncQueueItem>('SELECT * FROM sync_queue ORDER BY id ASC;');
    } catch (e) {
      return [];
    }
  }

  /**
   * Force manual sync trigger
   */
  async forceSync(): Promise<void> {
    await this.syncPendingItems();
  }

  /**
   * Cleans the queue
   */
  async clearQueue(): Promise<void> {
    const db = await getDatabase();
    await db.runAsync('DELETE FROM sync_queue;');
    if (this.onQueueChangeCallback) {
      this.onQueueChangeCallback();
    }
  }
}

export default new SyncService();
