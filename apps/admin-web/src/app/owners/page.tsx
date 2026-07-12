"use client";

import React, { useState, useEffect } from "react";
import {
  Owner,
  OwnerType,
  CreateOwnerDto,
  UpdateOwnerDto,
} from "@/types/owner";
import { OwnerService } from "@/services/api/owner.service";
import { useAuthStore } from "@/store/auth.store";

/**
 * Gestión de Propietarios - Vista de Administración de EquusCronos
 *
 * ESTRUCTURA DE GOBERNANZA DE DATOS (REGLAS OFICIALES FEU):
 * 1. CLASIFICACIÓN DE PROPIETARIOS: Se segmentan bajo tres tipologías estrictas (Haras / Studs / Persona Física).
 *    Esto garantiza la trazabilidad oficial y genealogía de los binomios inscriptos en competencias ecuestres.
 * 2. CONTROL DE INTEGRIDAD REQUERIDO: Toda actualización en el padrón de criadores e instalaciones debe registrarse
 *    bajo auditorías estrictas en el backoffice. Si un propietario tiene caballos asociados en el sistema,
 *    la base de datos controlará la eliminación mediante restricciones referenciales (FK constraints).
 */
export default function OwnersPage() {
  const user = useAuthStore((state) => state.user);
  const isJudge = user?.role === "JUDGE";

  const [owners, setOwners] = useState<Owner[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Estados para el Formulario en Modal
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingOwner, setEditingOwner] = useState<Owner | null>(null);

  // Estado local de los campos del formulario
  const [formData, setFormData] = useState<CreateOwnerDto>({
    name: "",
    type: OwnerType.INDIVIDUAL,
    contactInfo: "",
  });

  // Estado del envío del formulario
  const [isSaving, setIsSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  // Cargar propietarios al inicializar o al buscar
  const loadOwners = async (query?: string) => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await OwnerService.getAll(query);
      setOwners(data);
    } catch (err: any) {
      setError(
        err.message || "Ocurrió un error al cargar el padrón de propietarios.",
      );
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadOwners();
  }, []);

  // Controlar la búsqueda con un pequeño retardo manual o al presionar Enter/Click
  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    loadOwners(searchQuery);
  };

  // Restablecer el formulario
  const resetForm = () => {
    setFormData({
      name: "",
      type: OwnerType.INDIVIDUAL,
      contactInfo: "",
    });
    setFormError(null);
    setEditingOwner(null);
  };

  // Abrir modal para añadir nuevo propietario
  const handleOpenAddModal = () => {
    resetForm();
    setIsModalOpen(true);
  };

  // Abrir modal para editar un propietario
  const handleOpenEditModal = (owner: Owner) => {
    setEditingOwner(owner);
    setFormData({
      name: owner.name.toUpperCase(),
      type: owner.type,
      contactInfo: owner.contactInfo || "",
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

    // Validaciones básicas del lado del cliente
    if (!formData.name.trim()) {
      setFormError("El nombre o razón social es obligatorio.");
      setIsSaving(false);
      return;
    }

    try {
      if (editingOwner) {
        // Ejecutar actualización
        await OwnerService.update(editingOwner.id, formData);
      } else {
        // Ejecutar creación
        await OwnerService.create(formData);
      }
      setIsModalOpen(false);
      resetForm();
      loadOwners(searchQuery);
    } catch (err: any) {
      setFormError(err.message || "Error al procesar la solicitud.");
    } finally {
      setIsSaving(false);
    }
  };

  // Eliminar un propietario con confirmación nativa
  const handleDeleteOwner = async (id: string, name: string) => {
    if (
      confirm(
        `¿Está seguro de que desea eliminar al propietario "${name}"? Esta acción no se puede deshacer y fallará si tiene equinos registrados a su nombre.`,
      )
    ) {
      try {
        await OwnerService.delete(id);
        loadOwners(searchQuery);
      } catch (err: any) {
        alert(
          err.message ||
            "No se pudo eliminar al propietario por restricciones de integridad referencial (tiene caballos vinculados).",
        );
      }
    }
  };

  // Ayudante para formatear de forma estética el tipo
  const getOwnerTypeBadge = (type: OwnerType) => {
    switch (type) {
      case OwnerType.SYNDICATE:
        return "bg-violet-50 text-violet-700 border border-violet-200/50";
      case OwnerType.STABLE:
        return "bg-amber-50 text-amber-700 border border-amber-200/50";
      case OwnerType.INDIVIDUAL:
      default:
        return "bg-emerald-50 text-emerald-700 border border-emerald-200/50";
    }
  };

  const getOwnerTypeLabel = (type: OwnerType) => {
    switch (type) {
      case OwnerType.SYNDICATE:
        return "Haras";
      case OwnerType.STABLE:
        return "Stud";
      case OwnerType.INDIVIDUAL:
      default:
        return "Persona Física";
    }
  };

  return (
    <div className="space-y-6">
      {/* 1. SECCIÓN DE ENCABEZADO */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between space-y-4 sm:space-y-0">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-800 tracking-tight">
            Gestión de Propietarios
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            Registro oficial de Haras, Studs y criadores habilitados en la base
            nacional ecuestre.
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
            Nuevo Propietario
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
            placeholder="Buscar propietario por nombre, Stud o Haras..."
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
              <span>Consultando registros oficiales...</span>
            </div>
          ) : error ? (
            <div className="py-12 text-center text-rose-600 font-semibold">
              <p className="mb-2">⚠️ {error}</p>
              <button
                onClick={() => loadOwners(searchQuery)}
                className="text-xs text-equus-green underline font-bold"
              >
                Reintentar cargar
              </button>
            </div>
          ) : owners.length === 0 ? (
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
                  d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"
                />
              </svg>
              <p className="font-medium text-slate-700">
                No se encontraron propietarios.
              </p>
              <p className="text-xs text-slate-400 mt-1">
                Añada un nuevo Haras, Stud o Propietario para comenzar.
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
                    Nombre / Razón Social
                  </th>
                  <th
                    scope="col"
                    className="px-4 py-4 text-left text-xs font-bold text-slate-500 uppercase tracking-wider"
                  >
                    Categoría
                  </th>
                  <th
                    scope="col"
                    className="px-4 py-4 text-left text-xs font-bold text-slate-500 uppercase tracking-wider"
                  >
                    Contacto Oficial
                  </th>
                  <th
                    scope="col"
                    className="px-4 py-4 text-left text-xs font-bold text-slate-500 uppercase tracking-wider"
                  >
                    Fecha Registro
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
                {owners.map((owner) => (
                  <tr
                    key={owner.id}
                    className="hover:bg-slate-50/60 transition-colors"
                  >
                    <td className="whitespace-nowrap py-4 pl-6 pr-3 text-sm font-bold text-slate-900">
                      {owner.name}
                    </td>
                    <td className="whitespace-nowrap px-4 py-4 text-sm font-medium">
                      <span
                        className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-bold ${getOwnerTypeBadge(owner.type)}`}
                      >
                        {getOwnerTypeLabel(owner.type)}
                      </span>
                    </td>
                    <td className="whitespace-nowrap px-4 py-4 text-sm text-slate-600">
                      {owner.contactInfo || (
                        <span className="text-slate-400 italic">
                          No especificado
                        </span>
                      )}
                    </td>
                    <td className="whitespace-nowrap px-4 py-4 text-sm text-slate-400">
                      {owner.createdAt ? (
                        <span>
                          {new Date(owner.createdAt).toLocaleDateString(
                            "es-UY",
                          )}
                        </span>
                      ) : (
                        <span>-</span>
                      )}
                    </td>
                    {!isJudge && (
                      <td className="whitespace-nowrap py-4 pl-3 pr-6 text-right text-sm font-medium">
                        <div className="flex items-center justify-end space-x-2">
                          <button
                            onClick={() => handleOpenEditModal(owner)}
                            className="p-1.5 text-slate-400 hover:text-equus-green hover:bg-slate-100 rounded-lg transition-all"
                            title={`Editar Propietario ${owner.name}`}
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
                              handleDeleteOwner(owner.id, owner.name)
                            }
                            className="p-1.5 text-slate-400 hover:text-rose-500 hover:bg-rose-50 rounded-lg transition-all"
                            title={`Eliminar Propietario ${owner.name}`}
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
                ))}
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
                  {editingOwner
                    ? "Modificar Registro de Propietario"
                    : "Registrar Establecimiento / Propietario"}
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  Control de Criadores - Federación Ecuestre Uruguaya
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
            <form
              onSubmit={handleSubmit}
              className="p-6 space-y-4 overflow-y-auto flex-1"
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

              {/* Nombre / Razón Social */}
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  Nombre Completo / Razón Social *
                </label>
                <input
                  type="text"
                  required
                  value={formData.name}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      name: e.target.value.toUpperCase(),
                    })
                  }
                  placeholder="Ej: HARAS EL RELINCHO"
                  className="w-full px-3.5 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-equus-green/20 focus:border-equus-green text-slate-800 shadow-sm uppercase"
                />
              </div>

              {/* Categoría o Tipo de Propietario */}
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  Categoría / Clasificación FEU
                </label>
                <select
                  value={formData.type}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      type: e.target.value as OwnerType,
                    })
                  }
                  className="w-full px-3.5 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-equus-green/20 focus:border-equus-green text-slate-800 shadow-sm bg-white"
                >
                  <option value={OwnerType.INDIVIDUAL}>
                    Persona Física (Criador / Propietario)
                  </option>
                  <option value={OwnerType.STABLE}>
                    Stud (Caballeriza Competidora)
                  </option>
                  <option value={OwnerType.SYNDICATE}>
                    Haras (Establecimiento de Cría)
                  </option>
                </select>
              </div>

              {/* Información de Contacto */}
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  Contacto Oficial (Teléfono o Correo)
                </label>
                <input
                  type="text"
                  value={formData.contactInfo}
                  onChange={(e) =>
                    setFormData({ ...formData, contactInfo: e.target.value })
                  }
                  placeholder="Ej: contacto@haraselrelincho.uy o 099 123 456"
                  className="w-full px-3.5 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-equus-green/20 focus:border-equus-green text-slate-800 shadow-sm"
                />
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
                  <span>{editingOwner ? "Guardar Cambios" : "Registrar"}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
