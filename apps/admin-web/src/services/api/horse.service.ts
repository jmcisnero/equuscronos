import { Horse, CreateHorseDto, UpdateHorseDto } from '@/types/horse';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000/admin';

export const HorseService = {
  async getAll(search?: string): Promise<Horse[]> {
    const url = search ? `${API_URL}/horses?q=${encodeURIComponent(search)}` : `${API_URL}/horses`;
    const response = await fetch(url);
    if (!response.ok) throw new Error('Error al cargar la lista de caballos');
    return response.json();
  },

  async getById(id: string): Promise<Horse> {
    const response = await fetch(`${API_URL}/horses/${id}`);
    if (!response.ok) throw new Error('Error al cargar los datos del caballo');
    return response.json();
  },

  async create(data: CreateHorseDto): Promise<Horse> {
    const response = await fetch(`${API_URL}/horses`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (!response.ok) throw new Error('Error al registrar el caballo');
    return response.json();
  },

  async update(id: string, data: UpdateHorseDto): Promise<Horse> {
    const response = await fetch(`${API_URL}/horses/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (!response.ok) throw new Error('Error al actualizar el caballo');
    return response.json();
  },

  async delete(id: string): Promise<void> {
    const response = await fetch(`${API_URL}/horses/${id}`, {
      method: 'DELETE',
    });
    if (!response.ok) throw new Error('Error al dar de baja el caballo');
  }
};
