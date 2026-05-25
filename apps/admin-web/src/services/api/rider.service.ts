import { Rider, CreateRiderDto, UpdateRiderDto } from '@/types/rider';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000/admin';

export const RiderService = {
  /**
   * Obtiene todos los jinetes registrados, con soporte para búsqueda global (Omni-Search).
   * Requerido por la FEU para auditoría de padrón nacional e inmutabilidad de fechas.
   */
  async getAll(search?: string): Promise<Rider[]> {
    const url = search ? `${API_URL}/riders?search=${encodeURIComponent(search)}` : `${API_URL}/riders`;
    const response = await fetch(url);
    if (!response.ok) throw new Error('Error al cargar la lista de jinetes');
    return response.json();
  },

  /**
   * Obtiene un jinete por su identificador único UUID.
   */
  async getById(id: string): Promise<Rider> {
    const response = await fetch(`${API_URL}/riders/${id}`);
    if (!response.ok) throw new Error('Error al obtener el jinete especificado');
    return response.json();
  },

  /**
   * Registra un nuevo jinete en el padrón oficial de la FEU.
   */
  async create(dto: CreateRiderDto): Promise<Rider> {
    const response = await fetch(`${API_URL}/riders`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(dto),
    });
    if (!response.ok) {
      const err = await response.json();
      throw new Error(err.message || 'Error al registrar el nuevo jinete');
    }
    return response.json();
  },

  /**
   * Modifica los datos de un jinete existente.
   */
  async update(id: string, dto: UpdateRiderDto): Promise<Rider> {
    const response = await fetch(`${API_URL}/riders/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(dto),
    });
    if (!response.ok) {
      const err = await response.json();
      throw new Error(err.message || 'Error al actualizar el jinete');
    }
    return response.json();
  },

  /**
   * Elimina un jinete de forma definitiva de la base de datos.
   */
  async delete(id: string): Promise<void> {
    const response = await fetch(`${API_URL}/riders/${id}`, {
      method: 'DELETE',
    });
    if (!response.ok) {
      const err = await response.json();
      throw new Error(err.message || 'Error al eliminar el jinete');
    }
  }
};
