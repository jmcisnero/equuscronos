import React, { useState } from "react";
import { getEliminationDisplayLabel } from "@equuscronos/shared";
import {
  useLiveLeaderboard,
  LeaderboardEntry,
} from "@/hooks/useLiveLeaderboard";
import { useAuthStore } from "@/store/auth.store";
import { ContingencyService } from "@/services/api/contingency.service";

interface Props {
  competitionId: string;
  stages: any[];
}

export default function LiveLeaderboardContingency({
  competitionId,
  stages,
}: Props) {
  const { user } = useAuthStore();
  const isAdmin = user?.role === "ADMIN";
  const { leaderboard, isLoading, refetch } = useLiveLeaderboard(competitionId);
  const [expandedEntryId, setExpandedEntryId] = useState<string | null>(null);

  // API loading / error states
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  // Modal timing record state
  const [timingModal, setTimingModal] = useState<{
    isOpen: boolean;
    recordId: string;
    recordedAt: string;
    label: string;
  } | null>(null);

  const [modalTimeStr, setModalTimeStr] = useState("");

  React.useEffect(() => {
    if (timingModal?.isOpen && timingModal.recordedAt) {
      const date = new Date(timingModal.recordedAt);
      if (!isNaN(date.getTime())) {
        const h = String(date.getHours()).padStart(2, "0");
        const m = String(date.getMinutes()).padStart(2, "0");
        const s = String(date.getSeconds()).padStart(2, "0");
        setModalTimeStr(`${h}:${m}:${s}`);
      } else {
        setModalTimeStr("");
      }
      setActionError(null);
    }
  }, [timingModal]);

  // Modal vet inspection state
  const [vetModal, setVetModal] = useState<{
    isOpen: boolean;
    inspectionId: string;
    heartRate: number;
    gaitStatus: string;
    notes: string;
  } | null>(null);

  // Modal penalty state
  const [penaltyModal, setPenaltyModal] = useState<{
    isOpen: boolean;
    id?: string; // empty if creating
    entryId?: string;
    stageId: string;
    timePenaltySeconds: number;
    reason: string;
  } | null>(null);

  const toggleExpand = (entryId: string) => {
    setExpandedEntryId(expandedEntryId === entryId ? null : entryId);
  };

  // Format milliseconds to HH:MM:SS
  const formatTimeMs = (ms: number | null) => {
    if (ms === null || ms === undefined || ms < 0) return "-";
    const totalSecs = Math.floor(ms / 1000);
    const hours = Math.floor(totalSecs / 3600);
    const minutes = Math.floor((totalSecs % 3600) / 60);
    const secs = totalSecs % 60;
    return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
  };

  // Format ISO Date to Local time
  const formatLocalTime = (isoString?: string) => {
    if (!isoString) return "-";
    const date = new Date(isoString);
    return date.toLocaleTimeString("es-UY", {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: false,
    });
  };

  // ==========================================
  // HANDLERS
  // ==========================================

  const handleTimeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const input = e.target.value;
    const cleaned = input.replace(/\D/g, "");

    let formatted = "";
    for (let i = 0; i < cleaned.length && i < 6; i++) {
      const num = cleaned[i];
      if (i === 0) {
        if (/[0-2]/.test(num)) formatted += num;
      } else if (i === 1) {
        const first = formatted[0];
        if (first === "2") {
          if (/[0-3]/.test(num)) formatted += num;
        } else {
          formatted += num;
        }
      } else if (i === 2) {
        if (/[0-5]/.test(num)) formatted += ":" + num;
      } else if (i === 3) {
        formatted += num;
      } else if (i === 4) {
        if (/[0-5]/.test(num)) formatted += ":" + num;
      } else if (i === 5) {
        formatted += num;
      }
    }
    setModalTimeStr(formatted);
  };

  const handleUpdateTiming = async () => {
    if (!timingModal) return;
    setIsSubmitting(true);
    setActionError(null);
    try {
      const timeRegex = /^(?:[01]\d|2[0-3]):[0-5]\d:[0-5]\d$/;
      if (!timeRegex.test(modalTimeStr)) {
        throw new Error(
          "Formato de tiempo inválido. Debe ser HH:MM:SS (ej: 14:30:00).",
        );
      }

      const baseDate = new Date(timingModal.recordedAt);
      if (isNaN(baseDate.getTime())) {
        throw new Error("Fecha original no es válida.");
      }

      const [hours, minutes, seconds] = modalTimeStr.split(":").map(Number);
      baseDate.setHours(hours);
      baseDate.setMinutes(minutes);
      baseDate.setSeconds(seconds);
      baseDate.setMilliseconds(0);

      await ContingencyService.updateTimingRecord(
        timingModal.recordId,
        baseDate.toISOString(),
      );
      setTimingModal(null);
      refetch();
    } catch (err: any) {
      setActionError(
        err.message || "Error al actualizar el registro de tiempo.",
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteTiming = async (recordId: string) => {
    if (
      !confirm(
        "¿Está seguro de eliminar permanentemente este paso de tiempo? Esto recalculará los tiempos del binomio.",
      )
    )
      return;
    setIsSubmitting(true);
    setActionError(null);
    try {
      await ContingencyService.deleteTimingRecord(recordId);
      refetch();
    } catch (err: any) {
      alert(err.message || "Error al eliminar el registro.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleUpdateVet = async () => {
    if (!vetModal) return;
    setIsSubmitting(true);
    setActionError(null);
    try {
      await ContingencyService.updateVetInspection(
        vetModal.inspectionId,
        vetModal.heartRate,
        vetModal.gaitStatus,
        vetModal.notes,
      );
      setVetModal(null);
      refetch();
    } catch (err: any) {
      setActionError(
        err.message || "Error al actualizar la inspección veterinaria.",
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteVet = async (inspectionId: string) => {
    if (
      !confirm(
        "¿Está seguro de eliminar permanentemente este control veterinario?",
      )
    )
      return;
    setIsSubmitting(true);
    setActionError(null);
    try {
      await ContingencyService.deleteVetInspection(inspectionId);
      refetch();
    } catch (err: any) {
      alert(err.message || "Error al eliminar la inspección veterinaria.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSavePenalty = async () => {
    if (!penaltyModal) return;
    setIsSubmitting(true);
    setActionError(null);
    try {
      if (penaltyModal.id) {
        // Edit
        await ContingencyService.updatePenalty(
          penaltyModal.id,
          penaltyModal.timePenaltySeconds,
          penaltyModal.reason,
        );
      } else {
        // Create
        if (!penaltyModal.entryId)
          throw new Error("ID de binomio no especificado.");
        await ContingencyService.createPenalty(
          penaltyModal.entryId,
          penaltyModal.stageId,
          penaltyModal.timePenaltySeconds,
          penaltyModal.reason,
        );
      }
      setPenaltyModal(null);
      refetch();
    } catch (err: any) {
      setActionError(err.message || "Error al guardar la penalización.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeletePenalty = async (id: string) => {
    if (!confirm("¿Está seguro de eliminar esta penalización?")) return;
    setIsSubmitting(true);
    setActionError(null);
    try {
      await ContingencyService.deletePenalty(id);
      refetch();
    } catch (err: any) {
      alert(err.message || "Error al eliminar la penalización.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden mt-8">
      {/* Header */}
      <div className="px-6 py-5 border-b border-slate-50 flex items-center justify-between bg-slate-50/50">
        <div>
          <h3 className="text-base font-extrabold text-slate-800 flex items-center space-x-2">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
            </span>
            <span>Resultados en Vivo y Contingencia</span>
          </h3>
          <p className="text-xs text-slate-400 mt-0.5">
            {isAdmin
              ? "Modo Editor (ADMIN): Corrección manual de tiempos, vet checks y penalizaciones."
              : "Modo Lectura: Estado de carrera y ranking actual."}
          </p>
        </div>
        <button
          onClick={() => refetch()}
          className="text-xs font-bold text-slate-600 bg-white border border-slate-200 px-3 py-1.5 rounded-xl shadow-sm hover:bg-slate-50 transition-colors"
        >
          🔄 Refrescar
        </button>
      </div>

      {/* Grid Table */}
      <div className="p-6">
        {isLoading ? (
          <div className="text-center py-12 text-slate-400 text-sm">
            Cargando resultados...
          </div>
        ) : leaderboard.length === 0 ? (
          <div className="text-center py-12 text-slate-400 text-sm">
            No hay binomios en competencia aún.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-100 text-[10px] font-extrabold text-slate-400 uppercase tracking-wider">
                  <th className="py-3 px-4">Pos</th>
                  <th className="py-3 px-4">Dorsal</th>
                  <th className="py-3 px-4">Jinete / Caballo</th>
                  <th className="py-3 px-4">Estado</th>
                  <th className="py-3 px-4">Etapa</th>
                  <th className="py-3 px-4 text-right">Vel. Prom</th>
                  <th className="py-3 px-4 text-right">T. Neto</th>
                  <th className="py-3 px-4 text-right">Pulsaciones</th>
                  <th className="py-3 px-4 text-center">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-sm text-slate-600">
                {leaderboard.map((entry: any, index: number) => {
                  const isExpanded = expandedEntryId === entry.entryId;
                  return (
                    <React.Fragment key={entry.entryId || index}>
                      <tr
                        className={`hover:bg-slate-50/50 transition-colors ${isExpanded ? "bg-slate-50/30" : ""}`}
                      >
                        <td className="py-4 px-4 font-extrabold text-slate-800 font-sans tabular-nums">
                          {entry.rank !== null ? `#${entry.rank}` : "-"}
                        </td>
                        <td className="py-4 px-4">
                          <span className="inline-flex items-center px-2 py-0.5 rounded bg-slate-100 text-slate-800 text-xs font-bold font-sans tabular-nums">
                            #{entry.bibNumber}
                          </span>
                        </td>
                        <td className="py-4 px-4">
                          <div className="font-bold text-slate-800">
                            {entry.riderName}
                          </div>
                          <div className="text-xs text-slate-400">
                            {entry.horseName}
                          </div>
                        </td>
                        <td className="py-4 px-4">
                          {(() => {
                            if (entry.status === "IN_RACE") {
                              return (
                                <span className="inline-flex px-2 py-0.5 rounded-full text-[10px] font-extrabold border bg-emerald-50 text-emerald-700 border-emerald-100">
                                  🏇 CARRERA
                                </span>
                              );
                            }
                            if (entry.status === "VET_CHECK") {
                              return (
                                <span className="inline-flex px-2 py-0.5 rounded-full text-[10px] font-extrabold border bg-amber-50 text-amber-700 border-amber-100">
                                  🩺 VET CHECK
                                </span>
                              );
                            }
                            if (entry.status === "RESTING") {
                              return (
                                <span className="inline-flex px-2 py-0.5 rounded-full text-[10px] font-extrabold border bg-blue-50 text-blue-700 border-blue-100">
                                  ⏱️ NEUTRALIZACIÓN
                                </span>
                              );
                            }
                            if (entry.status === "FINISHED") {
                              return (
                                <span className="inline-flex px-2 py-0.5 rounded-full text-[10px] font-extrabold border bg-purple-50 text-purple-700 border-purple-100">
                                  🏁 FINALIZADO
                                </span>
                              );
                            }
                            if (entry.status === "FINISHED_PROVISIONAL") {
                              return (
                                <span className="inline-flex px-2 py-0.5 rounded-full text-[10px] font-extrabold border bg-blue-50 text-blue-700 border-blue-100">
                                  🏁 PROVISIONAL
                                </span>
                              );
                            }

                            const info = getEliminationDisplayLabel(entry.status);
                            return (
                              <span
                                title={`${info.label} (${info.feiLabel})`}
                                className="inline-flex px-2 py-0.5 rounded-full text-[10px] font-extrabold border bg-rose-50 text-rose-700 border-rose-200 cursor-help"
                              >
                                🛑 {info.code}
                              </span>
                            );
                          })()}
                        </td>
                        <td className="py-4 px-4 font-sans tabular-nums font-bold text-slate-700">
                          E{entry.currentStage}
                        </td>
                        <td className="py-4 px-4 text-right font-sans tabular-nums font-bold text-slate-800">
                          {entry.averageSpeed
                            ? `${entry.averageSpeed.toFixed(2)} km/h`
                            : "-"}
                        </td>
                        <td className="py-4 px-4 text-right font-sans tabular-nums text-slate-800">
                          {formatTimeMs(entry.totalRaceTimeMs)}
                        </td>
                        <td className="py-4 px-4 text-right font-sans tabular-nums font-bold">
                          {entry.heartRate ? (
                            <span
                              className={`font-sans tabular-nums ${entry.heartRate > 65 ? "text-rose-600 animate-pulse" : "text-emerald-600"}`}
                            >
                              {entry.heartRate} ppm
                            </span>
                          ) : (
                            "-"
                          )}
                        </td>
                        <td className="py-4 px-4 text-center">
                          <button
                            onClick={() => toggleExpand(entry.entryId)}
                            className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-lg transition-all"
                          >
                            {isExpanded ? "Ocultar" : "Detalles / Editar"}
                          </button>
                        </td>
                      </tr>

                      {/* Expanded Section */}
                      {isExpanded && (
                        <tr>
                          <td
                            colSpan={9}
                            className="bg-slate-50/50 p-6 border-t border-b border-slate-100"
                          >
                            <div className="space-y-6">
                              {/* Stage Detail Timeline */}
                              <div>
                                <h4 className="text-xs font-extrabold text-slate-400 uppercase tracking-wider mb-3">
                                  Historial por Etapa
                                </h4>
                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                  {(entry.stages || []).map((st: any) => (
                                    <div
                                      key={st.stageNumber}
                                      className="bg-white border border-slate-150 p-4 rounded-xl shadow-sm space-y-3"
                                    >
                                      <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                                        <span className="font-extrabold text-slate-800 text-xs">
                                          E{st.stageNumber}
                                        </span>
                                        <span className="text-[10px] text-slate-400 font-sans tabular-nums">
                                          {st.distanceKm} km
                                        </span>
                                      </div>

                                      {/* Times layout */}
                                      <div className="space-y-2 text-xs">
                                        {/* Start Time */}
                                        <div className="flex items-center justify-between">
                                          <span className="text-slate-400">
                                            Salida (Start):
                                          </span>
                                          <div className="flex items-center space-x-1.5 font-sans tabular-nums text-slate-800 font-bold">
                                            <span>
                                              {formatLocalTime(st.startTime)}
                                            </span>
                                            {isAdmin &&
                                              st.startTimeRecordId && (
                                                <div className="flex items-center space-x-1">
                                                  <button
                                                    onClick={() =>
                                                      setTimingModal({
                                                        isOpen: true,
                                                        recordId:
                                                          st.startTimeRecordId,
                                                        recordedAt:
                                                          st.startTime,
                                                        label: `Largada Etapa ${st.stageNumber}`,
                                                      })
                                                    }
                                                    className="text-blue-500 hover:text-blue-700 p-0.5"
                                                    title="Corregir Hora"
                                                  >
                                                    ✏️
                                                  </button>
                                                  <button
                                                    onClick={() =>
                                                      handleDeleteTiming(
                                                        st.startTimeRecordId,
                                                      )
                                                    }
                                                    className="text-rose-500 hover:text-rose-700 p-0.5"
                                                    title="Eliminar Registro"
                                                  >
                                                    🗑️
                                                  </button>
                                                </div>
                                              )}
                                          </div>
                                        </div>

                                        {/* Arrival Time */}
                                        <div className="flex items-center justify-between">
                                          <span className="text-slate-400">
                                            Llegada (Arrival):
                                          </span>
                                          <div className="flex items-center space-x-1.5 font-sans tabular-nums text-slate-800 font-bold">
                                            <span>
                                              {formatLocalTime(st.arrivalTime)}
                                            </span>
                                            {isAdmin &&
                                              st.arrivalTimeRecordId && (
                                                <div className="flex items-center space-x-1">
                                                  <button
                                                    onClick={() =>
                                                      setTimingModal({
                                                        isOpen: true,
                                                        recordId:
                                                          st.arrivalTimeRecordId,
                                                        recordedAt:
                                                          st.arrivalTime,
                                                        label: `Llegada Etapa ${st.stageNumber}`,
                                                      })
                                                    }
                                                    className="text-blue-500 hover:text-blue-700 p-0.5"
                                                    title="Corregir Hora"
                                                  >
                                                    ✏️
                                                  </button>
                                                  <button
                                                    onClick={() =>
                                                      handleDeleteTiming(
                                                        st.arrivalTimeRecordId,
                                                      )
                                                    }
                                                    className="text-rose-500 hover:text-rose-700 p-0.5"
                                                    title="Eliminar Registro"
                                                  >
                                                    🗑️
                                                  </button>
                                                </div>
                                              )}
                                          </div>
                                        </div>

                                        {/* Vet In Time */}
                                        <div className="flex items-center justify-between">
                                          <span className="text-slate-400">
                                            Presentación (Vet In):
                                          </span>
                                          <div className="flex items-center space-x-1.5 font-sans tabular-nums text-slate-800 font-bold">
                                            <span>
                                              {formatLocalTime(st.vetInTime)}
                                            </span>
                                            {isAdmin &&
                                              st.vetInTimeRecordId && (
                                                <div className="flex items-center space-x-1">
                                                  <button
                                                    onClick={() =>
                                                      setTimingModal({
                                                        isOpen: true,
                                                        recordId:
                                                          st.vetInTimeRecordId,
                                                        recordedAt:
                                                          st.vetInTime,
                                                        label: `Vet In Etapa ${st.stageNumber}`,
                                                      })
                                                    }
                                                    className="text-blue-500 hover:text-blue-700 p-0.5"
                                                    title="Corregir Hora"
                                                  >
                                                    ✏️
                                                  </button>
                                                  <button
                                                    onClick={() =>
                                                      handleDeleteTiming(
                                                        st.vetInTimeRecordId,
                                                      )
                                                    }
                                                    className="text-rose-500 hover:text-rose-700 p-0.5"
                                                    title="Eliminar Registro"
                                                  >
                                                    🗑️
                                                  </button>
                                                </div>
                                              )}
                                          </div>
                                        </div>

                                        {/* Tiempo Neto */}
                                        <div className="flex items-center justify-between border-t border-slate-50/50 pt-1.5">
                                          <span className="text-slate-400">
                                            Tiempo Neto:
                                          </span>
                                          <span className="font-sans tabular-nums text-slate-800 font-bold">
                                            {formatTimeMs(st.netTimeMs)}
                                          </span>
                                        </div>

                                        {/* Average Speed */}
                                        <div className="flex items-center justify-between">
                                          <span className="text-slate-400">
                                            Vel. Promedio:
                                          </span>
                                          <span className="font-sans tabular-nums text-slate-800 font-bold">
                                            {st.averageSpeed
                                              ? `${st.averageSpeed.toFixed(2)} km/h`
                                              : "-"}
                                          </span>
                                        </div>

                                        {/* Heart Rate / Clinical */}
                                        <div className="flex items-center justify-between border-t border-slate-50 pt-2">
                                          <span className="text-slate-400 font-semibold">
                                            Vet Check:
                                          </span>
                                          <div className="flex items-center space-x-1.5 font-sans tabular-nums font-bold">
                                            {st.heartRate ? (
                                              <span
                                                className={`font-sans tabular-nums ${st.heartRate > 65 ? "text-rose-600" : "text-emerald-600"}`}
                                              >
                                                {st.heartRate} ppm (
                                                {st.motricity || "APTO"})
                                              </span>
                                            ) : (
                                              <span className="text-slate-300">
                                                -
                                              </span>
                                            )}
                                            {isAdmin && st.vetInspectionId && (
                                              <div className="flex items-center space-x-1">
                                                <button
                                                  onClick={() =>
                                                    setVetModal({
                                                      isOpen: true,
                                                      inspectionId:
                                                        st.vetInspectionId,
                                                      heartRate:
                                                        st.heartRate || 56,
                                                      gaitStatus:
                                                        st.motricity ||
                                                        "APPROVED",
                                                      notes: st.notes || "",
                                                    })
                                                  }
                                                  className="text-blue-500 hover:text-blue-700 p-0.5"
                                                  title="Editar Clínica"
                                                >
                                                  ✏️
                                                </button>
                                                <button
                                                  onClick={() =>
                                                    handleDeleteVet(
                                                      st.vetInspectionId,
                                                    )
                                                  }
                                                  className="text-rose-500 hover:text-rose-700 p-0.5"
                                                  title="Eliminar Inspección"
                                                >
                                                  🗑️
                                                </button>
                                              </div>
                                            )}
                                          </div>
                                        </div>
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              </div>

                              {/* Penalties Section */}
                              <div className="border-t border-slate-200 pt-4">
                                <div className="flex items-center justify-between mb-3">
                                  <h4 className="text-xs font-extrabold text-slate-400 uppercase tracking-wider">
                                    Penalizaciones
                                  </h4>
                                  {isAdmin && (
                                    <button
                                      onClick={() =>
                                        setPenaltyModal({
                                          isOpen: true,
                                          entryId: entry.entryId,
                                          stageId: stages[0]?.id || "",
                                          timePenaltySeconds: 60,
                                          reason: "",
                                        })
                                      }
                                      className="text-xs font-extrabold text-emerald-600 hover:text-emerald-700"
                                    >
                                      + Agregar Penalización
                                    </button>
                                  )}
                                </div>

                                {!entry.penalties ||
                                entry.penalties.length === 0 ? (
                                  <p className="text-xs text-slate-400 italic">
                                    No hay penalizaciones aplicadas a este
                                    binomio.
                                  </p>
                                ) : (
                                  <div className="space-y-2">
                                    {entry.penalties.map((p: any) => (
                                      <div
                                        key={p.id}
                                        className="flex items-center justify-between bg-white border border-slate-150 p-3 rounded-lg text-xs"
                                      >
                                        <div>
                                          <span className="font-bold text-slate-700">
                                            E{p.stageNumber}:
                                          </span>{" "}
                                          <span className="text-slate-600">
                                            {p.reason}
                                          </span>
                                        </div>
                                        <div className="flex items-center space-x-3">
                                          <span className="font-sans tabular-nums font-bold text-rose-600">
                                            +{p.timePenaltySeconds} seg
                                          </span>
                                          {isAdmin && (
                                            <div className="flex items-center space-x-1.5">
                                              <button
                                                onClick={() =>
                                                  setPenaltyModal({
                                                    isOpen: true,
                                                    id: p.id,
                                                    stageId: p.stageId,
                                                    timePenaltySeconds:
                                                      p.timePenaltySeconds,
                                                    reason: p.reason,
                                                  })
                                                }
                                                className="text-blue-500 hover:text-blue-700"
                                              >
                                                ✏️
                                              </button>
                                              <button
                                                onClick={() =>
                                                  handleDeletePenalty(p.id)
                                                }
                                                className="text-rose-500 hover:text-rose-700"
                                              >
                                                🗑️
                                              </button>
                                            </div>
                                          )}
                                        </div>
                                      </div>
                                    ))}
                                  </div>
                                )}
                              </div>
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ==========================================
          MODAL: EDIT TIMING RECORD
          ========================================== */}
      {timingModal && timingModal.isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-100">
            <h3 className="text-base font-extrabold text-slate-800 mb-2">
              Corregir Registro de Tiempo
            </h3>
            <p className="text-xs text-slate-400 mb-4 uppercase font-bold tracking-wider">
              {timingModal.label}
            </p>

            <div className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">
                  Hora (Formato HH:MM:SS)
                </label>
                <input
                  type="text"
                  value={modalTimeStr}
                  onChange={handleTimeChange}
                  placeholder="HH:MM:SS"
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm font-sans tabular-nums focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
                <span className="text-[10px] text-slate-400 mt-1 block">
                  Ejemplo: 14:30:00 (Rango válido: 00:00:00 a 23:59:59)
                </span>
              </div>

              {actionError && (
                <div className="bg-rose-50 border border-rose-100 p-3 rounded-xl text-xs text-rose-600 font-bold">
                  {actionError}
                </div>
              )}

              <div className="flex justify-end space-x-3 pt-2">
                <button
                  onClick={() => setTimingModal(null)}
                  disabled={isSubmitting}
                  className="px-4 py-2 text-sm font-bold text-slate-500 hover:text-slate-700"
                >
                  Cancelar
                </button>
                <button
                  onClick={handleUpdateTiming}
                  disabled={isSubmitting}
                  className="px-5 py-2 bg-emerald-600 text-white rounded-xl text-sm font-bold shadow-md hover:bg-emerald-500"
                >
                  {isSubmitting ? "Guardando..." : "Confirmar"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ==========================================
          MODAL: EDIT VET INSPECTION
          ========================================== */}
      {vetModal && vetModal.isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-100">
            <h3 className="text-base font-extrabold text-slate-800 mb-4">
              Corregir Inspección Veterinaria
            </h3>

            <div className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">
                  Frecuencia Cardíaca (ppm)
                </label>
                <input
                  type="number"
                  value={vetModal.heartRate}
                  onChange={(e) =>
                    setVetModal({
                      ...vetModal,
                      heartRate: parseInt(e.target.value) || 0,
                    })
                  }
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm font-sans tabular-nums focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
                {vetModal.heartRate > 65 && (
                  <span className="text-[10px] text-rose-500 font-semibold mt-1 block">
                    ⚠️ Excede el límite de 65 ppm. El competidor será
                    descalificado automáticamente (DQ).
                  </span>
                )}
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">
                  Estado de la Marcha (Gait Status)
                </label>
                <select
                  value={vetModal.gaitStatus}
                  onChange={(e) =>
                    setVetModal({ ...vetModal, gaitStatus: e.target.value })
                  }
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                >
                  <option value="APPROVED">APPROVED (Aprobado)</option>
                  <option value="LAMENESS_ELIMINATED">
                    LAMENESS_ELIMINATED (Claudicación / Descalificado)
                  </option>
                  <option value="OBSERVATION">
                    OBSERVATION (En Observación)
                  </option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">
                  Notas / Observaciones
                </label>
                <textarea
                  value={vetModal.notes}
                  onChange={(e) =>
                    setVetModal({ ...vetModal, notes: e.target.value })
                  }
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  rows={3}
                />
              </div>

              {actionError && (
                <div className="bg-rose-50 border border-rose-100 p-3 rounded-xl text-xs text-rose-600 font-bold">
                  {actionError}
                </div>
              )}

              <div className="flex justify-end space-x-3 pt-2">
                <button
                  onClick={() => setVetModal(null)}
                  disabled={isSubmitting}
                  className="px-4 py-2 text-sm font-bold text-slate-500 hover:text-slate-700"
                >
                  Cancelar
                </button>
                <button
                  onClick={handleUpdateVet}
                  disabled={isSubmitting}
                  className="px-5 py-2 bg-emerald-600 text-white rounded-xl text-sm font-bold shadow-md hover:bg-emerald-500"
                >
                  {isSubmitting ? "Guardando..." : "Confirmar"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ==========================================
          MODAL: CREATE / EDIT PENALTY
          ========================================== */}
      {penaltyModal && penaltyModal.isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-100">
            <h3 className="text-base font-extrabold text-slate-800 mb-4">
              {penaltyModal.id
                ? "Modificar Penalización"
                : "Agregar Penalización de Tiempo"}
            </h3>

            <div className="space-y-4">
              {!penaltyModal.id && (
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase mb-1">
                    Etapa de la Carrera
                  </label>
                  <select
                    value={penaltyModal.stageId}
                    onChange={(e) =>
                      setPenaltyModal({
                        ...penaltyModal,
                        stageId: e.target.value,
                      })
                    }
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  >
                    {stages.map((st) => (
                      <option key={st.id} value={st.id}>
                        Etapa {st.stageNumber}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">
                  Tiempo de Penalización (Segundos)
                </label>
                <input
                  type="number"
                  value={penaltyModal.timePenaltySeconds}
                  onChange={(e) =>
                    setPenaltyModal({
                      ...penaltyModal,
                      timePenaltySeconds: parseInt(e.target.value) || 0,
                    })
                  }
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm font-sans tabular-nums focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">
                  Motivo / Razón
                </label>
                <input
                  type="text"
                  value={penaltyModal.reason}
                  onChange={(e) =>
                    setPenaltyModal({ ...penaltyModal, reason: e.target.value })
                  }
                  placeholder="Ej. Incumplimiento del Art. 20"
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              {actionError && (
                <div className="bg-rose-50 border border-rose-100 p-3 rounded-xl text-xs text-rose-600 font-bold">
                  {actionError}
                </div>
              )}

              <div className="flex justify-end space-x-3 pt-2">
                <button
                  onClick={() => setPenaltyModal(null)}
                  disabled={isSubmitting}
                  className="px-4 py-2 text-sm font-bold text-slate-500 hover:text-slate-700"
                >
                  Cancelar
                </button>
                <button
                  onClick={handleSavePenalty}
                  disabled={isSubmitting}
                  className="px-5 py-2 bg-emerald-600 text-white rounded-xl text-sm font-bold shadow-md hover:bg-emerald-500"
                >
                  {isSubmitting ? "Guardando..." : "Confirmar"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
