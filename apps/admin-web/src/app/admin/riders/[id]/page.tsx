"use client";

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { Rider } from '@/types/rider';
import { RiderService } from '@/services/api/rider.service';

export default function RiderDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;

  const [rider, setRider] = useState<Rider | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    const fetchRider = async () => {
      try {
        setIsLoading(true);
        const data = await RiderService.getById(id);
        setRider(data);
      } catch (err: any) {
        setError(err.message || 'Error al cargar los detalles del jinete');
      } finally {
        setIsLoading(false);
      }
    };
    fetchRider();
  }, [id]);

  if (isLoading) {
    return (
      <div className="py-20 text-center text-slate-500 font-medium flex flex-col items-center justify-center space-y-3">
        <svg className="animate-spin h-8 w-8 text-equus-green" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
        </svg>
        <span>Consultando ficha oficial del jinete...</span>
      </div>
    );
  }

  if (error || !rider) {
    return (
      <div className="p-6 max-w-2xl mx-auto text-center">
        <div className="bg-rose-50 border border-rose-100 rounded-2xl p-8 text-rose-600 font-semibold shadow-sm">
          <p className="text-lg mb-4">⚠️ {error || 'No se encontró el jinete solicitado.'}</p>
          <Link
            href="/riders"
            className="inline-flex items-center px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl font-bold transition-all shadow"
          >
            Volver al Padrón de Jinetes
          </Link>
        </div>
      </div>
    );
  }

  const isExpired = rider.medicalCardExpiration && new Date(rider.medicalCardExpiration) < new Date();
  const initials = rider.name.split(' ').map((n) => n[0]).join('').substring(0, 2).toUpperCase();

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Volver */}
      <div>
        <Link
          href="/riders"
          className="inline-flex items-center text-sm font-bold text-slate-500 hover:text-slate-800 transition-colors group"
        >
          <svg className="w-5 h-5 mr-1.5 transform group-hover:-translate-x-1 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
          </svg>
          Volver al Padrón de Jinetes
        </Link>
      </div>

      {/* Tarjeta Principal */}
      <div className="bg-white rounded-3xl overflow-hidden shadow-xl border border-slate-100/80">
        
        {/* Cabecera Premium */}
        <div className="bg-slate-50 border-b border-slate-100 p-8 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="flex items-center space-x-5">
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-equus-green to-emerald-500 text-white flex items-center justify-center font-extrabold text-2xl shadow-inner">
              {initials}
            </div>
            <div>
              <h1 className="text-2xl font-extrabold text-slate-800 tracking-tight">{rider.name}</h1>
              <p className="text-xs text-slate-400 font-mono mt-0.5">ID Interno: {rider.id}</p>
            </div>
          </div>
          <div>
            <span className={`inline-flex rounded-full px-4 py-1.5 text-xs font-bold shadow-sm ${
              rider.isFeuActive 
                ? 'bg-emerald-50 text-emerald-700 border border-emerald-200/50' 
                : 'bg-slate-100 text-slate-500 border border-slate-200'
            }`}>
              {rider.isFeuActive ? 'Federado Activo' : 'Inactivo / Suspendido'}
            </span>
          </div>
        </div>

        {/* Ficha de Detalles */}
        <div className="p-8 grid grid-cols-1 md:grid-cols-2 gap-8">
          
          {/* Identificación Oficial */}
          <div className="space-y-4">
            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest border-b border-slate-100 pb-2">
              Identidad & Federación
            </h3>

            <div className="flex justify-between py-2 border-b border-slate-50">
              <span className="text-sm font-semibold text-slate-500">Cédula de Identidad (CI)</span>
              <span className="text-sm font-bold font-mono text-slate-800">{rider.nationalId}</span>
            </div>

            <div className="flex justify-between py-2 border-b border-slate-50">
              <span className="text-sm font-semibold text-slate-500">Nro. Licencia FEU</span>
              <span className="text-sm font-bold font-mono text-slate-800">
                {rider.feuId ? (
                  <span className="bg-slate-100 px-2 py-0.5 rounded border border-slate-200 text-slate-700">
                    {rider.feuId}
                  </span>
                ) : (
                  <span className="text-slate-400 italic">No Federado</span>
                )}
              </span>
            </div>

            <div className="flex justify-between py-2">
              <span className="text-sm font-semibold text-slate-500">Fecha de Nacimiento</span>
              <span className="text-sm font-bold text-slate-800">
                {rider.birthDate ? rider.birthDate.substring(0, 10) : <span className="text-slate-400 italic">-</span>}
              </span>
            </div>
          </div>

          {/* Estado Médico & Auditoría */}
          <div className="space-y-4">
            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest border-b border-slate-100 pb-2">
              Controles Sanitarios & Registro
            </h3>

            <div className="flex justify-between py-2 border-b border-slate-50">
              <span className="text-sm font-semibold text-slate-500">Vence Ficha Médica</span>
              <span className="text-sm font-bold font-mono">
                {rider.medicalCardExpiration ? (
                  <span className={`inline-flex items-center px-2 py-0.5 rounded ${
                    isExpired ? 'bg-rose-50 text-rose-700 border border-rose-200' : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                  }`}>
                    <span className={`w-1.5 h-1.5 rounded-full mr-1.5 ${isExpired ? 'bg-rose-500' : 'bg-emerald-500'}`} />
                    {rider.medicalCardExpiration.substring(0, 10)} {isExpired && '(Vencida)'}
                  </span>
                ) : (
                  <span className="text-slate-400 italic">Sin Registrar</span>
                )}
              </span>
            </div>

            <div className="flex justify-between py-2">
              <span className="text-sm font-semibold text-slate-500">Fecha de Registro</span>
              <span className="text-sm font-bold text-slate-800">
                {rider.createdAt ? new Date(rider.createdAt).toLocaleDateString('es-UY') : '-'}
              </span>
            </div>
          </div>

        </div>

        {/* Pié de página del expediente */}
        <div className="bg-slate-50/75 border-t border-slate-100 px-8 py-4 flex items-center justify-between text-xs text-slate-400 font-medium">
          <span>Gobierno de Datos FEU - EquusCronos</span>
          <span>Expediente de Jinete Oficial</span>
        </div>

      </div>
    </div>
  );
}
