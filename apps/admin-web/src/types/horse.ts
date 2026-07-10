export interface Owner {
  id: string;
  name: string;
}

export interface Horse {
  id: string;
  name: string;
  feuId?: string;
  chipId?: string;
  isFeuActive: boolean;
  healthRecordsExpiration?: string | null;
  birthDate?: string;
  imageUrl?: string;
  createdAt: string;
  owner?: Owner;
}

export interface CreateHorseDto {
  name: string;
  feuId?: string;
  chipId?: string;
  isFeuActive?: boolean;
  healthRecordsExpiration?: string | null;
  birthDate?: string;
  imageUrl?: string;
  // El propietario es requerido para la trazabilidad y las planillas oficiales de la FEU
  ownerId: string;
}

export interface UpdateHorseDto extends Partial<CreateHorseDto> {}
