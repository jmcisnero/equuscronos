export interface Stage {
  id?: string;
  stageNumber: number;
  distanceKm: number;
  neutralizationMinutes: number;
}

export interface Competition {
  id: string;
  name: string;
  competitionDate: string;
  startTime: string;
  location?: string;
  isFederated: boolean;
  maxHeartRate: number;
  status: string;
  controlClosureTime?: string | null;
  stages: Stage[];
  createdAt?: string;
  tenant?: { id: string; name: string };
  competitionType?: { id: string; name: string };
}

export interface CreateStageDto {
  stageNumber: number;
  distanceKm: number;
  neutralizationMinutes?: number;
}

export interface CreateCompetitionDto {
  tenantId: string;
  competitionTypeId: string;
  name: string;
  competitionDate: string;
  startTime: string;
  location?: string;
  isFederated?: boolean;
  maxHeartRate?: number;
  status?: string;
  stages: CreateStageDto[];
}

export type UpdateCompetitionDto = Partial<CreateCompetitionDto>;
