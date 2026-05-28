import axios, { AxiosInstance } from 'axios';
import { LocalTimingRecord, LocalVetInspection } from '../database/schema';

// API BASE URL - In production, this would be an environment variable.
// In Expo, localhost refers to the emulator, so we target a common development IP or a fallback.
const API_BASE_URL = 'https://api.equuscronos.com/api'; // Or your local API e.g. 'http://10.0.2.2:3000/api' for Android emulator

class ApiService {
  private client: AxiosInstance;

  constructor() {
    this.client = axios.create({
      baseURL: API_BASE_URL,
      timeout: 10000,
      headers: {
        'Content-Type': 'application/json',
        // In a real application, we would retrieve these from a secure store (e.g. expo-secure-store)
        'x-tenant-id': '77777777-7777-7777-7777-777777777777',
      },
    });

    // Request interceptor to attach JWT token
    this.client.interceptors.request.use(
      async (config) => {
        // Retrieve bearer token from local storage/secure storage here
        // const token = await SecureStore.getItemAsync('user_token');
        // if (token) {
        //   config.headers.Authorization = `Bearer ${token}`;
        // }
        return config;
      },
      (error) => Promise.reject(error)
    );
  }

  /**
   * Syncs a timing record to the backend Postgres DB
   */
  async syncTimingRecord(record: LocalTimingRecord): Promise<void> {
    // Map SQLite boolean representations (0/1) back to backend format
    const payload = {
      ...record,
      is_approved: record.is_approved === 1,
      is_void: record.is_void === 1,
    };
    
    await this.client.post('/timing/sync', payload);
  }

  /**
   * Syncs a vet inspection record to the backend Postgres DB
   */
  async syncVetInspection(inspection: LocalVetInspection): Promise<void> {
    const payload = {
      ...inspection,
      is_recheck_required: inspection.is_recheck_required === 1,
    };

    await this.client.post('/vet-inspections/sync', payload);
  }

  /**
   * Syncs a competition entry status update to the backend Postgres DB
   */
  async syncEntryStatus(entryId: string, status: string): Promise<void> {
    await this.client.patch(`/competition-entries/${entryId}/status`, { status });
  }

  /**
   * Fetches latest entries from backend to update local cache
   */
  async fetchLatestEntries(competitionId: string): Promise<any[]> {
    const response = await this.client.get(`/competitions/${competitionId}/entries`);
    return response.data;
  }
}

export default new ApiService();
