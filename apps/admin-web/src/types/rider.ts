export interface Rider {
  id: string;
  name: string;
  nationalId: string;
  feuId?: string;
  isFeuActive: boolean;
  birthDate?: string;
  medicalCardExpiration?: string;
  createdAt?: string;
}

export interface CreateRiderDto {
  name: string;
  nationalId: string;
  feuId?: string;
  isFeuActive?: boolean;
  birthDate?: string;
  medicalCardExpiration?: string;
}

export interface UpdateRiderDto extends Partial<CreateRiderDto> {}
