"use client";

import React from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { CompetitionService } from "@/services/api/competition.service";
import { CompetitionEntryService } from "@/services/api/competition-entry.service";

export default function EntrySheetPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const resolvedParams = React.use(params);
  const id = resolvedParams.id;

  // 1. Fetch competition metadata
  const { data: comp, isLoading: isCompLoading, error: compError } = useQuery({
    queryKey: ["competition", id],
    queryFn: () => CompetitionService.getById(id),
    enabled: !!id,
    retry: 1,
  });

  // 2. Fetch all registered entries for the competition
  const { data: entries = [], isLoading: isEntriesLoading, error: entriesError } = useQuery({
    queryKey: ["competition-entries", id],
    queryFn: () => CompetitionEntryService.getAllByCompetition(id),
    enabled: !!id,
    retry: 1,
  });

  // Loading state
  if (isCompLoading || isEntriesLoading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-slate-50 p-6">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-slate-600 mb-4"></div>
        <p className="text-sm font-semibold text-slate-600">Cargando Planilla de Participantes...</p>
      </div>
    );
  }

  // Error state
  if (compError || entriesError || !comp) {
    const errorMsg = (compError instanceof Error ? compError.message : "") || 
                     (entriesError instanceof Error ? entriesError.message : "") ||
                     "No se pudo cargar la información de participantes.";
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-slate-50 p-6 text-center">
        <div className="bg-red-50 border border-red-100 text-red-600 p-4 rounded-xl max-w-md mb-6">
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

  // Sort entries by bib number (Dorsal) ascending
  const sortedEntries = [...entries].sort((a, b) => a.bibNumber - b.bibNumber);

  // Pad the entries up to a total of 30 rows
  const minRows = 30;
  const tableRows = sortedEntries.map(e => ({ ...e, isDummy: false }));
  while (tableRows.length < minRows) {
    tableRows.push({
      id: `blank-${tableRows.length}`,
      bibNumber: 0,
      status: "PLANNED",
      ballastWeight: 0,
      rider: { id: `dummy-rider-${tableRows.length}`, name: "", weight: 0 },
      horse: { id: `dummy-horse-${tableRows.length}`, name: "", owner: { id: "", name: "" }, isFeuActive: false, createdAt: "" },
      isDummy: true,
    } as any);
  }

  return (
    <div className="min-h-screen bg-slate-100 py-8 print:py-0 print:bg-white transition-colors duration-200">
      {/* Strict A4 Vertical Page Layout Styling */}
      <style dangerouslySetInnerHTML={{ __html: `
        @media print {
          body {
            background-color: white !important;
            color: black !important;
          }
          @page {
            size: A4 portrait;
            margin: 15mm 15mm 15mm 15mm;
          }
          ::-webkit-scrollbar {
            display: none;
          }
        }
      `}} />

      {/* Floating navigation and print control buttons */}
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
          className="bg-slate-900 hover:bg-slate-800 text-white font-extrabold px-6 py-3 rounded-full shadow-2xl flex items-center space-x-2 cursor-pointer transition-all hover:scale-105 active:scale-95 text-sm"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2.2} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M6.72 13.821V21h10.56v-7.179M9 17h6M19.5 8.25v7.5a2.25 2.25 0 01-2.25 2.25H6.75A2.25 2.25 0 014.5 15.75v-7.5m15 0A2.25 2.25 0 0017.25 6H6.75A2.25 2.25 0 004.5 8.25M19.5 8.25a2.25 2.25 0 00-2.25-2.25H17.25m-10.5 0h10.5m-10.5 0a2.25 2.25 0 00-2.25 2.25M6.75 6h10.5" />
          </svg>
          <span>Imprimir Planilla</span>
        </button>
      </div>

      {/* Main A4 Document Sheet */}
      <div className="w-full max-w-[210mm] mx-auto bg-white p-8 print:p-0 shadow-xl print:shadow-none border border-slate-200 print:border-0 rounded-sm font-sans text-black">
        
        {/* Document Header - Centauro Polo Club style */}
        <div className="text-center mb-6 border-b-2 border-black pb-4">
          <h1 className="text-2xl font-black tracking-widest text-black uppercase">PLANILLA DE PARTICIPANTES</h1>
          <h2 className="text-base font-bold text-slate-800 uppercase mt-1.5">{comp.name}</h2>
          <p className="text-xs font-bold text-slate-500 uppercase mt-0.5">
            Fecha: {comp.competitionDate ? new Date(comp.competitionDate).toLocaleDateString("es-UY", { timeZone: "America/Montevideo" }) : "-"}
          </p>
        </div>

        {/* Competitor Grid Table */}
        <table className="w-full border-collapse border border-black text-xs">
          <thead>
            <tr className="bg-slate-100/90 border-b border-black text-black font-extrabold uppercase text-[10px]">
              <th className="border border-black py-2 px-1 w-[5%] text-center">Ord</th>
              <th className="border border-black py-2 px-3 w-[22%] text-left">EQUINO</th>
              <th className="border border-black py-2 px-3 w-[22%] text-left">JINETE</th>
              <th className="border border-black py-2 px-3 w-[18%] text-left">PROPIETARIO</th>
              <th className="border border-black py-2 px-3 w-[18%] text-left">REPRESENTA CLUB</th>
              <th className="border border-black py-2 px-1 w-[7%] text-center">ANTECEDENTES</th>
              <th className="border border-black py-2 px-1 w-[8%] text-center">TEL / CABALLERIZA</th>
            </tr>
          </thead>
          <tbody>
            {tableRows.map((entry, index) => {
              const isDummy = entry.isDummy;
              return (
                <tr key={entry.id} className="border-b border-black h-8 hover:bg-slate-50/40">
                  <td className="border border-black py-1 px-1 text-center font-bold text-slate-700 font-mono">
                    {index + 1}
                  </td>
                  <td className="border border-black py-1 px-3 text-left font-semibold text-black uppercase font-mono text-[10.5px] truncate">
                    {isDummy ? "" : (entry.horse?.name || "")}
                  </td>
                  <td className="border border-black py-1 px-3 text-left text-slate-800 font-semibold uppercase text-[10.5px] truncate">
                    {isDummy ? "" : (entry.rider?.name || "")}
                  </td>
                  <td className="border border-black py-1 px-3 text-left text-slate-600 uppercase text-[9.5px] truncate">
                    {isDummy ? "" : (entry.horse?.owner?.name || "")}
                  </td>
                  <td className="border border-black py-1 px-3 text-left text-slate-600 uppercase text-[9.5px] truncate">
                    {isDummy ? "" : (entry.representedTenant?.name || "")}
                  </td>
                  <td className="border border-black py-1 px-1"></td>
                  <td className="border border-black py-1 px-1"></td>
                </tr>
              );
            })}
          </tbody>
        </table>

        {/* Small footer notice */}
        <div className="mt-8 text-right text-[9px] text-slate-400 font-semibold uppercase tracking-wider">
          EquusCronos - Generación Oficial de Planillas
        </div>

      </div>
    </div>
  );
}
