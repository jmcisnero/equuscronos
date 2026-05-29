import { Competition, CreateCompetitionDto, UpdateCompetitionDto } from '@/types/competition';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000/admin';

export const CompetitionService = {
  /**
   * Obtiene todas las competencias registradas.
   * Admite un filtro opcional para búsqueda global en el frontend.
   */
  async getAll(search?: string): Promise<Competition[]> {
    const url = search ? `${API_URL}/competitions?search=${encodeURIComponent(search)}` : `${API_URL}/competitions`;
    const response = await fetch(url);
    if (!response.ok) throw new Error('Error al cargar la lista de competencias');
    return response.json();
  },

  /**
   * Obtiene el detalle de una competencia específica por UUID.
   */
  async getById(id: string): Promise<Competition> {
    const response = await fetch(`${API_URL}/competitions/${id}`);
    if (!response.ok) throw new Error('Error al obtener la competencia especificada');
    return response.json();
  },

  /**
   * Crea una nueva competencia con sus etapas correspondientes en una transacción SQL anidada.
   */
  async create(dto: CreateCompetitionDto): Promise<Competition> {
    const response = await fetch(`${API_URL}/competitions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(dto),
    });
    if (!response.ok) {
      const err = await response.json();
      console.error('NestJS API validation error response:', err);
      const friendlyMessage = Array.isArray(err.message)
        ? err.message.join('. ')
        : (err.message || 'Error al registrar la nueva competencia');
      const customError = new Error(friendlyMessage) as any;
      customError.response = err;
      throw customError;
    }
    return response.json();
  },

  /**
   * Actualiza la configuración de una competencia existente.
   */
  async update(id: string, dto: UpdateCompetitionDto): Promise<Competition> {
    const response = await fetch(`${API_URL}/competitions/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(dto),
    });
    if (!response.ok) {
      const err = await response.json();
      const friendlyMessage = Array.isArray(err.message)
        ? err.message.join('. ')
        : (err.message || 'Error al actualizar la competencia');
      throw new Error(friendlyMessage);
    }
    return response.json();
  },

  /**
   * Elimina una competencia del sistema (si no tiene inscripciones operativas).
   */
  async delete(id: string): Promise<void> {
    const response = await fetch(`${API_URL}/competitions/${id}`, {
      method: 'DELETE',
    });
    if (!response.ok) {
      const err = await response.json();
      throw new Error(err.message || 'Error al eliminar la competencia');
    }
  }
};
