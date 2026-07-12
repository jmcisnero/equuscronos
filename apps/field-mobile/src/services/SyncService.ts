import NetInfo from "@react-native-community/netinfo";
import { getDatabase } from "../database/db";
import { SyncQueueItem } from "../database/schema";
import ApiService from "./ApiService";

class SyncService {
  private isSyncing = false;
  private isConnected = true;
  private statusListeners = new Set<(connected: boolean) => void>();
  private queueListeners = new Set<() => void>();
  private lastAttemptTimes = new Map<number, number>();
  private retryTimeout: any = null;

  private get onStatusChangeCallback() {
    return (connected: boolean) => {
      this.statusListeners.forEach((listener) => {
        try {
          listener(connected);
        } catch (e) {
          console.error("[SyncService] Status listener error:", e);
        }
      });
    };
  }

  private get onQueueChangeCallback() {
    return () => {
      this.queueListeners.forEach((listener) => {
        try {
          listener();
        } catch (e) {
          console.error("[SyncService] Queue listener error:", e);
        }
      });
    };
  }

  private getBackoffDelay(attempts: number): number {
    // Delay = 2^attempts * 1000 ms, capped at 60s
    return Math.min(Math.pow(2, attempts) * 1000, 60000);
  }

  constructor() {
    // Monitor real-time connection status
    NetInfo.addEventListener((state) => {
      const wasOffline = !this.isConnected;
      this.isConnected = state.isConnected ?? false;

      console.log(
        `[SyncService] Connection State: ${this.isConnected ? "ONLINE" : "OFFLINE"}`,
      );

      if (this.onStatusChangeCallback) {
        this.onStatusChangeCallback(this.isConnected);
      }

      // If transition from OFFLINE -> ONLINE, fire sync queue automatically
      if (this.isConnected && wasOffline) {
        console.log(
          "[SyncService] Internet re-established. Initiating automatic sync...",
        );
        this.syncPendingItems().catch((err) => {
          console.error("[SyncService] Auto-sync failed:", err);
        });
      }
    });
  }

  /**
   * Set callback to update UI when network state changes
   */
  registerStatusListener(callback: (connected: boolean) => void): () => void {
    this.statusListeners.add(callback);
    // Initial call
    callback(this.isConnected);
    return () => {
      this.statusListeners.delete(callback);
    };
  }

