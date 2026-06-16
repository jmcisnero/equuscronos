import { UserRole } from "@equuscronos/shared";
import { Tenant } from "./tenant";

export interface User {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  tenant?: Tenant | null;
  createdAt?: string;
}

export interface CreateUserDto {
  name: string;
  email: string;
  role: UserRole;
  tenantId?: string | null;
  passwordHash?: string; // Standard password parameter for creation
}

export interface UpdateUserDto {
  name?: string;
  email?: string;
  role?: UserRole;
  tenantId?: string | null;
  passwordHash?: string;
}
