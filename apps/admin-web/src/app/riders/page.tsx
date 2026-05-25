"use client";

import React from 'react';

export default function RidersPage() {
  const riders = [
    { name: 'Guzmán Silva', feuId: 'FEU-J-201', active: true, cardExpiration: '2026-11-20', represented: 'Haras El Relincho' },
    { name: 'Ana Laura Pereira', feuId: 'FEU-J-202', active: true, cardExpiration: '2026-09-15', represented: 'Club Hípico Libertad' },
    { name: 'Diego Martín Castro', feuId: 'FEU-J-203', active: false, cardExpiration: '2025-05-10', represented: 'Haras La Leyenda' },
    { name: 'Florencia Méndez', feuId: 'FEU-J-204', active: true, cardExpiration: '2027-02-28', represented: 'Haras El Relincho' }
  ];

  return (
    <div className="space-y-6">
      
      {/* Encabezado */}
      <div>
        <h2 className="text-xl font-extrabold text-slate-800 tracking-tight">Padrón de Jinetes</h2>
        <p className="mt-1 text-sm text-slate-500">
          Control de licencias deportivas oficiales de competidores federados y vigencia de Fichas Médicas.
        </p>
      </div>

      {/* Listado */}
      <div className="bg-white shadow rounded-2xl overflow-hidden border border-slate-100">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-slate-50">
            <tr>
              <th className="py-3.5 pl-6 pr-3 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">Nombre del Jinete</th>
              <th className="px-3 py-3.5 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">Nro. FEU</th>
              <th className="px-3 py-3.5 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">Estado Licencia</th>
              <th className="px-3 py-3.5 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">Vencimiento Ficha Médica</th>
              <th className="px-3 py-3.5 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">Representa</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200 bg-white">
            {riders.map((rider) => (
              <tr key={rider.feuId} className="hover:bg-slate-50 transition-colors">
                <td className="whitespace-nowrap py-4 pl-6 pr-3 text-sm font-bold text-slate-900">
                  {rider.name}
                </td>
                <td className="whitespace-nowrap px-3 py-4 text-sm font-mono text-slate-600">
                  {rider.feuId}
                </td>
                <td className="whitespace-nowrap px-3 py-4 text-sm">
                  <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-bold ${
                    rider.active ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'
                  }`}>
                    {rider.active ? 'Habilitado' : 'Suspendido / Inactivo'}
                  </span>
                </td>
                <td className="whitespace-nowrap px-3 py-4 text-sm text-slate-500">
                  {new Date(rider.cardExpiration).toLocaleDateString('es-UY')}
                </td>
                <td className="whitespace-nowrap px-3 py-4 text-sm text-slate-500">
                  {rider.represented}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

    </div>
  );
}
