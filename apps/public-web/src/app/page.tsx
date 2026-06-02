"use client";

import React from "react";
import CompetitionFeed from "../components/CompetitionFeed";

export default function HomePage() {
  return (
    <div className="min-h-screen bg-equus-bg font-sans text-equus-text pb-24">
      
      {/* 1. SECCIÓN PRINCIPAL HÉROE */}
      <div className="relative overflow-hidden bg-slate-900 text-white py-8 px-4 sm:px-6 lg:px-8 shadow-inner">
        {/* Decoraciones de fondo con la paleta de colores oficial */}
        <div className="absolute top-0 right-0 -mt-10 -mr-10 w-[500px] h-[500px] bg-equus-green opacity-25 rounded-full blur-3xl"></div>
        <div className="absolute bottom-0 left-0 -mb-10 -ml-10 w-[500px] h-[500px] bg-equus-tan-light opacity-15 rounded-full blur-3xl"></div>

        <div className="max-w-7xl mx-auto relative z-10 text-center md:text-left">
          <div className="max-w-3xl">
            <h1 className="text-3xl sm:text-4xl font-black tracking-tight leading-tight">
              EquusCronos <span className="text-[#A99677]">Resultados</span> en Vivo
            </h1>
            <p className="text-slate-300 mt-3 text-xs sm:text-sm max-w-xl leading-relaxed">
              Monitoreo en tiempo real de binomios oficiales. Clasificación inmediata basada en el reglamento de la Federación Ecuestre Uruguaya (FEU) para eventos de Raid Hípico y Endurance.
            </p>
          </div>
        </div>
      </div>

      {/* 2. ÁREA DE CONTENIDO PRINCIPAL */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-8">
        {/* COMPONENTE DYNAMIC FEED */}
        <CompetitionFeed />
      </main>
    </div>
  );
}
