"use client";

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { HorseService } from '@/services/api/horse.service';
import { Horse } from '@/types/horse';
import { HorseForm } from './HorseForm';

/**
 * Padrón de Caballos - Vista de Administración de EquusCronos
 * 
 * NORMAS DE DISEÑO CORPORATIVO (ESTILO PREMIUM):
 * 1. DISEÑO DATA-GRID BORDERLESS: La tabla elimina bordes perimetrales pesados. Utiliza
 *    el fondo global bg-equus-bg y filas blancas separadas por divide-y divide-gray-100.
 * 2. OMNI-SEARCH INTEGRADO: Una única barra superior de ancho completo para consultas globales.
 * 3. ICONOGRAFÍA DE ACCIÓN NATIVA: Acciones rápidas (Lápiz y Basura) representadas por SVGs limpios,
 *    con tooltips 'title' para accesibilidad y efectos de transición fluidos.
 */
export const HorseList: React.FC = () => {
  const [horses, setHorses] = useState<Horse[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // Estado único para la búsqueda global (Omni-search)
  const [searchTerm, setSearchTerm] = useState('');

  // Estados para el ModalForm
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingHorse, setEditingHorse] = useState<Horse | null>(null);

  // Obtener los caballos desde la API
  const fetchHorses = async (search?: string) => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await HorseService.getAll(search);
      setHorses(data);
    } catch (err: any) {
      setError(err.message || 'Error al conectar con el servidor de EquusCronos.');
    } finally {
      setIsLoading(false);
    }
  };

  // Búsqueda reactiva fluida con Debounce de 300ms
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

  const handleDelete = async (id: string, name: string) => {
    if (!window.confirm(`¿Está seguro de que desea eliminar al caballo "${name}" del padrón? Esta acción no se puede deshacer y fallará si el equino ya registra pasadas en competencias.`)) return;
    try {
      await HorseService.delete(id);
      fetchHorses(searchTerm);
    } catch (err: any) {
      alert(err.message || 'No se pudo eliminar al caballo del padrón por restricciones de integridad referencial.');
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
      fetchHorses(searchTerm);
    } catch (err: any) {
      alert(err.message);
    }
  };

  return (
    <div className="space-y-6">
      
      {/* 1. SECCIÓN DE ENCABEZADO */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between space-y-4 sm:space-y-0">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-800 tracking-tight">Padrón de Caballos</h1>
          <p className="mt-1 text-sm text-slate-500">
            Control de registros de equinos, chips oficiales RFID y estados sanitarios obligatorios de la FEU.
          </p>
        </div>
        
        <button
          onClick={handleCreate}
          className="inline-flex items-center justify-center px-5 py-2.5 bg-equus-green hover:bg-opacity-95 text-white font-bold text-sm rounded-xl transition-all shadow-md hover:shadow-lg focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-equus-green whitespace-nowrap self-stretch sm:self-auto"
        >
          <svg className="w-5 h-5 mr-2 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" />
          </svg>
          Nuevo Caballo
        </button>
      </div>

      {/* 2. BARRA DE BÚSQUEDA ANCHA SUPERIOR (OMNI-SEARCH) */}
      <div className="flex gap-2">
        <div className="relative flex-1">
          <span className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none text-slate-400">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </span>
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Buscar caballo por nombre, chip RFID, pasaporte FEU o propietario..."
            className="w-full pl-10 pr-4 py-3 bg-white text-slate-800 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-equus-green/20 focus:border-equus-green placeholder-slate-400 shadow-sm"
          />
        </div>
      </div>

      {/* 3. LISTADO (DATAGRID CON DISEÑO BORDERLESS) */}
      <div className="bg-white rounded-2xl overflow-hidden shadow-sm border border-slate-100/50">
        <div className="overflow-x-auto">
          {isLoading ? (
            <div className="py-20 text-center text-slate-500 font-medium flex flex-col items-center justify-center space-y-3">
              <svg className="animate-spin h-8 w-8 text-equus-green" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
              <span>Consultando padrón nacional ecuestre...</span>
            </div>
          ) : error ? (
            <div className="py-12 text-center text-rose-600 font-semibold">
              <p className="mb-2">⚠️ {error}</p>
              <button onClick={() => fetchHorses(searchTerm)} className="text-xs text-equus-green underline font-bold">
                Reintentar cargar
              </button>
            </div>
          ) : horses.length === 0 ? (
            <div className="py-20 text-center text-slate-500">
              <svg className="w-12 h-12 mx-auto text-slate-300 mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
              <p className="font-medium text-slate-700">No se encontraron caballos registrados.</p>
              <p className="text-xs text-slate-400 mt-1">Asegúrese de escribir correctamente el nombre o chip.</p>
            </div>
          ) : (
            <table className="min-w-full divide-y divide-gray-100">
              <thead className="bg-slate-50/75 border-b border-gray-100">
                <tr>
                  <th scope="col" className="py-4 pl-6 pr-3 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">Nombre del Equino</th>
                  <th scope="col" className="px-4 py-4 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">Propietario / Establecimiento</th>
                  <th scope="col" className="px-4 py-4 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">Chip / Registro FEU</th>
                  <th scope="col" className="px-4 py-4 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">Estado FEU</th>
                  <th scope="col" className="px-4 py-4 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">Vto. Sanidad (MGAP)</th>
                  <th scope="col" className="relative py-4 pl-3 pr-6 text-right text-xs font-bold text-slate-500 uppercase tracking-wider">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 bg-white">
                {horses.map((horse) => {
                  const isExpired = horse.healthRecordsExpiration && new Date(horse.healthRecordsExpiration) < new Date();
                  
                  return (
                    <tr key={horse.id} className="hover:bg-slate-50/60 transition-colors">
                      <td className="whitespace-nowrap py-4 pl-6 pr-3 text-sm font-bold text-slate-900">
                        <Link href={`/admin/horses/${horse.id}`} className="text-equus-green hover:underline">
                          {horse.name}
                        </Link>
                      </td>
                      <td className="whitespace-nowrap px-4 py-4 text-sm text-slate-600">
                        {horse.owner?.name || (
                          <span className="text-slate-400 italic">Sin propietario asignado</span>
                        )}
                      </td>
                      <td className="whitespace-nowrap px-4 py-4 text-sm">
                        <div className="flex items-center space-x-1">
                          <span className="text-[10px] font-extrabold text-slate-400">CHIP:</span>
                          <span className="font-mono text-xs text-slate-600">{horse.chipId || 'N/A'}</span>
                        </div>
                        <div className="flex items-center space-x-1 text-[10px]">
                          <span className="text-slate-400 font-extrabold">FEU:</span>
                          <span className="font-mono text-xs text-slate-600">{horse.feuId || 'N/A'}</span>
                        </div>
                      </td>
                      <td className="whitespace-nowrap px-4 py-4 text-sm">
                        <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-bold ${
                          horse.isFeuActive 
                            ? 'bg-emerald-50 text-emerald-700 border border-emerald-200/50' 
                            : 'bg-slate-100 text-slate-500 border border-slate-200'
                        }`}>
                          {horse.isFeuActive ? 'Habilitado FEU' : 'No Habilitado'}
                        </span>
                      </td>
                      <td className="whitespace-nowrap px-4 py-4 text-sm">
                        {horse.healthRecordsExpiration ? (
                          <span className={`inline-flex items-center text-xs font-semibold ${
                            isExpired ? 'text-rose-600' : 'text-slate-600'
                          }`}>
                            <span className={`w-2 h-2 rounded-full mr-1.5 ${isExpired ? 'bg-rose-500' : 'bg-emerald-500'}`} />
                            {horse.healthRecordsExpiration.substring(0, 10)} {isExpired && '(Vencido)'}
                          </span>
                        ) : (
                          <span className="text-slate-400 italic">Sin Registrar</span>
                        )}
                      </td>
                      <td className="whitespace-nowrap py-4 pl-3 pr-6 text-right text-sm font-medium">
                        <div className="flex items-center justify-end space-x-2">
                          <button
                            onClick={() => handleEdit(horse)}
                            className="p-1.5 text-slate-400 hover:text-equus-green hover:bg-slate-100 rounded-lg transition-all"
                            title={`Editar Caballo ${horse.name}`}
                          >
                            <svg className="w-4.5 h-4.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                            </svg>
                          </button>
                          
                          <button
                            onClick={() => handleDelete(horse.id, horse.name)}
                            className="p-1.5 text-slate-400 hover:text-rose-500 hover:bg-rose-50 rounded-lg transition-all"
                            title={`Eliminar Caballo ${horse.name}`}
                          >
                            <svg className="w-4.5 h-4.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* 4. MODALFORM PARA ALTA Y EDICIÓN DE CABALLOS */}
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
