"use client";

import React from 'react';

export default function CompetitionsPage() {
  const competitions = [
    { name: 'Enduro Ecuestre - Haras La Leyenda', date: '2026-06-15', location: 'Florida, Uruguay', distance: '80 Km', status: 'Planificada' },
    { name: 'Raid Federado - Centro Hípico Libertad', date: '2026-07-04', location: 'San José, Uruguay', distance: '90 Km', status: 'Planificada' },
    { name: 'Campeonato Nacional de Endurance - FEU', date: '2026-05-24', location: 'Trinidad, Uruguay', distance: '120 Km', status: 'En Progreso' }
  ];

  return (
    <div className="space-y-6">
      
      {/* Encabezado */}
      <div>
        <h2 className="text-xl font-extrabold text-slate-800 tracking-tight">Calendario de Competencias</h2>
        <p className="mt-1 text-sm text-slate-500">
          Planificación de raids federados, campeonatos nacionales de endurance y control de etapas.
        </p>
      </div>

      {/* Listado */}
      <div className="bg-white shadow rounded-2xl overflow-hidden border border-slate-100">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-slate-50">
            <tr>
              <th className="py-3.5 pl-6 pr-3 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">Nombre de Competencia</th>
              <th className="px-3 py-3.5 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">Fecha</th>
              <th className="px-3 py-3.5 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">Ubicación</th>
              <th className="px-3 py-3.5 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">Distancia Total</th>
              <th className="px-3 py-3.5 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">Estado</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200 bg-white">
            {competitions.map((comp) => (
              <tr key={comp.name} className="hover:bg-slate-50 transition-colors">
                <td className="whitespace-nowrap py-4 pl-6 pr-3 text-sm font-bold text-slate-900">
                  {comp.name}
                </td>
                <td className="whitespace-nowrap px-3 py-4 text-sm text-slate-500">
                  {new Date(comp.date).toLocaleDateString('es-UY')}
                </td>
                <td className="whitespace-nowrap px-3 py-4 text-sm text-slate-500">
                  {comp.location}
                </td>
                <td className="whitespace-nowrap px-3 py-4 text-sm text-slate-600 font-semibold">
                  {comp.distance}
                </td>
                <td className="whitespace-nowrap px-3 py-4 text-sm">
                  <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-bold ${
                    comp.status === 'En Progreso' ? 'bg-amber-100 text-amber-800' : 'bg-indigo-100 text-indigo-800'
                  }`}>
                    {comp.status}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

    </div>
  );
}
