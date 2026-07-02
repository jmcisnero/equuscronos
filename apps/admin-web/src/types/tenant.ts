export interface Tenant {
  id: string;
  name: string;
  location?: string;
  federationNumber?: number;
  jerseyImageUrl?: string;
  createdAt?: string;
}

export interface CreateTenantDto {
  name: string;
  location?: string;
  federationNumber?: number;
  jerseyImageUrl?: string;
}

export interface UpdateTenantDto {
  name?: string;
  location?: string;
  federationNumber?: number;
  jerseyImageUrl?: string;
}
