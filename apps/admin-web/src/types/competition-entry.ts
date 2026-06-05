import { Rider } from './rider';
import { Horse } from './horse';
import { Tenant } from './tenant';

export interface CompetitionEntry {
  id: string;
  bibNumber: number;
  status: string;
  qualifiesForPoints?: boolean;
  ballastWeight: number;
  riderWeight?: number;
  tackWeight?: number;
  sealedItems?: string[];
  sealNumber?: string;
  weighInAt?: string;
  rider: Rider;
  horse: Horse;
  representedTenant?: Tenant;
  createdAt?: string;
  updatedAt?: string;
}

export interface CreateCompetitionEntryDto {
  competitionId: string;
  riderId: string;
  horseId: string;
  representedTenantId?: string;
  bibNumber: number;
  qualifiesForPoints?: boolean;
  ballastWeight?: number;
  riderWeight?: number;
  tackWeight?: number;
  sealedItems?: string[];
  sealNumber?: string;
  weighInAt?: string;
}

export interface UpdateCompetitionEntryDto extends Partial<CreateCompetitionEntryDto> {
  status?: string;
  finalPosition?: number;
  currentStageId?: string;
}
