import useSWR from "swr";

export type CompetitionStatus =
  | "PLANNED"
  | "ACTIVE"
  | "PAUSED"
  | "COMPLETED"
  | "OFFICIAL"
  | "CANCELLED";

export interface Stage {
  id: string;
  stageNumber: number;
  distanceKm: number;
  neutralizationMinutes: number;
}

export interface Tenant {
  id: string;
  name: string;
  location?: string;
}

export interface CompetitionType {
  id: string;
  name: string;
  modality: "CONTROLLED_SPEED" | "FREE_SPEED" | "FLAT_RACING";
}

export interface Competition {
  id: string;
  name: string;
  competitionDate: string; // ISO Date String
  location: string;
  isFederated: boolean;
  maxHeartRate: number;
  status: CompetitionStatus;
  stages: Stage[];
  tenant?: Tenant;
  competitionType?: CompetitionType;
}

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3000";

// Fetcher optimizado con manejo de excepciones y estatus HTTP
const fetcher = async (path: string): Promise<Competition[]> => {
  const res = await fetch(`${API_BASE_URL}${path}`);
  if (!res.ok) {
    const errorInfo = await res.json().catch(() => ({}));
    const error = new Error(
      errorInfo?.message ||
        "Ocurrió un error al listar las competencias del servidor principal.",
    ) as any;
    error.status = res.status;
    error.info = errorInfo;
    throw error;
  }
  return res.json();
};

/**
 * MOCK DATA DE RESERVA:
 * Para cuando la API de desarrollo no está iniciada, permitiendo al usuario probar la interfaz premium.
 */
export const MOCK_COMPETITIONS: Competition[] = [
  {
    id: "c2000000-0000-0000-0000-000000000001",
    name: "71° Raid Hípico Batalla de Tupambaé",
    competitionDate: "2026-06-14T07:00:00Z",
    location: "Tupambaé, Cerro Largo",
    isFederated: true,
    maxHeartRate: 60,
    status: "ACTIVE",
    stages: [
      { id: "s1", stageNumber: 1, distanceKm: 40, neutralizationMinutes: 30 },
      { id: "s2", stageNumber: 2, distanceKm: 20, neutralizationMinutes: 0 },
    ],
    tenant: { id: "t1", name: "Club Social y Deportivo Tupambaé" },
    competitionType: {
      id: "ct1",
      name: "Raid de Velocidad Controlada (FEU)",
      modality: "CONTROLLED_SPEED",
    },
  },
  {
    id: "c2000000-0000-0000-0000-000000000002",
    name: "Raid Éxodo del Pueblo Oriental",
    competitionDate: "2026-06-28T08:00:00Z",
    location: "Cardona, Soriano",
    isFederated: true,
    maxHeartRate: 64,
    status: "PLANNED",
    stages: [
      { id: "s3", stageNumber: 1, distanceKm: 60, neutralizationMinutes: 40 },
      { id: "s4", stageNumber: 2, distanceKm: 30, neutralizationMinutes: 0 },
    ],
    tenant: { id: "t2", name: "Club Larrañaga de Cardona" },
    competitionType: {
      id: "ct2",
      name: "Endurance de Velocidad Libre (FEU)",
      modality: "FREE_SPEED",
    },
  },
  {
    id: "c2000000-0000-0000-0000-000000000003",
    name: "Raid Federal de San Ramón",
    competitionDate: "2026-05-17T07:30:00Z",
    location: "San Ramón, Canelones",
    isFederated: true,
    maxHeartRate: 60,
    status: "COMPLETED",
    stages: [
      { id: "s5", stageNumber: 1, distanceKm: 50, neutralizationMinutes: 30 },
      { id: "s6", stageNumber: 2, distanceKm: 30, neutralizationMinutes: 0 },
    ],
    tenant: { id: "t3", name: "Centro Unión de San Ramón" },
    competitionType: {
      id: "ct1",
      name: "Raid de Velocidad Controlada (FEU)",
      modality: "CONTROLLED_SPEED",
    },
  },
  {
    id: "c2000000-0000-0000-0000-000000000004",
    name: "Raid Hípico Grito de Asencio",
    competitionDate: "2026-04-12T08:00:00Z",
    location: "Mercedes, Soriano",
    isFederated: false,
    maxHeartRate: 65,
    status: "OFFICIAL",
    stages: [
      { id: "s7", stageNumber: 1, distanceKm: 55, neutralizationMinutes: 35 },
      { id: "s8", stageNumber: 2, distanceKm: 25, neutralizationMinutes: 0 },
    ],
    tenant: { id: "t4", name: "Sociedad Criolla La Tradición" },
    competitionType: {
      id: "ct1",
      name: "Raid de Velocidad Controlada (FEU)",
      modality: "CONTROLLED_SPEED",
    },
  },
];

/**
 * Hook useCompetitions
 * Recupera el listado completo de competencias vigentes (activas, planificadas, pasadas)
 * desde el backend NestJS con soporte de polling automático.
 */
export function useCompetitions() {
  const { data, error, isLoading, isValidating, mutate } = useSWR<
    Competition[]
  >("/admin/competitions", fetcher, {
    refreshInterval: 30000, // 30 segundos
    dedupingInterval: 4000,
    revalidateOnFocus: true,
  });

  return {
    competitions: data || [],
    error,
    isLoading,
    isValidating,
    mutate,
  };
}
