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
  location?: string;
  isFederated: boolean;
  maxHeartRate: number;
  status: string;
  stages: Stage[];
  createdAt?: string;
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
  location?: string;
  isFederated?: boolean;
  maxHeartRate?: number;
  status?: string;
  stages: CreateStageDto[];
}

export interface UpdateCompetitionDto extends Partial<CreateCompetitionDto> {}
