export interface Tenant {
  id: string;
  name: string;
  location?: string;
  createdAt?: string;
}

export interface CreateTenantDto {
  name: string;
  location?: string;
}

export interface UpdateTenantDto {
  name?: string;
  location?: string;
}
