export interface Tenant {
  id: string;
  name: string;
  location?: string;
  jerseyImageUrl?: string;
  federationNumber?: number;
}

export interface Competition {
  id: string;
  name: string;
  competitionDate: string;
  location?: string;
  status: "PLANNED" | "ACTIVE" | "PAUSED" | "COMPLETED" | "OFFICIAL" | "CANCELLED";
  maxHeartRate?: number;
  enableRfidChips?: boolean;
  isFederated?: boolean;
  tenant?: Tenant;
  stagesCount?: number;
}

export interface StageDetail {
  stageNumber: number;
  distanceKm: number;
  startTime?: string;
  arrivalTime?: string;
  vetInTime?: string;
  heartRate?: number;
  isRecheck?: boolean;
  recheckStatus?: "PENDING" | "PASSED" | "OBSERVED" | "FAILED" | null;
  netTimeMs?: number;
  averageSpeed?: number;
}

export interface LeaderboardEntry {
  rank: number | null;
  bibNumber: number;
  riderName: string;
  horseName: string;
  status:
    | "IN_RACE"
    | "VET_CHECK"
    | "RESTING"
    | "FINISHED"
    | "DQ"
    | "DNF"
    | "WD"
    | "NO_COMPLETED"
    | "FINISHED_PROVISIONAL";
  currentStage: number;
  lastArrivalTime?: string;
  nextVetControlTime?: string;
  totalRaceTimeMs: number;
  gapToLeaderMs: number;
  averageSpeed: number;
  heartRate?: number;
  isRecheck?: boolean;
  recheckStatus?: "PENDING" | "PASSED" | "OBSERVED" | "FAILED" | null;
  nextStageDepartureTime?: string;
  startTime?: string;
  arrivalTime?: string;
  vetInTime?: string;
  completedStages?: number;
  representedTenant?: Tenant | null;
  stages?: StageDetail[];
}

export interface UserProfile {
  id: string;
  name: string;
  email: string;
  role: string;
  isGuest: boolean;
  optInMarketing: boolean;
  tenantId?: string | null;
}

export interface CompetitionSubscription {
  id: string;
  competitionId: string;
  notifyStatusChange: boolean;
  notifyStageStart: boolean;
  notifyVetGate: boolean;
  notifyOfficialResults: boolean;
  competition?: Competition;
}
