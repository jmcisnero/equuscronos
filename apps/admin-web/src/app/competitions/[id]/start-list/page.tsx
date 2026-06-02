"use client";

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';

import { CompetitionEntryService } from '@/services/api/competition-entry.service';
import { CompetitionService } from '@/services/api/competition.service';
import { RiderService } from '@/services/api/rider.service';
import { HorseService } from '@/services/api/horse.service';
import { TenantService } from '@/services/api/tenant.service';

import { Rider } from '@/types/rider';
import { Horse } from '@/types/horse';
import { Tenant } from '@/types/tenant';

// Esquema de validación con Zod
const entrySchema = z.object({
  riderId: z.string().min(1, "Debe seleccionar un jinete de la lista"),
  horseId: z.string().min(1, "Debe seleccionar un caballo de la lista"),
  representedTenantId: z.string().optional().or(z.literal("")),
  bibNumber: z.number()
    .int("El dorsal debe ser un número entero")
    .min(1, "El dorsal debe ser un número entero positivo mayor a 0"),
  ballastWeight: z.number()
    .min(0, "El peso registrado no puede ser negativo"),
  sealNumber: z.string().min(1, "El número de precinto es obligatorio"),
});

type EntryFormValues = z.infer<typeof entrySchema>;

export default function StartListPage() {
  const params = useParams();
  const competitionId = params.id as string;
  const queryClient = useQueryClient();

  // Estados de control para el Modal y Autocompletes
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [toastMessage, setToastMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Estados de Autocompletado / Búsqueda para el Modal
  const [riderSearch, setRiderSearch] = useState('');
  const [isRiderDropdownOpen, setIsRiderDropdownOpen] = useState(false);
  const [selectedRider, setSelectedRider] = useState<Rider | null>(null);

  const [horseSearch, setHorseSearch] = useState('');
  const [isHorseDropdownOpen, setIsHorseDropdownOpen] = useState(false);
  const [selectedHorse, setSelectedHorse] = useState<Horse | null>(null);

  // Formulario React Hook Form + Zod
  const {
    register,
    handleSubmit,
    setValue,
    reset,
    control,
    watch,
    formState: { errors, isSubmitting }
  } = useForm<EntryFormValues>({
    resolver: zodResolver(entrySchema),
    defaultValues: {
      riderId: '',
      horseId: '',
      representedTenantId: '',
      bibNumber: undefined,
      ballastWeight: 0,
      sealNumber: '',
    }
  });

  // Mostrar toast temporal
  const showToast = (text: string, type: 'success' | 'error') => {
    setToastMessage({ text, type });
    setTimeout(() => {
      setToastMessage(null);
    }, 5000);
  };

  // Queries de React Query
  // 1. Detalles de la Competencia
  const { data: competition, isLoading: isCompLoading, error: compError } = useQuery({
    queryKey: ['competition', competitionId],
    queryFn: () => CompetitionService.getById(competitionId),
    enabled: !!competitionId,
  });

  // 2. Start-List de la Competencia
  const { data: entries = [], isLoading: isEntriesLoading, error: entriesError } = useQuery({
    queryKey: ['competition-entries', competitionId],
    queryFn: () => CompetitionEntryService.getAllByCompetition(competitionId),
    enabled: !!competitionId,
  });

  // 3. Jinetes para Autocomplete
  const { data: riders = [] } = useQuery({
    queryKey: ['riders', riderSearch],
    queryFn: () => RiderService.getAll(riderSearch),
  });

  // 4. Caballos para Autocomplete
  const { data: horses = [] } = useQuery({
    queryKey: ['horses', horseSearch],
    queryFn: () => HorseService.getAll(horseSearch),
  });

  // 5. Clubes / Tenants para el Select normal
  const { data: tenants = [] } = useQuery({
    queryKey: ['tenants'],
    queryFn: () => TenantService.getAll(),
  });

  // Mutación para Registrar Inscripción
  const createMutation = useMutation({
    mutationFn: (dto: EntryFormValues) => {
      return CompetitionEntryService.create({
        competitionId,
        riderId: dto.riderId,
        horseId: dto.horseId,
        representedTenantId: dto.representedTenantId || undefined,
        bibNumber: dto.bibNumber,
        ballastWeight: dto.ballastWeight || 0,
        sealNumber: dto.sealNumber || undefined,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['competition-entries', competitionId] });
      showToast("¡Binomio inscripto y marcado exitosamente!", "success");
      handleCloseModal();
    },
  });

  // Mutación para Dar de Baja Inscripción
  const deleteMutation = useMutation({
    mutationFn: (entryId: string) => CompetitionEntryService.delete(entryId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['competition-entries', competitionId] });
      showToast("Binomio dado de baja de la carrera.", "success");
    },
    onError: (error: any) => {
      showToast(error.message || "Error al dar de baja al binomio", "error");
    }
  });

  // Manejo de envío del Formulario con TRY/CATCH para errores 409
  const onSubmit = async (data: EntryFormValues) => {
    console.log("Current Form Data:", data);
    setSubmitError(null);
    try {
      await createMutation.mutateAsync(data);
    } catch (err: any) {
      console.error('[MUTATE ERROR]', err);
      // Detección de error 409 Conflict (unicidad del dorsal o binomio)
      if (err.status === 409 || (err.message && (
        err.message.includes('dorsal') || 
        err.message.includes('ya está en uso') || 
        err.message.includes('duplicado') ||
        err.message.includes('Conflict')
      ))) {
        setSubmitError("Dorsal duplicado: El número ya fue asignado a otro binomio en esta carrera.");
      } else if (err.message && (
        err.message.includes('binomio') || 
        err.message.includes('ya está inscripto')
      )) {
        setSubmitError("Binomio duplicado: Este jinete y caballo ya están registrados juntos en esta carrera.");
      } else {
        setSubmitError(err.message || "Error inesperado al registrar el binomio. Verifique los datos.");
      }
    }
  };

  const handleDelete = (id: string, bibNumber: number, riderName: string) => {
    if (confirm(`¿Está seguro de que desea dar de baja al dorsal #${bibNumber} (${riderName})?`)) {
      deleteMutation.mutate(id);
    }
  };

  const handleOpenModal = () => {
    setSubmitError(null);
    setSelectedRider(null);
    setSelectedHorse(null);
    setRiderSearch('');
    setHorseSearch('');
    reset();
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
  };

  // Filtrar jinetes que no tengan campos vacíos y coincidan con búsqueda
  const filteredRiders = riders.filter(r => 
    r.name.toLowerCase().includes(riderSearch.toLowerCase()) || 
    r.nationalId.includes(riderSearch)
  );

  // Filtrar caballos
  const filteredHorses = horses.filter(h => 
    h.name.toLowerCase().includes(horseSearch.toLowerCase()) ||
    (h.chipId && h.chipId.includes(horseSearch))
  );

  return (
    <div className="space-y-6">
      
      {/* TOAST SYSTEM PREMIUM */}
      {toastMessage && (
        <div className={`fixed top-4 right-4 z-50 flex items-center p-4 rounded-xl shadow-xl border animate-fade-in ${
          toastMessage.type === 'success' 
            ? 'bg-emerald-50 text-emerald-800 border-emerald-200' 
            : 'bg-rose-50 text-rose-800 border-rose-200'
        }`}>
          <div className="mr-3">
            {toastMessage.type === 'success' ? (
              <svg className="w-5 h-5 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
              </svg>
            ) : (
              <svg className="w-5 h-5 text-rose-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
            )}
          </div>
          <span className="text-sm font-bold">{toastMessage.text}</span>
        </div>
      )}

      {/* 1. CABECERA & VOLVER */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between space-y-4 sm:space-y-0 border-b border-slate-100 pb-5">
        <div className="space-y-1">
          <div className="flex items-center space-x-2 text-xs font-bold text-slate-400 uppercase tracking-widest">
            <Link href="/competitions" className="hover:text-equus-green transition-colors">Competencias</Link>
            <span>/</span>
            <span className="text-slate-600">Start List</span>
          </div>
          
          <div className="flex items-center space-x-3">
            <Link 
              href="/competitions" 
              className="p-2 bg-white hover:bg-slate-50 border border-slate-200 rounded-xl text-slate-600 transition-all shadow-sm"
              title="Volver al calendario"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M15 19l-7-7 7-7" />
              </svg>
            </Link>
            <h1 className="text-2xl font-extrabold text-slate-800 tracking-tight">Planilla de Largada (Start-List)</h1>
          </div>
        </div>

        {(() => {
          const isRaceActive = competition?.status === 'ACTIVE' || 
                               competition?.status === 'COMPLETED' || 
                               competition?.status === 'OFFICIAL' ||
                               competition?.status === 'CANCELLED';

          return (
            <button
              onClick={handleOpenModal}
              disabled={isCompLoading || !!compError || isRaceActive}
              className="inline-flex items-center justify-center px-5 py-2.5 bg-equus-green hover:bg-opacity-95 disabled:bg-slate-100 disabled:text-slate-400 text-white font-extrabold text-sm rounded-xl transition-all shadow-md hover:shadow-lg focus:outline-none"
            >
              {isRaceActive ? (
                <>
                  <span className="mr-2">🔒</span>
                  Inscripciones Cerradas (Carrera Activa)
                </>
              ) : (
                <>
                  <svg className="w-4.5 h-4.5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" />
                  </svg>
                  Inscribir Binomio / Marcación
                </>
              )}
            </button>
          );
        })()}
      </div>

      {/* 2. CARD DE DETALLES DE LA COMPETENCIA (ESTILO PREMIUM VET-GATE) */}
      {isCompLoading ? (
        <div className="h-28 bg-white border border-slate-100 rounded-2xl animate-pulse flex items-center justify-center">
          <div className="text-slate-400 text-sm font-semibold">Cargando detalles de la competencia...</div>
        </div>
      ) : compError ? (
        <div className="p-4 bg-rose-50 border border-rose-100 rounded-2xl text-rose-600 text-sm font-semibold">
          ⚠️ Error al cargar los detalles de la competencia.
        </div>
      ) : competition && (
        <div className="bg-gradient-to-r from-equus-green to-slate-900 rounded-2xl p-6 text-white shadow-xl relative overflow-hidden border border-white/5">
          {/* Fondo decorativo abstracto */}
          <div className="absolute right-0 top-0 bottom-0 w-1/3 opacity-5 pointer-events-none">
            <svg className="w-full h-full" viewBox="0 0 100 100" preserveAspectRatio="none">
              <path d="M0,0 C50,20 50,80 100,100 L100,0 Z" fill="white" />
            </svg>
          </div>

          <div className="relative z-10 grid grid-cols-1 md:grid-cols-3 gap-6 items-center">
            
            {/* Col 1: Nombre e Identificación */}
            <div className="space-y-2 md:col-span-2">
              <div className="flex flex-wrap gap-2 items-center">
                <span className={`text-[10px] font-extrabold uppercase px-2.5 py-0.5 rounded-full border ${
                  competition.isFederated 
                    ? 'bg-amber-400/20 text-amber-300 border-amber-400/30' 
                    : 'bg-white/10 text-slate-300 border-white/10'
                }`}>
                  {competition.isFederated ? '🏆 FEDERADA FEU' : 'ORGANIZACIÓN SOCIAL'}
                </span>
                <span className="text-[10px] font-bold bg-white/10 text-slate-200 px-2 py-0.5 rounded-full uppercase tracking-wider font-mono">
                  {competition.status === 'ACTIVE' ? 'Carrera en Curso' : 'Fase Planificación'}
                </span>
              </div>
              <h2 className="text-xl md:text-2xl font-black text-white leading-tight">{competition.name}</h2>
              <div className="flex flex-wrap gap-x-4 gap-y-1 text-slate-300 text-xs">
                <span className="flex items-center">
                  <svg className="w-3.5 h-3.5 mr-1 text-equus-tan-light" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                  {competition.location || 'Melo, Cerro Largo'}
                </span>
                <span className="flex items-center">
                  <svg className="w-3.5 h-3.5 mr-1 text-equus-tan-light" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                  {competition.competitionDate ? competition.competitionDate.substring(0, 10) : '-'}
                </span>
              </div>
            </div>

            {/* Col 2: Parámetros Técnicos Rápidos */}
            <div className="flex gap-4 md:justify-end">
              
              {/* Etapas Totales */}
              <div className="bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-center min-w-[90px]">
                <span className="block text-[9px] text-slate-400 font-bold uppercase tracking-wider">Etapas</span>
                <span className="block text-xl font-black font-mono text-white mt-0.5">{competition.stages?.length || 0}</span>
              </div>

              {/* Distancia Total */}
              <div className="bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-center min-w-[90px]">
                <span className="block text-[9px] text-slate-400 font-bold uppercase tracking-wider">Distancia</span>
                <span className="block text-xl font-black font-mono text-equus-tan-light mt-0.5">
                  {competition.stages?.reduce((acc, s) => acc + Number(s.distanceKm), 0).toFixed(0) || 0}K
                </span>
              </div>

              {/* FC Máxima Vet Gate */}
              <div className="bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-center min-w-[90px]">
                <span className="block text-[9px] text-slate-400 font-bold uppercase tracking-wider">Límite Vet</span>
                <span className="block text-xl font-black font-mono text-emerald-400 mt-0.5">{competition.maxHeartRate || 65}</span>
              </div>

            </div>

          </div>
        </div>
      )}

      {/* 3. LISTADO / START-LIST DE INSCRIPCIONES */}
      <div className="bg-white rounded-2xl overflow-hidden shadow-sm border border-slate-100/60">
        <div className="border-b border-slate-100 px-6 py-4 flex items-center justify-between">
          <div>
            <h3 className="text-sm font-extrabold text-slate-800">Planilla Oficial de Participantes</h3>
            <p className="text-[11px] text-slate-400 mt-0.5">Start list definitiva con dorsal oficial, control de peso de lastre y habilitación de jinetes.</p>
          </div>
          
          <div className="text-xs bg-slate-50 font-extrabold text-slate-600 px-3 py-1.5 rounded-lg border border-slate-100 font-mono">
            Total Inscriptos: {entries.length}
          </div>
        </div>

        <div className="overflow-x-auto">
          {isEntriesLoading ? (
            <div className="py-20 text-center text-slate-500 font-medium flex flex-col items-center justify-center space-y-3">
              <svg className="animate-spin h-8 w-8 text-equus-green" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
              <span className="text-xs">Cargando start-list oficial...</span>
            </div>
          ) : entriesError ? (
            <div className="py-12 text-center text-rose-600 font-semibold text-sm">
              ⚠️ Error al cargar la planilla de competidores.
            </div>
          ) : entries.length === 0 ? (
            <div className="py-20 text-center text-slate-500">
              <svg className="w-12 h-12 mx-auto text-slate-300 mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                {/* Clipboard user icon */}
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
              </svg>
              <p className="font-bold text-slate-700 text-sm">No hay binomios inscriptos en esta carrera.</p>
              <p className="text-xs text-slate-400 mt-1">Presione el botón "Inscribir Binomio" en la cabecera para añadir participantes.</p>
            </div>
          ) : (
            <table className="min-w-full divide-y divide-slate-100">
              <thead className="bg-slate-50/75 border-b border-slate-100">
                <tr>
                  <th scope="col" className="py-4 pl-6 pr-3 text-left text-xs font-bold text-slate-500 uppercase tracking-wider w-[100px]">Dorsal / Chaleco</th>
                  <th scope="col" className="px-4 py-4 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">Jinete (Rider)</th>
                  <th scope="col" className="px-4 py-4 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">Caballo (Horse)</th>
                  <th scope="col" className="px-4 py-4 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">Club Representado</th>
                  <th scope="col" className="px-4 py-4 text-left text-xs font-bold text-slate-500 uppercase tracking-wider w-[120px]">Lastre (Kg)</th>
                  <th scope="col" className="px-4 py-4 text-left text-xs font-bold text-slate-500 uppercase tracking-wider w-[120px]">Precinto</th>
                  <th scope="col" className="px-4 py-4 text-left text-xs font-bold text-slate-500 uppercase tracking-wider w-[130px]">Habilitación FEU</th>
                  <th scope="col" className="relative py-4 pl-3 pr-6 text-right text-xs font-bold text-slate-500 uppercase tracking-wider w-[100px]">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 bg-white">
                {entries.map((entry) => {
                  const isRiderActive = entry.rider?.isFeuActive;
                  const isHorseActive = entry.horse?.isFeuActive;
                  const minWeight = 85;
                  const qualifies = isRiderActive && isHorseActive && 
                                    Number(entry.ballastWeight) >= minWeight && 
                                    !!entry.sealNumber;

                  return (
                    <tr key={entry.id} className="hover:bg-slate-50/40 transition-colors">
                      
                      {/* Dorsal */}
                      <td className="whitespace-nowrap py-4 pl-6 pr-3 text-sm font-black text-slate-900 font-mono text-center">
                        <span className="inline-flex items-center justify-center h-8 w-8 rounded-lg bg-slate-950 text-white shadow-sm font-extrabold">
                          {entry.bibNumber}
                        </span>
                      </td>

                      {/* Jinete */}
                      <td className="px-4 py-4 whitespace-nowrap">
                        <div className="flex flex-col">
                          <span className="text-sm font-bold text-slate-800">{entry.rider?.name || 'Jinete Desconocido'}</span>
                          <span className="text-[10px] text-slate-400 font-mono font-semibold">C.I. {entry.rider?.nationalId || '-'}</span>
                        </div>
                      </td>

                      {/* Caballo */}
                      <td className="px-4 py-4 whitespace-nowrap">
                        <div className="flex flex-col">
                          <span className="text-sm font-bold text-slate-800">{entry.horse?.name || 'Caballo Desconocido'}</span>
                          <span className="text-[10px] text-slate-400 font-semibold">
                            {entry.horse?.owner ? `Propietario: ${entry.horse.owner.name}` : <span className="italic text-slate-300">Trazabilidad s/ dueño</span>}
                          </span>
                        </div>
                      </td>

                      {/* Club */}
                      <td className="px-4 py-4 whitespace-nowrap text-sm text-slate-600 font-semibold">
                        {entry.representedTenant?.name || <span className="text-slate-300 italic font-normal">Sin club asignado</span>}
                      </td>

                      {/* Lastre */}
                      <td className="px-4 py-4 whitespace-nowrap text-sm font-bold font-mono text-slate-800">
                        {Number(entry.ballastWeight) > 0 ? (
                          <span className="inline-flex items-center text-amber-600 bg-amber-50 px-2 py-0.5 rounded-md border border-amber-200/50">
                            ⚖️ {Number(entry.ballastWeight).toFixed(2)} Kg
                          </span>
                        ) : (
                          <span className="text-slate-400 font-normal">0.00 Kg</span>
                        )}
                      </td>

                      {/* Precinto */}
                      <td className="px-4 py-4 whitespace-nowrap text-sm font-bold font-mono text-slate-800">
                        {entry.sealNumber ? (
                          <span className="inline-flex items-center text-slate-700 bg-slate-100 px-2 py-0.5 rounded-md border border-slate-200/50">
                            🔗 {entry.sealNumber}
                          </span>
                        ) : (
                          <span className="text-slate-300 italic font-normal">Sin precintar</span>
                        )}
                      </td>

                      {/* Habilitación FEU */}
                      <td className="px-4 py-4 whitespace-nowrap text-sm">
                        <span className={`inline-flex rounded-full px-2.5 py-0.5 text-[10px] font-bold border ${
                          qualifies 
                            ? 'bg-emerald-50 text-emerald-700 border-emerald-200/50' 
                            : 'bg-rose-50 text-rose-700 border-rose-200/50'
                        }`}>
                          {qualifies ? 'Habilitado' : 'Observado'}
                        </span>
                      </td>

                      {/* Acciones */}
                      <td className="whitespace-nowrap py-4 pl-3 pr-6 text-right text-sm font-medium">
                        {(() => {
                          const isRaceActive = competition?.status === 'ACTIVE' || 
                                               competition?.status === 'COMPLETED' || 
                                               competition?.status === 'OFFICIAL' ||
                                               competition?.status === 'CANCELLED';

                          return isRaceActive ? (
                            <span className="p-1.5 text-slate-300 inline-block font-sans text-xs select-none" title="Inmutable: Carrera en curso/finalizada">
                              🔒 Bloqueado
                            </span>
                          ) : (
                            <button
                              onClick={() => handleDelete(entry.id, entry.bibNumber, entry.rider?.name || '')}
                              className="p-1.5 text-slate-400 hover:text-rose-500 hover:bg-rose-50 rounded-lg transition-all"
                              title="Eliminar inscripción de binomio"
                            >
                              <svg className="w-4.5 h-4.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                              </svg>
                            </button>
                          );
                        })()}
                      </td>

                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* 4. MODAL DE INSCRIPCIÓN PREMIUM CON AUTOCOMPLETES */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm transition-opacity duration-300">
          
          <div className="bg-white rounded-2xl max-w-xl w-full overflow-hidden shadow-2xl border border-slate-100 flex flex-col max-h-[90vh] transition-all transform scale-100 duration-300">
            
            {/* Cabecera del Modal */}
            <div className="bg-slate-50 border-b border-slate-100 px-6 py-4 flex items-center justify-between">
              <div>
                <h3 className="text-base font-extrabold text-slate-800">
                  Marcación de Pesaje Inicial e Inscripción
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">Asignación de dorsal, control de lastre y número de precinto (Art. 20)</p>
              </div>
              
              <button
                onClick={handleCloseModal}
                className="text-slate-400 hover:text-slate-600 p-1 hover:bg-slate-100 rounded-lg transition-all"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Formulario */}
            <form onSubmit={handleSubmit(onSubmit)} className="flex-1 overflow-y-auto p-6 space-y-4">
              
              {/* CRITICAL ERROR FEEDBACK FOR 409 DUPLICATES */}
              {submitError && (
                <div className="p-3.5 bg-rose-50 border border-rose-100 rounded-xl text-rose-700 text-xs font-bold flex items-start space-x-2.5">
                  <svg className="w-4 h-4 mt-0.5 flex-shrink-0 text-rose-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                  </svg>
                  <span className="leading-snug">{submitError}</span>
                </div>
              )}

              {/* 1. AUTOCOMPLETE PARA JINETES (RIDER) */}
              <div className="relative">
                <Controller
                  control={control}
                  name="riderId"
                  render={({ field }) => <input type="hidden" {...field} />}
                />
                <label className="block text-xs font-extrabold text-slate-700 uppercase tracking-wider mb-1.5">
                  Jinete (Rider) *
                </label>

                {selectedRider ? (
                  <div className="flex items-center justify-between p-3 border border-emerald-200 bg-emerald-50 rounded-xl">
                    <div>
                      <span className="text-sm font-bold text-slate-800">{selectedRider.name}</span>
                      <span className="block text-[10px] text-slate-400 font-mono font-semibold">C.I. {selectedRider.nationalId}</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedRider(null);
                        setValue('riderId', '');
                      }}
                      className="p-1 hover:bg-emerald-100 rounded-md text-emerald-600 transition-colors"
                      title="Cambiar Jinete"
                    >
                      <svg className="w-4.5 h-4.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </button>
                  </div>
                ) : (
                  <div>
                    <input
                      type="text"
                      placeholder="Buscar jinete por nombre o cédula..."
                      value={riderSearch}
                      onChange={(e) => {
                        setRiderSearch(e.target.value);
                        setIsRiderDropdownOpen(true);
                      }}
                      onFocus={() => setIsRiderDropdownOpen(true)}
                      className="w-full px-3.5 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-equus-green/20 focus:border-equus-green text-slate-800 shadow-sm font-semibold"
                    />

                    {isRiderDropdownOpen && riderSearch && (
                      <div className="absolute z-30 left-0 right-0 mt-1 bg-white border border-slate-200 rounded-xl shadow-xl max-h-48 overflow-y-auto divide-y divide-slate-50">
                        {filteredRiders.length === 0 ? (
                          <div className="p-3 text-xs text-slate-400 italic text-center">No se encontraron jinetes</div>
                        ) : (
                          filteredRiders.map(rider => (
                            <button
                              key={rider.id}
                              type="button"
                              onClick={() => {
                                setSelectedRider(rider);
                                setValue('riderId', rider.id, { shouldValidate: true });
                                setIsRiderDropdownOpen(false);
                              }}
                              className="w-full text-left px-4 py-2.5 hover:bg-slate-50 text-xs transition-colors flex items-center justify-between"
                            >
                              <div>
                                <span className="font-bold text-slate-800 block">{rider.name}</span>
                                <span className="text-[10px] text-slate-400 font-mono">C.I. {rider.nationalId}</span>
                              </div>
                              <span className={`text-[9px] font-bold px-2 py-0.5 rounded border ${
                                rider.isFeuActive 
                                  ? 'bg-emerald-50 text-emerald-700 border-emerald-100' 
                                  : 'bg-rose-50 text-rose-700 border-rose-100'
                              }`}>
                                {rider.isFeuActive ? 'FEU Activo' : 'Inactivo'}
                              </span>
                            </button>
                          ))
                        )}
                      </div>
                    )}
                  </div>
                )}
                {errors.riderId && (
                  <p className="mt-1 text-xs font-bold text-rose-500">{errors.riderId.message}</p>
                )}
              </div>

              {/* 2. AUTOCOMPLETE PARA CABALLOS (HORSE) */}
              <div className="relative">
                <Controller
                  control={control}
                  name="horseId"
                  render={({ field }) => <input type="hidden" {...field} />}
                />
                <label className="block text-xs font-extrabold text-slate-700 uppercase tracking-wider mb-1.5">
                  Caballo (Horse) *
                </label>

                {selectedHorse ? (
                  <div className="flex items-center justify-between p-3 border border-emerald-200 bg-emerald-50 rounded-xl">
                    <div>
                      <span className="text-sm font-bold text-slate-800">{selectedHorse.name}</span>
                      {selectedHorse.chipId && (
                        <span className="block text-[10px] text-slate-400 font-mono font-semibold">Chip ID: {selectedHorse.chipId}</span>
                      )}
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedHorse(null);
                        setValue('horseId', '');
                      }}
                      className="p-1 hover:bg-emerald-100 rounded-md text-emerald-600 transition-colors"
                      title="Cambiar Caballo"
                    >
                      <svg className="w-4.5 h-4.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </button>
                  </div>
                ) : (
                  <div>
                    <input
                      type="text"
                      placeholder="Buscar caballo por nombre o chip..."
                      value={horseSearch}
                      onChange={(e) => {
                        setHorseSearch(e.target.value);
                        setIsHorseDropdownOpen(true);
                      }}
                      onFocus={() => setIsHorseDropdownOpen(true)}
                      className="w-full px-3.5 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-equus-green/20 focus:border-equus-green text-slate-800 shadow-sm font-semibold"
                    />

                    {isHorseDropdownOpen && horseSearch && (
                      <div className="absolute z-30 left-0 right-0 mt-1 bg-white border border-slate-200 rounded-xl shadow-xl max-h-48 overflow-y-auto divide-y divide-slate-50">
                        {filteredHorses.length === 0 ? (
                          <div className="p-3 text-xs text-slate-400 italic text-center">No se encontraron caballos</div>
                        ) : (
                          filteredHorses.map(horse => (
                            <button
                              key={horse.id}
                              type="button"
                              onClick={() => {
                                setSelectedHorse(horse);
                                setValue('horseId', horse.id, { shouldValidate: true });
                                setIsHorseDropdownOpen(false);
                              }}
                              className="w-full text-left px-4 py-2.5 hover:bg-slate-50 text-xs transition-colors flex items-center justify-between"
                            >
                              <div>
                                <span className="font-bold text-slate-800 block">{horse.name}</span>
                                {horse.owner && (
                                  <span className="text-[10px] text-slate-400">Propietario: {horse.owner.name}</span>
                                )}
                              </div>
                              <span className={`text-[9px] font-bold px-2 py-0.5 rounded border ${
                                horse.isFeuActive 
                                  ? 'bg-emerald-50 text-emerald-700 border-emerald-100' 
                                  : 'bg-rose-50 text-rose-700 border-rose-100'
                              }`}>
                                {horse.isFeuActive ? 'FEU Activo' : 'Inactivo'}
                              </span>
                            </button>
                          ))
                        )}
                      </div>
                    )}
                  </div>
                )}
                {errors.horseId && (
                  <p className="mt-1 text-xs font-bold text-rose-500">{errors.horseId.message}</p>
                )}
              </div>

              {/* 3. CLUB REPRESENTADO (OPCIONAL) */}
              <div>
                <label className="block text-xs font-extrabold text-slate-700 uppercase tracking-wider mb-1.5">
                  Club / Institución Representada (Opcional)
                </label>
                <select
                  {...register('representedTenantId')}
                  className="w-full px-3.5 py-2.5 border border-slate-200 rounded-xl text-sm bg-white focus:outline-none focus:ring-2 focus:ring-equus-green/20 focus:border-equus-green text-slate-800 shadow-sm font-semibold"
                >
                  <option value="">Seleccione un Club (Opcional)...</option>
                  {tenants.map(tenant => (
                    <option key={tenant.id} value={tenant.id}>
                      {tenant.name} {tenant.location ? `(${tenant.location})` : ''}
                    </option>
                  ))}
                </select>
                {errors.representedTenantId && (
                  <p className="mt-1 text-xs font-bold text-rose-500">{errors.representedTenantId.message}</p>
                )}
              </div>

              {/* 4. FILA DE DORSAL Y PESO DE LASTRE */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                
                {/* bibNumber (Dorsal) */}
                <div>
                  <label className="block text-xs font-extrabold text-slate-700 uppercase tracking-wider mb-1.5">
                    Dorsal / Chaleco Nro *
                  </label>
                  <input
                    type="number"
                    min="1"
                    placeholder="Ej: 15"
                    {...register('bibNumber', { valueAsNumber: true })}
                    className="w-full px-3.5 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-equus-green/20 focus:border-equus-green text-slate-800 font-bold font-mono shadow-sm"
                  />
                  {errors.bibNumber && (
                    <p className="mt-1 text-xs font-bold text-rose-500">{errors.bibNumber.message}</p>
                  )}
                </div>
 
                {/* ballastWeight (Lastre de peso) & sealNumber (Precinto) */}
                <div className="space-y-4">
                  <div>
                    <label className="block text-xs font-extrabold text-slate-700 uppercase tracking-wider mb-1.5 flex items-center">
                      ⚖️ Peso Registrado / Lastre (Kg) *
                      <span className="text-[9.5px] text-rose-500 font-extrabold ml-1.5 uppercase font-sans tracking-normal">(Obligatorio - Art. 20)</span>
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      placeholder="0.00"
                      {...register('ballastWeight', { valueAsNumber: true })}
                      className="w-full px-3.5 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-equus-green/20 focus:border-equus-green text-slate-800 font-bold font-mono shadow-sm"
                    />
                    {errors.ballastWeight && (
                      <p className="mt-1 text-xs font-bold text-rose-500">{errors.ballastWeight.message}</p>
                    )}
                  </div>

                  <div>
                    <label className="block text-xs font-extrabold text-slate-700 uppercase tracking-wider mb-1.5 flex items-center">
                      🔗 Número de Precinto *
                      <span className="text-[9.5px] text-rose-500 font-extrabold ml-1.5 uppercase font-sans tracking-normal">(Obligatorio)</span>
                    </label>
                    <input
                      type="text"
                      placeholder="Ej: P-98421"
                      {...register('sealNumber')}
                      className="w-full px-3.5 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-equus-green/20 focus:border-equus-green text-slate-800 font-bold font-mono shadow-sm"
                    />
                    {errors.sealNumber && (
                      <p className="mt-1 text-xs font-bold text-rose-500">{errors.sealNumber.message}</p>
                    )}
                  </div>
                </div>

              </div>

              {/* Acciones del Modal */}
              <div className="flex items-center justify-end space-x-3 pt-5 border-t border-slate-100 mt-6">
                <button
                  type="button"
                  onClick={handleCloseModal}
                  className="px-4 py-2 text-slate-500 hover:text-slate-700 text-sm font-bold transition-all focus:outline-none"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-6 py-2 bg-equus-green hover:bg-opacity-95 disabled:bg-opacity-50 text-white font-extrabold text-sm rounded-xl transition-all shadow-md focus:outline-none flex items-center space-x-2"
                >
                  {isSubmitting && (
                    <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                  )}
                  <span>Inscribir Binomio</span>
                </button>
              </div>

            </form>

          </div>
        </div>
      )}

    </div>
  );
}