  /**
   * Set callback to refresh UI when queue changes
   */
  registerQueueListener(callback: () => void): () => void {
    this.queueListeners.add(callback);
    return () => {
      this.queueListeners.delete(callback);
    };
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
    actionType:
      | "CREATE_TIMING"
      | "CREATE_VET_INSPECTION"
      | "UPDATE_ENTRY_STATUS"
      | "UPDATE_TIMING"
      | "VOID_TIMING",
    tableName: "timing_records" | "vet_inspections" | "competition_entries",
    payload: any,
  ): Promise<void> {
    try {
      const db = await getDatabase();
      const payloadString = JSON.stringify(payload);
      const now = new Date().toISOString();

      await db.runAsync(
        `INSERT INTO sync_queue (action_type, table_name, payload, created_at, attempts)
         VALUES (?, ?, ?, ?, 0);`,
        [actionType, tableName, payloadString, now],
      );

      console.log(`[SyncQueue] Action '${actionType}' stored locally.`);

      if (this.onQueueChangeCallback) {
        this.onQueueChangeCallback();
      }

      // Attempt to sync immediately if online
      if (this.isConnected) {
        this.syncPendingItems().catch((err) => {
          console.error(
            "[SyncQueue] Immediate sync failed, will retry later:",
            err,
          );
        });
      }
    } catch (error) {
      console.error("[SyncQueue] Error enqueuing action:", error);
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
      console.log("[SyncService] Cannot sync: currently OFFLINE.");
      return;
    }

    if (this.retryTimeout) {
      clearTimeout(this.retryTimeout);
      this.retryTimeout = null;
    }

    this.isSyncing = true;
    console.log("[SyncService] Commencing sync queue verification...");

    try {
      const db = await getDatabase();

      // Select queued items sorted chronologically (ascending ID)
      const pending = await db.getAllAsync<SyncQueueItem>(
        "SELECT * FROM sync_queue ORDER BY id ASC;",
      );

      if (pending.length === 0) {
        console.log("[SyncService] No pending items in sync queue.");
        this.isSyncing = false;
        return;
      }

      console.log(`[SyncService] ${pending.length} pending items found.`);

      for (const item of pending) {
        // Exponential backoff check
        if (item.attempts > 0) {
          const lastAttempt = this.lastAttemptTimes.get(item.id) || 0;
          const delay = this.getBackoffDelay(item.attempts);
          const nextAllowedTime = lastAttempt + delay;
          if (Date.now() < nextAllowedTime) {
            const remainingDelay = nextAllowedTime - Date.now();
            console.log(
              `[SyncService] Item #${item.id} is in backoff window. Skipping remaining queue to preserve order. Next retry in ${Math.round(remainingDelay / 1000)}s`,
            );
            if (!this.retryTimeout) {
              this.retryTimeout = setTimeout(
                () => {
                  this.syncPendingItems().catch((err) =>
                    console.error("[SyncService] Retry trigger failed:", err),
                  );
                },
                Math.max(remainingDelay, 100),
              );
            }
            break;
          }
        }

        try {
          const payload = JSON.parse(item.payload);

          // Distribute action to corresponding Api endpoint
          let responseData: any = null;
          switch (item.action_type) {
            case "CREATE_TIMING":
              responseData = await ApiService.syncTimingRecord(payload);
              if (responseData && responseData.id) {
                const newId = responseData.id;
                const oldId = payload.id;

                console.log(
                  `[SyncService] Propagating new ID from backend: ${oldId} -> ${newId}`,
                );

                // Update SQLite database (temporarily disabling foreign keys to avoid violations)
                await db.execAsync("PRAGMA foreign_keys = OFF;");
                await db.runAsync(
                  "UPDATE vet_inspections SET timing_record_id = ? WHERE timing_record_id = ?;",
                  [newId, oldId],
                );
                await db.runAsync(
                  "UPDATE timing_records SET id = ? WHERE id = ?;",
                  [newId, oldId],
                );
                await db.execAsync("PRAGMA foreign_keys = ON;");

                // Update remaining items in the sync queue that reference this ID
                const remainingItems = await db.getAllAsync<SyncQueueItem>(
                  "SELECT * FROM sync_queue WHERE id > ?;",
                  [item.id],
                );
                for (const remaining of remainingItems) {
                  let remPayload = JSON.parse(remaining.payload);
                  let changed = false;

                  if (remPayload.timingRecordId === oldId) {
                    remPayload.timingRecordId = newId;
                    changed = true;
                  }
                  if (remPayload.timing_record_id === oldId) {
                    remPayload.timing_record_id = newId;
                    changed = true;
                  }
                  if (remPayload.id === oldId) {
                    remPayload.id = newId;
                    changed = true;
                  }

                  if (changed) {
                    await db.runAsync(
                      "UPDATE sync_queue SET payload = ? WHERE id = ?;",
                      [JSON.stringify(remPayload), remaining.id],
                    );
                  }
                }
              }
              break;
            case "CREATE_VET_INSPECTION":
              await ApiService.syncVetInspection(payload);
              break;
            case "UPDATE_ENTRY_STATUS":
              await ApiService.syncEntryStatus(payload.id, payload.status);
              break;
            case "UPDATE_TIMING":
              await ApiService.updateTimingRecord(payload.id, {
                recordedAt: payload.recordedAt,
              });
              break;
            case "VOID_TIMING":
              await ApiService.voidTimingRecord(payload.id, {
                voidReason: payload.voidReason,
              });
              break;
            default:
              throw new Error(
                `Unsupported sync action type: ${item.action_type}`,
              );
          }

          // Successfully synced -> Remove from queue
          await db.runAsync("DELETE FROM sync_queue WHERE id = ?;", [item.id]);
          console.log(
            `[SyncService] Synced item #${item.id} (${item.action_type}) successfully.`,
          );

          if (this.onQueueChangeCallback) {
            this.onQueueChangeCallback();
          }
        } catch (error: any) {
          const apiErrorData = error?.response?.data;
          const apiErrorMsg = apiErrorData?.message || apiErrorData;
          const errMsg = apiErrorMsg
            ? `${error.message} - API Response: ${JSON.stringify(apiErrorMsg)}`
            : error?.message || "Network endpoint unreachable";
          const nextAttempt = item.attempts + 1;

          console.error(
            `[SyncService] Synchronization failed for item #${item.id} (Attempt ${nextAttempt}). Error: ${errMsg}`,
          );

          // Track the attempt timestamp in memory
          this.lastAttemptTimes.set(item.id, Date.now());

          // Update local status with retry count and log message
          await db.runAsync(
            "UPDATE sync_queue SET attempts = ?, error_message = ? WHERE id = ?;",
            [nextAttempt, errMsg, item.id],
          );

          if (this.onQueueChangeCallback) {
            this.onQueueChangeCallback();
          }

          // Schedule a retry after backoff delay
          const delay = this.getBackoffDelay(nextAttempt);
          console.log(
            `[SyncService] Scheduling retry in ${delay / 1000}s due to error.`,
          );
          if (this.retryTimeout) {
            clearTimeout(this.retryTimeout);
          }
          this.retryTimeout = setTimeout(() => {
            this.syncPendingItems().catch((err) =>
              console.error("[SyncService] Retry trigger failed:", err),
            );
          }, delay);

          // CRITICAL: We stop processing the queue.
          // In Offline-First architectures, we MUST preserve serial ordering (FIFO).
          // Continuing would trigger failures in dependent rows (e.g. Vet Inspection for a Timing Record that wasn't created).
          console.warn(
            "[SyncService] Order integrity block: Halting remaining sync operations.",
          );
          break;
        }
      }
    } catch (error) {
      console.error(
        "[SyncService] Operational database error during sync:",
        error,
      );
    } finally {
      this.isSyncing = false;
      console.log("[SyncService] Sync cycle ended.");
    }
  }

