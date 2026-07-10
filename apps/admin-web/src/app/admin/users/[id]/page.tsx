"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { User } from "@/types/user";
import { UserService } from "@/services/api/user.service";
import { UserRole } from "@equuscronos/shared";

export default function UserDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;

  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    const fetchUser = async () => {
      try {
        setIsLoading(true);
        const data = await UserService.getById(id);
        setUser(data);
      } catch (err: any) {
        setError(err.message || "Error al cargar los detalles del usuario");
      } finally {
        setIsLoading(false);
      }
    };
    fetchUser();
  }, [id]);

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
        <span>Consultando credenciales de acceso del staff...</span>
      </div>
    );
  }

  if (error || !user) {
    return (
      <div className="p-6 max-w-2xl mx-auto text-center">
        <div className="bg-rose-50 border border-rose-100 rounded-2xl p-8 text-rose-600 font-semibold shadow-sm">
          <p className="text-lg mb-4">
            ⚠️ {error || "No se encontró el usuario solicitado."}
          </p>
          <Link
            href="/users"
            className="inline-flex items-center px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl font-bold transition-all shadow pointer"
          >
            Volver al Control de Usuarios
          </Link>
        </div>
      </div>
    );
  }

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

  const getRoleDescription = (role: UserRole) => {
    switch (role) {
      case UserRole.ADMIN:
        return "Control global de la consola, creación de tenants, administración de usuarios y configuración maestra de reglas de competencia.";
      case UserRole.JUDGE:
        return "Homologación de resultados, descalificaciones oficiales, firmas y validaciones de planillas de clasificación general.";
      case UserRole.VET:
        return "Evaluación en Vetting Gate, control de parámetros de recuperación, re-inspecciones cardíacas obligatorias y habilitaciones clínicas.";
      case UserRole.TIMEKEEPER:
        return "Apertura de cronómetros, registro manual y RFID de tiempos de salida, paso intermedio y arribos a meta en cada etapa.";
      case UserRole.USER:
      default:
        return "Carga general de binomios inscritos, inspección de chips identificadores y soporte logístico en campo de carrera.";
    }
  };

  const initials = user.name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .substring(0, 2)
    .toUpperCase();

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Volver */}
      <div>
        <Link
          href="/users"
          className="inline-flex items-center text-sm font-bold text-slate-500 hover:text-slate-800 transition-colors group"
        >
          <svg
            className="w-5 h-5 mr-1.5 transform group-hover:-translate-x-1 transition-transform"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2.5}
              d="M10 19l-7-7m0 0l7-7m-7 7h18"
            />
          </svg>
          Volver a Usuarios
        </Link>
      </div>

      {/* Tarjeta Principal */}
      <div className="bg-white rounded-3xl overflow-hidden shadow-xl border border-slate-100/80">
        {/* Cabecera Premium */}
        <div className="bg-slate-50 border-b border-slate-100 p-8 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="flex items-center space-x-5">
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-slate-700 to-slate-600 text-white flex items-center justify-center font-extrabold text-2xl shadow-inner">
              {initials}
            </div>
            <div>
              <h1 className="text-2xl font-extrabold text-slate-800 tracking-tight">
                {user.name}
              </h1>
            </div>
          </div>
          <div>
            <span
              className={`inline-flex rounded-full px-4 py-1.5 text-xs font-bold shadow-sm ${getRoleBadge(user.role)}`}
            >
              {getRoleLabel(user.role)}
            </span>
          </div>
        </div>

        {/* Ficha de Detalles */}
        <div className="p-8 grid grid-cols-1 md:grid-cols-2 gap-8">
          {/* Identidad del Operador */}
          <div className="space-y-4">
            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest border-b border-slate-100 pb-2">
              Credenciales & Club Afiliado
            </h3>

            <div className="flex justify-between py-2 border-b border-slate-50">
              <span className="text-sm font-semibold text-slate-500">
                Correo Electrónico
              </span>
              <span className="text-sm font-bold text-slate-800">
                {user.email}
              </span>
            </div>

            <div className="flex justify-between py-2 border-b border-slate-50">
              <span className="text-sm font-semibold text-slate-500">
                Club / Organización
              </span>
              <span className="text-sm font-bold text-slate-800">
                {user.tenant ? (
                  <span className="text-slate-800 font-semibold">
                    {user.tenant.name}
                  </span>
                ) : (
                  <span className="text-rose-500 bg-rose-50 border border-rose-100 text-xs px-2.5 py-0.5 rounded-md font-bold">
                    Global (SuperAdmin)
                  </span>
                )}
              </span>
            </div>

            <div className="flex flex-col py-2 space-y-1">
              <span className="text-sm font-semibold text-slate-500">
                Alcance de Privilegios
              </span>
              <p className="text-xs text-slate-400 leading-relaxed font-medium bg-slate-50/50 p-3 rounded-xl border border-slate-100/50">
                {getRoleDescription(user.role)}
              </p>
            </div>
          </div>

          {/* Registro del Sistema */}
          <div className="space-y-4">
            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest border-b border-slate-100 pb-2">
              Auditoría & Seguridad
            </h3>

            <div className="flex justify-between py-2 border-b border-slate-50">
              <span className="text-sm font-semibold text-slate-500">
                Fecha Alta Cuenta
              </span>
              <span className="text-sm font-bold text-slate-800 font-sans tabular-nums">
                {user.createdAt
                  ? new Date(user.createdAt).toLocaleDateString("es-UY")
                  : "-"}
              </span>
            </div>

            <div className="flex justify-between py-2 border-b border-slate-50">
              <span className="text-sm font-semibold text-slate-500">
                Seguridad RLS (Multi-Tenant)
              </span>
              <span className="text-xs font-extrabold text-emerald-700 bg-emerald-50 border border-emerald-100 px-2.5 py-0.5 rounded-md">
                {user.tenant?.id
                  ? "Restringido a Tenant"
                  : "Filtro Desactivado (Global)"}
              </span>
            </div>
          </div>
        </div>

        {/* Pié de página del expediente */}
        <div className="bg-slate-50/75 border-t border-slate-100 px-8 py-4 flex items-center justify-between text-xs text-slate-400 font-medium">
          <span>Consola de Seguridad RLS - EquusCronos</span>
          <span>Expediente de Usuario Oficial</span>
        </div>
      </div>
    </div>
  );
}
