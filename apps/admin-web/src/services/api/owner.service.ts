import { Owner, CreateOwnerDto, UpdateOwnerDto } from '@/types/owner';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000/admin';

export const OwnerService = {
  /**
   * Obtiene todos los propietarios registrados, con soporte para búsqueda por texto (Omni-Search).
   * Requerido para la trazabilidad y las planillas oficiales de la FEU.
   */
  async getAll(search?: string): Promise<Owner[]> {
    const url = search ? `${API_URL}/owners?search=${encodeURIComponent(search)}` : `${API_URL}/owners`;
    const response = await fetch(url);
    if (!response.ok) throw new Error('Error al cargar la lista de propietarios');
    return response.json();
  },

  /**
   * Obtiene un propietario por su identificador único UUID.
   */
  async getById(id: string): Promise<Owner> {
    const response = await fetch(`${API_URL}/owners/${id}`);
    if (!response.ok) throw new Error('Error al obtener el propietario especificado');
    return response.json();
  },

  /**
   * Registra un nuevo propietario. Soporta tanto un DTO completo (para el CRUD principal)
   * como un string simple con el nombre (para el alta rápida inline en el formulario de caballos).
   */
  async create(dtoOrName: CreateOwnerDto | string): Promise<Owner> {
    const payload = typeof dtoOrName === 'string' ? { name: dtoOrName } : dtoOrName;
    const response = await fetch(`${API_URL}/owners`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (!response.ok) {
      const err = await response.json();
      throw new Error(err.message || 'Error al registrar el nuevo propietario');
    }
    return response.json();
  },

  /**
   * Actualiza los datos de un propietario existente.
   */
  async update(id: string, dto: UpdateOwnerDto): Promise<Owner> {
    const response = await fetch(`${API_URL}/owners/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(dto),
    });
    if (!response.ok) {
      const err = await response.json();
      throw new Error(err.message || 'Error al actualizar el propietario');
    }
    return response.json();
  },

  /**
   * Elimina de forma definitiva un propietario.
   */
  async delete(id: string): Promise<void> {
    const response = await fetch(`${API_URL}/owners/${id}`, {
      method: 'DELETE',
    });
    if (!response.ok) {
      const err = await response.json();
      throw new Error(err.message || 'Error al eliminar el propietario');
    }
  }
};
