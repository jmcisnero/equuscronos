import { CompetitionEntry, CreateCompetitionEntryDto, UpdateCompetitionEntryDto } from '@/types/competition-entry';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000/admin';

export const CompetitionEntryService = {
  /**
   * Obtiene la Start List (inscripciones de binomios) de una competencia.
   */
  async getAllByCompetition(competitionId: string): Promise<CompetitionEntry[]> {
    const url = `${API_URL}/entries?competitionId=${encodeURIComponent(competitionId)}`;
    const response = await fetch(url);
    if (!response.ok) {
      const err = await response.json();
      throw new Error(err.message || 'Error al cargar la Start-List');
    }
    return response.json();
  },

  /**
   * Obtiene una inscripción por su ID único.
   */
  async getById(id: string): Promise<CompetitionEntry> {
    const response = await fetch(`${API_URL}/entries/${id}`);
    if (!response.ok) {
      const err = await response.json();
      throw new Error(err.message || 'Error al obtener la inscripción');
    }
    return response.json();
  },

  /**
   * Inscribe un nuevo binomio (crea una inscripción).
   * Puede retornar 409 Conflict si el dorsal está duplicado en la carrera.
   */
  async create(dto: CreateCompetitionEntryDto): Promise<CompetitionEntry> {
    const response = await fetch(`${API_URL}/entries`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(dto),
    });

    if (!response.ok) {
      let errMessage = 'Error al registrar el binomio';
      try {
        const err = await response.json();
        // Si es 409 Conflict o tiene un mensaje de error
        if (response.status === 409) {
          throw { status: 409, message: err.message || 'Conflicto de unicidad al registrar binomio' };
        }
        errMessage = err.message || errMessage;
      } catch (e: any) {
        if (e.status === 409) throw e;
      }
      throw new Error(errMessage);
    }
    return response.json();
  },

  /**
   * Actualiza una inscripción existente.
   */
  async update(id: string, dto: UpdateCompetitionEntryDto): Promise<CompetitionEntry> {
    const response = await fetch(`${API_URL}/entries/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(dto),
    });

    if (!response.ok) {
      const err = await response.json();
      if (response.status === 409) {
        throw { status: 409, message: err.message || 'Dorsal duplicado o conflicto de unicidad' };
      }
      throw new Error(err.message || 'Error al actualizar la inscripción');
    }
    return response.json();
  },

  /**
   * Elimina una inscripción de la carrera (baja voluntaria / previo a largar).
   */
  async delete(id: string): Promise<void> {
    const response = await fetch(`${API_URL}/entries/${id}`, {
      method: 'DELETE',
    });
    if (!response.ok) {
      const err = await response.json();
      throw new Error(err.message || 'Error al dar de baja la inscripción');
    }
  }
};
