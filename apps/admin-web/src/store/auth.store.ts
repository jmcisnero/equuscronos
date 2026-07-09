import { create } from "zustand";
import { persist } from "zustand/middleware";

export interface User {
  id: string;
  name: string;
  email: string;
  role: string;
  tenantId: string | null;
  tenant?: {
    id: string;
    name: string;
    location?: string;
    federationNumber?: number;
    jerseyImageUrl?: string;
  } | null;
}

interface AuthState {
  accessToken: string | null;
  user: User | null;
  tenantId: string | null;
  setAuth: (accessToken: string, user: User) => void;
  logout: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      accessToken: null,
      user: null,
      tenantId: null,
      setAuth: (accessToken, user) => {
        // Seteamos la cookie para el middleware del servidor
        if (typeof window !== "undefined") {
          document.cookie = `session-token=${accessToken}; path=/; max-age=604800; SameSite=Lax`;
        }
        set({ accessToken, user, tenantId: user.tenantId });
      },
      logout: () => {
        // Eliminamos la cookie de sesión
        if (typeof window !== "undefined") {
          document.cookie =
            "session-token=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT; SameSite=Lax";
        }
        set({ accessToken: null, user: null, tenantId: null });
      },
    }),
    {
      name: "equuscronos-auth-storage",
    },
  ),
);
