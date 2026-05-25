import { Owner } from '@/types/horse';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000/admin';

export const OwnerService = {
  /**
   * Obtiene todos los propietarios registrados, con soporte para búsqueda por texto.
   * Requerido para la trazabilidad y las planillas oficiales de la FEU.
   */
  async getAll(search?: string): Promise<Owner[]> {
    const url = search ? `${API_URL}/owners?search=${encodeURIComponent(search)}` : `${API_URL}/owners`;
    const response = await fetch(url);
    if (!response.ok) throw new Error('Error al cargar la lista de propietarios');
    return response.json();
  },

  /**
   * Crea un nuevo propietario de forma rápida en línea para simplificar el alta en el CRUD de caballos.
   */
  async create(name: string): Promise<Owner> {
    const response = await fetch(`${API_URL}/owners`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name }),
    });
    if (!response.ok) throw new Error('Error al registrar el nuevo propietario');
    return response.json();
  }
};
