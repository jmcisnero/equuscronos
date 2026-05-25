"use client";

import React, { useState, useEffect } from 'react';
import { CreateHorseDto, UpdateHorseDto, Horse, Owner } from '@/types/horse';
import { OwnerService } from '@/services/api/owner.service';

interface HorseFormProps {
  initialData?: Horse | null;
  onSubmit: (data: CreateHorseDto | UpdateHorseDto) => Promise<void>;
  onCancel: () => void;
}

export const HorseForm: React.FC<HorseFormProps> = ({ initialData, onSubmit, onCancel }) => {
  // Estados para búsqueda asíncrona y autocompletado
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedOwnerName, setSelectedOwnerName] = useState('');
  const [owners, setOwners] = useState<Owner[]>([]);
  const [isLoadingOwners, setIsLoadingOwners] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);

  // Evitar conflictos entre transiciones de desenfoque (blur) y creación asíncrona en red (REST)
  const isCreatingOwnerRef = React.useRef(false);

  const [formData, setFormData] = useState<CreateHorseDto>({
    name: '',
    feuId: '',
    chipId: '',
    isFeuActive: false,
    healthRecordsExpiration: '',
    ownerId: '', // Propietario legal obligatorio para trazabilidad FEU
  });
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Implementación del buscador asíncrono con Debounce (300ms)
  // Requerido para evitar saturación de la API de propietarios en consultas repetidas
  useEffect(() => {
    if (searchTerm === selectedOwnerName) {
      return; // Si coincide con la selección actual, evitamos repetición de consulta
    }

    const delayDebounceFn = setTimeout(async () => {
      if (searchTerm.trim() === '') {
        setOwners([]);
        return;
      }

      setIsLoadingOwners(true);
      try {
        const data = await OwnerService.getAll(searchTerm);
        setOwners(data);
      } catch (error) {
        console.error('Error al realizar búsqueda asíncrona de propietarios:', error);
      } finally {
        setIsLoadingOwners(false);
      }
    }, 300);

    return () => clearTimeout(delayDebounceFn);
  }, [searchTerm, selectedOwnerName]);

  // Sincronización inicial de datos para edición de caballos
  useEffect(() => {
    if (initialData) {
      let dateValue = '';
      if (initialData.healthRecordsExpiration) {
        const dateStr = initialData.healthRecordsExpiration;
        dateValue = typeof dateStr === 'string' && /^\d{4}-\d{2}-\d{2}/.test(dateStr)
          ? dateStr.substring(0, 10)
          : new Date(dateStr).toISOString().split('T')[0];
      }

      setFormData({
        name: initialData.name,
        feuId: initialData.feuId || '',
        chipId: initialData.chipId || '',
        isFeuActive: initialData.isFeuActive,
        healthRecordsExpiration: dateValue,
        ownerId: initialData.owner?.id || '',
      });

      if (initialData.owner) {
        setSearchTerm(initialData.owner.name);
        setSelectedOwnerName(initialData.owner.name);
      }
    }
  }, [initialData]);

  // Carga previa de sugerencias iniciales al enfocar el campo sin búsquedas activas
  const handleInputFocus = async () => {
    setShowDropdown(true);
    if (searchTerm.trim() === '') {
      setIsLoadingOwners(true);
      try {
        const data = await OwnerService.getAll();
        setOwners(data.slice(0, 5)); // Limitación preventiva de sugerencias rápidas
      } catch (error) {
        console.error('Error al precargar sugerencias de propietarios:', error);
      } finally {
        setIsLoadingOwners(false);
      }
    }
  };

  // Cierre controlado de sugerencias al desenfocar, manteniendo consistencia del input
  const handleBlur = () => {
    setTimeout(() => {
      setShowDropdown(false);
      // Evitar restaurar si estamos en proceso de alta en línea
      if (!isCreatingOwnerRef.current && searchTerm !== selectedOwnerName) {
        setSearchTerm(selectedOwnerName);
      }
    }, 200);
  };

  const handleSelectOwner = (owner: Owner) => {
    setFormData((prev) => ({
      ...prev,
      ownerId: owner.id,
    }));
    setSelectedOwnerName(owner.name);
    setSearchTerm(owner.name);
    setShowDropdown(false);
  };

  // Creación en línea de propietario (Inline Create)
  // Permite un flujo continuo de registro oficial para planillas de trazabilidad FEU
  const handleCreateOwnerInline = async (name: string) => {
    isCreatingOwnerRef.current = true;
    try {
      setIsLoadingOwners(true);
      const newOwner = await OwnerService.create(name.trim());
      handleSelectOwner(newOwner);
    } catch (err: any) {
      alert('Error al registrar nuevo propietario: ' + err.message);
    } finally {
      setIsLoadingOwners(false);
      isCreatingOwnerRef.current = false;
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const target = e.target;
    const { name, value, type, checked } = target;

    setFormData((prev) => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value,
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.ownerId) {
      alert('Debe buscar y seleccionar o registrar un propietario legal para continuar.');
      return;
    }
    setIsSubmitting(true);
    try {
      await onSubmit(formData);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6">
        <h2 className="text-xl font-bold mb-4 text-gray-800">
          {initialData ? 'Editar Caballo' : 'Registrar Caballo'}
        </h2>
        
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700">Nombre del Caballo *</label>
            <input
              type="text"
              name="name"
              required
              value={formData.name}
              onChange={handleChange}
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm p-2 border"
              placeholder="Ej. Tormenta"
            />
          </div>

          {/* Buscador Asíncrono de Propietario con Autocompletado */}
          <div className="relative">
            <label className="block text-sm font-medium text-gray-700">Propietario *</label>
            <div className="relative mt-1">
              <input
                type="text"
                required
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                onFocus={handleInputFocus}
                onBlur={handleBlur}
                className="block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm p-2 border pr-10"
                placeholder="Escriba el nombre del propietario..."
                autoComplete="off"
              />
              {isLoadingOwners && (
                <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none">
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-indigo-600"></div>
                </div>
              )}
            </div>

            {showDropdown && (
              <div className="absolute z-10 mt-1 w-full rounded-md bg-white shadow-lg ring-1 ring-black ring-opacity-5 max-h-60 overflow-auto focus:outline-none border border-gray-100">
                {owners.length > 0 ? (
                  <ul className="py-1 text-base sm:text-sm">
                    {owners.map((owner) => (
                      <li
                        key={owner.id}
                        onMouseDown={() => handleSelectOwner(owner)}
                        className="cursor-pointer select-none relative py-2 pl-3 pr-9 hover:bg-indigo-600 hover:text-white text-gray-900"
                      >
                        {owner.name}
                      </li>
                    ))}
                  </ul>
                ) : (
                  !isLoadingOwners && (
                    <div className="py-2 px-3 text-sm text-gray-500">
                      No se encontraron propietarios.
                    </div>
                  )
                )}

                {/* Opción de creación en línea (Inline Create) */}
                {searchTerm.trim().length > 0 && !owners.some(o => o.name.toLowerCase() === searchTerm.trim().toLowerCase()) && (
                  <button
                    type="button"
                    onMouseDown={() => handleCreateOwnerInline(searchTerm)}
                    className="w-full text-left px-4 py-2 text-sm text-indigo-600 hover:bg-indigo-50 font-semibold border-t border-gray-100 flex items-center"
                  >
                    <svg className="h-4 w-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                    </svg>
                    Crear nuevo propietario: "{searchTerm}"
                  </button>
                )}
              </div>
            )}
            <p className="mt-1 text-xs text-gray-500">
              El propietario es obligatorio para la trazabilidad y las planillas oficiales de la FEU.
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700">Chip RFID</label>
            <input
              type="text"
              name="chipId"
              value={formData.chipId || ''}
              onChange={handleChange}
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm p-2 border"
              placeholder="Ej. 982000412345678"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700">Pasaporte FEU (Opcional)</label>
            <input
              type="text"
              name="feuId"
              value={formData.feuId || ''}
              onChange={handleChange}
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm p-2 border"
              placeholder="Ej. URY-12345"
            />
          </div>

          <div className="flex items-center">
            <input
              type="checkbox"
              name="isFeuActive"
              checked={formData.isFeuActive || false}
              onChange={handleChange}
              className="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
            />
            <label className="ml-2 block text-sm text-gray-900">
              ¿Está activo en la Federación Ecuestre?
            </label>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700">Vencimiento Anemia/Sanidad</label>
            <input
              type="date"
              name="healthRecordsExpiration"
              value={formData.healthRecordsExpiration || ''}
              onChange={handleChange}
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm p-2 border"
            />
          </div>

          <div className="flex justify-end space-x-3 pt-4">
            <button
              type="button"
              onClick={onCancel}
              className="rounded-md border border-gray-300 bg-white py-2 px-4 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="inline-flex justify-center rounded-md border border-transparent bg-indigo-600 py-2 px-4 text-sm font-medium text-white shadow-sm hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 disabled:opacity-50"
            >
              {isSubmitting ? 'Guardando...' : 'Guardar'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
