"use client";

import React, { useState, useEffect } from "react";
import { Tenant, CreateTenantDto, UpdateTenantDto } from "@/types/tenant";
import { TenantService } from "@/services/api/tenant.service";
import { compressImage } from "@/utils/imageCompression";
import { useAuthStore } from "@/store/auth.store";

export function TenantsPage() {
  const user = useAuthStore((state) => state.user);
  const isJudge = user?.role === "JUDGE";
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingTenant, setEditingTenant] = useState<Tenant | null>(null);

  // Form Fields
  const [name, setName] = useState("");
  const [location, setLocation] = useState("");
  const [federationNumber, setFederationNumber] = useState("");
  const [jerseyImageUrl, setJerseyImageUrl] = useState("");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  const [isSaving, setIsSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const loadTenants = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await TenantService.getAll();
      setTenants(data);
    } catch (err: any) {
      setError(err.message || "Error al cargar los clubes/organizaciones.");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadTenants();
  }, []);

  const filteredTenants = tenants.filter(
    (t) =>
      t.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (t.location &&
        t.location.toLowerCase().includes(searchQuery.toLowerCase())),
  );

  const resetForm = () => {
    setName("");
    setLocation("");
    setFederationNumber("");
    setJerseyImageUrl("");
    setSelectedFile(null);
    setFormError(null);
    setEditingTenant(null);
  };

  const handleOpenAddModal = () => {
    resetForm();
    setIsModalOpen(true);
  };

  const handleOpenEditModal = (tenant: Tenant) => {
    setEditingTenant(tenant);
    setName(tenant.name);
    setLocation(tenant.location || "");
    setFederationNumber(
      tenant.federationNumber !== undefined && tenant.federationNumber !== null
        ? tenant.federationNumber.toString()
        : "",
    );
    setJerseyImageUrl(tenant.jerseyImageUrl || "");
    setSelectedFile(null);
    setFormError(null);
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    resetForm();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    setFormError(null);

    if (!name.trim()) {
      setFormError("El nombre del club/organización es obligatorio.");
      setIsSaving(false);
      return;
    }

    const fedNum = federationNumber.trim()
      ? parseInt(federationNumber.trim(), 10)
      : undefined;
    if (
      fedNum !== undefined &&
      (isNaN(fedNum) || fedNum < 10 || fedNum > 999)
    ) {
      setFormError(
        "El número de federación debe ser un entero entre 10 y 999.",
      );
      setIsSaving(false);
      return;
    }

    const payload: CreateTenantDto = {
      name: name.trim(),
      location: location.trim() || undefined,
      federationNumber: fedNum,
      jerseyImageUrl: jerseyImageUrl.trim() || undefined,
    };

    try {
      let savedTenant: Tenant;
      if (editingTenant) {
        savedTenant = await TenantService.update(editingTenant.id, payload);
      } else {
        savedTenant = await TenantService.create(payload);
      }

      if (selectedFile) {
        const tenantId = editingTenant ? editingTenant.id : savedTenant.id;
        await TenantService.uploadJersey(tenantId, selectedFile);
      }

      setIsModalOpen(false);
      resetForm();
      loadTenants();
    } catch (err: any) {
      setFormError(
        err.message || "Ocurrió un error al guardar la organización.",
      );
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (id: string, tenantName: string) => {
    if (
      confirm(
        `¿Está seguro de que desea eliminar la organización "${tenantName}"? Esta acción no se puede deshacer y fallará si hay usuarios o competencias asociadas.`,
      )
    ) {
      try {
        await TenantService.delete(id);
        loadTenants();
      } catch (err: any) {
        alert(
          err.message ||
            "No se pudo eliminar la organización debido a restricciones de integridad.",
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
            Clubes y Organizaciones (Tenants)
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            Gestione las organizaciones afiliadas y clubes oficiales autorizados
            para registrar binomios y cronometrar carreras.
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
            Nuevo Club
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
            placeholder="Buscar club por nombre o ubicación..."
            className="w-full pl-10 pr-4 py-3 bg-white text-slate-800 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-equus-green/20 focus:border-equus-green placeholder-slate-400 shadow-sm"
          />
        </div>
      </div>

      {/* TENANTS DATAGRID */}
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
              <span>Cargando clubes y federaciones oficiales...</span>
            </div>
          ) : error ? (
            <div className="py-12 text-center text-rose-600 font-semibold p-6">
              <p className="mb-2">⚠️ {error}</p>
              <button
                onClick={loadTenants}
                className="text-xs text-equus-green underline font-bold"
              >
                Reintentar cargar
              </button>
            </div>
          ) : filteredTenants.length === 0 ? (
            <div className="py-20 text-center text-slate-500 p-6">
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
                No se encontraron clubes registrados.
              </p>
              <p className="text-xs text-slate-400 mt-1">
                Haga clic en 'Nuevo Club' para comenzar la configuración
                multi-tenant.
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
                    Nombre del Club / Org.
                  </th>
                  <th
                    scope="col"
                    className="px-4 py-4 text-left text-xs font-bold text-slate-500 uppercase tracking-wider"
                  >
                    Sede / Ubicación
                  </th>
                  <th
                    scope="col"
                    className="px-4 py-4 text-left text-xs font-bold text-slate-500 uppercase tracking-wider"
                  >
                    Nro. Fed.
                  </th>
                  <th
                    scope="col"
                    className="px-4 py-4 text-left text-xs font-bold text-slate-500 uppercase tracking-wider"
                  >
                    Camiseta
                  </th>
                  <th
                    scope="col"
                    className="px-4 py-4 text-left text-xs font-bold text-slate-500 uppercase tracking-wider"
                  >
                    Fecha Alta
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
                {filteredTenants.map((tenant) => (
                  <tr
                    key={tenant.id}
                    className="hover:bg-slate-50/60 transition-colors"
                  >
                    <td className="whitespace-nowrap py-4 pl-6 pr-3 text-sm font-bold text-slate-900">
                      {tenant.name}
                    </td>
                    <td className="whitespace-nowrap px-4 py-4 text-sm text-slate-600">
                      {tenant.location || (
                        <span className="text-slate-400 italic">
                          No registrada
                        </span>
                      )}
                    </td>
                    <td className="whitespace-nowrap px-4 py-4 text-sm font-semibold text-slate-700">
                      {tenant.federationNumber || (
                        <span className="text-slate-400 italic font-normal">
                          -
                        </span>
                      )}
                    </td>
                    <td className="whitespace-nowrap px-4 py-4 text-sm">
                      {tenant.jerseyImageUrl ? (
                        <img
                           src={tenant.jerseyImageUrl}
                           alt="Camiseta"
                           className="w-8 h-8 rounded-full object-cover border border-slate-200"
                        />
                      ) : (
                        <span className="text-slate-300" title="Sin camiseta">
                          <svg
                            className="w-5 h-5"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={1.5}
                              d="M9 11l3-3m0 0l3 3m-3-3v8m0-13a9 9 0 110 18 9 9 0 010-18z"
                            />
                          </svg>
                        </span>
                      )}
                    </td>
                    <td className="whitespace-nowrap px-4 py-4 text-sm text-slate-400">
                      {tenant.createdAt ? (
                        <span>
                          {new Date(tenant.createdAt).toLocaleDateString(
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
                            onClick={() => handleOpenEditModal(tenant)}
                            className="p-1.5 text-slate-400 hover:text-equus-green hover:bg-slate-100 rounded-lg transition-all"
                            title="Editar Club"
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
                            onClick={() => handleDelete(tenant.id, tenant.name)}
                            className="p-1.5 text-slate-400 hover:text-rose-500 hover:bg-rose-50 rounded-lg transition-all"
                            title="Eliminar Club"
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

      {/* CREATE/EDIT MODAL */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fade-in">
          <div className="bg-white rounded-2xl max-w-lg w-full max-h-[90vh] flex flex-col overflow-hidden shadow-2xl border border-slate-100 animate-slide-up">
            <div className="bg-slate-50 border-b border-slate-100 px-6 py-4 flex items-center justify-between flex-shrink-0">
              <div>
                <h3 className="text-base font-extrabold text-slate-800">
                  {editingTenant
                    ? "Modificar Registro de Club"
                    : "Registrar Nuevo Club Oficial"}
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  Control Multi-Tenant - EquusCronos
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

              {/* Tenant Name */}
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  Nombre Completo del Club / Organización *
                </label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Ej: Club Hípico de Melo, Federación Ecuestre"
                  className="w-full px-3.5 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-equus-green/20 focus:border-equus-green text-slate-800 shadow-sm"
                />
              </div>

              {/* Location */}
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  Sede / Ubicación Geográfica
                </label>
                <input
                  type="text"
                  value={location}
                  onChange={(e) => setLocation(e.target.value)}
                  placeholder="Ej: Cerro Largo, Uruguay o Florida"
                  className="w-full px-3.5 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-equus-green/20 focus:border-equus-green text-slate-800 shadow-sm"
                />
              </div>

              {/* Federation Number */}
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  Número de Federación FEU (2-3 dígitos)
                </label>
                <input
                  type="number"
                  min="10"
                  max="999"
                  value={federationNumber}
                  onChange={(e) => setFederationNumber(e.target.value)}
                  placeholder="Ej: 45"
                  className="w-full px-3.5 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-equus-green/20 focus:border-equus-green text-slate-800 shadow-sm font-semibold"
                />
              </div>

              {/* Jersey Image URL (External) */}
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  URL de Camiseta (Opcional - Google Drive / Web)
                </label>
                <input
                  type="text"
                  value={jerseyImageUrl}
                  onChange={(e) => setJerseyImageUrl(e.target.value)}
                  placeholder="https://example.com/jersey.jpg"
                  className="w-full px-3.5 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-equus-green/20 focus:border-equus-green text-slate-800 shadow-sm"
                />
              </div>

              {/* Local File Upload */}
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  Subir Archivo de Camiseta Local (Reemplaza URL)
                </label>
                {jerseyImageUrl && (
                  <div className="mb-2 flex items-center space-x-2 bg-slate-50 p-2 rounded-lg border border-slate-100">
                    <img
                      src={jerseyImageUrl}
                      alt="Vista previa"
                      className="w-10 h-10 rounded-full object-cover border border-slate-200 animate-fade-in"
                    />
                    <span className="text-xs text-slate-400 font-mono truncate max-w-[200px]">
                      {jerseyImageUrl}
                    </span>
                  </div>
                )}
                <input
                  type="file"
                  accept="image/*"
                  onChange={async (e) => {
                    if (e.target.files && e.target.files.length > 0) {
                      try {
                        const compressed = await compressImage(
                          e.target.files[0],
                        );
                        setSelectedFile(compressed);
                      } catch (err) {
                        console.error("Error compressing image:", err);
                        setSelectedFile(e.target.files[0]);
                      }
                    }
                  }}
                  className="w-full text-xs text-slate-500 file:mr-3 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-xs file:font-extrabold file:bg-slate-100 file:text-slate-700 hover:file:bg-slate-200/80 file:cursor-pointer cursor-pointer"
                />
              </div>

              {/* Form Buttons */}
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
                  <span>{editingTenant ? "Guardar Cambios" : "Registrar"}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