  /**
   * Returns total size of the queue
   */
  async getQueueSize(): Promise<number> {
    try {
      const db = await getDatabase();
      const result = await db.getFirstAsync<{ count: number }>(
        "SELECT COUNT(*) as count FROM sync_queue;",
      );
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
      return await db.getAllAsync<SyncQueueItem>(
        "SELECT * FROM sync_queue ORDER BY id ASC;",
      );
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
   * Reset attempts and error message for a specific queue item and trigger sync
   */
  async resetItemAndSync(id: number): Promise<void> {
    try {
      const db = await getDatabase();
      await db.runAsync(
        "UPDATE sync_queue SET attempts = 0, error_message = NULL WHERE id = ?;",
        [id],
      );
      this.lastAttemptTimes.delete(id);
      if (this.onQueueChangeCallback) {
        this.onQueueChangeCallback();
      }
      // Force sync immediately
      await this.syncPendingItems();
    } catch (e) {
      console.error("[SyncService] Error resetting item:", e);
      throw e;
    }
  }

  /**
   * Discards a specific queue item
   */
  async discardItem(id: number): Promise<void> {
    try {
      const db = await getDatabase();
      await db.runAsync("DELETE FROM sync_queue WHERE id = ?;", [id]);
      this.lastAttemptTimes.delete(id);
      if (this.onQueueChangeCallback) {
        this.onQueueChangeCallback();
      }
    } catch (e) {
      console.error("[SyncService] Error discarding item:", e);
      throw e;
    }
  }

  /**
   * Cleans the queue
   */
  async clearQueue(): Promise<void> {
    const db = await getDatabase();
    await db.runAsync("DELETE FROM sync_queue;");
    if (this.onQueueChangeCallback) {
      this.onQueueChangeCallback();
    }
  }
}

export default new SyncService();
