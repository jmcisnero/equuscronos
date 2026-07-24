"use client";

import React from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { CompetitionService } from "@/services/api/competition.service";
import { useLiveLeaderboard, LeaderboardEntry } from "@/hooks/useLiveLeaderboard";

export default function OfficialSheetPage({
  params,
}: {
  params?: Promise<{ id: string }>;
}) {
  const routeParams = useParams();
  const routeId = routeParams?.id as string;
  let unwrappedId = "";
  if (params) {
    try {
      const resolved = React.use(params);
      unwrappedId = resolved?.id || "";
    } catch (e) {
      // Fallback to routeParams if params Promise unwrapping fails
    }
  }
  const id = routeId || unwrappedId;

  const [printDateTime, setPrintDateTime] = React.useState("");
  React.useEffect(() => {
    setPrintDateTime(new Date().toLocaleString("es-UY", {
      timeZone: "America/Montevideo",
      hour: "2-digit",
      minute: "2-digit",
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour12: false,
    }));
  }, []);

  // 1. Fetch competition metadata
  const { data: comp, isLoading: isCompLoading, error: compError } = useQuery({
    queryKey: ["competition", id],
    queryFn: () => CompetitionService.getById(id),
    enabled: !!id,
    retry: 1,
  });

  // 2. Fetch live leaderboard data
  const { leaderboard = [], isLoading: isLeaderboardLoading, error: leaderboardError } = useLiveLeaderboard(id);

  // Loading state
  if (isCompLoading || isLeaderboardLoading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-slate-50 p-6">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-equus-green mb-4"></div>
        <p className="text-sm font-semibold text-slate-600">Cargando Planilla Oficial...</p>
      </div>
    );
  }

  // Error state
  if (compError || leaderboardError || !comp) {
    const errorMsg = (compError instanceof Error ? compError.message : "") || 
                     (leaderboardError instanceof Error ? leaderboardError.message : "") ||
                     "No se pudo cargar la información del evento.";
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-slate-50 p-6 text-center">
        <div className="bg-emerald-50 border border-[#1C4F38]/20 text-equus-green p-4 rounded-xl max-w-md mb-6">
          <p className="font-bold">Error al Cargar Planilla</p>
          <p className="text-xs mt-1">{errorMsg}</p>
        </div>
        <Link
          href={`/competitions/${id}`}
          className="px-6 py-2.5 bg-slate-800 hover:bg-slate-700 text-white font-bold text-sm rounded-xl transition-all shadow-md"
        >
          Volver a la Competencia
        </Link>
      </div>
    );
  }

  // Formatting helpers
  const formatDateOnly = (dateStr?: string) => {
    if (!dateStr) return "-";
    const datePart = dateStr.includes("T") ? dateStr.split("T")[0] : dateStr;
    const parts = datePart.split("-");
    if (parts.length === 3) {
      const [year, month, day] = parts;
      return `${day.padStart(2, "0")}/${month.padStart(2, "0")}/${year}`;
    }
    return dateStr;
  };

  const formatTimeOnly = (dateStr?: string | Date) => {
    if (!dateStr) return "";
    try {
      const d = new Date(dateStr);
      if (isNaN(d.getTime())) return "";
      return new Intl.DateTimeFormat("es-UY", {
        timeZone: "America/Montevideo",
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
        hour12: false,
      }).format(d);
    } catch {
      return "";
    }
  };

  // Dynamic maximum vet control presentation time calculation (arrivalTime + 20 minutes)
  const calculateVetLimit = (arrivalTimeStr?: string | Date | null) => {
    if (!arrivalTimeStr) return "";
    try {
      const d = new Date(arrivalTimeStr);
      if (isNaN(d.getTime())) return "";
      const limitDate = new Date(d.getTime() + 20 * 60 * 1000);
      return new Intl.DateTimeFormat("es-UY", {
        timeZone: "America/Montevideo",
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
        hour12: false,
      }).format(limitDate);
    } catch {
      return "";
    }
  };

  const formatDuration = (ms?: number) => {
    if (ms === undefined || ms === null || isNaN(ms)) return "-";
    const totalSeconds = Math.floor(ms / 1000);
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;
    return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
  };

  // Stage distance configuration
  const s1 = comp.stages?.find(s => s.stageNumber === 1);
  const s2 = comp.stages?.find(s => s.stageNumber === 2);
  const s1Distance = s1?.distanceKm ? Number(s1.distanceKm) : 0;
  const s2Distance = s2?.distanceKm ? Number(s2.distanceKm) : 0;
  const totalDistance = s1Distance + s2Distance;

  // Helper to determine the stage where a competitor abandoned/was eliminated
  const getEliminatedStage = (entry: LeaderboardEntry) => {
    const statusStr = entry.status as string;
    const isEliminated = ["DQ", "DNF", "WD", "NO_COMPLETED"].includes(statusStr) || 
                         statusStr.startsWith("ELIMINATED");
    if (!isEliminated) return null;

    const stg2 = entry.stages?.find(s => s.stageNumber === 2);
    if (stg2?.startTime) {
      return 2;
    }
    return 1;
  };

  const getEliminationReason = (entry: LeaderboardEntry, stageNumber: number) => {
    const elimStage = getEliminatedStage(entry);
    if (elimStage !== stageNumber) return "";

    const stg = entry.stages?.find(s => s.stageNumber === stageNumber);
    const statusStr = entry.status as string;
    if (statusStr === "WD") return "Retirado";
    if (statusStr === "DNF") return "Ret. Vol.";
    if (statusStr === "ELIMINATED_GAIT" || stg?.motricity === "LAMENESS_ELIMINATED") {
      return "Cojera";
    }
    if (statusStr === "ELIMINATED_PP") {
      const hr = stg?.heartRate || entry.heartRate;
      return hr ? `${hr} ppm F.C.A.` : "F.C.A.";
    }
    if (statusStr === "ELIMINATED_TR") {
      return "Ex. T. Rec.";
    }
    if (stg?.heartRate && stg.heartRate > (comp.maxHeartRate || 65)) {
      return `${stg.heartRate} ppm F.C.A.`;
    }
    if (statusStr === "DQ") {
      if (stg?.motricity === "LAMENESS_ELIMINATED") return "Cojera";
      if (stg?.heartRate && stg.heartRate > (comp.maxHeartRate || 65)) {
        return `${stg.heartRate} ppm F.C.A.`;
      }
      return "Descalif.";
    }
    if (statusStr === "NO_COMPLETED") return "N.C.";
    return "Eliminado";
  };

  // Stage 1 Statistics
  const s1Started = leaderboard.filter(e => {
    const stg = e.stages?.find(s => s.stageNumber === 1);
    return stg?.startTime || e.status !== "WD";
  }).length;

  const s1Abandoned = leaderboard
    .filter(e => getEliminatedStage(e) === 1)
    .map(e => e.bibNumber)
    .sort((a, b) => a - b);
  const s1AbandonedList = s1Abandoned.length > 0 ? s1Abandoned.join(", ") : "-";

  const s1Finishers = leaderboard.filter(e => {
    const stg = e.stages?.find(s => s.stageNumber === 1);
    return stg && stg.arrivalTime;
  });

  // Winners and FEU Trophy calculations
  const classifiedCompetitors = leaderboard.filter(e => e.rank !== null && e.rank !== undefined && e.rank > 0);
  const ganadorCompetencia = classifiedCompetitors.find(e => e.rank === 1);
  
  const winnerTimeStr = ganadorCompetencia?.totalRaceTimeMs ? formatDuration(ganadorCompetencia.totalRaceTimeMs) : "-";
  const winnerSpeedStr = ganadorCompetencia?.averageSpeed ? ganadorCompetencia.averageSpeed.toFixed(3) : "-";
  const displayCompetenciaWinner = ganadorCompetencia ? `${ganadorCompetencia.bibNumber} - ${ganadorCompetencia.horseName}` : "-";

  const s1Leader = s1Finishers.length > 0
    ? [...s1Finishers].sort((a, b) => {
        const sa = a.stages?.find(s => s.stageNumber === 1)?.netTimeMs || Infinity;
        const sb = b.stages?.find(s => s.stageNumber === 1)?.netTimeMs || Infinity;
        return sa - sb;
      })[0]
    : null;

  const s1LeaderStg = s1Leader?.stages?.find(s => s.stageNumber === 1);
  const ganadorS1 = ganadorCompetencia?.stages?.find(s => s.stageNumber === 1);
  const s1TimeStr = ganadorS1?.netTimeMs
    ? formatDuration(ganadorS1.netTimeMs)
    : (s1LeaderStg?.netTimeMs ? formatDuration(s1LeaderStg.netTimeMs) : "-");
  const s1SpeedStr = ganadorS1?.averageSpeed
    ? ganadorS1.averageSpeed.toFixed(3)
    : (s1LeaderStg?.averageSpeed ? s1LeaderStg.averageSpeed.toFixed(3) : "-");

  // Stage 2 Statistics
  const s2Started = leaderboard.filter(e => {
    const stg = e.stages?.find(s => s.stageNumber === 2);
    return !!stg?.startTime;
  }).length;

  const s2Abandoned = leaderboard
    .filter(e => getEliminatedStage(e) === 2)
    .map(e => e.bibNumber)
    .sort((a, b) => a - b);
  const s2AbandonedList = s2Abandoned.length > 0 ? s2Abandoned.join(", ") : "-";

  const s2Finishers = leaderboard.filter(e => {
    const stg = e.stages?.find(s => s.stageNumber === 2);
    return stg && stg.arrivalTime;
  });

  const s2Leader = s2Finishers.length > 0
    ? [...s2Finishers].sort((a, b) => {
        const sa = a.stages?.find(s => s.stageNumber === 2)?.netTimeMs || Infinity;
        const sb = b.stages?.find(s => s.stageNumber === 2)?.netTimeMs || Infinity;
        return sa - sb;
      })[0]
    : null;

  const s2LeaderStg = s2Leader?.stages?.find(s => s.stageNumber === 2);
  const ganadorS2 = ganadorCompetencia?.stages?.find(s => s.stageNumber === 2);
  const s2TimeStr = ganadorS2?.netTimeMs
    ? formatDuration(ganadorS2.netTimeMs)
    : (s2LeaderStg?.netTimeMs ? formatDuration(s2LeaderStg.netTimeMs) : "-");
  const s2SpeedStr = ganadorS2?.averageSpeed
    ? ganadorS2.averageSpeed.toFixed(3)
    : (s2LeaderStg?.averageSpeed ? s2LeaderStg.averageSpeed.toFixed(3) : "-");

  const getStage1HeartRate = (e: LeaderboardEntry) => {
    const stg = e.stages?.find(s => s.stageNumber === 1);
    return stg?.heartRate || Infinity;
  };

  let ganadorTrofeoFeu: LeaderboardEntry | null = null;
  if (classifiedCompetitors.length > 0) {
    ganadorTrofeoFeu = classifiedCompetitors.reduce((minEntry, currentEntry) => {
      const minHr = getStage1HeartRate(minEntry);
      const curHr = getStage1HeartRate(currentEntry);
      if (curHr < minHr) {
        return currentEntry;
      } else if (curHr === minHr) {
        const minRank = minEntry.rank || Infinity;
        const curRank = currentEntry.rank || Infinity;
        return curRank < minRank ? currentEntry : minEntry;
      }
      return minEntry;
    });
  }

  const displayFeuWinner = (ganadorTrofeoFeu && getStage1HeartRate(ganadorTrofeoFeu) !== Infinity)
    ? `${ganadorTrofeoFeu.bibNumber} - ${ganadorTrofeoFeu.horseName}`
    : "-";

  // Left side sorting: Chronological ascending order of Stage 1 arrival time
  const leftEntries = [...leaderboard].sort((a, b) => {
    const s1a = a.stages?.find(s => s.stageNumber === 1);
    const s1b = b.stages?.find(s => s.stageNumber === 1);
    
    const timeA = s1a?.arrivalTime ? new Date(s1a.arrivalTime).getTime() : Infinity;
    const timeB = s1b?.arrivalTime ? new Date(s1b.arrivalTime).getTime() : Infinity;
    
    if (timeA !== timeB) {
      return timeA - timeB;
    }
    return a.bibNumber - b.bibNumber;
  });

  // Right side sorting: strictly classified binomios only (rank !== null or FINISHED status) sorted by rank ascending, compacted
  const rightEntries = leaderboard.filter(e => {
    const isFinished = e.status === "FINISHED" || e.status === "FINISHED_PROVISIONAL" || (e.rank !== null && e.rank !== undefined && e.rank > 0);
    return isFinished;
  }).sort((a, b) => {
    const rA = a.rank || Infinity;
    const rB = b.rank || Infinity;
    return rA - rB;
  });

  // Determine row count: exactly 25 minimum rows, expandable if there are more leftEntries or rightEntries + 6 bottom rows
  const totalRows = Math.max(25, leftEntries.length, rightEntries.length + 6);

  const displayDate = formatDateOnly(comp.competitionDate);

  // Calculate dynamic control closure time in HH:MM:SS based on winner's final stage arrival time + distance tolerance
  const getDynamicControlClosureTime = () => {
    if (ganadorCompetencia) {
      const s2Winner = ganadorCompetencia.stages?.find(s => s.stageNumber === 2);
      if (s2Winner?.arrivalTime) {
        try {
          const winnerArrival = new Date(s2Winner.arrivalTime);
          if (!isNaN(winnerArrival.getTime())) {
            let toleranceMins = 30;
            if (totalDistance < 80) {
              toleranceMins = 30;
            } else if (totalDistance >= 80 && totalDistance < 100) {
              toleranceMins = 45;
            } else {
              toleranceMins = 60;
            }
            const closureDate = new Date(winnerArrival.getTime() + toleranceMins * 60 * 1000);
            return new Intl.DateTimeFormat("es-UY", {
              timeZone: "America/Montevideo",
              hour: "2-digit",
              minute: "2-digit",
              second: "2-digit",
              hour12: false,
            }).format(closureDate);
          }
        } catch (e) {
          console.error("Error calculating dynamic closure time:", e);
        }
      }
    }

    // Fallback: format the database value to HH:MM:SS
    if (comp.controlClosureTime) {
      try {
        const d = new Date(comp.controlClosureTime);
        if (!isNaN(d.getTime())) {
          return new Intl.DateTimeFormat("es-UY", {
            timeZone: "America/Montevideo",
            hour: "2-digit",
            minute: "2-digit",
            second: "2-digit",
            hour12: false,
          }).format(d);
        }
      } catch {}
    }
    return "-";
  };

  const closureTimeStr = getDynamicControlClosureTime();

  return (
    <div className="min-h-screen bg-slate-100 py-8 print:py-0 print:bg-white transition-colors duration-200">
      {/* Dynamic Printing Style Setup */}
      <style dangerouslySetInnerHTML={{ __html: `
        @media print {
          body {
            background-color: white !important;
            color: black !important;
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
          }
          @page {
            size: A4;
            margin: 0;
          }
          ::-webkit-scrollbar {
            display: none;
          }
        }
        .feu-row-index {
          font-family: Arial, Helvetica, sans-serif !important;
          color: #1C4F38 !important;
          font-weight: 700 !important;
          font-size: 13px !important;
        }
        .feu-data-dorsal {
          font-family: Arial, Helvetica, sans-serif !important;
          color: #000000 !important;
          font-weight: 700 !important;
          font-size: 13px !important;
        }
        .feu-data-value {
          font-family: Arial, Helvetica, sans-serif !important;
          color: #000000 !important;
          font-weight: 700 !important;
          font-size: 13px !important;
        }
        .feu-eliminated-bg {
          background-color: #c58a41 !important;
          color: #000000 !important;
        }
      `}} />

      {/* Floating navigation and control action buttons */}
      <div className="fixed bottom-6 right-6 flex items-center space-x-3 z-50 print:hidden">
        <Link
          href={`/competitions/${id}`}
          className="bg-slate-800 hover:bg-slate-700 text-white font-extrabold px-6 py-3 rounded-full shadow-2xl flex items-center space-x-2 cursor-pointer transition-all hover:scale-105 active:scale-95 text-sm"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2.2} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18" />
          </svg>
          <span>Volver al Evento</span>
        </Link>
        <button
          onClick={() => window.print()}
          className="bg-equus-green hover:bg-[#153e2b] text-white font-extrabold px-6 py-3 rounded-full shadow-2xl flex items-center space-x-2 cursor-pointer transition-all hover:scale-105 active:scale-95 text-sm"
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
          <span>Imprimir Planilla</span>
        </button>
      </div>

      {/* Main A4 Document Sheet */}
      <div className="relative w-full max-w-[210mm] min-h-[297mm] mx-auto bg-white p-8 print:p-[12mm] print:pb-[20mm] shadow-xl print:shadow-none border border-slate-200 print:border-0 rounded-sm font-sans text-black">
        
        {/* Document Header Title */}
        <div className="text-center text-equus-green mb-5">
          <h1 className="text-lg font-black tracking-wider uppercase font-sans">Planilla de Resultados - {comp.name}</h1>
          <h2 className="text-xs font-extrabold tracking-widest uppercase mt-0.5 font-sans">Institución Organizadora: {comp.tenant?.name || "-"}</h2>
          <div className="text-[11px] font-bold mt-2 uppercase font-sans">
            <span className="text-equus-green">Fecha:</span>
            <span className="text-black font-bold font-sans ml-1 mr-3">{displayDate}</span>
            <span className="text-slate-400 font-normal mr-3">|</span>
            <span className="text-equus-green">Distancia:</span>
            <span className="text-black font-bold font-sans ml-1 mr-3">{totalDistance.toFixed(0)} kms</span>
            <span className="text-slate-400 font-normal mr-3">|</span>
            <span className="text-equus-green">Hora de Largada:</span>
            <span className="text-black font-bold font-sans ml-1 mr-3">{comp.startTime ? comp.startTime.substring(0, 5) : "07:00"}</span>
            <span className="text-slate-400 font-normal mr-3">|</span>
            <span className="text-equus-green">Localización:</span>
            <span className="text-black font-bold font-sans ml-1">{comp.location || "Melo"}</span>
          </div>
        </div>

        {/* Global Metadata & Stage stats Grid blocks */}
        <div className="border-2 border-[#1C4F38] bg-white text-equus-green text-[11px] mb-5 divide-y divide-[#1C4F38] font-sans">

          {/* 1ª ETAPA */}
          <div className="px-4 py-1.5">
            <div className="flex justify-between items-center font-bold uppercase text-[11px]">
              <div className="w-[25%] text-left">
                <span>1ª ETAPA de:</span>
                <span className="text-black font-bold ml-1.5 font-sans">{s1Distance.toFixed(0)} kms</span>
              </div>
              <div className="w-[20%] text-center font-sans">
                <span>LARGARON:</span>
                <span className="text-black font-bold ml-1.5">{s1Started}</span>
              </div>
              <div className="w-[55%] text-right font-sans">
                <span>ABANDONARON LOS Nº:</span>
                <span className="text-black font-bold ml-1.5">{s1AbandonedList}</span>
              </div>
            </div>
            <div className="grid grid-cols-2 mt-1 text-[10px] text-equus-green/90 font-medium">
              <div>
                <span>TIEMPO: </span>
                <span className="text-black font-bold font-sans ml-1">{s1TimeStr}</span>
              </div>
              <div className="text-right">
                <span>PROMEDIO: </span>
                <span className="text-black font-bold font-sans ml-1">{s1SpeedStr} Km/h</span>
              </div>
            </div>
          </div>

          {/* 2ª ETAPA */}
          <div className="px-4 py-1.5">
            <div className="flex justify-between items-center font-bold uppercase text-[11px]">
              <div className="w-[25%] text-left">
                <span>2ª ETAPA de:</span>
                <span className="text-black font-bold ml-1.5 font-sans">{s2Distance.toFixed(0)} kms</span>
              </div>
              <div className="w-[20%] text-center font-sans">
                <span>LARGARON:</span>
                <span className="text-black font-bold ml-1.5">{s2Started}</span>
              </div>
              <div className="w-[55%] text-right font-sans">
                <span>ABANDONARON LOS Nº:</span>
                <span className="text-black font-bold ml-1.5">{s2AbandonedList}</span>
              </div>
            </div>
            <div className="grid grid-cols-2 mt-1 text-[10px] text-equus-green/90 font-medium">
              <div>
                <span>TIEMPO: </span>
                <span className="text-black font-bold font-sans ml-1">{s2TimeStr}</span>
              </div>
              <div className="text-right">
                <span>PROMEDIO: </span>
                <span className="text-black font-bold font-sans ml-1">{s2SpeedStr} Km/h</span>
              </div>
            </div>
          </div>

          {/* Total race time & Winners Block */}
          <div className="px-4 py-1.5">
            <div className="grid grid-cols-2 font-bold uppercase gap-4">
              <div>
                <span>TIEMPO TOTAL:</span>
                <span className="text-black font-bold ml-1.5 font-sans">{winnerTimeStr}</span>
              </div>
              <div className="text-right">
                <span>PROMEDIO:</span>
                <span className="text-black font-bold ml-1.5 font-sans">{winnerSpeedStr} Km/h</span>
              </div>
            </div>
            <div className="grid grid-cols-2 mt-1.5 font-bold uppercase gap-4">
              <div className="truncate">
                <span>GANADOR DE LA COMPETENCIA:</span>
                <span className="text-black font-bold ml-1.5 font-sans">{displayCompetenciaWinner}</span>
              </div>
              <div className="text-right truncate">
                <span>GANADOR TROFEO F.E.U.:</span>
                <span className="text-black font-bold ml-1.5 font-sans">{displayFeuWinner}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Central double grid tables layout */}
        <div className="text-equus-green font-bold text-[10px] mb-1 font-sans">DOMINGO:</div>
        <table className="w-full border-collapse border-2 border-[#1C4F38] text-[10px]">
          <colgroup>
            <col className="w-[4%]" />
            <col className="w-[6%]" />
            <col className="w-[13%]" />
            <col className="w-[13%]" />
            <col className="w-[12%]" />
            <col className="w-[12%]" />
            
            <col className="w-[4%]" />
            <col className="w-[6%]" />
            <col className="w-[12%]" />
            <col className="w-[18%]" />
          </colgroup>
          <thead>
            {/* Header row 1 */}
            <tr className="border-b-2 border-[#1C4F38] bg-emerald-50/40 text-equus-green font-extrabold uppercase text-center">
              <th colSpan={6} className="border-r-2 border-[#1C4F38] py-1.5 text-xs tracking-wider font-sans">NEUTRALIZACIÓN</th>
              <th colSpan={4} className="py-1.5 text-xs tracking-wider font-sans">CLASIFICACIÓN FINAL</th>
            </tr>
            {/* Header row 2 */}
            <tr className="border-b-2 border-[#1C4F38] bg-emerald-50/20 text-equus-green font-bold uppercase text-[9px] text-center font-sans">
              <th className="border-r border-[#1C4F38] py-1"></th> {/* Left Row index */}
              <th className="border-r border-[#1C4F38]">Nº</th>
              <th className="border-r border-[#1C4F38]">HORA LLEGADA</th>
              <th className="border-r border-[#1C4F38]">HORA CONT. VET.</th>
              <th className="border-r border-[#1C4F38]">Frec. Card. / Mot. Desc.</th>
              <th className="border-r-2 border-[#1C4F38]">HORA LARGADA</th>
              
              <th className="border-r border-[#1C4F38]"></th> {/* Right Row index */}
              <th className="border-r border-[#1C4F38]">Nº</th>
              <th className="border-r border-[#1C4F38]">HORA LLEGADA</th>
              <th>TIEMPO TOTAL</th>
            </tr>
          </thead>
          <tbody>
            {Array.from({ length: totalRows }).map((_, index) => {
              const leftEntry = leftEntries[index];
              const rightEntry = rightEntries[index];
              
              const isLeftDummy = !leftEntry;
              const s1 = leftEntry?.stages?.find(s => s.stageNumber === 1);
              const s2 = leftEntry?.stages?.find(s => s.stageNumber === 2);
              
              const s1Eliminated = leftEntry ? getEliminatedStage(leftEntry) === 1 : false;
              const s1Arrival = s1?.arrivalTime ? formatTimeOnly(s1.arrivalTime) : "";
              const s1VetLimit = s1?.arrivalTime ? calculateVetLimit(s1.arrivalTime) : "";
              
              let s1HeartRateOrDesc = "";
              if (leftEntry) {
                if (s1Eliminated) {
                  s1HeartRateOrDesc = getEliminationReason(leftEntry, 1);
                } else if (s1?.heartRate) {
                  s1HeartRateOrDesc = `${s1.heartRate} ppm`;
                }
              }
              
              const s2Start = s2?.startTime ? formatTimeOnly(s2.startTime) : "";
              const hasRightData = !!rightEntry;
              
              // Double bottom border resolution
              const isLeftLastReal = !isLeftDummy && index === leftEntries.length - 1;
              const leftBorderClass = isLeftLastReal
                ? "border-b-4 border-double border-b-[#1C4F38]"
                : "border-b border-[#1C4F38]";

              const isRightLastReal = hasRightData && index === rightEntries.length - 1;
              const rightBorderClass = isRightLastReal
                ? "border-b-4 border-double border-b-[#1C4F38]"
                : "border-b border-[#1C4F38]";

              // Bottom six rows configuration for Right Side
              const isBottomSix = index >= totalRows - 6;

              return (
                <tr key={`row-${index}`} className="text-center h-[26px]">
                  {/* Left Side (Neutralización / Stage 1) */}
                  <td className={`border-r border-[#1C4F38] bg-emerald-50/10 ${leftBorderClass} feu-row-index`}>
                    {index + 1}
                  </td>
                  <td className={`border-r border-[#1C4F38] ${leftBorderClass} feu-data-dorsal`}>
                    {isLeftDummy ? "" : leftEntry.bibNumber}
                  </td>
                  <td className={`border-r border-[#1C4F38] ${leftBorderClass} feu-data-value`}>
                    {s1Arrival}
                  </td>
                  <td className={`border-r border-[#1C4F38] ${leftBorderClass} feu-data-value`}>
                    {s1VetLimit}
                  </td>
                  <td className={`border-r border-[#1C4F38] ${leftBorderClass} ${s1Eliminated ? "feu-eliminated-bg text-center font-sans" : ""}`}>
                    <span className={s1Eliminated ? "font-bold text-black text-[11px] font-sans" : "feu-data-value"}>
                      {s1HeartRateOrDesc}
                    </span>
                  </td>
                  <td className={`border-r-2 border-[#1C4F38] ${leftBorderClass} feu-data-value`}>
                    {s2Start}
                  </td>
                  
                  {/* Right Side (Clasificación Final / Stage 2 & Bottom Boxes) */}
                  {isBottomSix ? (
                    index === totalRows - 6 ? (
                      <td colSpan={4} className="border-2 border-[#1C4F38] bg-white px-2 py-1 text-left font-sans">
                        <div className="flex justify-between items-center text-xs">
                          <span className="font-extrabold text-[#1C4F38] tracking-wide uppercase font-sans">CIERRE DE CONTROL</span>
                          <span className="font-bold text-black font-sans text-sm">{closureTimeStr}</span>
                        </div>
                      </td>
                    ) : index === totalRows - 5 ? (
                      <td colSpan={4} className="border-x border-b border-[#1C4F38] bg-slate-100 px-2 py-1 text-center font-sans">
                        <div className="font-extrabold text-[#1C4F38] text-[9px] tracking-wider uppercase font-sans">LUNES: EQUINOS DESCALIFICADOS</div>
                      </td>
                    ) : (
                      <td colSpan={4} className="border-x border-b border-[#1C4F38] bg-white px-2 py-1 text-left font-sans">
                        <div className="flex items-center space-x-2">
                          <span className="text-[10px] text-[#1C4F38] font-bold w-4 font-sans">{index - (totalRows - 4) + 1}</span>
                          <span className="flex-1 border-b border-dotted border-[#1C4F38]/30 h-3"></span>
                        </div>
                      </td>
                    )
                  ) : hasRightData ? (
                    <>
                      <td className={`border-r border-[#1C4F38] bg-emerald-50/10 ${rightBorderClass} feu-row-index`}>
                        {rightEntry.rank}
                      </td>
                      <td className={`border-r border-[#1C4F38] ${rightBorderClass} feu-data-dorsal`}>
                        {rightEntry.bibNumber}
                      </td>
                      <td className={`border-r border-[#1C4F38] ${rightBorderClass} feu-data-value`}>
                        {rightEntry.stages?.find(s => s.stageNumber === 2)?.arrivalTime 
                          ? formatTimeOnly(rightEntry.stages.find(s => s.stageNumber === 2)!.arrivalTime) 
                          : ""}
                      </td>
                      <td className={`${rightBorderClass} feu-data-value`}>
                        {rightEntry.totalRaceTimeMs ? formatDuration(rightEntry.totalRaceTimeMs) : "-"}
                      </td>
                    </>
                  ) : (
                    <>
                      <td style={{ border: "none" }} className="bg-transparent"></td>
                      <td style={{ border: "none" }} className="bg-transparent"></td>
                      <td style={{ border: "none" }} className="bg-transparent"></td>
                      <td style={{ border: "none" }} className="bg-transparent"></td>
                    </>
                  )}
                </tr>
              );
            })}
          </tbody>
        </table>

        {/* Custom Print Footer */}
        <div className="hidden print:flex justify-between items-center text-[8px] text-slate-400 absolute bottom-[8mm] left-[12mm] right-[12mm] border-t border-slate-200 pt-1 font-mono uppercase">
          <span>EquusCronos - Consola de Administración</span>
          <span>{printDateTime || "-"} hs</span>
        </div>

      </div>
    </div>
  );
}
