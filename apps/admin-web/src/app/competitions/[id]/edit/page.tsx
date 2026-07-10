"use client";

import React, { useState, useEffect, use } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { CompetitionService } from "@/services/api/competition.service";
import { CreateStageDto } from "@/types/competition";

export default function CompetitionEditPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const resolvedParams = use(params);
  const id = resolvedParams.id;
  const router = useRouter();
  const queryClient = useQueryClient();

  const [isSaving, setIsSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const {
    data: comp,
    isLoading,
    error,
  } = useQuery({
    queryKey: ["competition", id],
    queryFn: () => CompetitionService.getById(id),
    enabled: !!id,
  });

  const [formData, setFormData] = useState<{
    name: string;
    competitionDate: string;
    startTime: string;
    location: string;
    isFederated: boolean;
    maxHeartRate: number;
    stages: CreateStageDto[];
  }>({
    name: "",
    competitionDate: "",
    startTime: "07:00",
    location: "",
    isFederated: true,
    maxHeartRate: 65,
    stages: [],
  });

  const [tempStage, setTempStage] = useState<{
    distanceKm: string;
    neutralizationMinutes: string;
  }>({
    distanceKm: "",
    neutralizationMinutes: "",
  });

  useEffect(() => {
    if (comp) {
      setFormData({
        name: comp.name,
        competitionDate: comp.competitionDate
          ? comp.competitionDate.substring(0, 10)
          : "",
        startTime: comp.startTime ? comp.startTime.substring(0, 5) : "07:00",
        location: comp.location || "",
        isFederated: comp.isFederated ?? false,
        maxHeartRate: comp.maxHeartRate ?? 65,
        stages: (comp.stages || []).map((s) => ({
          stageNumber: s.stageNumber,
          distanceKm: typeof s.distanceKm === "string" ? parseFloat(s.distanceKm) : s.distanceKm,
          neutralizationMinutes: typeof s.neutralizationMinutes === "string" ? parseInt(s.neutralizationMinutes, 10) : (s.neutralizationMinutes ?? 0),
        })),
      });
    }
  }, [comp]);

  if (isLoading) {
    return (
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
        <span>Cargando datos de la competencia...</span>
      </div>
    );
  }

  if (error || !comp) {
    return (
      <div className="py-12 text-center text-rose-600 font-semibold max-w-lg mx-auto">
        <p className="mb-4">⚠️ No se pudo cargar la competencia para editar.</p>
        <Link
          href="/competitions"
          className="px-4 py-2 bg-slate-800 text-white rounded-xl font-bold text-sm"
        >
          Volver al Calendario
        </Link>
      </div>
    );
  }

  const isFieldsDisabled = comp.status !== "PLANNED";

  const handleAutocompletePreset = () => {
    setFormData((prev) => ({
      ...prev,
      stages: [
        { stageNumber: 1, distanceKm: 40, neutralizationMinutes: 60 },
        { stageNumber: 2, distanceKm: 20, neutralizationMinutes: 0 },
      ],
    }));
  };

  const handleAddStage = () => {
    const dist = parseFloat(tempStage.distanceKm);
    const neut = parseInt(tempStage.neutralizationMinutes || "0", 10);

    if (isNaN(dist) || dist <= 0) {
      alert("La distancia debe ser un número mayor a 0 Km.");
      return;
    }
    if (isNaN(neut) || neut < 0) {
      alert("Los minutos de neutralización deben ser un número positivo.");
      return;
    }

    const nextStageNumber = formData.stages.length + 1;
    const newStage: CreateStageDto = {
      stageNumber: nextStageNumber,
      distanceKm: dist,
      neutralizationMinutes: neut,
    };

    setFormData((prev) => ({
      ...prev,
      stages: [...prev.stages, newStage],
    }));

    setTempStage({
      distanceKm: "",
      neutralizationMinutes: "",
    });
  };

  const handleRemoveStage = (index: number) => {
    setFormData((prev) => {
      const updated = prev.stages.filter((_, i) => i !== index);
      const reindexed = updated.map((s, i) => ({
        ...s,
        stageNumber: i + 1,
      }));
      return { ...prev, stages: reindexed };
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    setFormError(null);

    if (!formData.name.trim()) {
      setFormError("El nombre oficial es requerido.");
      setIsSaving(false);
      return;
    }
    if (!formData.competitionDate) {
      setFormError("La fecha es obligatoria.");
      setIsSaving(false);
      return;
    }

    const cleanStages = (formData.stages || []).map((s) => ({
      stageNumber: s.stageNumber,
      distanceKm: typeof s.distanceKm === "string" ? parseFloat(s.distanceKm) : s.distanceKm,
      neutralizationMinutes: typeof s.neutralizationMinutes === "string" ? parseInt(s.neutralizationMinutes, 10) : (s.neutralizationMinutes ?? 0),
    }));

    try {
      await CompetitionService.update(comp.id, {
        name: formData.name.trim(),
        competitionDate: formData.competitionDate,
        startTime:
          formData.startTime.length === 5
            ? `${formData.startTime}:00`
            : formData.startTime,
        location: formData.location.trim() || undefined,
        maxHeartRate: formData.maxHeartRate,
        stages: cleanStages,
      });

      queryClient.invalidateQueries({ queryKey: ["competition", comp.id] });
      queryClient.invalidateQueries({ queryKey: ["competitions"] });
      router.push(`/competitions/${comp.id}`);
    } catch (err: any) {
      console.error(err);
      setFormError(err.message || "Error al actualizar la competencia.");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      {/* Cabecera */}
      <div className="flex items-center justify-between">
        <div>
          <nav className="flex items-center space-x-2 text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">
            <Link
              href="/competitions"
              className="hover:text-equus-green transition-colors"
            >
              Calendario
            </Link>
            <span>/</span>
            <Link
              href={`/competitions/${comp.id}`}
              className="hover:text-equus-green transition-colors"
            >
              {comp.name}
            </Link>
            <span>/</span>
            <span className="text-slate-600">Editar</span>
          </nav>
          <h1 className="text-2xl font-extrabold text-slate-800 tracking-tight">
            {isFieldsDisabled
              ? "Detalles de Competencia (Inmutable)"
              : "Modificar Competencia"}
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Estado de carrera actual:{" "}
            <span className="font-bold text-slate-600">{comp.status}</span>
          </p>
        </div>
      </div>

      {formError && (
        <div className="p-3 bg-rose-50 border border-rose-100 rounded-xl text-rose-600 text-xs font-semibold flex items-center space-x-2">
          <span>⚠️ {formError}</span>
        </div>
      )}

      <form
        onSubmit={handleSubmit}
        className="bg-white rounded-2xl p-6 shadow-sm border border-slate-100/80 space-y-5"
      >
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {/* Nombre Oficial */}
          <div className="sm:col-span-2">
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
              Nombre Oficial de la Competencia *
            </label>
            <input
              type="text"
              required
              disabled={isFieldsDisabled}
              value={formData.name}
              onChange={(e) =>
                setFormData({ ...formData, name: e.target.value })
              }
              className="w-full px-3.5 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:border-equus-green text-slate-800 shadow-sm font-semibold disabled:bg-slate-50 disabled:text-slate-500"
            />
          </div>

          {/* Fecha y Hora */}
          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
              Fecha y Hora de Largada *
            </label>
            <input
              type="datetime-local"
              required
              disabled={isFieldsDisabled}
              value={
                formData.competitionDate && formData.startTime
                  ? `${formData.competitionDate}T${formData.startTime}`
                  : ""
              }
              onChange={(e) => {
                const val = e.target.value;
                if (val) {
                  const [date, time] = val.split("T");
                  setFormData({
                    ...formData,
                    competitionDate: date,
                    startTime: time ? time.substring(0, 5) : "07:00",
                  });
                }
              }}
              className="w-full px-3.5 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:border-equus-green text-slate-800 shadow-sm font-semibold disabled:bg-slate-50 disabled:text-slate-500"
            />
          </div>

          {/* Ubicación */}
          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
              Predio / Localización
            </label>
            <input
              type="text"
              disabled={isFieldsDisabled}
              value={formData.location}
              onChange={(e) =>
                setFormData({ ...formData, location: e.target.value })
              }
              className="w-full px-3.5 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:border-equus-green text-slate-800 shadow-sm disabled:bg-slate-50 disabled:text-slate-500"
            />
          </div>

          {/* Pulsaciones Vet Gate */}
          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
              Pulsaciones Máximas Vet Gate (ppm) *
            </label>
            <input
              type="number"
              min="40"
              max="80"
              required
              disabled={isFieldsDisabled}
              value={formData.maxHeartRate}
              onChange={(e) =>
                setFormData({
                  ...formData,
                  maxHeartRate: parseInt(e.target.value, 10) || 65,
                })
              }
              className="w-full px-3.5 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:border-equus-green text-slate-800 shadow-sm font-semibold disabled:bg-slate-50 disabled:text-slate-500"
            />
          </div>
        </div>

        {/* Sección de Etapas */}
        <div className="border-t border-slate-100 pt-5 space-y-4">
          {/* Banner de bloqueo de etapas */}
          {isFieldsDisabled && (
            <div className="p-3 bg-amber-50 border border-amber-250 rounded-xl text-amber-705 text-xs font-semibold flex items-center space-x-2">
              <svg
                className="w-4 h-4 text-amber-500"
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
              <span>
                Etapas bloqueadas: La competencia ya ha iniciado o finalizado.
              </span>
            </div>
          )}

          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between space-y-2 sm:space-y-0">
            <div>
              <h4 className="text-sm font-extrabold text-slate-800">
                Fases y Etapas del Evento
              </h4>
              <p className="text-[11px] text-slate-400 mt-0.5">
                Defina las distancias de carrera y tiempos de neutralización.
              </p>
            </div>

            {!isFieldsDisabled && (
              <button
                type="button"
                onClick={handleAutocompletePreset}
                className="inline-flex items-center px-3 py-1.5 bg-slate-100 hover:bg-slate-200/80 text-slate-600 hover:text-slate-800 text-xs font-bold rounded-lg transition-all"
              >
                ⚡ Autocompletar Raid Corto Estándar (60 Km)
              </button>
            )}
          </div>

          {/* Agregar Etapa */}
          {!isFieldsDisabled && (
            <div className="p-4 bg-slate-50 border border-slate-200/60 rounded-xl space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">
                    Distancia (Km)
                  </label>
                  <input
                    type="number"
                    step="0.1"
                    placeholder="Ej: 40"
                    value={tempStage.distanceKm}
                    onChange={(e) =>
                      setTempStage({ ...tempStage, distanceKm: e.target.value })
                    }
                    className="w-full px-3 py-1.5 border border-slate-200 rounded-lg text-sm bg-white focus:border-equus-green text-slate-800 font-semibold"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">
                    Neutralización (Minutos)
                  </label>
                  <input
                    type="number"
                    placeholder="Ej: 60"
                    value={tempStage.neutralizationMinutes}
                    onChange={(e) =>
                      setTempStage({
                        ...tempStage,
                        neutralizationMinutes: e.target.value,
                      })
                    }
                    className="w-full px-3 py-1.5 border border-slate-200 rounded-lg text-sm bg-white focus:border-equus-green text-slate-800 font-semibold"
                  />
                </div>
              </div>
              <div className="flex items-center justify-between pt-1">
                <span className="text-[10px] text-slate-400">
                  Siguiente Etapa:{" "}
                  <span className="font-bold text-slate-600">
                    Etapa Nro. {formData.stages.length + 1}
                  </span>
                </span>
                <button
                  type="button"
                  onClick={handleAddStage}
                  className="px-4 py-1.5 bg-equus-green text-white font-bold text-xs rounded-lg shadow-sm"
                >
                  + Agregar Etapa
                </button>
              </div>
            </div>
          )}

          {/* Tabla de Etapas */}
          {formData.stages.length > 0 ? (
            <div className="bg-white border border-slate-105 rounded-xl overflow-hidden shadow-sm">
              <table className="min-w-full divide-y divide-slate-100">
                <thead className="bg-slate-50">
                  <tr>
                    <th className="px-4 py-2.5 text-left text-[10px] font-bold text-slate-500 uppercase">
                      Orden
                    </th>
                    <th className="px-4 py-2.5 text-left text-[10px] font-bold text-slate-500 uppercase">
                      Distancia
                    </th>
                    <th className="px-4 py-2.5 text-left text-[10px] font-bold text-slate-500 uppercase">
                      Neutralización
                    </th>
                    {!isFieldsDisabled && (
                      <th className="px-4 py-2.5 text-right text-[10px] font-bold text-slate-500 uppercase">
                        Remover
                      </th>
                    )}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-sans tabular-nums text-sm">
                  {formData.stages.map((stage, idx) => (
                    <tr key={idx} className="hover:bg-slate-50/50">
                      <td className="px-4 py-2 font-bold text-slate-700">
                        Etapa {stage.stageNumber}
                      </td>
                      <td className="px-4 py-2 text-slate-800 font-semibold">
                        {isFieldsDisabled ? (
                          <span>{stage.distanceKm} Km</span>
                        ) : (
                          <div className="flex items-center space-x-1">
                            <input
                              type="number"
                              step="0.1"
                              min="0.1"
                              value={stage.distanceKm}
                              onChange={(e) => {
                                const val = parseFloat(e.target.value);
                                setFormData((prev) => {
                                  const updated = [...prev.stages];
                                  updated[idx] = {
                                    ...updated[idx],
                                    distanceKm: isNaN(val) ? 0 : val,
                                  };
                                  return { ...prev, stages: updated };
                                });
                              }}
                              className="w-20 px-2 py-1 border border-slate-200 rounded text-sm bg-white font-sans tabular-nums font-semibold text-slate-800"
                            />
                            <span className="text-xs text-slate-400">Km</span>
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-2 text-slate-600">
                        {isFieldsDisabled ? (
                          <span>{stage.neutralizationMinutes} minutos</span>
                        ) : (
                          <div className="flex items-center space-x-1">
                            <input
                              type="number"
                              min="0"
                              value={stage.neutralizationMinutes}
                              onChange={(e) => {
                                const val = parseInt(e.target.value, 10);
                                setFormData((prev) => {
                                  const updated = [...prev.stages];
                                  updated[idx] = {
                                    ...updated[idx],
                                    neutralizationMinutes: isNaN(val) ? 0 : val,
                                  };
                                  return { ...prev, stages: updated };
                                });
                              }}
                              className="w-20 px-2 py-1 border border-slate-200 rounded text-sm bg-white font-sans tabular-nums text-slate-700"
                            />
                            <span className="text-xs text-slate-400">min</span>
                          </div>
                        )}
                      </td>
                      {!isFieldsDisabled && (
                        <td className="px-4 py-2 text-right">
                          <button
                            type="button"
                            onClick={() => {
                              if (
                                confirm(
                                  `¿Está seguro de que desea eliminar la Etapa ${stage.stageNumber}?`,
                                )
                              ) {
                                handleRemoveStage(idx);
                              }
                            }}
                            className="p-1 text-slate-400 hover:text-rose-500 rounded-md"
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
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="text-center py-6 border-2 border-dashed border-slate-200 rounded-xl text-slate-400 text-xs">
              No se han definido etapas aún.
            </div>
          )}
        </div>

        {/* Acciones */}
        <div className="flex justify-end space-x-3 pt-4 border-t border-slate-100">
          <Link
            href={`/competitions/${comp.id}`}
            className="px-4 py-2 text-slate-500 hover:text-slate-700 text-sm font-bold"
          >
            Cancelar
          </Link>
          {!isFieldsDisabled && (
            <button
              type="submit"
              disabled={isSaving}
              className="px-6 py-2 bg-equus-green text-white font-bold text-sm rounded-xl shadow-md disabled:bg-opacity-50"
            >
              {isSaving ? "Guardando..." : "Guardar Cambios"}
            </button>
          )}
        </div>
      </form>
    </div>
  );
}
