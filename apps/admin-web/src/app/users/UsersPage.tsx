"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { User, CreateUserDto, UpdateUserDto } from "@/types/user";
import { Tenant } from "@/types/tenant";
import { UserService } from "@/services/api/user.service";
import { TenantService } from "@/services/api/tenant.service";
import { UserRole } from "@equuscronos/shared";

export function UsersPage() {
  const [users, setUsers] = useState<User[]>([]);
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);

  // Form Fields
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<UserRole>(UserRole.USER);
  const [tenantId, setTenantId] = useState<string>("");
  const [password, setPassword] = useState("");

  // Dropdown search filter state
  const [tenantFilterQuery, setTenantFilterQuery] = useState("");
  const [isDropdownFocused, setIsDropdownFocused] = useState(false);

  const [isSaving, setIsSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const loadData = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const [usersData, tenantsData] = await Promise.all([
        UserService.getAll(),
        TenantService.getAll(),
      ]);
      setUsers(usersData);
      setTenants(tenantsData);
    } catch (err: any) {
      setError(
        err.message ||
          "Error al cargar los registros del staff y organizaciones.",
      );
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const filteredUsers = users.filter(
    (u) =>
      u.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      u.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (u.tenant &&
        u.tenant.name.toLowerCase().includes(searchQuery.toLowerCase())),
  );

  const filteredTenantsForSelect = tenants.filter(
    (t) =>
      t.name.toLowerCase().includes(tenantFilterQuery.toLowerCase()) ||
      (t.location &&
        t.location.toLowerCase().includes(tenantFilterQuery.toLowerCase())),
  );

  const resetForm = () => {
    setName("");
    setEmail("");
    setRole(UserRole.USER);
    setTenantId("");
    setPassword("");
    setTenantFilterQuery("");
    setFormError(null);
    setEditingUser(null);
  };

  const handleOpenAddModal = () => {
    resetForm();
    setIsModalOpen(true);
  };

  const handleOpenEditModal = (user: User) => {
    setEditingUser(user);
    setName(user.name);
    setEmail(user.email);
    setRole(user.role);
    setTenantId(user.tenant?.id || "");
    // Fetch and display active tenant's name in dropdown search field if set
    setTenantFilterQuery(user.tenant?.name || "");
    setPassword("");
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

    // Form validations
    if (!name.trim()) {
      setFormError("El nombre es obligatorio.");
      setIsSaving(false);
      return;
    }
    if (!email.trim() || !email.includes("@")) {
      setFormError(
        "Por favor, introduzca una dirección de correo electrónico válida.",
      );
      setIsSaving(false);
      return;
    }

    if (!editingUser && !password.trim()) {
      setFormError("La contraseña es obligatoria para nuevos usuarios.");
      setIsSaving(false);
      return;
    }

    // Standard DTO Mapping
    const payload: CreateUserDto = {
      name: name.trim(),
      email: email.trim(),
      role,
      tenantId: tenantId || null,
      passwordHash: password.trim() || undefined,
    };

    try {
      if (editingUser) {
        // Build partial update payload
        const updatePayload: UpdateUserDto = {
          name: payload.name,
          email: payload.email,
          role: payload.role,
          tenantId: payload.tenantId,
          passwordHash: password.trim() ? password.trim() : undefined,
        };
        await UserService.update(editingUser.id, updatePayload);
      } else {
        await UserService.create(payload);
      }
      setIsModalOpen(false);
      resetForm();
      loadData();
    } catch (err: any) {
      setFormError(err.message || "Error al procesar el guardado del usuario.");
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (id: string, userName: string) => {
    if (
      confirm(
        `¿Está seguro de que desea revocar el acceso y eliminar definitivamente al usuario "${userName}"?`,
      )
    ) {
      try {
        await UserService.delete(id);
        loadData();
      } catch (err: any) {
        alert(err.message || "No se pudo eliminar al usuario.");
      }
    }
  };

  // Helper for role tag designs
  const getRoleBadge = (role: UserRole) => {
    switch (role) {
      case UserRole.ADMIN:
        return "bg-rose-50 text-rose-700 border border-rose-200/50";
      case UserRole.JUDGE:
        return "bg-violet-50 text-violet-700 border border-violet-200/50";
      case UserRole.VET:
        return "bg-amber-50 text-amber-700 border border-amber-200/50";
      case UserRole.TIMEKEEPER:
        return "bg-blue-50 text-blue-700 border border-blue-200/50";
      case UserRole.USER:
      default:
        return "bg-slate-50 text-slate-700 border border-slate-200/50";
    }
  };

  const getRoleLabel = (role: UserRole) => {
    switch (role) {
      case UserRole.ADMIN:
        return "Super Administrador";
      case UserRole.JUDGE:
        return "Juez General";
      case UserRole.VET:
        return "Veterinario";
      case UserRole.TIMEKEEPER:
        return "Cronometrador";
      case UserRole.USER:
      default:
        return "Operador de Campo";
    }
  };

  return (
    <div className="space-y-6">
      {/* HEADER SECTION */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between space-y-4 sm:space-y-0">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-800 tracking-tight">
            Gestión de Usuarios y Staff
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            Administre cuentas oficiales de oficiales de carrera, comisiones de
            juzgamiento, cuerpo veterinario y operadores de control de paso.
          </p>
        </div>

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
          Nuevo Usuario
        </button>
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
            placeholder="Buscar usuario por nombre, email o club afiliado..."
            className="w-full pl-10 pr-4 py-3 bg-white text-slate-800 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-equus-green/20 focus:border-equus-green placeholder-slate-400 shadow-sm"
          />
        </div>
      </div>

      {/* USERS DATAGRID */}
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
              <span>Consultando registros oficiales de usuarios...</span>
            </div>
          ) : error ? (
            <div className="py-12 text-center text-rose-600 font-semibold p-6">
              <p className="mb-2">⚠️ {error}</p>
              <button
                onClick={loadData}
                className="text-xs text-equus-green underline font-bold"
              >
                Reintentar cargar
              </button>
            </div>
          ) : filteredUsers.length === 0 ? (
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
                  d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z"
                />
              </svg>
              <p className="font-medium text-slate-700">
                No se encontraron usuarios.
              </p>
              <p className="text-xs text-slate-400 mt-1">
                Registre oficiales o delegados técnicos para darles acceso a la
                plataforma.
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
                    Nombre del Operador
                  </th>
                  <th
                    scope="col"
                    className="px-4 py-4 text-left text-xs font-bold text-slate-500 uppercase tracking-wider"
                  >
                    Correo Electrónico
                  </th>
                  <th
                    scope="col"
                    className="px-4 py-4 text-left text-xs font-bold text-slate-500 uppercase tracking-wider"
                  >
                    Rol de Privilegios
                  </th>
                  <th
                    scope="col"
                    className="px-4 py-4 text-left text-xs font-bold text-slate-500 uppercase tracking-wider"
                  >
                    Club / Organización Afiliada
                  </th>
                  <th
                    scope="col"
                    className="px-4 py-4 text-left text-xs font-bold text-slate-500 uppercase tracking-wider"
                  >
                    Fecha Alta
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
                {filteredUsers.map((user) => (
                  <tr
                    key={user.id}
                    className="hover:bg-slate-50/60 transition-colors"
                  >
                    <td className="whitespace-nowrap py-4 pl-6 pr-3 text-sm font-bold text-slate-900">
                      <Link
                        href={`/admin/users/${user.id}`}
                        className="text-equus-green hover:underline"
                      >
                        {user.name}
                      </Link>
                    </td>
                    <td className="whitespace-nowrap px-4 py-4 text-sm text-slate-600">
                      {user.email}
                    </td>
                    <td className="whitespace-nowrap px-4 py-4 text-sm font-medium">
                      <span
                        className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-bold ${getRoleBadge(user.role)}`}
                      >
                        {getRoleLabel(user.role)}
                      </span>
                    </td>
                    <td className="whitespace-nowrap px-4 py-4 text-sm font-semibold text-slate-700">
                      {user.tenant ? (
                        <span className="text-slate-800">
                          {user.tenant.name}
                        </span>
                      ) : (
                        <span className="text-rose-500 italic bg-rose-50 border border-rose-100 text-[10px] px-2 py-0.5 rounded-md font-bold">
                          Global (SuperAdmin)
                        </span>
                      )}
                    </td>
                    <td className="whitespace-nowrap px-4 py-4 text-sm text-slate-400">
                      {user.createdAt ? (
                        <span>
                          {new Date(user.createdAt).toLocaleDateString("es-UY")}
                        </span>
                      ) : (
                        <span>-</span>
                      )}
                    </td>
                    <td className="whitespace-nowrap py-4 pl-3 pr-6 text-right text-sm font-medium">
                      <div className="flex items-center justify-end space-x-2">
                        <button
                          onClick={() => handleOpenEditModal(user)}
                          className="p-1.5 text-slate-400 hover:text-equus-green hover:bg-slate-100 rounded-lg transition-all"
                          title="Editar Perfil"
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
                          onClick={() => handleDelete(user.id, user.name)}
                          className="p-1.5 text-slate-400 hover:text-rose-500 hover:bg-rose-50 rounded-lg transition-all"
                          title="Revocar Acceso"
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
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* CREATE/EDIT MODAL WITH SEARCHABLE DROPDOWN */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fade-in">
          <div className="bg-white rounded-2xl max-w-lg w-full overflow-hidden shadow-2xl border border-slate-100 animate-slide-up">
            <div className="bg-slate-50 border-b border-slate-100 px-6 py-4 flex items-center justify-between">
              <div>
                <h3 className="text-base font-extrabold text-slate-800">
                  {editingUser
                    ? "Modificar Usuario / Staff"
                    : "Registrar Nuevo Operador / Oficial"}
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  Control de Roles y Contexto Organizacional
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

            <form
              onSubmit={handleSubmit}
              className="p-6 space-y-4 overflow-visible"
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

              {/* Name */}
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  Nombre Completo *
                </label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Ej: Carlos Juez o Ana Gómez"
                  className="w-full px-3.5 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-equus-green/20 focus:border-equus-green text-slate-800 shadow-sm"
                />
              </div>

              {/* Email */}
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  Correo Electrónico *
                </label>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="correo@ejemplo.com"
                  className="w-full px-3.5 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-equus-green/20 focus:border-equus-green text-slate-800 shadow-sm"
                />
              </div>

              {/* Role Select */}
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  Rol y Privilegios
                </label>
                <select
                  value={role}
                  onChange={(e) => setRole(e.target.value as UserRole)}
                  className="w-full px-3.5 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-equus-green/20 focus:border-equus-green text-slate-800 shadow-sm bg-white"
                >
                  <option value={UserRole.USER}>
                    Operador de Campo (Básico)
                  </option>
                  <option value={UserRole.TIMEKEEPER}>
                    Cronometrador Oficial
                  </option>
                  <option value={UserRole.VET}>Veterinario Homologado</option>
                  <option value={UserRole.JUDGE}>
                    Juez General de Comisión
                  </option>
                  <option value={UserRole.ADMIN}>
                    Super Administrador del Sistema
                  </option>
                </select>
              </div>

              {/* Searchable Tenant Dropdown */}
              <div className="relative">
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  Club / Organización Adscripta (Tenant Context)
                </label>

                <div className="relative">
                  <input
                    type="text"
                    value={tenantFilterQuery}
                    onChange={(e) => {
                      setTenantFilterQuery(e.target.value);
                      if (e.target.value === "") {
                        setTenantId("");
                      }
                    }}
                    onFocus={() => setIsDropdownFocused(true)}
                    onBlur={() =>
                      setTimeout(() => setIsDropdownFocused(false), 200)
                    }
                    placeholder="Escriba para buscar y seleccionar un club..."
                    className="w-full px-3.5 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-equus-green/20 focus:border-equus-green text-slate-800 shadow-sm pr-10"
                  />
                  {tenantId && (
                    <span className="absolute inset-y-0 right-3 flex items-center text-emerald-600">
                      <svg
                        className="w-5 h-5"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2.5}
                          d="M5 13l4 4L19 7"
                        />
                      </svg>
                    </span>
                  )}
                </div>

                {isDropdownFocused && (
                  <div className="absolute z-10 w-full mt-1.5 bg-white border border-slate-200 rounded-xl shadow-lg max-h-48 overflow-y-auto divide-y divide-slate-50">
                    <div
                      onClick={() => {
                        setTenantId("");
                        setTenantFilterQuery("Global (SuperAdmin)");
                      }}
                      className="px-4 py-2.5 text-xs text-rose-500 font-bold hover:bg-slate-50 cursor-pointer transition-all"
                    >
                      [Ninguno / Administrador Global sin Club]
                    </div>
                    {filteredTenantsForSelect.length === 0 ? (
                      <div className="px-4 py-2.5 text-xs text-slate-400 italic">
                        No se encontraron clubes
                      </div>
                    ) : (
                      filteredTenantsForSelect.map((t) => (
                        <div
                          key={t.id}
                          onClick={() => {
                            setTenantId(t.id);
                            setTenantFilterQuery(t.name);
                          }}
                          className="px-4 py-2.5 text-xs text-slate-700 hover:bg-slate-50 hover:text-slate-900 cursor-pointer transition-all"
                        >
                          <span className="font-bold block">{t.name}</span>
                          {t.location && (
                            <span className="text-[10px] text-slate-400 block">
                              {t.location}
                            </span>
                          )}
                        </div>
                      ))
                    )}
                  </div>
                )}
                <p className="mt-1 text-[10px] text-slate-400 leading-normal">
                  * Vincular al operador a un club garantiza que la seguridad
                  RLS restrinja sus accesos exclusivamente a la base de datos de
                  dicho club.
                </p>
              </div>

              {/* Password */}
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  {editingUser
                    ? "Nueva Contraseña (Opcional)"
                    : "Contraseña de Acceso *"}
                </label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder={
                    editingUser
                      ? "Dejar en blanco para mantener la actual"
                      : "Introduzca contraseña inicial"
                  }
                  className="w-full px-3.5 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-equus-green/20 focus:border-equus-green text-slate-800 shadow-sm"
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
                  <span>{editingUser ? "Guardar Cambios" : "Registrar"}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
