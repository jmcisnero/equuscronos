"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { Rider, CreateRiderDto, UpdateRiderDto } from "@/types/rider";
import { RiderService } from "@/services/api/rider.service";
import { useAuthStore } from "@/store/auth.store";

/**
 * Padrón de Jinetes - Vista de Administración de EquusCronos
 *
 * ESTRUCTURA DE GOBERNANZA DE DATOS (REGLAS OFICIALES FEU):
 * 1. UNICIDAD DE CÉDULA: La Cédula de Identidad (national_id) debe ser única a nivel nacional.
 * 2. UNICIDAD DE LICENCIA FEU: El identificador FEU (feu_id) es único y obligatorio para competencias federadas.
 *    El backend validará esto retornando un error 409 Conflict ante registros duplicados.
 * 3. INMUTABILIDAD DE FECHAS DE NACIMIENTO: Para evitar corrupciones de datos causadas por el desplazamiento
 *    de husos horarios locales (ej. GMT-3 en Uruguay) durante conversiones UTC automáticas en navegadores,
 *    las fechas se gestionan estrictamente como Strings planos en formato ISO (YYYY-MM-DD) desde la captura
 *    del input HTML hasta el almacenamiento en la columna DATE de PostgreSQL.
 */
export default function RidersPage() {
  const user = useAuthStore((state) => state.user);
  const isJudge = user?.role === "JUDGE";

  const [riders, setRiders] = useState<Rider[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Estados para el Formulario en Modal
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingRider, setEditingRider] = useState<Rider | null>(null);

  // Estado local de los campos del formulario
  const [formData, setFormData] = useState<CreateRiderDto>({
    name: "",
    nationalId: "",
    feuId: "",
    isFeuActive: true,
    birthDate: "",
    medicalCardExpiration: "",
  });

  // Estado del envío del formulario
  const [isSaving, setIsSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  // Cargar jinetes al inicializar o al buscar
  const loadRiders = async (query?: string) => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await RiderService.getAll(query);
      setRiders(data);
    } catch (err: any) {
      setError(
        err.message || "Ocurrió un error al cargar el padrón de jinetes.",
      );
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadRiders();
  }, []);

  // Controlar la búsqueda con un pequeño retardo manual o al presionar Enter/Click
  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    loadRiders(searchQuery);
  };

  // Restablecer el formulario
  const resetForm = () => {
    setFormData({
      name: "",
      nationalId: "",
      feuId: "",
      isFeuActive: true,
      birthDate: "",
      medicalCardExpiration: "",
    });
    setFormError(null);
    setEditingRider(null);
  };

  // Abrir modal para añadir nuevo jinete
  const handleOpenAddModal = () => {
    resetForm();
    setIsModalOpen(true);
  };

  // Abrir modal para editar un jinete
  const handleOpenEditModal = (rider: Rider) => {
    setEditingRider(rider);
    setFormData({
      name: rider.name,
      nationalId: rider.nationalId,
      feuId: rider.feuId || "",
      isFeuActive: rider.isFeuActive,
      // Las fechas se leen directamente como strings 'YYYY-MM-DD' de la entidad
      birthDate: rider.birthDate ? rider.birthDate.substring(0, 10) : "",
      medicalCardExpiration: rider.medicalCardExpiration
        ? rider.medicalCardExpiration.substring(0, 10)
        : "",
    });
    setFormError(null);
    setIsModalOpen(true);
  };

  // Cerrar modal
  const handleCloseModal = () => {
    setIsModalOpen(false);
    resetForm();
  };

  // Manejar el envío del formulario
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    setFormError(null);

    // Validaciones del lado del cliente requeridas por la FEU
    if (!formData.name.trim()) {
      setFormError("El nombre completo es requerido.");
      setIsSaving(false);
      return;
    }
    if (!formData.nationalId.trim()) {
      setFormError(
        "La Cédula de Identidad es obligatoria para el control de identidad.",
      );
      setIsSaving(false);
      return;
    }

    try {
      if (editingRider) {
        // Ejecutar actualización
        await RiderService.update(editingRider.id, formData);
      } else {
        // Ejecutar creación
        await RiderService.create(formData);
      }
      setIsModalOpen(false);
      resetForm();
      loadRiders(searchQuery);
    } catch (err: any) {
      // Capturar conflicto 409 (duplicados de Cédula o FEU) y otros errores
      setFormError(err.message || "Error al procesar la solicitud.");
    } finally {
      setIsSaving(false);
    }
  };

  // Eliminar un jinete con confirmación nativa
  const handleDeleteRider = async (id: string, name: string) => {
    if (
      confirm(
        `¿Está seguro de que desea eliminar al jinete "${name}"? Esta acción no se puede deshacer y fallará si el jinete ya registra pasadas en competencias.`,
      )
    ) {
      try {
        await RiderService.delete(id);
        loadRiders(searchQuery);
      } catch (err: any) {
        alert(
          err.message ||
            "No se pudo eliminar al jinete por restricciones de integridad referencial.",
        );
      }
    }
  };

  return (
    <div className="space-y-6">
      {/* 1. SECCIÓN DE ENCABEZADO */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between space-y-4 sm:space-y-0">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-800 tracking-tight">
            Padrón de Jinetes
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            Control de licencias federativas y vigencia de carnets médicos de
            atletas en la Federación Ecuestre.
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
            Nuevo Jinete
          </button>
        )}
      </div>

      {/* 2. BARRA DE BÚSQUEDA ANCHA SUPERIOR (OMNI-SEARCH) */}
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
            placeholder="Buscar jinete por nombre, cédula o número de licencia FEU..."
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

      {/* 3. LISTADO (DATAGRID CON DISEÑO BORDERLESS) */}
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
              <span>Consultando padrón nacional FEU...</span>
            </div>
          ) : error ? (
            <div className="py-12 text-center text-rose-600 font-semibold">
              <p className="mb-2">⚠️ {error}</p>
              <button
                onClick={() => loadRiders(searchQuery)}
                className="text-xs text-equus-green underline font-bold"
              >
                Reintentar cargar
              </button>
            </div>
          ) : riders.length === 0 ? (
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
                  d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                />
              </svg>
              <p className="font-medium text-slate-700">
                No se encontraron jinetes registrados.
              </p>
              <p className="text-xs text-slate-400 mt-1">
                Intente refinar los criterios de búsqueda o añada uno nuevo.
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
                    Nombre del Atleta
                  </th>
                  <th
                    scope="col"
                    className="px-4 py-4 text-left text-xs font-bold text-slate-500 uppercase tracking-wider"
                  >
                    Documento (CI)
                  </th>
                  <th
                    scope="col"
                    className="px-4 py-4 text-left text-xs font-bold text-slate-500 uppercase tracking-wider"
                  >
                    Nro. Licencia FEU
                  </th>
                  <th
                    scope="col"
                    className="px-4 py-4 text-left text-xs font-bold text-slate-500 uppercase tracking-wider"
                  >
                    Estado Licencia
                  </th>
                  <th
                    scope="col"
                    className="px-4 py-4 text-left text-xs font-bold text-slate-500 uppercase tracking-wider"
                  >
                    Fecha Nacimiento
                  </th>
                  <th
                    scope="col"
                    className="px-4 py-4 text-left text-xs font-bold text-slate-500 uppercase tracking-wider"
                  >
                    Ficha Médica
                  </th>
                  {!isJudge && (
                    <th
                      scope="col"
                      className="relative py-4 pl-3 pr-6 text-right text-xs font-bold text-slate-500 uppercase tracking-wider"
                    >
                      Acciones
                    </th>
                  )}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 bg-white">
                {riders.map((rider) => {
                  const isExpired =
                    rider.medicalCardExpiration &&
                    new Date(rider.medicalCardExpiration) < new Date();

                  return (
                    <tr
                      key={rider.id}
                      className="hover:bg-slate-50/60 transition-colors"
                    >
                      <td className="whitespace-nowrap py-4 pl-6 pr-3 text-sm font-bold text-slate-900">
                        <Link
                          href={`/admin/riders/${rider.id}`}
                          className="text-equus-green hover:underline"
                        >
                          {rider.name}
                        </Link>
                      </td>
                      <td className="whitespace-nowrap px-4 py-4 text-sm text-slate-600 font-mono">
                        {rider.nationalId}
                      </td>
                      <td className="whitespace-nowrap px-4 py-4 text-sm font-semibold font-mono text-slate-700">
                        {rider.feuId ? (
                          <span className="bg-slate-100 px-2.5 py-1 rounded-md border border-slate-200/50">
                            {rider.feuId}
                          </span>
                        ) : (
                          <span className="text-slate-400 italic">
                            No Federado
                          </span>
                        )}
                      </td>
                      <td className="whitespace-nowrap px-4 py-4 text-sm">
                        <span
                          className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-bold ${
                            rider.isFeuActive
                              ? "bg-emerald-50 text-emerald-700 border border-emerald-200/50"
                              : "bg-slate-100 text-slate-500 border border-slate-200"
                          }`}
                        >
                          {rider.isFeuActive
                            ? "Federado Activo"
                            : "Inactivo / Suspendido"}
                        </span>
                      </td>
                      <td className="whitespace-nowrap px-4 py-4 text-sm text-slate-600">
                        {rider.birthDate ? (
                          // Visualización local inmutable: renderizar tal cual el string para prevenir bugs timezone
                          <span>{rider.birthDate.substring(0, 10)}</span>
                        ) : (
                          <span className="text-slate-400 italic">-</span>
                        )}
                      </td>
                      <td className="whitespace-nowrap px-4 py-4 text-sm">
                        {rider.medicalCardExpiration ? (
                          <span
                            className={`inline-flex items-center text-xs font-semibold ${
                              isExpired ? "text-rose-600" : "text-slate-600"
                            }`}
                          >
                            <span
                              className={`w-2 h-2 rounded-full mr-1.5 ${isExpired ? "bg-rose-500" : "bg-emerald-500"}`}
                            />
                            {rider.medicalCardExpiration.substring(0, 10)}{" "}
                            {isExpired && "(Vencida)"}
                          </span>
                        ) : (
                          <span className="text-slate-400 italic">
                            Sin Registrar
                          </span>
                        )}
                      </td>
                      {!isJudge && (
                        <td className="whitespace-nowrap py-4 pl-3 pr-6 text-right text-sm font-medium">
                          <div className="flex items-center justify-end space-x-2">
                            <button
                              onClick={() => handleOpenEditModal(rider)}
                              className="p-1.5 text-slate-400 hover:text-equus-green hover:bg-slate-100 rounded-lg transition-all"
                              title={`Editar Jinete ${rider.name}`}
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
                                  d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
                                />
                              </svg>
                            </button>

                            <button
                              onClick={() =>
                                handleDeleteRider(rider.id, rider.name)
                              }
                              className="p-1.5 text-slate-400 hover:text-rose-500 hover:bg-rose-50 rounded-lg transition-all"
                              title={`Eliminar Jinete ${rider.name}`}
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
                          </div>
                        </td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* 4. MODALFORM (DISEÑO LIMPIO Y PREMIUM) */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fade-in">
          <div className="bg-white rounded-2xl max-w-lg w-full max-h-[90vh] flex flex-col overflow-hidden shadow-2xl border border-slate-100 animate-slide-up">
            {/* Cabecera del Modal */}
            <div className="bg-slate-50 border-b border-slate-100 px-6 py-4 flex items-center justify-between flex-shrink-0">
              <div>
                <h3 className="text-base font-extrabold text-slate-800">
                  {editingRider
                    ? "Modificar Registro de Jinete"
                    : "Inscribir Nuevo Jinete"}
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  Padrón Oficial - Federación Ecuestre Uruguaya
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

            {/* Formulario */}
            <form onSubmit={handleSubmit} className="p-6 space-y-4 overflow-y-auto flex-1">
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

              {/* Nombre Completo */}
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  Nombre Completo *
                </label>
                <input
                  type="text"
                  required
                  value={formData.name}
                  onChange={(e) =>
                    setFormData({ ...formData, name: e.target.value })
                  }
                  placeholder="Ej: Mateo Silva"
                  className="w-full px-3.5 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-equus-green/20 focus:border-equus-green text-slate-800 shadow-sm"
                />
              </div>

              {/* Fila de Documentos y Licencia */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Cédula de Identidad */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                    Cédula de Identidad *
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.nationalId}
                    onChange={(e) =>
                      setFormData({ ...formData, nationalId: e.target.value })
                    }
                    placeholder="Ej: 3.123.456-7"
                    className="w-full px-3.5 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-equus-green/20 focus:border-equus-green text-slate-800 shadow-sm font-mono"
                  />
                </div>

                {/* Nro Licencia FEU */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                    Licencia FEU
                  </label>
                  <input
                    type="text"
                    value={formData.feuId}
                    onChange={(e) =>
                      setFormData({ ...formData, feuId: e.target.value })
                    }
                    placeholder="Ej: FEU-R-201"
                    className="w-full px-3.5 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-equus-green/20 focus:border-equus-green text-slate-800 shadow-sm font-mono"
                  />
                </div>
              </div>

              {/* Fila de Fechas - Manejadas de forma inmutable como string YYYY-MM-DD */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Fecha de Nacimiento */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                    Fecha de Nacimiento
                  </label>
                  <input
                    type="date"
                    value={formData.birthDate}
                    onChange={(e) =>
                      setFormData({ ...formData, birthDate: e.target.value })
                    }
                    className="w-full px-3.5 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-equus-green/20 focus:border-equus-green text-slate-800 shadow-sm"
                  />
                </div>

                {/* Vencimiento de Ficha Médica */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                    Vto. Ficha Médica
                  </label>
                  <input
                    type="date"
                    value={formData.medicalCardExpiration}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        medicalCardExpiration: e.target.value,
                      })
                    }
                    className="w-full px-3.5 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-equus-green/20 focus:border-equus-green text-slate-800 shadow-sm"
                  />
                </div>
              </div>

              {/* Estado de la Licencia FEU */}
              <div className="p-3 bg-slate-50 border border-slate-100 rounded-xl flex items-center justify-between">
                <div className="flex flex-col">
                  <span className="text-xs font-bold text-slate-700">
                    Estado de Licencia
                  </span>
                  <span className="text-[10px] text-slate-400">
                    ¿El jinete está habilitado y al día con la anualidad?
                  </span>
                </div>

                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formData.isFeuActive}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        isFeuActive: e.target.checked,
                      })
                    }
                    className="sr-only peer"
                  />
                  <div className="w-9 h-5 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-equus-green"></div>
                </label>
              </div>

              {/* Botones de Acción del Formulario */}
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
                  disabled={isSaving}
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
                  <span>{editingRider ? "Guardar Cambios" : "Registrar"}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
