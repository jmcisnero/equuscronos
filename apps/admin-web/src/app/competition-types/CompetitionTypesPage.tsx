"use client";

import React, { useState, useEffect } from "react";
import {
  CompetitionType,
  CreateCompetitionTypeDto,
} from "@/types/competition-type";
import { CompetitionTypeService } from "@/services/api/competition-type.service";
import { useCompetitionRulesForm } from "@/hooks/useCompetitionRulesForm";
import { useAuthStore } from "@/store/auth.store";

export function CompetitionTypesPage() {
  const user = useAuthStore((state) => state.user);
  const isJudge = user?.role === "JUDGE";
  const [competitionTypes, setCompetitionTypes] = useState<CompetitionType[]>(
    [],
  );
  const [searchQuery, setSearchQuery] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingType, setEditingType] = useState<CompetitionType | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  // Custom hook for form states and synchronization logic
  const {
    name,
    setName,
    maxHeartRate,
    minWeightKg,
    recoveryTimeMins,
    minSpeedKh,
    maxTimeMins,
    isExpertMode,
    setIsExpertMode,
    rulesJsonString,
    jsonError,
    formError,
    setFormError,
    resetForm,
    loadFromType,
    getRulesPayload,
    handleFieldChange,
    handleJsonChange,
  } = useCompetitionRulesForm();

  // Load all competition types
  const loadCompetitionTypes = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await CompetitionTypeService.getAll();
      setCompetitionTypes(data);
    } catch (err: any) {
      setError(
        err.message || "Error al cargar las modalidades de competencia.",
      );
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadCompetitionTypes();
  }, []);

  const filteredTypes = competitionTypes.filter((t) =>
    t.name.toLowerCase().includes(searchQuery.toLowerCase()),
  );

  const handleOpenAddModal = () => {
    resetForm();
    setIsModalOpen(true);
  };

  const handleOpenEditModal = (type: CompetitionType) => {
    setEditingType(type);
    loadFromType(type.name, type.defaultRules);
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    resetForm();
    setEditingType(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    setFormError(null);

    // Frontend validations
    if (!name.trim()) {
      setFormError("El nombre de la modalidad es obligatorio.");
      setIsSaving(false);
      return;
    }

    const payloadRules = getRulesPayload();
    if (!payloadRules) {
      setIsSaving(false);
      return;
    }

    const payload: CreateCompetitionTypeDto = {
      name: name.trim(),
      defaultRules: payloadRules,
    };

    try {
      if (editingType) {
        await CompetitionTypeService.update(editingType.id, payload);
      } else {
        await CompetitionTypeService.create(payload);
      }
      setIsModalOpen(false);
      resetForm();
      setEditingType(null);
      loadCompetitionTypes();
    } catch (err: any) {
      setFormError(err.message || "Ocurrió un error al guardar la modalidad.");
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (id: string, typeName: string) => {
    if (
      confirm(
        `¿Está seguro de que desea eliminar la modalidad "${typeName}"? Esta acción no se puede deshacer y fallará si hay competencias asociadas a ella.`,
      )
    ) {
      try {
        await CompetitionTypeService.delete(id);
        loadCompetitionTypes();
      } catch (err: any) {
        alert(
          err.message ||
            "No se pudo eliminar la modalidad debido a restricciones de integridad.",
        );
      }
    }
  };

  return (
    <div className="space-y-6">
      {/* HEADER SECTION */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between space-y-4 sm:space-y-0">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-800 tracking-tight">
            Reglas y Modalidades
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            Configure plantillas de reglas de competencia (parámetros
            reglamentarios, límites de ritmo cardíaco y pesos mínimos) para
            automatizar la homologación.
          </p>
        </div>

        {!isJudge && (
          <button
            onClick={handleOpenAddModal}
            className="inline-flex items-center justify-center px-5 py-2.5 bg-equus-green hover:bg-opacity-95 text-white font-bold text-sm rounded-xl transition-all shadow-md hover:shadow-lg focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-equus-green whitespace-nowrap self-stretch sm:self-auto"
          >
            <svg
              className="w-5 h-5 mr-2 flex-shrink-0"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2.5}
                d="M12 4v16m8-8H4"
              />
            </svg>
            <span>Nueva Modalidad</span>
          </button>
        )}
      </div>

      {/* SEARCH BAR */}
      <div className="flex gap-2">
        <div className="relative flex-1">
          <span className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none text-slate-400">
            <svg
              className="w-5 h-5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
              />
            </svg>
          </span>
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Buscar modalidad por nombre..."
            className="w-full pl-10 pr-4 py-3 bg-white text-slate-800 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-equus-green/20 focus:border-equus-green placeholder-slate-400 shadow-sm"
          />
        </div>
      </div>

      {/* MODALITIES GRID LAYOUT */}
      {isLoading ? (
        <div className="py-20 text-center text-slate-500 font-medium flex flex-col items-center justify-center space-y-3">
          <svg
            className="animate-spin h-8 w-8 text-equus-green"
            fill="none"
            viewBox="0 0 24 24"
          >
            <circle
              className="opacity-25"
              cx="12"
              cy="12"
              r="10"
              stroke="currentColor"
              strokeWidth="4"
            />
            <path
              className="opacity-75"
              fill="currentColor"
              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
            />
          </svg>
          <span>Cargando plantillas de reglas...</span>
        </div>
      ) : error ? (
        <div className="py-12 text-center text-rose-600 font-semibold bg-white rounded-2xl border border-slate-100/50 p-6 shadow-sm">
          <p className="mb-2">⚠️ {error}</p>
          <button
            onClick={loadCompetitionTypes}
            className="text-xs text-equus-green underline font-bold"
          >
            Reintentar cargar
          </button>
        </div>
      ) : filteredTypes.length === 0 ? (
        <div className="py-20 text-center text-slate-500 bg-white rounded-2xl border border-slate-100/50 p-6 shadow-sm">
          <svg
            className="w-12 h-12 mx-auto text-slate-300 mb-3"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.5}
              d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
            />
          </svg>
          <p className="font-medium text-slate-700">
            No se encontraron modalidades de competencia.
          </p>
          <p className="text-xs text-slate-400 mt-1">
            Cree una plantilla para comenzar a definir reglas de carrera.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredTypes.map((type) => {
            const rules = type.defaultRules || {};
            const ruleKeys = Object.keys(rules);

            return (
              <div
                key={type.id}
                className="bg-white border border-slate-100 rounded-2xl p-6 shadow-sm flex flex-col justify-between hover:shadow-md hover:border-slate-200/60 transition-all duration-300"
              >
                <div>
                  {/* MODALITY TITLE */}
                  <div className="flex justify-between items-start mb-4">
                    <h3 className="font-bold text-slate-800 text-lg leading-snug">
                      {type.name}
                    </h3>
                  </div>

                  {/* RULE VALUES DISPLAY */}
                  <div className="space-y-2 mb-6">
                    <span className="text-[11px] font-extrabold text-slate-400 uppercase tracking-widest block mb-2">
                      Parámetros Reglamentarios
                    </span>

                    {ruleKeys.length === 0 ? (
                      <span className="text-xs text-slate-400 italic">
                        Sin reglas definidas. Todo manual.
                      </span>
                    ) : (
                      <div className="grid grid-cols-2 gap-2 text-xs">
                        {rules.max_heart_rate !== undefined && (
                          <div className="bg-slate-50/50 p-2 rounded-xl border border-slate-100/50 flex flex-col justify-between">
                            <span className="text-[10px] text-slate-400 font-semibold block">
                              BPM Máximo
                            </span>
                            <span className="font-bold text-slate-700 text-sm">
                              {rules.max_heart_rate} bpm
                            </span>
                          </div>
                        )}
                        {(rules.min_weight_kg !== undefined ||
                          rules.min_weight !== undefined) && (
                          <div className="bg-slate-50/50 p-2 rounded-xl border border-slate-100/50 flex flex-col justify-between">
                            <span className="text-[10px] text-slate-400 font-semibold block">
                              Peso Mínimo
                            </span>
                            <span className="font-bold text-slate-700 text-sm">
                              {rules.min_weight_kg !== undefined
                                ? rules.min_weight_kg
                                : rules.min_weight}{" "}
                              kg
                            </span>
                          </div>
                        )}
                        {rules.recovery_time_mins !== undefined && (
                          <div className="bg-slate-50/50 p-2 rounded-xl border border-slate-100/50 flex flex-col justify-between">
                            <span className="text-[10px] text-slate-400 font-semibold block">
                              Tiempo Recup.
                            </span>
                            <span className="font-bold text-slate-700 text-sm">
                              {rules.recovery_time_mins} min
                            </span>
                          </div>
                        )}
                        {rules.min_speed_kh !== undefined && (
                          <div className="bg-slate-50/50 p-2 rounded-xl border border-slate-100/50 flex flex-col justify-between">
                            <span className="text-[10px] text-slate-400 font-semibold block">
                              Vel. Mínima
                            </span>
                            <span className="font-bold text-slate-700 text-sm">
                              {rules.min_speed_kh} km/h
                            </span>
                          </div>
                        )}
                        {rules.max_time_mins !== undefined && (
                          <div className="bg-slate-50/50 p-2 rounded-xl border border-slate-100/50 flex flex-col justify-between sm:col-span-2">
                            <span className="text-[10px] text-slate-400 font-semibold block">
                              Tiempo Máximo
                            </span>
                            <span className="font-bold text-slate-700 text-sm">
                              {rules.max_time_mins} min
                            </span>
                          </div>
                        )}
                      </div>
                    )}

                    {/* OTHER CUSTOM RULES IN THE JSON */}
                    {ruleKeys.some(
                      (k) =>
                        ![
                          "max_heart_rate",
                          "min_weight",
                          "min_weight_kg",
                          "recovery_time_mins",
                          "min_speed_kh",
                          "max_time_mins",
                        ].includes(k),
                    ) && (
                      <div className="mt-3">
                        <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wide block mb-1">
                          Otros Parámetros
                        </span>
                        <div className="flex flex-wrap gap-1">
                          {ruleKeys
                            .filter(
                              (k) =>
                                ![
                                  "max_heart_rate",
                                  "min_weight",
                                  "min_weight_kg",
                                  "recovery_time_mins",
                                  "min_speed_kh",
                                  "max_time_mins",
                                ].includes(k),
                            )
                            .map((k) => (
                              <span
                                key={k}
                                className="inline-flex items-center text-[10px] bg-slate-100/75 border border-slate-200/50 text-slate-600 px-2 py-0.5 rounded-md font-sans tabular-nums"
                              >
                                {k}: {String(rules[k])}
                              </span>
                            ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* ACTION BUTTONS */}
                <div className="flex items-center justify-between pt-4 border-t border-slate-100 mt-auto">
                  <span className="text-[10px] text-slate-400 font-sans tabular-nums">
                    {type.createdAt
                      ? `Creado: ${type.createdAt.substring(0, 10)}`
                      : ""}
                  </span>

                  {!isJudge && (
                    <div className="flex items-center space-x-1">
                      <button
                        onClick={() => handleOpenEditModal(type)}
                        className="p-2 text-slate-400 hover:text-equus-green hover:bg-slate-100 rounded-lg transition-all"
                        title="Editar Modalidad"
                      >
                        <svg
                          className="w-4 h-4"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
                          />
                        </svg>
                      </button>

                      <button
                        onClick={() => handleDelete(type.id, type.name)}
                        className="p-2 text-slate-400 hover:text-rose-500 hover:bg-rose-50 rounded-lg transition-all"
                        title="Eliminar Modalidad"
                      >
                        <svg
                          className="w-4 h-4"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                          />
                        </svg>
                      </button>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* PREMIUM CREATION/EDIT MODAL */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fade-in overflow-y-auto">
          <div className="bg-white rounded-2xl max-w-2xl w-full overflow-hidden shadow-2xl border border-slate-100 animate-slide-up my-8">
            {/* Modal Header */}
            <div className="bg-slate-50 border-b border-slate-100 px-6 py-4 flex items-center justify-between">
              <div>
                <h3 className="text-base font-extrabold text-slate-800">
                  {editingType
                    ? "Modificar Modalidad / Plantilla"
                    : "Registrar Nueva Modalidad"}
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  Control de Parámetros Reglamentarios
                </p>
              </div>

              <button
                onClick={handleCloseModal}
                className="text-slate-400 hover:text-slate-600 p-1 hover:bg-slate-100 rounded-lg transition-all"
              >
                <svg
                  className="w-5 h-5"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              </button>
            </div>

            {/* Modal Form */}
            <form onSubmit={handleSubmit} className="p-6 space-y-5">
              {formError && (
                <div className="p-3.5 bg-rose-50 border border-rose-100 rounded-xl text-rose-600 text-xs font-semibold flex items-center space-x-2">
                  <svg
                    className="w-4 h-4 flex-shrink-0"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                    />
                  </svg>
                  <span>{formError}</span>
                </div>
              )}

              {/* Modality Name */}
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  Nombre de la Modalidad *
                </label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Ej: Enduro FEI 120km, FEU Long Raid"
                  className="w-full px-3.5 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-equus-green/20 focus:border-equus-green text-slate-800 shadow-sm"
                />
              </div>

              {/* STANDARD FORM FIELDS SECTION */}
              <div className="border-t border-slate-100 pt-4 space-y-4">
                <span className="text-xs font-extrabold text-slate-500 uppercase tracking-wider block mb-1">
                  Configuración de Reglas Predefinidas
                </span>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {/* Frecuencia Cardíaca Máxima (bpm) */}
                  <div className="relative">
                    <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1.5 flex items-center">
                      <svg
                        className="w-3.5 h-3.5 mr-1 text-rose-500"
                        fill="currentColor"
                        viewBox="0 0 20 20"
                      >
                        <path
                          fillRule="evenodd"
                          d="M3.172 5.172a4 4 0 015.656 0L10 6.343l1.172-1.171a4 4 0 115.656 5.656L10 17.657l-6.828-6.829a4 4 0 010-5.656z"
                          clipRule="evenodd"
                        />
                      </svg>
                      Frecuencia Cardíaca Máx (bpm)
                    </label>
                    <input
                      type="number"
                      value={maxHeartRate}
                      onChange={(e) =>
                        handleFieldChange(
                          "max_heart_rate",
                          e.target.value !== "" ? Number(e.target.value) : "",
                        )
                      }
                      placeholder="Ej: 64"
                      className="w-full px-3.5 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-equus-green/20 focus:border-equus-green text-slate-800 shadow-sm"
                    />
                  </div>

                  {/* Peso Mínimo del Jinete (kg) */}
                  <div className="relative">
                    <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1.5 flex items-center">
                      <svg
                        className="w-3.5 h-3.5 mr-1 text-amber-600"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M3 6l3 1m0 0l-3 9a5.002 5.002 0 006.001 0M6 7l3 9M6 7l6-2m6 2l3-1m-3 1l-3 9a5.002 5.002 0 006.001 0M18 7l3 9m-3-9l-6-2m0-2v2m0 16V5m0 16H9m3 0h3"
                        />
                      </svg>
                      Peso Mínimo del Jinete (kg)
                    </label>
                    <input
                      type="number"
                      value={minWeightKg}
                      onChange={(e) =>
                        handleFieldChange(
                          "min_weight_kg",
                          e.target.value !== "" ? Number(e.target.value) : "",
                        )
                      }
                      placeholder="Ej: 75"
                      className="w-full px-3.5 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-equus-green/20 focus:border-equus-green text-slate-800 shadow-sm"
                    />
                  </div>

                  {/* Tiempo de Recuperación Vet (min) */}
                  <div className="relative">
                    <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1.5 flex items-center">
                      <svg
                        className="w-3.5 h-3.5 mr-1 text-blue-500"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
                        />
                      </svg>
                      Tiempo Recuperación Vet (min)
                    </label>
                    <input
                      type="number"
                      value={recoveryTimeMins}
                      onChange={(e) =>
                        handleFieldChange(
                          "recovery_time_mins",
                          e.target.value !== "" ? Number(e.target.value) : "",
                        )
                      }
                      placeholder="Ej: 20"
                      className="w-full px-3.5 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-equus-green/20 focus:border-equus-green text-slate-800 shadow-sm"
                    />
                  </div>

                  {/* Velocidad Mínima (km/h) */}
                  <div className="relative">
                    <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1.5 flex items-center">
                      <svg
                        className="w-3.5 h-3.5 mr-1 text-emerald-500"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M13 10V3L4 14h7v7l9-11h-7z"
                        />
                      </svg>
                      Velocidad Mínima (km/h)
                    </label>
                    <input
                      type="number"
                      value={minSpeedKh}
                      onChange={(e) =>
                        handleFieldChange(
                          "min_speed_kh",
                          e.target.value !== "" ? Number(e.target.value) : "",
                        )
                      }
                      placeholder="Ej: 14"
                      className="w-full px-3.5 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-equus-green/20 focus:border-equus-green text-slate-800 shadow-sm"
                    />
                  </div>

                  {/* Tiempo Máximo Permitido (min) */}
                  <div className="relative sm:col-span-2">
                    <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1.5 flex items-center">
                      <svg
                        className="w-3.5 h-3.5 mr-1 text-purple-500"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                        />
                      </svg>
                      Tiempo Máximo Permitido (min)
                    </label>
                    <input
                      type="number"
                      value={maxTimeMins}
                      onChange={(e) =>
                        handleFieldChange(
                          "max_time_mins",
                          e.target.value !== "" ? Number(e.target.value) : "",
                        )
                      }
                      placeholder="Ej: 180"
                      className="w-full px-3.5 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-equus-green/20 focus:border-equus-green text-slate-800 shadow-sm"
                    />
                  </div>
                </div>
              </div>

              {/* EXPERT MODE JSON SECTION */}
              <div className="space-y-4 border-t border-slate-100 pt-4">
                {/* Toggle switch for expert mode */}
                <div className="flex items-center justify-between p-3.5 bg-slate-50 border border-slate-200 rounded-2xl">
                  <div className="flex flex-col">
                    <span className="text-xs font-bold text-slate-700">
                      Modo Experto (JSON)
                    </span>
                    <span className="text-[10px] text-slate-400">
                      Edite las reglas en formato JSON bruto
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setIsExpertMode(!isExpertMode)}
                    className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-equus-green ${
                      isExpertMode ? "bg-equus-green" : "bg-slate-200"
                    }`}
                  >
                    <span
                      className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                        isExpertMode ? "translate-x-5" : "translate-x-0"
                      }`}
                    />
                  </button>
                </div>

                {/* Raw JSON editor (shown only when expert mode is enabled) */}
                {isExpertMode && (
                  <div className="space-y-2 animate-fade-in">
                    <div className="flex items-center justify-between mb-1">
                      <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                        Editor de Reglas JSON Avanzado
                      </label>
                      {jsonError ? (
                        <span className="text-[10px] text-rose-500 font-semibold bg-rose-50 px-2 py-0.5 rounded border border-rose-100 animate-pulse">
                          JSON Inválido
                        </span>
                      ) : (
                        <span className="text-[10px] text-emerald-600 font-semibold bg-emerald-50 px-2 py-0.5 rounded border border-emerald-100">
                          JSON Correcto
                        </span>
                      )}
                    </div>

                    <div className="relative rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
                      {/* Editor Header */}
                      <div className="bg-slate-800 text-slate-400 px-4 py-2.5 text-xs font-sans tabular-nums flex items-center justify-between border-b border-slate-700 select-none">
                        <span className="flex items-center space-x-1.5">
                          <span className="w-2.5 h-2.5 rounded-full bg-rose-500"></span>
                          <span className="w-2.5 h-2.5 rounded-full bg-amber-500"></span>
                          <span className="w-2.5 h-2.5 rounded-full bg-emerald-500"></span>
                          <span className="pl-2">default_rules.json</span>
                        </span>
                        <span>JSON Schema</span>
                      </div>

                      <textarea
                        value={rulesJsonString}
                        onChange={(e) => handleJsonChange(e.target.value)}
                        rows={6}
                        className="w-full block bg-slate-900 text-slate-100 p-4 font-sans tabular-nums text-xs focus:outline-none resize-y leading-relaxed"
                        placeholder={'{\n  "max_heart_rate": 64\n}'}
                      />
                    </div>
                    {jsonError && (
                      <p className="mt-1 text-[11px] font-sans tabular-nums text-rose-500 leading-snug">
                        {jsonError}
                      </p>
                    )}
                    <p className="text-[10px] text-slate-400 leading-relaxed">
                      * Los cambios realizados en el JSON actualizarán
                      automáticamente los campos estándar de arriba. Puede
                      agregar cualquier regla personalizada adicional aquí.
                    </p>
                  </div>
                )}
              </div>

              {/* Action buttons */}
              <div className="flex items-center justify-end space-x-3 pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={handleCloseModal}
                  className="px-4 py-2 text-slate-500 hover:text-slate-700 text-sm font-bold transition-all focus:outline-none"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isSaving || (isExpertMode && jsonError !== null)}
                  className="px-6 py-2 bg-equus-green hover:bg-opacity-95 disabled:bg-opacity-50 text-white font-bold text-sm rounded-xl transition-all shadow-md focus:outline-none flex items-center space-x-2"
                >
                  {isSaving && (
                    <svg
                      className="animate-spin -ml-1 mr-2 h-4 w-4 text-white"
                      fill="none"
                      viewBox="0 0 24 24"
                    >
                      <circle
                        className="opacity-25"
                        cx="12"
                        cy="12"
                        r="10"
                        stroke="currentColor"
                        strokeWidth="4"
                      />
                      <path
                        className="opacity-75"
                        fill="currentColor"
                        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                      />
                    </svg>
                  )}
                  <span>{editingType ? "Guardar Cambios" : "Registrar"}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
