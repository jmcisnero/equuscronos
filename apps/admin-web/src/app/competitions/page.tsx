"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Competition,
  CreateCompetitionDto,
  CreateStageDto,
} from "@/types/competition";
import { CompetitionService } from "@/services/api/competition.service";
import { Tenant } from "@/types/tenant";
import { CompetitionType } from "@/types/competition-type";
import { TenantService } from "@/services/api/tenant.service";
import { CompetitionTypeService } from "@/services/api/competition-type.service";
import { useAuthStore } from "@/store/auth.store";
import { useQueryClient } from "@tanstack/react-query";

const DEFAULT_TENANT_ID = "a1000000-0000-0000-0000-000000000001"; // Sociedad Hípica de Melo
const DEFAULT_COMP_TYPE_ID = "c1000000-0000-0000-0000-000000000001"; // Raid FEU 60km

export default function CompetitionsPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const user = useAuthStore((state) => state.user);
  const [competitions, setCompetitions] = useState<Competition[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Datos para los dropdowns dinámicos
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [competitionTypes, setCompetitionTypes] = useState<CompetitionType[]>(
    [],
  );

  // Estados para el Formulario en Modal
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [editingCompetition, setEditingCompetition] =
    useState<Competition | null>(null);

  const isFieldsDisabled =
    editingCompetition !== null && editingCompetition.status !== "PLANNED";

  // Estado del Formulario
  const [formData, setFormData] = useState<{
    name: string;
    competitionDate: string;
    startTime: string;
    location: string;
    isFederated: boolean;
    maxHeartRate: number;
    stages: CreateStageDto[];
    tenantId: string;
    competitionTypeId: string;
  }>({
    name: "",
    competitionDate: "",
    startTime: "07:00",
    location: "",
    isFederated: true,
    maxHeartRate: 65,
    stages: [],
    tenantId: "",
    competitionTypeId: "",
  });

  // Campos temporales para agregar una etapa individual
  const [tempStage, setTempStage] = useState<{
    distanceKm: string;
    neutralizationMinutes: string;
  }>({
    distanceKm: "",
    neutralizationMinutes: "",
  });

  // Cargar competencias desde la API
  const loadCompetitions = async (query?: string) => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await CompetitionService.getAll(query);

      // Filtrar localmente en base a searchQuery si la API no realiza búsqueda directa
      const filtered = query
        ? data.filter(
            (c) =>
              c.name.toLowerCase().includes(query.toLowerCase()) ||
              (c.location &&
                c.location.toLowerCase().includes(query.toLowerCase())),
          )
        : data;

      setCompetitions(filtered);
    } catch (err: any) {
      setError(err.message || "Error al cargar la lista de competencias.");
    } finally {
      setIsLoading(false);
    }
  };

  const loadInitialData = async () => {
    try {
      const [tenantsData, compTypesData] = await Promise.all([
        TenantService.getAll(),
        CompetitionTypeService.getAll(),
      ]);
      setTenants(tenantsData);
      setCompetitionTypes(compTypesData);

      // Auto-seleccionar el primer tenant y compType si existen
      if (user?.tenantId) {
        setFormData((prev) => ({ ...prev, tenantId: user.tenantId || "" }));
      } else if (tenantsData.length > 0) {
        setFormData((prev) => ({ ...prev, tenantId: tenantsData[0].id }));
      }
      if (compTypesData.length > 0) {
        const defaultCompType = compTypesData[0];
        const defaultHeartRate =
          defaultCompType.defaultRules?.max_heart_rate ?? 65;
        setFormData((prev) => ({
          ...prev,
          competitionTypeId: defaultCompType.id,
          maxHeartRate: defaultHeartRate,
        }));
      }
    } catch (err: any) {
      console.error(
        "Error al cargar datos iniciales de clubes y modalidades:",
        err,
      );
    }
  };

  useEffect(() => {
    loadCompetitions();
    loadInitialData();
  }, [user?.tenantId]);

  useEffect(() => {
    if (user?.tenantId) {
      setFormData((prev) => ({ ...prev, tenantId: user.tenantId || "" }));
    }
  }, [user?.tenantId]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    loadCompetitions(searchQuery);
  };

  // Restablecer formulario
  const resetForm = () => {
    setEditingCompetition(null);
    const defaultCompType = competitionTypes[0];
    const defaultHeartRate =
      defaultCompType?.defaultRules?.max_heart_rate ?? 65;
    setFormData({
      name: "",
      competitionDate: "",
      startTime: "07:00",
      location: "",
      isFederated: true,
      maxHeartRate: defaultHeartRate,
      stages: [],
      tenantId: user?.tenantId || tenants[0]?.id || "",
      competitionTypeId: defaultCompType?.id || "",
    });
    setTempStage({
      distanceKm: "",
      neutralizationMinutes: "",
    });
    setFormError(null);
  };

  const handleOpenAddModal = () => {
    resetForm();
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setEditingCompetition(null);
    resetForm();
  };

  const handleEditCompetition = (comp: Competition) => {
    setEditingCompetition(comp);
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
        distanceKm:
          typeof s.distanceKm === "string"
            ? parseFloat(s.distanceKm)
            : s.distanceKm,
        neutralizationMinutes:
          typeof s.neutralizationMinutes === "string"
            ? parseInt(s.neutralizationMinutes, 10)
            : (s.neutralizationMinutes ?? 0),
      })),
      tenantId: comp.tenant?.id || "",
      competitionTypeId: comp.competitionType?.id || "",
    });
    setFormError(null);
    setIsModalOpen(true);
  };

  // FEU Preset Auto-complete
  const handleAutocompletePreset = () => {
    setFormData((prev) => ({
      ...prev,
      stages: [
        { stageNumber: 1, distanceKm: 40, neutralizationMinutes: 60 },
        { stageNumber: 2, distanceKm: 20, neutralizationMinutes: 0 },
      ],
    }));
  };

  // Agregar Etapa a la Lista Dinámica
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

    // Reset temporal
    setTempStage({
      distanceKm: "",
      neutralizationMinutes: "",
    });
  };

  // Eliminar última etapa
  const handleRemoveLastStage = () => {
    setFormData((prev) => ({
      ...prev,
      stages: prev.stages.slice(0, -1),
    }));
  };

  // Eliminar etapa específica y reindexar
  const handleRemoveStage = (index: number) => {
    setFormData((prev) => {
      const updated = prev.stages.filter((_, i) => i !== index);
      // Reindexar stageNumber correlativamente
      const reindexed = updated.map((s, i) => ({
        ...s,
        stageNumber: i + 1,
      }));
      return { ...prev, stages: reindexed };
    });
  };

  // Manejar el envío del formulario
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    setFormError(null);

    // Validaciones de negocio
    if (!formData.name.trim()) {
      setFormError("El nombre oficial de la competencia es requerido.");
      setIsSaving(false);
      return;
    }
    if (!formData.competitionDate) {
      setFormError("La fecha de la competencia es obligatoria.");
      setIsSaving(false);
      return;
    }

    if (!editingCompetition) {
      if (!formData.tenantId) {
        setFormError(
          "Debe seleccionar un Club / Organización (Tenant) de la lista.",
        );
        setIsSaving(false);
        return;
      }
      if (!formData.competitionTypeId) {
        setFormError(
          "Debe seleccionar una Modalidad de Competencia de la lista.",
        );
        setIsSaving(false);
        return;
      }
      if (!formData.startTime) {
        setFormError(
          "La hora programada de largada (Hora Cero) es obligatoria.",
        );
        setIsSaving(false);
        return;
      }
      if (formData.stages.length === 0) {
        setFormError("Debe definir al menos 1 etapa para la competencia.");
        setIsSaving(false);
        return;
      }
    }

    const cleanStages = (formData.stages || []).map((s) => ({
      stageNumber: s.stageNumber,
      distanceKm:
        typeof s.distanceKm === "string"
          ? parseFloat(s.distanceKm)
          : s.distanceKm,
      neutralizationMinutes:
        typeof s.neutralizationMinutes === "string"
          ? parseInt(s.neutralizationMinutes, 10)
          : (s.neutralizationMinutes ?? 0),
    }));

    try {
      if (editingCompetition) {
        // Modo Edición
        await CompetitionService.update(editingCompetition.id, {
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
        queryClient.invalidateQueries({
          queryKey: ["competition", editingCompetition.id],
        });
        queryClient.invalidateQueries({ queryKey: ["competitions"] });
      } else {
        // Modo Creación
        const createDto: CreateCompetitionDto = {
          tenantId: formData.tenantId,
          competitionTypeId: formData.competitionTypeId,
          name: formData.name.trim(),
          competitionDate: formData.competitionDate, // Transmitida como string simple YYYY-MM-DD
          startTime:
            formData.startTime.length === 5
              ? `${formData.startTime}:00`
              : formData.startTime,
          location: formData.location.trim() || undefined,
          isFederated: formData.isFederated,
          maxHeartRate: formData.maxHeartRate,
          stages: cleanStages,
        };
        await CompetitionService.create(createDto);
        queryClient.invalidateQueries({ queryKey: ["competitions"] });
      }
      setIsModalOpen(false);
      setEditingCompetition(null);
      resetForm();
      loadCompetitions(searchQuery);
    } catch (err: any) {
      console.error(
        "[SUBMIT ERROR] Error completo del servidor NestJS:",
        err.response || err,
      );
      setFormError(
        err.message || "Error al guardar la competencia en el servidor.",
      );
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteCompetition = async (id: string, name: string) => {
    if (
      confirm(
        `¿Está seguro de que desea eliminar la competencia "${name}"? Se eliminarán todas las etapas asociadas.`,
      )
    ) {
      try {
        await CompetitionService.delete(id);
        queryClient.invalidateQueries({ queryKey: ["competition", id] });
        queryClient.invalidateQueries({ queryKey: ["competitions"] });
        loadCompetitions(searchQuery);
      } catch (err: any) {
        alert(err.message || "No se pudo eliminar la competencia.");
      }
    }
  };

  // Calcular distancia total de las etapas
  const getDistanceTotal = (stages: { distanceKm: number }[]) => {
    if (!stages || stages.length === 0) return "0 Km";
    const total = stages.reduce((acc, s) => acc + Number(s.distanceKm), 0);
    return `${total.toFixed(0)} Km`;
  };

  return (
    <div className="space-y-6">
      {/* 1. CABECERA */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between space-y-4 sm:space-y-0">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-800 tracking-tight">
            Calendario de Competencias
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            Planificación de raids federados, campeonatos nacionales de
            endurance y configuración de etapas Vet Gate.
          </p>
        </div>

        <div className="flex flex-wrap gap-2 self-start sm:self-auto">
          <button
            onClick={handleOpenAddModal}
            className="inline-flex items-center justify-center px-4 py-2.5 bg-equus-green hover:bg-opacity-95 text-white font-bold text-sm rounded-xl transition-all shadow-md hover:shadow-lg focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-equus-green"
          >
            <svg
              className="w-5 h-5 mr-2"
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
            Nueva Competencia
          </button>
        </div>
      </div>

      {/* 2. OMNI-SEARCH BAR */}
      <form onSubmit={handleSearchSubmit} className="flex gap-2">
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
            placeholder="Buscar competencia por nombre, ubicación o características..."
            className="w-full pl-10 pr-4 py-3 bg-white text-slate-800 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-equus-green/20 focus:border-equus-green placeholder-slate-400 shadow-sm"
          />
        </div>
        <button
          type="submit"
          className="px-6 py-3 bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 font-bold text-sm rounded-xl transition-all shadow-sm focus:outline-none"
        >
          Buscar
        </button>
      </form>

      {/* 3. DATAGRID CON DISEÑO BORDERLESS */}
      <div className="bg-white rounded-2xl overflow-hidden shadow-sm border border-slate-100/50">
        <div className="overflow-x-auto">
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
              <span>Cargando calendario oficial...</span>
            </div>
          ) : error ? (
            <div className="py-12 text-center text-rose-600 font-semibold">
              <p className="mb-2">⚠️ {error}</p>
              <button
                onClick={() => loadCompetitions(searchQuery)}
                className="text-xs text-equus-green underline font-bold"
              >
                Reintentar cargar
              </button>
            </div>
          ) : competitions.length === 0 ? (
            <div className="py-20 text-center text-slate-500">
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
                  d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
                />
              </svg>
              <p className="font-medium text-slate-700">
                No hay competencias registradas.
              </p>
              <p className="text-xs text-slate-400 mt-1">
                Cree una nueva competencia para empezar a gestionar
                cronometrajes y controles veterinarios.
              </p>
            </div>
          ) : (
            <table className="min-w-full divide-y divide-gray-100">
              <thead className="bg-slate-50/75 border-b border-gray-100">
                <tr>
                  <th
                    scope="col"
                    className="py-4 pl-6 pr-3 text-left text-xs font-bold text-slate-500 uppercase tracking-wider"
                  >
                    Nombre de Competencia
                  </th>
                  <th
                    scope="col"
                    className="px-4 py-4 text-left text-xs font-bold text-slate-500 uppercase tracking-wider"
                  >
                    Fecha
                  </th>
                  <th
                    scope="col"
                    className="px-4 py-4 text-left text-xs font-bold text-slate-500 uppercase tracking-wider"
                  >
                    Ubicación
                  </th>
                  <th
                    scope="col"
                    className="px-4 py-4 text-left text-xs font-bold text-slate-500 uppercase tracking-wider"
                  >
                    Etapas
                  </th>
                  <th
                    scope="col"
                    className="px-4 py-4 text-left text-xs font-bold text-slate-500 uppercase tracking-wider"
                  >
                    Distancia Total
                  </th>
                  <th
                    scope="col"
                    className="px-4 py-4 text-left text-xs font-bold text-slate-500 uppercase tracking-wider"
                  >
                    Límite Vet Gate
                  </th>
                  <th
                    scope="col"
                    className="px-4 py-4 text-left text-xs font-bold text-slate-500 uppercase tracking-wider"
                  >
                    Estado
                  </th>
                  <th
                    scope="col"
                    className="relative py-4 pl-3 pr-6 text-right text-xs font-bold text-slate-500 uppercase tracking-wider"
                  >
                    Acciones
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 bg-white">
                {competitions.map((comp) => {
                  const displayDate = comp.competitionDate
                    ? comp.competitionDate.substring(0, 10)
                    : "-";
                  return (
                    <tr
                      key={comp.id}
                      onClick={() => router.push(`/competitions/${comp.id}`)}
                      className="hover:bg-slate-50/80 transition-colors cursor-pointer"
                    >
                      <td className="whitespace-nowrap py-4 pl-6 pr-3 text-sm font-bold text-slate-900">
                        <Link
                          href={`/competitions/${comp.id}`}
                          onClick={(e: React.MouseEvent) => e.stopPropagation()}
                          className="text-equus-green hover:underline cursor-pointer"
                        >
                          {comp.name}
                        </Link>
                      </td>
                      <td className="whitespace-nowrap px-4 py-4 text-sm text-slate-600 font-sans tabular-nums">
                        <div>{displayDate}</div>
                        <div className="text-xs text-slate-400 font-semibold">
                          {comp.startTime
                            ? comp.startTime.substring(0, 5)
                            : "07:00"}{" "}
                          hs
                        </div>
                      </td>
                      <td className="whitespace-nowrap px-4 py-4 text-sm text-slate-500">
                        {comp.location || (
                          <span className="text-slate-300 italic">
                            No especificada
                          </span>
                        )}
                      </td>
                      <td className="whitespace-nowrap px-4 py-4 text-sm font-semibold text-slate-700 font-sans tabular-nums">
                        {comp.stages
                          ? `${comp.stages.length} etapas`
                          : "0 etapas"}
                      </td>
                      <td className="whitespace-nowrap px-4 py-4 text-sm text-slate-900 font-bold font-sans tabular-nums">
                        {getDistanceTotal(comp.stages)}
                      </td>
                      <td className="whitespace-nowrap px-4 py-4 text-sm text-slate-600 font-sans tabular-nums">
                        {comp.maxHeartRate || 65} ppm
                      </td>
                      <td className="whitespace-nowrap px-4 py-4 text-sm">
                        <span
                          className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-bold border ${
                            comp.status === "ACTIVE"
                              ? "bg-emerald-50 text-emerald-700 border-emerald-200/50"
                              : comp.status === "COMPLETED" ||
                                  comp.status === "OFFICIAL"
                                ? "bg-blue-50 text-blue-700 border-blue-200/50"
                                : "bg-amber-50 text-amber-700 border-amber-200/50"
                          }`}
                        >
                          {comp.status === "ACTIVE"
                            ? "En Carrera"
                            : comp.status === "PLANNED"
                              ? "Planificado"
                              : comp.status}
                        </span>
                      </td>
                      <td className="whitespace-nowrap py-4 pl-3 pr-6 text-right text-sm font-medium">
                        <div className="flex items-center justify-end space-x-2">
                          <Link
                            href={`/competitions/${comp.id}/start-list`}
                            onClick={(e: React.MouseEvent) =>
                              e.stopPropagation()
                            }
                            className="p-1.5 text-slate-400 hover:text-equus-green hover:bg-emerald-50 rounded-lg transition-all"
                            title={`Ver Start List / Inscripciones de ${comp.name}`}
                          >
                            <svg
                              className="w-5 h-5"
                              fill="none"
                              stroke="currentColor"
                              strokeWidth={2}
                              viewBox="0 0 24 24"
                            >
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01"
                              />
                            </svg>
                          </Link>

                          <button
                            onClick={(e: React.MouseEvent) => {
                              e.stopPropagation();
                              handleEditCompetition(comp);
                            }}
                            className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-all"
                            title={
                              comp.status === "PLANNED"
                                ? `Editar Competencia ${comp.name}`
                                : `Ver detalles de ${comp.name}`
                            }
                          >
                            <svg
                              className="w-5 h-5"
                              fill="none"
                              stroke="currentColor"
                              strokeWidth={2}
                              viewBox="0 0 24 24"
                            >
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                d="m16.862 4.487 1.687-1.688a1.875 1.875 0 1 1 2.652 2.652L6.832 19.82a4.5 4.5 0 0 1-1.897 1.13l-2.685.8.8-2.685a4.5 4.5 0 0 1 1.13-1.897L16.863 4.487Zm0 0L19.5 7.125"
                              />
                            </svg>
                          </button>

                          <button
                            onClick={(e: React.MouseEvent) => {
                              e.stopPropagation();
                              handleDeleteCompetition(comp.id, comp.name);
                            }}
                            className="p-1.5 text-slate-400 hover:text-rose-500 hover:bg-rose-50 rounded-lg transition-all"
                            title={`Eliminar Competencia ${comp.name}`}
                          >
                            <svg
                              className="w-4.5 h-4.5"
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

                          {comp.status === "COMPLETED" || comp.status === "OFFICIAL" ? (
                            <Link
                              href={`/competitions/${comp.id}/official-sheet`}
                              onClick={(e: React.MouseEvent) => e.stopPropagation()}
                              className="p-1.5 text-slate-400 hover:text-equus-green hover:bg-slate-100 rounded-lg transition-all"
                              title="Ver Planilla de Resultados Oficiales F.E.U."
                            >
                              <svg
                                className="w-5 h-5"
                                fill="none"
                                stroke="currentColor"
                                strokeWidth={2}
                                viewBox="0 0 24 24"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                              >
                                <polyline points="6 9 6 2 18 2 18 9" />
                                <path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2" />
                                <rect x="6" y="14" width="12" height="8" />
                              </svg>
                            </Link>
                          ) : (
                            <Link
                              href={`/competitions/${comp.id}/entry-sheet`}
                              onClick={(e: React.MouseEvent) => e.stopPropagation()}
                              className="p-1.5 text-slate-400 hover:text-equus-green hover:bg-slate-100 rounded-lg transition-all"
                              title="Ver Planilla de Participantes Inscritos"
                            >
                              <svg
                                className="w-5 h-5"
                                fill="none"
                                stroke="currentColor"
                                strokeWidth={2}
                                viewBox="0 0 24 24"
                              >
                                <path
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                                />
                              </svg>
                            </Link>
                          )}
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

      {/* 4. MODALFORM (TRANSICIÓN PREMIUM CON BLUR) */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm transition-opacity duration-300">
          <div className="bg-white rounded-2xl max-w-2xl w-full overflow-hidden shadow-2xl border border-slate-100 transition-all transform duration-300 flex flex-col max-h-[90vh]">
            {/* Cabecera del Modal */}
            <div className="bg-slate-50 border-b border-slate-100 px-6 py-4 flex items-center justify-between">
              <div>
                <h3 className="text-base font-extrabold text-slate-800">
                  {editingCompetition
                    ? isFieldsDisabled
                      ? "Detalles de Competencia (Inmutable)"
                      : "Modificar Competencia"
                    : "Planificar Nueva Competencia"}
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  {editingCompetition
                    ? `Estado actual de la carrera: ${editingCompetition.status}`
                    : "Control de Etapas y Reglas de Admisión FEU"}
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

            {/* Formulario con Scroll */}
            <form
              onSubmit={handleSubmit}
              className="flex-1 overflow-y-auto p-6 space-y-5"
            >
              {formError && (
                <div className="p-3 bg-rose-50 border border-rose-100 rounded-xl text-rose-600 text-xs font-semibold flex items-center space-x-2">
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

              {/* Selección de Organización y Modalidad */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Club / Organización (Tenant) */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                    Organización / Club *
                  </label>
                  <select
                    required
                    disabled={editingCompetition !== null || !!user?.tenantId}
                    value={formData.tenantId}
                    onChange={(e) =>
                      setFormData({ ...formData, tenantId: e.target.value })
                    }
                    className="w-full px-3.5 py-2 border border-slate-200 rounded-xl text-sm bg-white focus:outline-none focus:ring-2 focus:ring-equus-green/20 focus:border-equus-green text-slate-800 shadow-sm font-semibold disabled:bg-slate-50 disabled:text-slate-500 disabled:border-slate-100"
                  >
                    <option value="">Seleccione un Club...</option>
                    {tenants.map((tenant) => (
                      <option key={tenant.id} value={tenant.id}>
                        {tenant.name}{" "}
                        {tenant.location ? `(${tenant.location})` : ""}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Modalidad de Competencia (CompetitionType) */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                    Modalidad / Tipo de Competencia *
                  </label>
                  <select
                    required
                    disabled={editingCompetition !== null}
                    value={formData.competitionTypeId}
                    onChange={(e) => {
                      const selectedId = e.target.value;
                      const selectedType = competitionTypes.find(
                        (t) => t.id === selectedId,
                      );
                      const heartRate =
                        selectedType?.defaultRules?.max_heart_rate ?? 65;
                      setFormData({
                        ...formData,
                        competitionTypeId: selectedId,
                        maxHeartRate: heartRate,
                      });
                    }}
                    className="w-full px-3.5 py-2 border border-slate-200 rounded-xl text-sm bg-white focus:outline-none focus:ring-2 focus:ring-equus-green/20 focus:border-equus-green text-slate-800 shadow-sm font-semibold disabled:bg-slate-50 disabled:text-slate-500 disabled:border-slate-100"
                  >
                    <option value="">Seleccione una Modalidad...</option>
                    {competitionTypes.map((type) => (
                      <option key={type.id} value={type.id}>
                        {type.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Nombre de la Carrera */}
              <div>
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
                  placeholder="Ej: Raid Batalla de Tupambaé"
                  className="w-full px-3.5 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-equus-green/20 focus:border-equus-green text-slate-800 shadow-sm font-semibold disabled:bg-slate-50 disabled:text-slate-500 disabled:border-slate-100"
                />
              </div>

              {/* Fila de Datos Generales */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Fecha y Hora de Largada */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5 flex items-center">
                    <svg
                      className="w-3.5 h-3.5 mr-1 text-slate-500"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth={2.2}
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M12 6v6h4.5m4.5 0a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z"
                      />
                    </svg>
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
                      } else {
                        setFormData({
                          ...formData,
                          competitionDate: "",
                          startTime: "07:00",
                        });
                      }
                    }}
                    className="w-full px-3.5 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-equus-green/20 focus:border-equus-green text-slate-800 shadow-sm disabled:bg-slate-50 disabled:text-slate-500 disabled:border-slate-100 font-semibold"
                  />
                </div>

                {/* Ubicación del Evento */}
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
                    placeholder="Ej: Ruta 8, Melo, Cerro Largo"
                    className="w-full px-3.5 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-equus-green/20 focus:border-equus-green text-slate-800 shadow-sm disabled:bg-slate-50 disabled:text-slate-500 disabled:border-slate-100"
                  />
                </div>
              </div>

              {/* Fila de Configuración FEU */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Pulsaciones Máximas */}
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
                    className="w-full px-3.5 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-equus-green/20 focus:border-equus-green text-slate-800 shadow-sm font-semibold font-sans tabular-nums disabled:bg-slate-50 disabled:text-slate-500 disabled:border-slate-100"
                  />
                </div>

                {/* Switch de Competencia Federada */}
                <div className="flex flex-col justify-center">
                  <span className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                    ¿Es Competencia Federada?
                  </span>
                  <div className="p-2.5 bg-slate-50 border border-slate-100 rounded-xl flex items-center justify-between">
                    <span className="text-[10px] text-slate-400 font-medium">
                      Habilita ranking nacional FEU
                    </span>
                    <label
                      className={`relative inline-flex items-center ${editingCompetition !== null ? "cursor-not-allowed opacity-60" : "cursor-pointer"}`}
                    >
                      <input
                        type="checkbox"
                        disabled={editingCompetition !== null}
                        checked={formData.isFederated}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            isFederated: e.target.checked,
                          })
                        }
                        className="sr-only peer"
                      />
                      <div className="w-9 h-5 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-equus-green"></div>
                    </label>
                  </div>
                </div>
              </div>

              {/* ---------------------------------------------------- */}
              {/* SECCIÓN DE ETAPAS (JERARQUÍA DINÁMICA DE FASES) */}
              <div className="border-t border-slate-100 pt-4 space-y-4">
                {/* Banner de bloqueo de etapas */}
                {isFieldsDisabled && (
                  <div className="p-3 bg-amber-50 border border-amber-250 rounded-xl text-amber-705 text-xs font-semibold flex items-center space-x-2">
                    <svg
                      className="w-4 h-4 flex-shrink-0 text-amber-500"
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
                      Etapas bloqueadas: La competencia ya ha iniciado o
                      finalizado.
                    </span>
                  </div>
                )}

                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between space-y-2 sm:space-y-0">
                  <div>
                    <h4 className="text-sm font-extrabold text-slate-800">
                      Fases y Etapas del Evento
                    </h4>
                    <p className="text-[11px] text-slate-400 mt-0.5">
                      Defina las distancias de carrera y tiempos de
                      neutralización.
                    </p>
                  </div>

                  {/* Preset Autocomplete Button */}
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

                {/* Editor Temporal de Etapas */}
                {!isFieldsDisabled && (
                  <div className="p-4 bg-slate-50 border border-slate-200/60 rounded-xl space-y-3">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {/* Campo Distancia */}
                      <div>
                        <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">
                          Distancia de Etapa (Km)
                        </label>
                        <input
                          type="number"
                          step="0.1"
                          placeholder="Ej: 40"
                          value={tempStage.distanceKm}
                          onChange={(e) =>
                            setTempStage({
                              ...tempStage,
                              distanceKm: e.target.value,
                            })
                          }
                          className="w-full px-3 py-1.5 border border-slate-200 rounded-lg text-sm bg-white focus:outline-none focus:border-equus-green text-slate-800 font-semibold"
                        />
                      </div>

                      {/* Campo Neutralización */}
                      <div>
                        <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">
                          Neutralización / Descanso (Minutos)
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
                          className="w-full px-3 py-1.5 border border-slate-200 rounded-lg text-sm bg-white focus:outline-none focus:border-equus-green text-slate-800 font-semibold"
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
                        className="px-4 py-1.5 bg-equus-green hover:bg-opacity-95 text-white font-bold text-xs rounded-lg transition-all shadow-sm"
                      >
                        + Agregar Etapa
                      </button>
                    </div>
                  </div>
                )}

                {/* Tabla de Etapas Agregadas */}
                {formData.stages.length > 0 ? (
                  <div className="bg-white border border-slate-100 rounded-xl overflow-hidden shadow-sm">
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
                                    className="w-20 px-2 py-1 border border-slate-200 rounded text-sm bg-white font-sans tabular-nums font-semibold focus:outline-none focus:border-equus-green text-slate-800"
                                  />
                                  <span className="text-xs text-slate-400">
                                    Km
                                  </span>
                                </div>
                              )}
                            </td>
                            <td className="px-4 py-2 text-slate-600">
                              {isFieldsDisabled ? (
                                <span>
                                  {stage.neutralizationMinutes} minutos
                                </span>
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
                                          neutralizationMinutes: isNaN(val)
                                            ? 0
                                            : val,
                                        };
                                        return { ...prev, stages: updated };
                                      });
                                    }}
                                    className="w-20 px-2 py-1 border border-slate-200 rounded text-sm bg-white font-sans tabular-nums text-slate-700 focus:outline-none focus:border-equus-green"
                                  />
                                  <span className="text-xs text-slate-400">
                                    min
                                  </span>
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
                                  className="p-1 text-slate-400 hover:text-rose-500 hover:bg-rose-50 rounded-md transition-all"
                                  title="Eliminar Etapa"
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

                    {/* Resumen Distancia Total */}
                    <div className="bg-slate-50/70 px-4 py-2.5 flex items-center justify-between text-xs font-semibold text-slate-600 border-t border-slate-100">
                      <span>Total de la Carrera:</span>
                      <span className="font-bold text-slate-900 text-sm">
                        {formData.stages
                          .reduce((acc, s) => acc + Number(s.distanceKm), 0)
                          .toFixed(2)}{" "}
                        Km
                      </span>
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-6 border-2 border-dashed border-slate-200 rounded-xl text-slate-400 text-xs">
                    No se han definido etapas aún. Use el autocompletado o
                    agregue una etapa en el panel superior.
                  </div>
                )}
              </div>

              {/* Botones de Envío del Formulario */}
              <div className="flex items-center justify-end space-x-3 pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={handleCloseModal}
                  className="px-4 py-2 text-slate-500 hover:text-slate-700 text-sm font-bold transition-all focus:outline-none"
                >
                  {isFieldsDisabled ? "Cerrar" : "Cancelar"}
                </button>
                {!isFieldsDisabled && (
                  <button
                    type="submit"
                    disabled={isSaving}
                    className="px-6 py-2 bg-equus-green hover:bg-opacity-95 disabled:bg-opacity-50 text-white font-bold text-sm rounded-xl transition-all shadow-md focus:outline-none flex items-center space-x-2 animate-pulse-once"
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
                    <span>
                      {editingCompetition
                        ? "Guardar Cambios"
                        : "+ Crear Competencia"}
                    </span>
                  </button>
                )}
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
