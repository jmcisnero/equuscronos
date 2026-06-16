"use client";

import React, { useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuthStore } from "@/store/auth.store";

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const setAuth = useAuthStore((state) => state.setAuth);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);

    // Validaciones básicas de cliente
    if (!email.trim() || !password.trim()) {
      setError("El correo electrónico y la contraseña son requeridos.");
      setIsLoading(false);
      return;
    }

    try {
      const apiBaseUrl = (
        process.env.NEXT_PUBLIC_API_URL || "http://localhost:3000/admin"
      ).replace("/admin", "");
      const response = await fetch(`${apiBaseUrl}/auth/login`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ email, password }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.message ||
            "Credenciales inválidas. Por favor intente nuevamente.",
        );
      }

      // Almacenamos credenciales en Zustand y seteamos la cookie
      setAuth(data.access_token, data.user);

      // Redireccionamos a la ruta original o al Dashboard
      const callbackUrl = searchParams.get("callbackUrl") || "/";
      router.push(callbackUrl);
      router.refresh();
    } catch (err: any) {
      console.error("[LOGIN ERROR]", err);
      setError(err.message || "Error de conexión con el servidor.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="w-full max-w-md bg-white rounded-3xl border border-slate-100 shadow-xl overflow-hidden p-8 md:p-10 transition-all duration-300">
      {/* Logotipo */}
      <div className="flex flex-col items-center mb-8">
        <div className="bg-white p-2.5 rounded-2xl shadow-md border border-slate-100 max-w-[170px] transition-transform duration-300 hover:scale-105">
          <img
            src="/ECLogo Leyenda.png"
            alt="EquusCronos Logo Oficial"
            className="h-auto w-full object-contain"
          />
        </div>
        <span className="text-[10px] text-slate-400 font-extrabold tracking-widest mt-3 uppercase">
          Consola de Administración
        </span>
      </div>

      {/* Título de Bienvenida */}
      <div className="text-center mb-6">
        <h1 className="text-xl font-black text-slate-900 tracking-tight">
          Iniciar Sesión
        </h1>
        <p className="text-xs text-slate-500 mt-1 font-medium">
          Acceda al sistema de cronometraje y fiscalización ecuestre
        </p>
      </div>

      {/* Manejo de Errores */}
      {error && (
        <div className="mb-6 p-4 bg-rose-50 border border-rose-100 rounded-2xl text-rose-700 text-xs font-semibold flex items-center space-x-2.5 animate-pulse-once">
          <svg
            className="w-4 h-4 flex-shrink-0"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2.5}
              d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
            />
          </svg>
          <span>{error}</span>
        </div>
      )}

      {/* Formulario */}
      <form onSubmit={handleSubmit} className="space-y-5">
        <div>
          <label
            htmlFor="email"
            className="block text-[10px] font-extrabold text-slate-500 uppercase tracking-widest mb-1.5 pl-1"
          >
            Correo Electrónico
          </label>
          <input
            id="email"
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="ejemplo@equuscronos.com"
            disabled={isLoading}
            className="w-full px-4 py-3 bg-slate-50/50 border border-slate-200/80 rounded-xl text-slate-800 text-sm placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-equus-green/20 focus:border-equus-green transition-all font-semibold disabled:opacity-50"
          />
        </div>

        <div>
          <label
            htmlFor="password"
            className="block text-[10px] font-extrabold text-slate-500 uppercase tracking-widest mb-1.5 pl-1"
          >
            Contraseña
          </label>
          <input
            id="password"
            type="password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••"
            disabled={isLoading}
            className="w-full px-4 py-3 bg-slate-50/50 border border-slate-200/80 rounded-xl text-slate-800 text-sm placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-equus-green/20 focus:border-equus-green transition-all font-mono disabled:opacity-50"
          />
        </div>

        <button
          type="submit"
          disabled={isLoading}
          className="w-full py-3.5 mt-2 bg-equus-green hover:bg-opacity-95 text-white font-extrabold text-xs uppercase tracking-wider rounded-xl transition-all shadow-md hover:shadow-lg focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-equus-green flex items-center justify-center space-x-2 disabled:opacity-75 disabled:cursor-not-allowed"
        >
          {isLoading ? (
            <>
              <svg
                className="animate-spin h-4 w-4 text-white"
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
              <span>Autenticando...</span>
            </>
          ) : (
            <span>Ingresar</span>
          )}
        </button>
      </form>
    </div>
  );
}

export default function LoginPage() {
  return (
    <div className="min-h-screen bg-equus-bg flex items-center justify-center p-4">
      <Suspense
        fallback={
          <div className="text-center text-slate-500 font-medium">
            Cargando formulario...
          </div>
        }
      >
        <LoginForm />
      </Suspense>
    </div>
  );
}
