"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { AuditLog, AuditLogResponse } from "@/types/audit";
import { User } from "@/types/user";
import { AuditService } from "@/services/api/audit.service";
import { UserService } from "@/services/api/user.service";
import { useAuthStore } from "@/store/auth.store";
import { UserRole } from "@equuscronos/shared";

export default function AuditPage() {
  const currentUser = useAuthStore((state) => state.user);
  const isJudge = currentUser?.role === UserRole.JUDGE;
  const router = useRouter();

  // Redirect if not authorized
  useEffect(() => {
    if (currentUser) {
      const allowedRoles = [
        UserRole.ADMIN,
        UserRole.CLUB_ADMIN,
        UserRole.JUDGE,
      ];
      if (!allowedRoles.includes(currentUser.role as any)) {
        router.push("/");
      }
    }
  }, [currentUser, router]);

  // Logs list state
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [total, setTotal] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filter States
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(10);
  const [userId, setUserId] = useState("");
  const [action, setAction] = useState("");
  const [entityType, setEntityType] = useState("");

  // Selectable operators list state
  const [users, setUsers] = useState<User[]>([]);

  // Detailed selected log state for inspector
  const [selectedLog, setSelectedLog] = useState<AuditLog | null>(null);

  // Load operators list
  useEffect(() => {
    const fetchUsers = async () => {
      try {
        const usersData = await UserService.getAll();
        setUsers(usersData);
      } catch (err) {
        console.error("Error loading users for filter:", err);
      }
    };
    fetchUsers();
  }, []);

  // Fetch paginated and filtered logs
  const loadLogs = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const filters = {
        page,
        limit,
        userId: userId || undefined,
        action: action || undefined,
        entityType: entityType || undefined,
      };
      const response = await AuditService.getAll(filters);
      setLogs(response.data);
      setTotal(response.total);

      // Select first log by default if none selected or if selected is not in current list
      if (response.data.length > 0) {
        if (
          !selectedLog ||
          !response.data.some((l) => l.id === selectedLog.id)
        ) {
          setSelectedLog(response.data[0]);
        }
      } else {
        setSelectedLog(null);
      }
    } catch (err: any) {
      setError(
        err.message ||
          "Error al cargar los registros de auditoría del sistema.",
      );
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadLogs();
  }, [page, limit, userId, action, entityType]);

  // Helper for action badges styling
  const getActionBadge = (act: string) => {
    switch (act) {
      case "INSERT":
      case "CREATE":
        return "bg-emerald-50 text-emerald-700 border border-emerald-200/50";
      case "UPDATE":
        return "bg-blue-50 text-blue-700 border border-blue-200/50";
      case "DELETE":
        return "bg-rose-50 text-rose-700 border border-rose-200/50";
      case "LOGIN":
        return "bg-purple-50 text-purple-700 border border-purple-200/50";
      case "SECURITY_ALERT":
        return "bg-amber-50 text-amber-700 border border-amber-200/50 animate-pulse";
      default:
        return "bg-slate-50 text-slate-700 border border-slate-200/50";
    }
  };

  const getActionLabel = (act: string) => {
    switch (act) {
      case "INSERT":
      case "CREATE":
        return "CREACIÓN";
      case "UPDATE":
        return "MODIFICACIÓN";
      case "DELETE":
        return "ELIMINACIÓN";
      case "LOGIN":
        return "INICIO SESIÓN";
      case "SECURITY_ALERT":
        return "ALERTA SEGURIDAD";
      default:
        return act;
    }
  };

  const getEntityLabel = (name: string) => {
    switch (name) {
      case "horses":
        return "Caballo";
      case "riders":
        return "Jinete";
      case "competitions":
        return "Competencia";
      case "users":
        return "Usuario";
      case "tenants":
        return "Club";
      case "owners":
        return "Propietario";
      case "competition_entries":
        return "Inscripción";
      case "vet_inspections":
        return "Control Veterinario";
      case "timing_records":
        return "Paso de Tiempo";
      default:
        return name;
    }
  };

  const renderPayloadDiff = (log: AuditLog) => {
    if (log.action === "UPDATE") {
      const oldVal = log.oldData || {};
      const newVal = log.newData || {};
      const allKeys = Array.from(
        new Set([...Object.keys(oldVal), ...Object.keys(newVal)]),
      );

      // Exclude system fields from key diff comparison if they don't carry audit value
      const ignoredKeys = ["updatedAt"];
      const diffKeys = allKeys.filter(
        (key) =>
          !ignoredKeys.includes(key) &&
          JSON.stringify(oldVal[key]) !== JSON.stringify(newVal[key]),
      );

      if (diffKeys.length === 0) {
        return (
          <div className="text-xs text-slate-500 italic p-4 bg-slate-50 rounded-xl border border-slate-100">
            No se detectaron diferencias significativas en las propiedades
            auditadas (los valores son idénticos).
          </div>
        );
      }

      return (
        <div className="space-y-3">
          <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider">
            Comparación de Campos Modificados
          </h4>
          <div className="overflow-x-auto border border-slate-200/60 rounded-xl shadow-sm">
            <table className="min-w-full divide-y divide-slate-100 text-xs">
              <thead className="bg-slate-50">
                <tr>
                  <th className="px-4 py-2.5 text-left font-bold text-slate-600">
                    Campo
                  </th>
                  <th className="px-4 py-2.5 text-left font-bold text-rose-600 bg-rose-50/30">
                    Valor Anterior
                  </th>
                  <th className="px-4 py-2.5 text-left font-bold text-emerald-600 bg-emerald-50/30">
                    Valor Nuevo
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 bg-white">
                {diffKeys.map((key) => {
                  const oVal = oldVal[key];
                  const nVal = newVal[key];
                  return (
                    <tr key={key} className="hover:bg-slate-50/40">
                      <td className="px-4 py-3 font-sans tabular-nums font-bold text-slate-700">
                        {key}
                      </td>
                      <td className="px-4 py-3 bg-rose-50/5 text-rose-700 font-sans tabular-nums break-all whitespace-pre-wrap">
                        {oVal !== undefined ? (
                          typeof oVal === "object" ? (
                            JSON.stringify(oVal, null, 2)
                          ) : (
                            String(oVal)
                          )
                        ) : (
                          <span className="text-slate-300 italic">nulo</span>
                        )}
                      </td>
                      <td className="px-4 py-3 bg-emerald-50/5 text-emerald-700 font-sans tabular-nums break-all whitespace-pre-wrap">
                        {nVal !== undefined ? (
                          typeof nVal === "object" ? (
                            JSON.stringify(nVal, null, 2)
                          ) : (
                            String(nVal)
                          )
                        ) : (
                          <span className="text-slate-300 italic">nulo</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      );
    }

    if (log.action === "INSERT" || log.action === "CREATE") {
      return (
        <div className="space-y-2">
          <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider">
            Datos Creados (Estado Inicial)
          </h4>
          <pre className="bg-slate-900 text-slate-100 p-4 rounded-xl text-xs font-sans tabular-nums overflow-auto max-h-96 shadow-inner">
            {JSON.stringify(log.newData, null, 2)}
          </pre>
        </div>
      );
    }

    if (log.action === "DELETE") {
      return (
        <div className="space-y-2">
          <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider">
            Datos Eliminados (Último Estado)
          </h4>
          <pre className="bg-slate-900 text-slate-100 p-4 rounded-xl text-xs font-sans tabular-nums overflow-auto max-h-96 shadow-inner">
            {JSON.stringify(log.oldData, null, 2)}
          </pre>
        </div>
      );
    }

    return (
      <div className="space-y-2">
        <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider">
          Detalle del Registro de Auditoría
        </h4>
        <pre className="bg-slate-900 text-slate-100 p-4 rounded-xl text-xs font-sans tabular-nums overflow-auto max-h-96 shadow-inner">
          {JSON.stringify(
            { oldData: log.oldData, newData: log.newData },
            null,
            2,
          )}
        </pre>
      </div>
    );
  };

  const totalPages = Math.ceil(total / limit) || 1;

  if (!currentUser) {
    return (
      <div className="py-20 text-center text-slate-500 font-medium flex items-center justify-center">
        Cargando credenciales de sesión...
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* HEADER SECTION */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between space-y-4 sm:space-y-0">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-800 tracking-tight">
            Auditoría de Sistema
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            Supervise operaciones transaccionales, auditoría de eventos de bases
            de datos y control de integridad multi-inquilino.
          </p>
        </div>

        {/* Botones de Infraestructura Operativa */}
        {!isJudge && (
          <div className="flex items-center space-x-3 self-stretch sm:self-auto">
            <button
              disabled={currentUser.role !== UserRole.ADMIN}
              onClick={() =>
                alert(
                  "Función de exportación de base de datos completa iniciada.",
                )
              }
              className="inline-flex items-center justify-center px-4 py-2 bg-white border border-slate-200 text-slate-700 font-bold text-xs rounded-xl shadow-sm hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
              title={
                currentUser.role !== UserRole.ADMIN
                  ? "No disponible en modo consulta"
                  : "Exportar base de datos completa"
              }
            >
              Exportar Base de Datos Completa
            </button>
            <button
              disabled={currentUser.role !== UserRole.ADMIN}
              onClick={() => {
                if (
                  confirm(
                    "¿Está seguro de que desea vaciar la bitácora completa de auditoría? Esta acción es irreversible.",
                  )
                ) {
                  alert("Procedimiento de limpieza de logs ejecutado.");
                }
              }}
              className="inline-flex items-center justify-center px-4 py-2 bg-rose-50 hover:bg-rose-100 disabled:bg-rose-50/50 disabled:text-rose-400 disabled:border-rose-100/50 disabled:cursor-not-allowed border border-rose-200 text-rose-700 font-bold text-xs rounded-xl shadow-sm transition-all"
              title={
                currentUser.role !== UserRole.ADMIN
                  ? "No disponible en modo consulta"
                  : "Vaciar logs de auditoría"
              }
            >
              Vaciar Logs
            </button>
          </div>
        )}
      </div>

      {/* SEARCH AND FILTERS PANEL */}
      <div className="bg-white rounded-2xl p-5 border border-slate-100 shadow-sm space-y-4">
        <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider">
          Filtros de Búsqueda Interactiva
        </h3>
        <div
          className={`grid grid-cols-1 ${currentUser.role === UserRole.ADMIN ? "md:grid-cols-5" : "md:grid-cols-4"} gap-4`}
        >
          {/* Action Filter */}
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1.5">
              Acción / Transacción
            </label>
            <select
              value={action}
              onChange={(e) => {
                setAction(e.target.value);
                setPage(1);
              }}
              className="w-full px-3.5 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-equus-green/20 focus:border-equus-green text-slate-800 shadow-sm bg-white"
            >
              <option value="">Todas las acciones</option>
              <option value="CREATE">CREACIÓN (INSERT)</option>
              <option value="UPDATE">MODIFICACIÓN (UPDATE)</option>
              <option value="DELETE">ELIMINACIÓN (DELETE)</option>
              <option value="LOGIN">INICIOS DE SESIÓN</option>
              <option value="SECURITY_ALERT">ALERTAS DE SEGURIDAD</option>
            </select>
          </div>

          {/* Entity Type Filter */}
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1.5">
              Tipo de Entidad
            </label>
            <select
              value={entityType}
              onChange={(e) => {
                setEntityType(e.target.value);
                setPage(1);
              }}
              className="w-full px-3.5 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-equus-green/20 focus:border-equus-green text-slate-800 shadow-sm bg-white"
            >
              <option value="">Todas las entidades</option>
              <option value="Horse">Caballos (Horse)</option>
              <option value="Competition">Competencias (Competition)</option>
              <option value="Rider">Jinetes (Rider)</option>
            </select>
          </div>

          {/* Operator Filter */}
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1.5">
              Operador de Campo
            </label>
            <select
              value={userId}
              onChange={(e) => {
                setUserId(e.target.value);
                setPage(1);
              }}
              className="w-full px-3.5 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-equus-green/20 focus:border-equus-green text-slate-800 shadow-sm bg-white"
            >
              <option value="">Todos los operadores</option>
              {users.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.name} ({u.email})
                </option>
              ))}
            </select>
          </div>

          {/* Filtros Inter-Clubes (Only visible to Admin, completely hidden for JUDGE) */}
          {currentUser.role === UserRole.ADMIN && (
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1.5">
                Filtros Inter-Clubes
              </label>
              <select
                className="w-full px-3.5 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-equus-green/20 focus:border-equus-green text-slate-800 shadow-sm bg-white"
                defaultValue=""
                onChange={() => alert("Filtrado inter-clubes activo.")}
              >
                <option value="">Todos los clubes</option>
                <option value="consolidated">
                  Filtro consolidado (Global)
                </option>
              </select>
            </div>
          )}

          {/* Page size limit Filter */}
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1.5">
              Registros por página
            </label>
            <select
              value={limit}
              onChange={(e) => {
                setLimit(parseInt(e.target.value, 10));
                setPage(1);
              }}
              className="w-full px-3.5 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-equus-green/20 focus:border-equus-green text-slate-800 shadow-sm bg-white"
            >
              <option value="10">10 registros</option>
              <option value="20">20 registros</option>
              <option value="50">50 registros</option>
            </select>
          </div>
        </div>
      </div>

      {/* BANNER DE AISLAMIENTO RLS PARA EL JUEZ */}
      {isJudge && (
        <div className="bg-emerald-50 border border-emerald-100 text-emerald-800 px-4 py-3.5 rounded-2xl flex items-center space-x-2.5 text-xs font-semibold shadow-sm animate-fade-in">
          <svg
            className="w-4.5 h-4.5 text-emerald-600 flex-shrink-0"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"
            />
          </svg>
          <span>
            Filtro de Seguridad Activo: Visualizando exclusivamente la bitácora
            transaccional de su Club (Aislamiento RLS)
          </span>
        </div>
      )}

      {/* DENSE DATA TABLE AND DETAILED JSON VISOR LAYOUT */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Column: Data table (8 cols) */}
        <div className="lg:col-span-8 bg-white rounded-2xl overflow-hidden shadow-sm border border-slate-100/50">
          <div className="overflow-x-auto">
            {isLoading ? (
              <div className="py-24 text-center text-slate-500 font-medium flex flex-col items-center justify-center space-y-3">
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
                <span>Consultando bitácora de auditoría transaccional...</span>
              </div>
            ) : error ? (
              <div className="py-12 text-center text-rose-600 font-semibold p-6">
                <p className="mb-2">⚠️ {error}</p>
                <button
                  onClick={loadLogs}
                  className="text-xs text-equus-green underline font-bold"
                >
                  Reintentar consulta
                </button>
              </div>
            ) : logs.length === 0 ? (
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
                    d="M9 12h6m-6 4h6m2 5H7a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5.586a1 1 0 0 1 .707.293l5.414 5.414a1 1 0 0 1 .293.707V19a2 2 0 0 1-2 2Z"
                  />
                </svg>
                <p className="font-semibold text-slate-700">
                  Bitácora de auditoría limpia
                </p>
                <p className="text-xs text-slate-400 mt-1">
                  No se registraron transacciones que coincidan con los filtros
                  activos.
                </p>
              </div>
            ) : (
              <table className="min-w-full divide-y divide-gray-100">
                <thead className="bg-slate-50/75 border-b border-gray-100">
                  <tr>
                    <th className="py-4 pl-5 pr-3 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">
                      Acción
                    </th>
                    <th className="px-3 py-4 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">
                      Entidad
                    </th>
                    <th className="px-3 py-4 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">
                      Operador
                    </th>
                    {currentUser.role === UserRole.ADMIN && (
                      <th className="px-3 py-4 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">
                        Club
                      </th>
                    )}
                    <th className="px-3 py-4 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">
                      Fecha y Hora
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 bg-white">
                  {logs.map((log) => {
                    const isSelected = selectedLog?.id === log.id;
                    return (
                      <tr
                        key={log.id}
                        onClick={() => setSelectedLog(log)}
                        className={`hover:bg-slate-50/80 transition-colors cursor-pointer ${
                          isSelected
                            ? "bg-equus-green/5 border-l-4 border-l-equus-green font-medium"
                            : ""
                        }`}
                      >
                        <td className="whitespace-nowrap py-3.5 pl-5 pr-3 text-xs">
                          <span
                            className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-bold tracking-wide ${getActionBadge(
                              log.action,
                            )}`}
                          >
                            {getActionLabel(log.action)}
                          </span>
                        </td>
                        <td className="whitespace-nowrap px-3 py-3.5 text-xs text-slate-700">
                          <div className="font-semibold text-slate-800">
                            {getEntityLabel(log.entityName)}
                          </div>
                          {log.entityId && (
                            <div className="text-[10px] text-slate-400 font-sans tabular-nums tracking-tighter truncate max-w-[130px]">
                              {log.entityId}
                            </div>
                          )}
                        </td>
                        <td className="whitespace-nowrap px-3 py-3.5 text-xs">
                          <div className="font-semibold text-slate-800">
                            {log.user ? log.user.name : "Sistema"}
                          </div>
                          {log.user && (
                            <div className="text-[10px] text-slate-400">
                              {log.user.email}
                            </div>
                          )}
                        </td>
                        {currentUser.role === UserRole.ADMIN && (
                          <td className="whitespace-nowrap px-3 py-3.5 text-xs text-slate-600 font-medium">
                            {log.tenant ? (
                              <span className="text-slate-700 font-semibold">
                                {log.tenant.name}
                              </span>
                            ) : (
                              <span className="text-rose-500 italic bg-rose-50 border border-rose-100 text-[10px] px-1.5 py-0.5 rounded">
                                Global
                              </span>
                            )}
                          </td>
                        )}
                        <td className="whitespace-nowrap px-3 py-3.5 text-xs text-slate-500 font-semibold">
                          {new Date(log.createdAt).toLocaleString("es-UY", {
                            day: "2-digit",
                            month: "2-digit",
                            year: "numeric",
                            hour: "2-digit",
                            minute: "2-digit",
                            second: "2-digit",
                          })}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>

          {/* Table pagination controls */}
          {logs.length > 0 && (
            <div className="bg-slate-50 border-t border-slate-100 px-6 py-4 flex items-center justify-between">
              <div className="text-xs text-slate-500 font-semibold">
                Mostrando{" "}
                <span className="font-bold text-slate-700">{logs.length}</span>{" "}
                de <span className="font-bold text-slate-700">{total}</span>{" "}
                registros de auditoría
              </div>
              <div className="flex items-center space-x-1">
                {/* Previous Button */}
                <button
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page === 1}
                  className="p-1.5 rounded-lg border border-slate-200 bg-white text-slate-500 hover:bg-slate-50 disabled:opacity-50 disabled:hover:bg-white transition-all text-xs font-bold"
                >
                  Anterior
                </button>
                {/* Page numbers */}
                <span className="text-xs text-slate-600 font-semibold px-2">
                  Pág. {page} de {totalPages}
                </span>
                {/* Next Button */}
                <button
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={page === totalPages}
                  className="p-1.5 rounded-lg border border-slate-200 bg-white text-slate-500 hover:bg-slate-50 disabled:opacity-50 disabled:hover:bg-white transition-all text-xs font-bold"
                >
                  Siguiente
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Right Column: Visor de Cargas Útiles JSON (4 cols) */}
        <div className="lg:col-span-4 bg-white rounded-2xl p-5 border border-slate-100 shadow-sm space-y-4">
          <div className="border-b border-slate-100 pb-3 flex items-center justify-between">
            <h3 className="text-sm font-bold text-slate-800">
              Detalle de Transacción
            </h3>
            {selectedLog && (
              <span
                className={`inline-flex rounded px-1.5 py-0.5 text-[9px] font-bold ${getActionBadge(
                  selectedLog.action,
                )}`}
              >
                {getActionLabel(selectedLog.action)}
              </span>
            )}
          </div>

          {selectedLog ? (
            <div className="space-y-4 text-xs">
              {/* Meta information grid */}
              <div className="bg-slate-50 p-4 rounded-xl border border-slate-100 space-y-2.5">
                <div className="flex justify-between">
                  <span className="text-slate-400 font-semibold">
                    Log UUID:
                  </span>
                  <span className="font-sans tabular-nums text-slate-700 font-bold select-all break-all text-right pl-4">
                    {selectedLog.id}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400 font-semibold">Fecha:</span>
                  <span className="font-semibold text-slate-700">
                    {new Date(selectedLog.createdAt).toLocaleString("es-UY")}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400 font-semibold">
                    Operador:
                  </span>
                  <span className="font-bold text-slate-800">
                    {selectedLog.user
                      ? selectedLog.user.name
                      : "Sistema / Fallback"}
                  </span>
                </div>
                {selectedLog.tenant && (
                  <div className="flex justify-between">
                    <span className="text-slate-400 font-semibold">Club:</span>
                    <span className="font-bold text-slate-700">
                      {selectedLog.tenant.name}
                    </span>
                  </div>
                )}
                {selectedLog.ipAddress && (
                  <div className="flex justify-between">
                    <span className="text-slate-400 font-semibold">
                      IP Address:
                    </span>
                    <span className="font-sans tabular-nums font-bold text-slate-700">
                      {selectedLog.ipAddress}
                    </span>
                  </div>
                )}
                {selectedLog.userAgent && (
                  <div className="flex flex-col space-y-1 pt-1 border-t border-slate-200/50">
                    <span className="text-slate-400 font-semibold">
                      User Agent:
                    </span>
                    <span className="text-[10px] text-slate-500 break-words leading-tight">
                      {selectedLog.userAgent}
                    </span>
                  </div>
                )}
              </div>

              {/* Payload/Diff inspector */}
              <div className="pt-2">{renderPayloadDiff(selectedLog)}</div>
            </div>
          ) : (
            <div className="py-24 text-center text-slate-400 italic">
              Seleccione un registro de la tabla para inspeccionar su carga útil
              JSON y ver el comparador de cambios (diff viewer).
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
