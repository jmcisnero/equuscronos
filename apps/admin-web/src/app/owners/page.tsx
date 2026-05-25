"use client";

import React, { useState, useEffect } from 'react';
import { Owner } from '@/types/horse';
import { OwnerService } from '@/services/api/owner.service';

export default function OwnersPage() {
  const [owners, setOwners] = useState<Owner[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState('');

  useEffect(() => {
    const fetchOwners = async () => {
      try {
        setIsLoading(true);
        const data = await OwnerService.getAll(search);
        setOwners(data);
      } catch (err) {
        console.error('Error al obtener propietarios:', err);
      } finally {
        setIsLoading(false);
      }
    };

    const delayDebounce = setTimeout(fetchOwners, search ? 300 : 0);
    return () => clearTimeout(delayDebounce);
  }, [search]);

  return (
    <div className="space-y-6">
      
      {/* Encabezado */}
      <div className="sm:flex sm:items-center sm:justify-between">
        <div>
          <h2 className="text-xl font-extrabold text-slate-800 tracking-tight">Gestión de Propietarios</h2>
          <p className="mt-1 text-sm text-slate-500">
            Registro oficial de Haras, Studs y criadores habilitados por la Federación Ecuestre Uruguaya.
          </p>
        </div>
      </div>

      {/* Buscador */}
      <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-100 flex items-center">
        <div className="relative flex-1 max-w-md">
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="block w-full rounded-xl border-slate-200 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm p-2.5 pl-10 border"
            placeholder="Buscar por nombre, Haras o Stud..."
          />
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </div>
        </div>
      </div>

      {/* Listado */}
      <div className="bg-white shadow rounded-2xl overflow-hidden border border-slate-100">
        {isLoading ? (
          <div className="p-8 text-center text-slate-500">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600 mx-auto mb-4"></div>
            Cargando propietarios oficiales...
          </div>
        ) : owners.length > 0 ? (
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-slate-50">
              <tr>
                <th className="py-3.5 pl-6 pr-3 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">Nombre del Propietario</th>
                <th className="px-3 py-3.5 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">Categoría</th>
                <th className="px-3 py-3.5 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">Contacto</th>
                <th className="px-3 py-3.5 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">Fecha Registro</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 bg-white">
              {owners.map((owner) => (
                <tr key={owner.id} className="hover:bg-slate-50 transition-colors">
                  <td className="whitespace-nowrap py-4 pl-6 pr-3 text-sm font-bold text-slate-900">
                    {owner.name}
                  </td>
                  <td className="whitespace-nowrap px-3 py-4 text-sm text-slate-500">
                    <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-bold ${
                      owner.type === 'HARAS'
                        ? 'bg-violet-100 text-violet-800'
                        : owner.type === 'STUD'
                        ? 'bg-amber-100 text-amber-800'
                        : 'bg-indigo-100 text-indigo-800'
                    }`}>
                      {owner.type || 'PERSON'}
                    </span>
                  </td>
                  <td className="whitespace-nowrap px-3 py-4 text-sm text-slate-500">
                    {owner.contactInfo || 'Sin contacto cargado'}
                  </td>
                  <td className="whitespace-nowrap px-3 py-4 text-sm text-slate-400">
                    {owner.createdAt ? new Date(owner.createdAt).toLocaleDateString('es-UY') : 'N/A'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <div className="p-8 text-center text-slate-500">
            No se encontraron propietarios cargados en la base de datos nacional.
          </div>
        )}
      </div>

    </div>
  );
}
