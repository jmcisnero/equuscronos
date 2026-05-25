"use client";

import React from 'react';
import Link from 'next/link';

export default function Home() {
  // Datos estadísticos de alto valor operativo del Club/Haras para la FEU
  const stats = [
    { 
      name: 'Caballos en Padrón', 
      value: '45', 
      change: '3 con sanidad por vencer', 
      changeType: 'warning' 
    },
    { 
      name: 'Jinetes Federados', 
      value: '12', 
      change: '100% con licencia al día', 
      changeType: 'success' 
    },
    { 
      name: 'Propietarios / Haras', 
      value: '8', 
      change: 'Registros activos', 
      changeType: 'neutral' 
    },
    { 
      name: 'Próximas Competencias', 
      value: '2', 
      change: 'Temporada actual', 
      changeType: 'accent' 
    },
  ];

  const quickLinks = [
    {
      title: 'Padrón de Caballos',
      description: 'Gestiona la trazabilidad, chips RFID, y vencimientos de sanidad MGAP para competencias.',
      href: '/horses',
      icon: (
        <svg className="h-6 w-6 text-equus-green" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M17 11c.3-3-1.5-5.5-3.8-6.5C10.5 3.5 7.5 5.5 7.5 8c0 .5-.1 1-.3 1.5L5 12.5c-.3.5-.1 1.2.4 1.5l1.6 1c.5.3 1.1.2 1.5-.2l.7-.7c.3-.3.8-.4 1.2-.2l1.6.8c1 .5 2.2.4 3.1-.3l2.4-1.9c.4-.3.5-.8.3-1.2L17 11z" />
          <path strokeLinecap="round" strokeLinejoin="round" d="M9.5 20h6M8.5 16h8" />
          <circle cx="12" cy="7.5" r="0.75" fill="currentColor" />
        </svg>
      ),
      color: 'green'
    },
    {
      title: 'Padrón de Propietarios',
      description: 'Control de Haras, Studs y criadores oficiales habilitados por la federación.',
      href: '/owners',
      icon: (
        <svg className="h-6 w-6 text-equus-tan-dark" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
        </svg>
      ),
      color: 'tan'
    },
    {
      title: 'Calendario y Etapas',
      description: 'Visualiza distancias, neutralizaciones en Vet Gates, y control de cronometraje.',
      href: '/competitions',
      icon: (
        <svg className="h-6 w-6 text-slate-700" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
        </svg>
      ),
      color: 'slate'
    }
  ];

  // Helper para asignar los estilos de badge de estadísticas dinámicamente
  const getBadgeStyle = (type: string) => {
    switch (type) {
      case 'warning':
        return 'bg-rose-50 text-rose-700 border border-rose-100/50';
      case 'success':
        return 'bg-emerald-50 text-emerald-700 border border-emerald-100/50';
      case 'accent':
        return 'bg-amber-50 text-equus-tan-dark border border-equus-tan-light/30';
      default:
        return 'bg-slate-50 text-slate-500 border border-slate-200/50';
    }
  };

  return (
    <div className="space-y-8">
      
      {/* Saludo Principal Corporativo */}
      <div className="bg-gradient-to-br from-equus-green to-emerald-950 rounded-2xl p-6 md:p-8 text-white shadow-xl border border-white/5 relative overflow-hidden">
        <div className="absolute top-0 right-0 -mt-6 -mr-6 w-32 h-32 bg-white/5 rounded-full blur-2xl pointer-events-none"></div>
        <div className="max-w-3xl relative z-10">
          <h2 className="text-2xl md:text-3xl font-bold tracking-tight">
            ¡Hola, Juan Díaz!
          </h2>
          <p className="mt-2 text-equus-tan-light/90 text-sm md:text-base leading-relaxed font-medium">
            Bienvenido al panel maestro de **EquusCronos**. Desde aquí puedes controlar la gobernanza deportiva del club, administrar binomios, fiscalizar inspecciones veterinarias en Vet Gates, y asegurar el cumplimiento de normativas sanitarias vigentes.
          </p>
          <div className="mt-4 flex items-center space-x-2">
            <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse"></span>
            <span className="text-xs font-bold text-equus-tan-light tracking-wider uppercase">Conectado a la base de datos nacional FEU</span>
          </div>
        </div>
      </div>

      {/* Grid de Estadísticas con Valor Operativo Real */}
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map((item) => (
          <div
            key={item.name}
            className="bg-white overflow-hidden shadow-sm rounded-2xl border border-slate-100 p-5 hover:shadow-md hover:border-slate-200/60 transition-all duration-200 flex flex-col justify-between"
          >
            <div className="flex items-start justify-between gap-2">
              <span className="text-xs font-bold text-slate-400 uppercase tracking-wider whitespace-normal leading-4">{item.name}</span>
              <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold whitespace-nowrap ${getBadgeStyle(item.changeType)}`}>
                {item.change}
              </span>
            </div>
            <div className="mt-4 flex items-baseline justify-between">
              <span className="text-3xl font-extrabold tracking-tight text-slate-950">{item.value}</span>
            </div>
          </div>
        ))}
      </div>

      {/* Accesos Rápidos y Novedades */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        
        {/* Enlaces de Acción Rápida */}
        <div className="lg:col-span-2 space-y-4">
          <h3 className="text-base font-bold text-slate-800 uppercase tracking-wider">Accesos Directos</h3>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {quickLinks.map((item) => {
              const hoverColorClass = 
                item.color === 'green' ? 'hover:border-emerald-100 hover:bg-emerald-50/10' :
                item.color === 'tan' ? 'hover:border-amber-100 hover:bg-amber-50/10' : 
                'hover:border-slate-200 hover:bg-slate-50/10';
              
              const titleColorClass =
                item.color === 'green' ? 'group-hover:text-equus-green' :
                item.color === 'tan' ? 'group-hover:text-equus-tan-dark' : 
                'group-hover:text-slate-800';

              return (
                <Link
                  key={item.title}
                  href={item.href}
                  className={`group p-5 bg-white rounded-2xl border border-slate-100 ${hoverColorClass} hover:shadow-md transition-all duration-250 flex flex-col justify-between`}
                >
                  <div>
                    <div className="p-2 w-fit rounded-xl bg-slate-50 group-hover:bg-white transition-colors">
                      {item.icon}
                    </div>
                    <h4 className={`mt-4 text-base font-bold text-slate-950 ${titleColorClass} transition-colors`}>
                      {item.title}
                    </h4>
                    <p className="mt-1.5 text-sm text-slate-500 leading-relaxed">
                      {item.description}
                    </p>
                  </div>
                  <div className="mt-5 flex items-center text-xs font-bold text-slate-600 group-hover:text-slate-800 transition-colors">
                    Ingresar
                    <svg className="ml-1.5 h-4 w-4 transform group-hover:translate-x-1 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </div>
                </Link>
              );
            })}
          </div>
        </div>

        {/* Novedades / Alertas Sanitarias Destacadas */}
        <div className="space-y-4">
          <h3 className="text-base font-bold text-slate-800 uppercase tracking-wider">Alertas Sanitarias</h3>
          <div className="bg-white rounded-2xl border border-slate-100 p-5 space-y-4 shadow-sm">
            
            {/* Alerta Roja/Amber Destacada de Acción Inmediata */}
            <div className="flex items-start space-x-3.5 p-4 rounded-xl bg-rose-50/50 border border-rose-100 shadow-sm relative overflow-hidden group hover:bg-rose-50 transition-colors duration-200">
              <div className="absolute left-0 top-0 bottom-0 w-1 bg-rose-500"></div>
              <svg className="h-5 w-5 text-rose-600 flex-shrink-0 mt-0.5 animate-pulse" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
              <div>
                <h4 className="text-xs font-bold text-rose-900 uppercase tracking-wider">Control MGAP: Relámpago</h4>
                <p className="text-[11px] text-rose-700 leading-relaxed mt-1 font-medium">
                  El vencimiento de sanidad expira próximamente (**07/06/2026**). Es obligatorio cargar la planilla de recheck veterinario en el sistema para evitar la descalificación deportiva.
                </p>
              </div>
            </div>

            {/* Sincronización FEU Activa */}
            <div className="flex items-start space-x-3.5 p-4 rounded-xl bg-emerald-50/30 border border-emerald-100 hover:bg-emerald-50/60 transition-colors duration-200">
              <svg className="h-5 w-5 text-emerald-600 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <div>
                <h4 className="text-xs font-bold text-emerald-950 uppercase tracking-wider">Base de Datos FEU Sincronizada</h4>
                <p className="text-[11px] text-emerald-800 leading-relaxed mt-1 font-medium">
                  Sincronización nacional FEU realizada con éxito. 3 binomios habilitados para la próxima competencia oficial del fin de semana.
                </p>
              </div>
            </div>

          </div>
        </div>

      </div>

    </div>
  );
}
