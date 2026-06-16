import {
  CompetitionType,
  CreateCompetitionTypeDto,
  UpdateCompetitionTypeDto,
} from "@/types/competition-type";

const API_URL =
  process.env.NEXT_PUBLIC_API_URL || "http://localhost:3000/admin";

export const CompetitionTypeService = {
  /**
   * Obtiene todas las modalidades de competencia (plantillas de reglas).
   */
  async getAll(): Promise<CompetitionType[]> {
    const url = `${API_URL}/competition-types`;
    const response = await fetch(url);
    if (!response.ok)
      throw new Error("Error al cargar la lista de modalidades de competencia");
    return response.json();
  },

  /**
   * Obtiene una modalidad por ID.
   */
  async getById(id: string): Promise<CompetitionType> {
    const url = `${API_URL}/competition-types/${id}`;
    const response = await fetch(url);
    if (!response.ok)
      throw new Error("Error al obtener la modalidad de competencia");
    return response.json();
  },

  /**
   * Registra una nueva modalidad de competencia.
   */
  async create(dto: CreateCompetitionTypeDto): Promise<CompetitionType> {
    const response = await fetch(`${API_URL}/competition-types`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(dto),
    });
    if (!response.ok) {
      const err = await response.json();
      const friendlyMessage = Array.isArray(err.message)
        ? err.message.join(". ")
        : err.message || "Error al registrar la nueva modalidad";
      throw new Error(friendlyMessage);
    }
    return response.json();
  },

  /**
   * Modifica una modalidad existente.
   */
  async update(
    id: string,
    dto: UpdateCompetitionTypeDto,
  ): Promise<CompetitionType> {
    const response = await fetch(`${API_URL}/competition-types/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(dto),
    });
    if (!response.ok) {
      const err = await response.json();
      const friendlyMessage = Array.isArray(err.message)
        ? err.message.join(". ")
        : err.message || "Error al actualizar la modalidad";
      throw new Error(friendlyMessage);
    }
    return response.json();
  },

  /**
   * Elimina una modalidad de forma definitiva.
   */
  async delete(id: string): Promise<void> {
    const response = await fetch(`${API_URL}/competition-types/${id}`, {
      method: "DELETE",
    });
    if (!response.ok) {
      const err = await response.json();
      throw new Error(
        err.message || "Error al eliminar la modalidad de competencia",
      );
    }
  },
};
