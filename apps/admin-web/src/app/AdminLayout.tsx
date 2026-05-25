"use client";

import React, { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

interface AdminLayoutProps {
  children: React.ReactNode;
}

export const AdminLayout: React.FC<AdminLayoutProps> = ({ children }) => {
  const pathname = usePathname();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  // Mapeo dinámico de títulos de página basado en la ruta actual
  const getPageTitle = (path: string) => {
    if (path === '/') return 'Dashboard Central';
    if (path.startsWith('/horses')) return 'Padrón de Caballos';
    if (path.startsWith('/owners')) return 'Gestión de Propietarios';
    if (path.startsWith('/riders')) return 'Padrón de Jinetes';
    if (path.startsWith('/competitions')) return 'Calendario de Competencias';
    return 'Consola de Administración';
  };

  // Menú de navegación principal con iconos SVG premium
  const navItems = [
    {
      name: 'Dashboard',
      href: '/',
      icon: (
        <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v4a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v4a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v4a2 2 0 01-2 2H6a2 2 0 01-2-2v-4zM14 16a2 2 0 012-2h2a2 2 0 012 2v4a2 2 0 01-2 2h-2a2 2 0 01-2-2v-4z" />
        </svg>
      )
    },
    {
      name: 'Caballos',
      href: '/horses',
      icon: (
        <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M17 11c.3-3-1.5-5.5-3.8-6.5C10.5 3.5 7.5 5.5 7.5 8c0 .5-.1 1-.3 1.5L5 12.5c-.3.5-.1 1.2.4 1.5l1.6 1c.5.3 1.1.2 1.5-.2l.7-.7c.3-.3.8-.4 1.2-.2l1.6.8c1 .5 2.2.4 3.1-.3l2.4-1.9c.4-.3.5-.8.3-1.2L17 11z" />
          <path strokeLinecap="round" strokeLinejoin="round" d="M9.5 20h6M8.5 16h8" />
          <circle cx="12" cy="7.5" r="0.75" fill="currentColor" />
        </svg>
      )
    },
    {
      name: 'Propietarios',
      href: '/owners',
      icon: (
        <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          {/* Escudo representativo de Establecimiento / Haras / Stud */}
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 13v-3a3 3 0 016 0v3M8 13h8M12 8v5" />
        </svg>
      )
    },
    {
      name: 'Jinetes',
      href: '/riders',
      icon: (
        <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          {/* Casco Oficial de Jinete Federado */}
          <path strokeLinecap="round" strokeLinejoin="round" d="M2 12a10 10 0 0120 0H2z" />
          <path strokeLinecap="round" strokeLinejoin="round" d="M6 12v2a6 6 0 0012 0v-2" />
          <path strokeLinecap="round" strokeLinejoin="round" d="M2 12c3-2 6-3 10-3s7 1 10 3" />
        </svg>
      )
    },
    {
      name: 'Competencias',
      href: '/competitions',
      icon: (
        <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
        </svg>
      )
    }
  ];

  return (
    <div className="min-h-screen bg-equus-bg flex flex-col sm:flex-row font-sans text-equus-text">
      
      {/* 1. SIDEBAR DESKTOP */}
      <aside className="hidden md:flex md:w-64 md:flex-col md:fixed md:inset-y-0 bg-equus-green text-white shadow-xl z-20">
        <div className="flex flex-col flex-1 min-h-0">
          
          {/* Logo Oficial de EquusCronos Prominente en el Sidebar */}
          <div className="flex items-center justify-center py-6 px-6 bg-slate-950/15 border-b border-white/5">
            <div className="flex flex-col items-center space-y-2">
              <div className="bg-white p-2 rounded-xl shadow-lg border border-white/10 max-w-[190px] transition-all hover:scale-[1.03]">
                <img
                  src="/ECLogo Leyenda.png"
                  alt="EquusCronos Logo Oficial"
                  className="h-auto w-full object-contain"
                />
              </div>
              <span className="text-[10px] text-equus-tan-light font-bold tracking-widest mt-1 uppercase">WEB ADMIN CONSOLE</span>
            </div>
          </div>

          {/* Enlaces de Navegación del Sidebar */}
          <div className="flex-1 flex flex-col overflow-y-auto px-4 py-6">
            <nav className="flex-1 space-y-1.5">
              {navItems.map((item) => {
                const isActive = pathname === item.href || (item.href !== '/' && pathname.startsWith(item.href));
                return (
                  <Link
                    key={item.name}
                    href={item.href}
                    className={`flex items-center px-4 py-3 text-sm font-medium rounded-xl transition-all duration-200 group ${
                      isActive
                        ? 'bg-white/10 text-equus-tan-light border-l-4 border-equus-tan-dark pl-3 scale-[1.02] shadow-sm'
                        : 'text-white/70 hover:bg-white/5 hover:text-white'
                    }`}
                  >
                    <span className={`mr-3 transition-colors duration-200 ${isActive ? 'text-equus-tan-light' : 'text-white/50 group-hover:text-equus-tan-light'}`}>
                      {item.icon}
                    </span>
                    {item.name}
                  </Link>
                );
              })}
            </nav>
          </div>

          {/* Footer del Sidebar: Info del Club / Tenant */}
          <div className="flex-shrink-0 p-4 border-t border-white/5 bg-slate-950/10">
            <div className="flex items-center space-x-3 p-2 rounded-xl bg-white/5">
              <div className="h-9 w-9 rounded-lg bg-equus-tan-light/20 flex items-center justify-center border border-equus-tan-light/30">
                <span className="text-xs font-bold text-equus-tan-light">HER</span>
              </div>
              <div className="flex flex-col min-w-0">
                <span className="text-xs font-bold text-slate-100 truncate">Haras El Relincho</span>
                <span className="text-[10px] text-white/50 truncate">FEU Nro. 1204</span>
              </div>
            </div>
          </div>

        </div>
      </aside>

      {/* 2. SIDEBAR MOVIL (Overlay & Drawer) */}
      <div className="md:hidden">
        {/* Navbar superior fija móvil */}
        <header className="flex items-center justify-between h-16 px-4 bg-equus-green text-white shadow-md fixed top-0 w-full z-30">
          <div className="flex items-center space-x-3">
            <div className="bg-white p-1 rounded max-w-[110px]">
              <img
                src="/ECLogo Leyenda.png"
                alt="EquusCronos Logo"
                className="h-6 w-auto object-contain"
              />
            </div>
          </div>
          
          <button
            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
            className="p-2 rounded-lg text-slate-200 hover:bg-white/5 hover:text-white focus:outline-none"
          >
            {isMobileMenuOpen ? (
              <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            ) : (
              <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            )}
          </button>
        </header>

        {/* Menú Drawer Móvil */}
        {isMobileMenuOpen && (
          <div className="fixed inset-0 z-20 flex pt-16 animate-fade-in">
            <div className="fixed inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setIsMobileMenuOpen(false)} />
            
            <nav className="relative flex flex-col w-full max-w-xs bg-equus-green text-white p-6 shadow-2xl">
              <div className="space-y-2 mt-4">
                {navItems.map((item) => {
                  const isActive = pathname === item.href || (item.href !== '/' && pathname.startsWith(item.href));
                  return (
                    <Link
                      key={item.name}
                      href={item.href}
                      onClick={() => setIsMobileMenuOpen(false)}
                      className={`flex items-center px-4 py-3 text-sm font-medium rounded-xl transition-all ${
                        isActive
                          ? 'bg-white/10 text-equus-tan-light border-l-4 border-equus-tan-dark pl-3 shadow-sm'
                          : 'text-white/70 hover:bg-white/5 hover:text-white'
                      }`}
                    >
                      <span className="mr-3">{item.icon}</span>
                      {item.name}
                    </Link>
                  );
                })}
              </div>

              {/* Tenant info en móvil */}
              <div className="mt-auto pt-6 border-t border-white/5">
                <div className="flex items-center space-x-3 p-2 rounded-xl bg-white/5">
                  <div className="h-8 w-8 rounded bg-equus-tan-light/20 flex items-center justify-center text-xs font-bold text-equus-tan-light">
                    HER
                  </div>
                  <div>
                    <div className="text-xs font-bold text-slate-100">Haras El Relincho</div>
                    <div className="text-[9px] text-white/50">FEU Nro. 1204</div>
                  </div>
                </div>
              </div>
            </nav>
          </div>
        )}
      </div>

      {/* 3. CONTENEDOR PRINCIPAL */}
      <div className="flex flex-col flex-1 md:pl-64 min-h-screen pt-16 md:pt-0 bg-equus-bg">
        
        {/* Topbar Desktop */}
        <header className="hidden md:flex items-center justify-end h-16 px-8 bg-white border-b border-gray-200 shadow-sm z-10">
          {/* Lado Derecho: Perfil de Usuario */}
          <div className="flex items-center space-x-3">
            <div className="h-9 w-9 rounded-full bg-equus-green flex items-center justify-center text-equus-tan-light font-extrabold text-sm shadow-md border border-equus-tan-dark/20">
              JD
            </div>
            <div className="flex flex-col">
              <span className="text-xs font-bold text-slate-800">Juan Díaz</span>
              <span className="text-[10px] text-slate-500 font-semibold uppercase">Administrador</span>
            </div>
          </div>
        </header>

        {/* 4. AREA DE CONTENIDO PRINCIPAL */}
        <main className="flex-1 bg-equus-bg p-6 md:p-8">
          <div className="max-w-7xl mx-auto animate-fade-in text-slate-800">
            {children}
          </div>
        </main>

      </div>

    </div>
  );
};
