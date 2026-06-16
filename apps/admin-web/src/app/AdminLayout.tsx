"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useAuthStore } from "@/store/auth.store";

interface AdminLayoutProps {
  children: React.ReactNode;
}

export const AdminLayout: React.FC<AdminLayoutProps> = ({ children }) => {
  const pathname = usePathname();

  // Si estamos en la página de login, no renderizamos el layout del administrador
  if (pathname === "/login") {
    return <>{children}</>;
  }

  const router = useRouter();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isCollapsed, setIsCollapsed] = useState(false);

  const user = useAuthStore((state) => state.user);
  const logout = useAuthStore((state) => state.logout);

  const [isMounted, setIsMounted] = useState(false);
  useEffect(() => {
    setIsMounted(true);
  }, []);

  const handleLogout = () => {
    logout();
    router.push("/login");
    router.refresh();
  };

  const displayName = isMounted && user ? user.name : "Administrador";
  const displayRole = isMounted && user ? user.role : "ADMIN";
  const displayInitials =
    isMounted && user
      ? user.name
          .split(" ")
          .map((n) => n[0])
          .join("")
          .substring(0, 2)
          .toUpperCase()
      : "AD";

  // Mapeo dinámico de títulos de página basado en la ruta actual
  const getPageTitle = (path: string) => {
    if (path === "/") return "Dashboard Central";
    if (path.startsWith("/horses")) return "Padrón de Caballos";
    if (path.startsWith("/owners")) return "Gestión de Propietarios";
    if (path.startsWith("/riders")) return "Padrón de Jinetes";
    if (path.startsWith("/competitions")) return "Calendario de Competencias";
    if (path.startsWith("/competition-types"))
      return "Modalidades de Competencia";
    if (path.startsWith("/tenants")) return "Clubes y Organizaciones";
    if (path.startsWith("/users")) return "Usuarios";
    return "Consola de Administración";
  };

  // Menú de navegación principal reordenado según especificaciones con iconos minimalistas consistentes
  const navItems = [
    {
      name: "Dashboard",
      href: "/",
      icon: (
        <svg
          className="h-5 w-5 flex-shrink-0"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
        >
          <rect x="3" y="3" width="7" height="9" rx="1" />
          <rect x="14" y="3" width="7" height="5" rx="1" />
          <rect x="14" y="12" width="7" height="9" rx="1" />
          <rect x="3" y="16" width="7" height="5" rx="1" />
        </svg>
      ),
    },
    {
      name: "Competencias",
      href: "/competitions",
      icon: (
        <svg
          className="h-5 w-5 flex-shrink-0"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6"
          />
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18"
          />
          <path strokeLinecap="round" strokeLinejoin="round" d="M4 22h16" />
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M10 14.66V17c0 .55-.45 1-1 1H4v2h16v-2h-5c-.55 0-1-.45-1-1v-2.34"
          />
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M12 2a6 6 0 0 1 6 6v3c0 2.5-2.5 4.5-6 4.5S6 13.5 6 11V8a6 6 0 0 1 6-6Z"
          />
        </svg>
      ),
    },
    {
      name: "Caballos",
      href: "/horses",
      icon: (
        <svg
          className="h-5 w-5 flex-shrink-0"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M3 10c2-1 4.5-1 6.5 0l2.5 1.5c1 .5 2.5 0 3-1l1-2c.5-1 2-1.5 3-1h1.5c.8 0 1.5.7 1.5 1.5v2.5c0 1.5-1 3-2.5 3.5l-2.5 1c-1.5.5-3 0-4-.5L9.5 14C8.5 13.5 6 13.5 5 14l-2 1"
          />
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M12 5c-1-1.5-2.5-2-4-2S5 4 4.5 5.5"
          />
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 19h7" />
        </svg>
      ),
    },
    {
      name: "Jinetes",
      href: "/riders",
      icon: (
        <svg
          className="h-5 w-5 flex-shrink-0"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M18 21a6 6 0 0 0-12 0"
          />
          <circle cx="12" cy="10" r="4" />
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 2v2" />
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M7 3.5c1-1 2.5-1.5 5-1.5s4 .5 5 1.5"
          />
        </svg>
      ),
    },
    {
      name: "Propietarios",
      href: "/owners",
      icon: (
        <svg
          className="h-5 w-5 flex-shrink-0"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"
          />
          <circle cx="12" cy="10" r="3" />
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M8 17c0-2.5 1.5-4 4-4s4 1.5 4 4"
          />
        </svg>
      ),
    },
    {
      name: "Usuarios",
      href: "/users",
      icon: (
        <svg
          className="h-5 w-5 flex-shrink-0"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"
          />
          <circle cx="9" cy="7" r="4" />
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M22 21v-2a4 4 0 0 0-3-3.87"
          />
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M16 3.13a4 4 0 0 1 0 7.75"
          />
        </svg>
      ),
    },
    {
      name: "Clubes",
      href: "/tenants",
      icon: (
        <svg
          className="h-5 w-5 flex-shrink-0"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M3 21h18" />
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M5 21V10l7-6 7 6v11"
          />
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M9 21v-4a3 3 0 0 1 6 0v4"
          />
          <circle cx="12" cy="11" r="1.5" />
        </svg>
      ),
    },
    {
      name: "Reglas y Modalidades",
      href: "/competition-types",
      icon: (
        <svg
          className="h-5 w-5 flex-shrink-0"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1-2.5-2.5Z"
          />
          <path strokeLinecap="round" strokeLinejoin="round" d="M6 6h10" />
          <path strokeLinecap="round" strokeLinejoin="round" d="M6 10h10" />
          <path strokeLinecap="round" strokeLinejoin="round" d="M6 14h10" />
        </svg>
      ),
    },
  ];

  return (
    <div className="min-h-screen bg-equus-bg flex flex-col md:flex-row font-sans text-equus-text">
      {/* 1. SIDEBAR DESKTOP */}
      <aside
        className={`hidden md:flex md:flex-col md:fixed md:inset-y-0 bg-equus-green text-white shadow-xl z-20 transition-all duration-300 ease-in-out ${
          isCollapsed ? "md:w-20" : "md:w-64"
        }`}
      >
        <div className="flex flex-col flex-1 min-h-0">
          {/* Logo Oficial de EquusCronos Prominente en el Sidebar */}
          <div className="flex items-center justify-center py-6 px-4 bg-slate-950/15 border-b border-white/5 transition-all duration-300 min-h-[105px]">
            {isCollapsed ? (
              <div
                className="h-10 w-10 rounded-full bg-gradient-to-br from-equus-tan-light to-equus-tan-dark flex items-center justify-center shadow-lg border border-white/20 cursor-pointer hover:scale-105 transition-all duration-200 animate-fade-in"
                title="EquusCronos Web Admin"
              >
                <span className="text-sm font-extrabold text-white tracking-tight font-sans">
                  EC
                </span>
              </div>
            ) : (
              <div className="flex flex-col items-center space-y-2 animate-fade-in">
                <div className="bg-white p-2 rounded-xl shadow-lg border border-white/10 max-w-[190px] transition-all hover:scale-[1.03]">
                  <img
                    src="/ECLogo Leyenda.png"
                    alt="EquusCronos Logo Oficial"
                    className="h-auto w-full object-contain"
                  />
                </div>
                <span className="text-[10px] text-equus-tan-light font-bold tracking-widest mt-1 uppercase">
                  WEB ADMIN CONSOLE
                </span>
              </div>
            )}
          </div>

          {/* Enlaces de Navegación del Sidebar */}
          <div className="flex-1 flex flex-col overflow-y-auto px-3 py-6 transition-all duration-300">
            <nav className="flex-1 space-y-1.5">
              {navItems.map((item) => {
                const isActive =
                  pathname === item.href ||
                  (item.href !== "/" && pathname.startsWith(item.href));
                return (
                  <Link
                    key={item.name}
                    href={item.href}
                    className={`flex items-center rounded-xl transition-all duration-200 group relative ${
                      isCollapsed
                        ? "justify-center p-3"
                        : "px-4 py-3 text-sm font-medium"
                    } ${
                      isActive
                        ? "bg-white/10 text-equus-tan-light border-l-4 border-equus-tan-dark shadow-sm" +
                          (isCollapsed ? " pl-2" : " pl-3 scale-[1.02]")
                        : "text-white/70 hover:bg-white/5 hover:text-white"
                    }`}
                  >
                    <span
                      className={`transition-colors duration-200 ${isCollapsed ? "" : "mr-3"} ${isActive ? "text-equus-tan-light" : "text-white/50 group-hover:text-equus-tan-light"}`}
                    >
                      {item.icon}
                    </span>
                    {!isCollapsed && (
                      <span className="transition-opacity duration-300 whitespace-nowrap animate-fade-in">
                        {item.name}
                      </span>
                    )}

                    {/* Premium Tooltip shown only when collapsed */}
                    {isCollapsed && (
                      <div className="absolute left-16 bg-slate-900 text-white text-xs px-2.5 py-1.5 rounded-lg opacity-0 pointer-events-none group-hover:opacity-100 group-hover:translate-x-1 transition-all duration-200 shadow-md whitespace-nowrap z-50">
                        {item.name}
                      </div>
                    )}
                  </Link>
                );
              })}
            </nav>
          </div>

          {/* Footer del Sidebar: Info del Club / Tenant & Botón de Colapso */}
          <div className="flex-shrink-0 p-4 border-t border-white/5 bg-slate-950/10 transition-all duration-300">
            <div
              className={`flex items-center justify-between ${isCollapsed ? "flex-col space-y-4" : "flex-row"}`}
            >
              <div className="flex items-center space-x-3 min-w-0">
                <div className="h-9 w-9 rounded-lg bg-equus-tan-light/20 flex items-center justify-center border border-equus-tan-light/30 flex-shrink-0">
                  <span className="text-xs font-bold text-equus-tan-light">
                    HER
                  </span>
                </div>
                {!isCollapsed && (
                  <div className="flex flex-col min-w-0 transition-opacity duration-300 animate-fade-in">
                    <span className="text-xs font-bold text-slate-100 truncate">
                      Haras El Relincho
                    </span>
                    <span className="text-[10px] text-white/50 truncate">
                      FEU Nro. 1204
                    </span>
                  </div>
                )}
              </div>

              {/* Botón de Colapso */}
              <button
                onClick={() => setIsCollapsed(!isCollapsed)}
                className={`p-2 rounded-lg bg-white/5 text-white/70 hover:text-white hover:bg-white/10 transition-all duration-200 border border-white/10 shadow-sm ${
                  isCollapsed ? "w-9 h-9 flex items-center justify-center" : ""
                }`}
                title={isCollapsed ? "Expandir menú" : "Colapsar menú"}
              >
                <svg
                  className={`w-4 h-4 transition-transform duration-300 ${isCollapsed ? "rotate-180" : ""}`}
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2.5}
                    d="M11 19l-7-7 7-7m8 14l-7-7 7-7"
                  />
                </svg>
              </button>
            </div>
          </div>
        </div>
      </aside>

      {/* 2. SIDEBAR MOVIL (Overlay & Drawer Panel) */}
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

          {/* Hamburger Menu Toggle Button */}
          <button
            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
            className="p-2 rounded-lg text-slate-200 hover:bg-white/5 hover:text-white focus:outline-none"
            aria-label="Abrir menú"
          >
            {isMobileMenuOpen ? (
              <svg
                className="h-6 w-6"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            ) : (
              <svg
                className="h-6 w-6"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M4 6h16M4 12h16M4 18h16"
                />
              </svg>
            )}
          </button>
        </header>

        {/* Backdrop overlay */}
        <div
          className={`fixed inset-0 z-40 bg-slate-900/60 backdrop-blur-sm transition-opacity duration-300 ${
            isMobileMenuOpen
              ? "opacity-100 pointer-events-auto"
              : "opacity-0 pointer-events-none"
          }`}
          onClick={() => setIsMobileMenuOpen(false)}
        />

        {/* Drawer Panel */}
        <aside
          className={`fixed top-0 bottom-0 left-0 z-50 w-full max-w-xs bg-equus-green text-white p-6 shadow-2xl flex flex-col transition-transform duration-300 ease-in-out ${
            isMobileMenuOpen ? "translate-x-0" : "-translate-x-full"
          }`}
        >
          {/* Header del Drawer */}
          <div className="flex items-center justify-between pb-6 border-b border-white/5">
            <div className="bg-white p-1.5 rounded-lg max-w-[120px]">
              <img
                src="/ECLogo Leyenda.png"
                alt="EquusCronos Logo"
                className="h-6 w-auto object-contain"
              />
            </div>
            <button
              onClick={() => setIsMobileMenuOpen(false)}
              className="p-2 rounded-lg text-white/70 hover:text-white hover:bg-white/5 focus:outline-none"
            >
              <svg
                className="h-6 w-6"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
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

          {/* Enlaces de Navegación del Drawer */}
          <nav className="flex-1 space-y-1.5 overflow-y-auto py-6">
            {navItems.map((item) => {
              const isActive =
                pathname === item.href ||
                (item.href !== "/" && pathname.startsWith(item.href));
              return (
                <Link
                  key={item.name}
                  href={item.href}
                  onClick={() => setIsMobileMenuOpen(false)}
                  className={`flex items-center px-4 py-3 text-sm font-medium rounded-xl transition-all duration-200 group ${
                    isActive
                      ? "bg-white/10 text-equus-tan-light border-l-4 border-equus-tan-dark pl-3 scale-[1.01]"
                      : "text-white/70 hover:bg-white/5 hover:text-white"
                  }`}
                >
                  <span className="mr-3">{item.icon}</span>
                  {item.name}
                </Link>
              );
            })}
          </nav>

          {/* Mobile Logout and Tenant Info */}
          <div className="pt-4 border-t border-white/5 bg-slate-950/10 -mx-6 -mb-6 p-6 space-y-4">
            <div className="flex items-center justify-between p-2 rounded-xl bg-white/5">
              <div className="flex items-center space-x-3 min-w-0">
                <div className="h-9 w-9 rounded-full bg-white/10 flex items-center justify-center text-sm font-bold text-white">
                  {displayInitials}
                </div>
                <div className="flex flex-col min-w-0">
                  <span className="text-xs font-bold text-slate-100 truncate">
                    {displayName}
                  </span>
                  <span className="text-[9px] text-white/50 truncate">
                    {displayRole}
                  </span>
                </div>
              </div>
              <button
                onClick={handleLogout}
                className="p-2 rounded-lg text-white/60 hover:text-rose-400 hover:bg-white/5 transition-all"
                title="Cerrar sesión"
              >
                <svg
                  className="w-5 h-5"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"
                  />
                </svg>
              </button>
            </div>

            <div className="flex items-center space-x-3 p-2 rounded-xl bg-white/5">
              <div className="h-9 w-9 rounded bg-equus-tan-light/20 flex items-center justify-center text-xs font-bold text-equus-tan-light">
                {isMounted && user?.tenantId ? "CLB" : "GLB"}
              </div>
              <div className="flex flex-col min-w-0">
                <span className="text-xs font-bold text-slate-100 truncate">
                  {isMounted && user?.tenantId
                    ? "Organización Club"
                    : "Administrador Global"}
                </span>
                <span className="text-[9px] text-white/50 truncate">
                  {isMounted && user?.tenantId
                    ? `ID: ${user.tenantId.substring(0, 8)}`
                    : "Todas las Organizaciones"}
                </span>
              </div>
            </div>
          </div>
        </aside>
      </div>

      {/* 3. CONTENEDOR PRINCIPAL */}
      <div
        className={`flex flex-col flex-1 min-h-screen pt-16 md:pt-0 bg-equus-bg transition-all duration-300 ease-in-out ${
          isCollapsed ? "md:pl-20" : "md:pl-64"
        }`}
      >
        {/* Topbar Desktop */}
        <header className="hidden md:flex items-center justify-between h-16 px-8 bg-white border-b border-gray-200 shadow-sm z-10">
          {/* Lado Izquierdo: Título de Sección */}
          <h2 className="text-sm font-bold text-slate-500 uppercase tracking-wider">
            {getPageTitle(pathname)}
          </h2>

          {/* Lado Derecho: Perfil de Usuario */}
          <div className="flex items-center space-x-4">
            <div className="flex items-center space-x-3">
              <div className="h-9 w-9 rounded-full bg-equus-green flex items-center justify-center text-equus-tan-light font-extrabold text-sm shadow-md border border-equus-tan-dark/20">
                {displayInitials}
              </div>
              <div className="flex flex-col">
                <span className="text-xs font-bold text-slate-800">
                  {displayName}
                </span>
                <span className="text-[10px] text-slate-500 font-semibold uppercase">
                  {displayRole}
                </span>
              </div>
            </div>

            {/* Botón Cerrar Sesión */}
            <button
              onClick={handleLogout}
              className="p-2 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-all duration-200"
              title="Cerrar sesión"
            >
              <svg
                className="w-5 h-5"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"
                />
              </svg>
            </button>
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
