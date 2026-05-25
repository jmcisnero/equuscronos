"use client";

import React, { useEffect, useState } from 'react';
import { HorseService } from '@/services/api/horse.service';
import { Horse } from '@/types/horse';
import { HorseForm } from './HorseForm';

const formatDateUTC = (dateStr: string | null | undefined): string => {
  if (!dateStr) return 'No registrado';
  const match = dateStr.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (match) {
    const [_, year, month, day] = match;
    return `${day}/${month}/${year}`;
  }
  return new Date(dateStr).toLocaleDateString(undefined, { timeZone: 'UTC' });
};

export const HorseList: React.FC = () => {
  const [horses, setHorses] = useState<Horse[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // Estado único para Omni-search
  const [searchTerm, setSearchTerm] = useState('');

  // Estados para el Modal
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingHorse, setEditingHorse] = useState<Horse | null>(null);

  const fetchHorses = async (search?: string) => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await HorseService.getAll(search);
      setHorses(data);
    } catch (err: any) {
      setError(err.message || 'Error al conectar con el servidor.');
    } finally {
      setIsLoading(false);
    }
  };

  // Efecto con Debounce de 300ms para búsqueda reactiva fluida
  useEffect(() => {
    const delayDebounceFn = setTimeout(() => {
      fetchHorses(searchTerm);
    }, 300);

    return () => clearTimeout(delayDebounceFn);
  }, [searchTerm]);

  const handleCreate = () => {
    setEditingHorse(null);
    setIsModalOpen(true);
  };

  const handleEdit = (horse: Horse) => {
    setEditingHorse(horse);
    setIsModalOpen(true);
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('¿Estás seguro de eliminar este caballo del padrón?')) return;
    try {
      await HorseService.delete(id);
      fetchHorses(searchTerm); // Recargar lista preservando filtro
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleFormSubmit = async (data: any) => {
    try {
      if (editingHorse) {
        await HorseService.update(editingHorse.id, data);
      } else {
        await HorseService.create(data);
      }
      setIsModalOpen(false);
      fetchHorses(searchTerm); // Recargar lista preservando filtro
    } catch (err: any) {
      alert(err.message);
    }
  };

  if (isLoading) return <div className="p-8 flex justify-center"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-equus-green"></div></div>;
  if (error) return <div className="p-4 bg-red-50 text-red-600 rounded-lg">{error}</div>;

  return (
    <div className="px-4 sm:px-6 lg:px-8 py-8">
      <div className="sm:flex sm:items-center">
        <div className="sm:flex-auto">
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Padrón de Caballos</h1>
          <p className="mt-2 text-sm text-slate-500">
            Lista de todos los caballos registrados, incluyendo su chip y estado sanitario para competencias FEU.
          </p>
        </div>
        <div className="mt-4 sm:mt-0 sm:ml-16 sm:flex-none">
          <button
            onClick={handleCreate}
            className="inline-flex items-center justify-center rounded-lg border border-transparent bg-equus-green px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-equus-green/90 focus:outline-none focus:ring-2 focus:ring-equus-green focus:ring-offset-2 sm:w-auto transition-colors duration-250"
          >
            Añadir Caballo
          </button>
        </div>
      </div>

      {/* Contenedor de Búsqueda Global (Omni-Search) */}
      <div className="mt-6 bg-white p-5 rounded-xl border border-slate-100 shadow-sm">
        <label htmlFor="omni-search" className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">
          Búsqueda Global
        </label>
        <div className="relative rounded-lg">
          <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
            <svg className="h-5 w-5 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </div>
          <input
            type="text"
            id="omni-search"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Buscar por nombre, chip, registro FEU o propietario..."
            className="block w-full pl-11 pr-4 py-3 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-equus-green focus:border-transparent bg-slate-50/50 hover:bg-slate-50 transition-colors duration-200"
          />
        </div>
      </div>

      <div className="mt-8 flex flex-col">
        <div className="-my-2 -mx-4 overflow-x-auto sm:-mx-6 lg:-mx-8">
          <div className="inline-block min-w-full py-2 align-middle md:px-6 lg:px-8">
            <div className="overflow-hidden bg-white rounded-xl border border-slate-100 shadow-sm">
              <table className="min-w-full divide-y divide-slate-100">
                <thead className="bg-slate-50/50">
                  <tr>
                    <th className="py-3.5 pl-4 pr-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider sm:pl-6">Nombre</th>
                    <th className="px-3 py-3.5 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Propietario</th>
                    <th className="px-3 py-3.5 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Chip / FEU</th>
                    <th className="px-3 py-3.5 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Estado FEU</th>
                    <th className="px-3 py-3.5 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Vencimiento Sanidad</th>
                    <th className="relative py-3.5 pl-3 pr-4 sm:pr-6">
                      <span className="sr-only">Acciones</span>
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 bg-white">
                  {horses.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="text-center py-12 text-sm text-slate-400 font-medium">
                        No se encontraron caballos que coincidan con los criterios de búsqueda.
                      </td>
                    </tr>
                  ) : (
                    horses.map((horse) => (
                      <tr key={horse.id} className="hover:bg-slate-50/40 transition-colors duration-150">
                        <td className="whitespace-nowrap py-4 pl-4 pr-3 text-sm font-semibold text-slate-900 sm:pl-6">
                          {horse.name}
                        </td>
                        <td className="whitespace-nowrap px-3 py-4 text-sm text-slate-600">
                          {horse.owner?.name || 'Sin propietario asignado'}
                        </td>
                        <td className="whitespace-nowrap px-3 py-4 text-sm text-slate-600">
                          <div className="flex items-center space-x-1">
                            <span className="text-[10px] font-extrabold text-slate-400 uppercase">CHIP:</span>
                            <span className="font-mono text-xs">{horse.chipId || 'N/A'}</span>
                          </div>
                          <div className="text-[10px] flex items-center space-x-1">
                            <span className="text-slate-400 font-extrabold uppercase">FEU:</span>
                            <span className="text-xs">{horse.feuId || 'N/A'}</span>
                          </div>
                        </td>
                        <td className="whitespace-nowrap px-3 py-4 text-sm">
                          <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-bold leading-5 ${horse.isFeuActive ? 'bg-emerald-50 text-emerald-700 border border-emerald-100/30' : 'bg-rose-50 text-rose-700 border border-rose-100/30'}`}>
                            {horse.isFeuActive ? 'Activo' : 'Inactivo'}
                          </span>
                        </td>
                        <td className="whitespace-nowrap px-3 py-4 text-sm text-slate-600">
                          {formatDateUTC(horse.healthRecordsExpiration)}
                        </td>
                        <td className="relative whitespace-nowrap py-4 pl-3 pr-4 text-right text-sm font-medium sm:pr-6">
                          <button 
                            onClick={() => handleEdit(horse)} 
                            className="text-slate-400 hover:text-equus-green p-1.5 rounded-lg hover:bg-slate-50 transition-all duration-200 inline-flex items-center"
                            title={`Editar ${horse.name}`}
                            aria-label={`Editar datos de ${horse.name}`}
                          >
                            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                            </svg>
                          </button>
                          <button 
                            onClick={() => handleDelete(horse.id)} 
                            className="text-slate-400 hover:text-rose-500 p-1.5 rounded-lg hover:bg-slate-50 transition-all duration-200 inline-flex items-center ml-2"
                            title={`Eliminar ${horse.name}`}
                            aria-label={`Eliminar a ${horse.name} del padrón`}
                          >
                            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>

      {isModalOpen && (
        <HorseForm 
          initialData={editingHorse} 
          onSubmit={handleFormSubmit} 
          onCancel={() => setIsModalOpen(false)} 
        />
      )}
    </div>
  );
};
