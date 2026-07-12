"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { Horse } from "@/types/horse";
import { HorseService } from "@/services/api/horse.service";

export default function HorseDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;

  const [horse, setHorse] = useState<Horse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    const fetchHorse = async () => {
      try {
        setIsLoading(true);
        const data = await HorseService.getById(id);
        setHorse(data);
      } catch (err: any) {
        setError(err.message || "Error al cargar los detalles del equino");
      } finally {
        setIsLoading(false);
      }
    };
    fetchHorse();
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
        <span>Consultando registro nacional del equino...</span>
      </div>
    );
  }

  if (error || !horse) {
    return (
      <div className="p-6 max-w-2xl mx-auto text-center">
        <div className="bg-rose-50 border border-rose-100 rounded-2xl p-8 text-rose-600 font-semibold shadow-sm">
          <p className="text-lg mb-4">
            ⚠️ {error || "No se encontró el equino solicitado."}
          </p>
          <Link
            href="/horses"
            className="inline-flex items-center px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl font-bold transition-all shadow pointer"
          >
            Volver al Padrón de Caballos
          </Link>
        </div>
      </div>
    );
  }

  const isExpired =
    horse.healthRecordsExpiration &&
    new Date(horse.healthRecordsExpiration) < new Date();
  const initials = horse.name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .substring(0, 2)
    .toUpperCase();

  const getAgeInYears = (birthDateStr?: string) => {
    if (!birthDateStr) return null;
    const birthDate = new Date(birthDateStr);
    const today = new Date();
    let age = today.getFullYear() - birthDate.getFullYear();
    const monthDiff = today.getMonth() - birthDate.getMonth();
    if (
      monthDiff < 0 ||
      (monthDiff === 0 && today.getDate() < birthDate.getDate())
    ) {
      age--;
    }
    return age;
  };

  const age = getAgeInYears(horse.birthDate);

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Volver */}
      <div>
        <Link
          href="/horses"
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
          Volver al Padrón de Caballos
        </Link>
      </div>

      {/* Tarjeta Principal */}
      <div className="bg-white rounded-3xl overflow-hidden shadow-xl border border-slate-100/80">
        {/* Banner/Header con Foto Gigante y Badge de Edad */}
        <div className="relative h-60 bg-gradient-to-r from-emerald-950 via-emerald-800 to-amber-950 overflow-hidden">
          <div className="absolute inset-0 bg-black/25"></div>
          {horse.imageUrl && (
            <div
              className="absolute inset-0 bg-cover bg-center blur-sm opacity-20 scale-105"
              style={{ backgroundImage: `url(${horse.imageUrl})` }}
            ></div>
          )}
          <div className="absolute bottom-0 left-0 w-full p-8 flex flex-col md:flex-row items-center md:items-end justify-between gap-6 translate-y-12">
            <div className="flex flex-col md:flex-row items-center space-y-4 md:space-y-0 md:space-x-6 text-center md:text-left">
              {horse.imageUrl ? (
                <img
                  src={horse.imageUrl}
                  alt={horse.name}
                  className="w-32 h-32 rounded-full border-4 border-white shadow-2xl object-cover bg-white"
                />
              ) : (
                <div className="w-32 h-32 rounded-full bg-gradient-to-br from-amber-700 via-amber-800 to-amber-950 text-white font-extrabold flex items-center justify-center text-4xl tracking-wider border-4 border-white shadow-2xl">
                  {initials}
                </div>
              )}
              <div className="pb-3">
                <div className="flex flex-col md:flex-row md:items-center gap-3">
                  <h1 className="text-3xl font-black text-white drop-shadow-md">
                    {horse.name}
                  </h1>
                  {age !== null && (
                    <span
                      className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-black shadow-md border ${
                        age < 6
                          ? "bg-rose-500 text-white border-rose-400 animate-pulse"
                          : "bg-emerald-500 text-white border-emerald-400"
                      }`}
                    >
                      {age} {age === 1 ? "año" : "años"}
                    </span>
                  )}
                </div>
              </div>
            </div>
            <div className="pb-5">
              <span
                className={`inline-flex rounded-full px-4 py-1.5 text-xs font-black shadow-lg border ${
                  horse.isFeuActive
                    ? "bg-emerald-500 text-white border-emerald-400"
                    : "bg-slate-800 text-slate-300 border-slate-700"
                }`}
              >
                {horse.isFeuActive
                  ? "Habilitado FEU"
                  : "No Habilitado / Suspendido"}
              </span>
            </div>
          </div>
        </div>

        {/* Spacer for avatar overlap offset */}
        <div className="h-12 bg-white"></div>

        {/* Ficha de Detalles */}
        <div className="p-8 grid grid-cols-1 md:grid-cols-2 gap-8">
          {/* Registro del Equino */}
          <div className="space-y-4">
            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest border-b border-slate-100 pb-2">
              Identificadores FEU & RFID
            </h3>

            <div className="flex justify-between py-2 border-b border-slate-50">
              <span className="text-sm font-semibold text-slate-500">
                Chip Oficial RFID
              </span>
              <span className="text-sm font-bold font-sans tabular-nums text-slate-800">
                {horse.chipId ? (
                  <span className="bg-slate-100 px-2 py-0.5 rounded border border-slate-200 text-slate-700 font-sans tabular-nums text-xs">
                    {horse.chipId}
                  </span>
                ) : (
                  <span className="text-slate-400 italic">Sin Chip</span>
                )}
              </span>
            </div>

            <div className="flex justify-between py-2 border-b border-slate-50">
              <span className="text-sm font-semibold text-slate-500">
                Pasaporte FEU
              </span>
              <span className="text-sm font-bold font-sans tabular-nums text-slate-800">
                {horse.feuId ? (
                  <span className="bg-slate-100 px-2 py-0.5 rounded border border-slate-200 text-slate-700 font-sans tabular-nums text-xs">
                    {horse.feuId}
                  </span>
                ) : (
                  <span className="text-slate-400 italic">No Registrado</span>
                )}
              </span>
            </div>

            <div className="flex justify-between py-2">
              <span className="text-sm font-semibold text-slate-500">
                Propietario Registrado
              </span>
              <span className="text-sm font-bold text-slate-800">
                {horse.owner?.name || (
                  <span className="text-slate-400 italic">Sin Asignar</span>
                )}
              </span>
            </div>
          </div>

          {/* Vencimiento de Sanidad y Controles */}
          <div className="space-y-4">
            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest border-b border-slate-100 pb-2">
              MGAP Sanidad & Registro
            </h3>

            <div className="flex justify-between py-2 border-b border-slate-50">
              <span className="text-sm font-semibold text-slate-500">
                Vence Control Sanitario
              </span>
              <span className="text-sm font-bold font-sans tabular-nums">
                {horse.healthRecordsExpiration ? (
                  <span
                    className={`inline-flex items-center px-2 py-0.5 rounded ${
                      isExpired
                        ? "bg-rose-50 text-rose-700 border border-rose-200"
                        : "bg-emerald-50 text-emerald-700 border border-emerald-200"
                    }`}
                  >
                    <span
                      className={`w-1.5 h-1.5 rounded-full mr-1.5 ${isExpired ? "bg-rose-500" : "bg-emerald-500"}`}
                    />
                    {horse.healthRecordsExpiration.substring(0, 10)}{" "}
                    {isExpired && "(Vencido)"}
                  </span>
                ) : (
                  <span className="text-slate-500 font-medium">
                    Sin fecha registrada (Habilitación de Contingencia)
                  </span>
                )}
              </span>
            </div>

            <div className="flex justify-between py-2 border-b border-slate-50">
              <span className="text-sm font-semibold text-slate-500">
                Fecha de Nacimiento
              </span>
              <span className="text-sm font-bold text-slate-800">
                {horse.birthDate ? (
                  <span>
                    {new Date(horse.birthDate).toLocaleDateString("es-UY")}
                  </span>
                ) : (
                  <span className="text-slate-400 italic">No Registrada</span>
                )}
              </span>
            </div>

            <div className="flex justify-between py-2">
              <span className="text-sm font-semibold text-slate-500">
                Fecha Alta Padrón
              </span>
              <span className="text-sm font-bold text-slate-800">
                {horse.createdAt
                  ? new Date(horse.createdAt).toLocaleDateString("es-UY")
                  : "-"}
              </span>
            </div>
          </div>
        </div>

        {/* Pié de página del expediente */}
        <div className="bg-slate-50/75 border-t border-slate-100 px-8 py-4 flex items-center justify-between text-xs text-slate-400 font-medium">
          <span>Trazabilidad Oficial FEU & MGAP - EquusCronos</span>
          <span>Expediente de Equino Oficial</span>
        </div>
      </div>
    </div>
  );
}
