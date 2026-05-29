import { User, CreateUserDto, UpdateUserDto } from '@/types/user';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000/admin';

export const UserService = {
  /**
   * Obtiene la lista completa de usuarios (operadores/jueces/veterinarios/staff).
   */
  async getAll(): Promise<User[]> {
    const url = `${API_URL}/users`;
    const response = await fetch(url);
    if (!response.ok) throw new Error('Error al cargar la lista de usuarios/staff');
    return response.json();
  },

  /**
   * Obtiene la ficha de un usuario específico por UUID.
   */
  async getById(id: string): Promise<User> {
    const url = `${API_URL}/users/${id}`;
    const response = await fetch(url);
    if (!response.ok) throw new Error('Error al obtener la información del usuario');
    return response.json();
  },

  /**
   * Crea una nueva cuenta de usuario asignando el rol y club correspondiente.
   */
  async create(dto: CreateUserDto): Promise<User> {
    const response = await fetch(`${API_URL}/users`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(dto),
    });
    if (!response.ok) {
      const err = await response.json();
      const friendlyMessage = Array.isArray(err.message)
        ? err.message.join('. ')
        : (err.message || 'Error al registrar el nuevo usuario');
      throw new Error(friendlyMessage);
    }
    return response.json();
  },

  /**
   * Actualiza el perfil de un usuario existente.
   */
  async update(id: string, dto: UpdateUserDto): Promise<User> {
    const response = await fetch(`${API_URL}/users/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(dto),
    });
    if (!response.ok) {
      const err = await response.json();
      const friendlyMessage = Array.isArray(err.message)
        ? err.message.join('. ')
        : (err.message || 'Error al actualizar el usuario');
      throw new Error(friendlyMessage);
    }
    return response.json();
  },

  /**
   * Elimina de forma definitiva la cuenta de un usuario.
   */
  async delete(id: string): Promise<void> {
    const response = await fetch(`${API_URL}/users/${id}`, {
      method: 'DELETE',
    });
    if (!response.ok) {
      const err = await response.json();
      throw new Error(err.message || 'Error al revocar el acceso del usuario');
    }
  }
};
