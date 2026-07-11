import { OwnerType } from "@equuscronos/shared";

export { OwnerType };

export interface Owner {
  id: string;
  name: string;
  type: OwnerType;
  contactInfo?: string;
  createdAt?: string;
}

export interface CreateOwnerDto {
  name: string;
  type?: OwnerType;
  contactInfo?: string;
}

export interface UpdateOwnerDto extends Partial<CreateOwnerDto> {}
