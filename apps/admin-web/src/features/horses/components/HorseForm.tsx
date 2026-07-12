"use client";

import React, { useState, useEffect } from "react";
import { CreateHorseDto, UpdateHorseDto, Horse, Owner } from "@/types/horse";
import { OwnerService } from "@/services/api/owner.service";
import { compressImage } from "@/utils/imageCompression";

interface HorseFormProps {
  initialData?: Horse | null;
  onSubmit: (
    data: CreateHorseDto | UpdateHorseDto,
    file?: File | null,
  ) => Promise<void>;
  onCancel: () => void;
}

/**
 * Formulario de Caballos (ModalForm) - Gestión de EquusCronos
 *
 * NORMAS DE NEGOCIO Y TRAZABILIDAD (FEU):
 * 1. PROPIETARIO OBLIGATORIO: Se integra un buscador asíncrono con autocompletado y creación en línea
 *    (inline create) para agilizar el flujo de inscripción sin perder consistencia relacional.
 * 2. CHIP RFID Y PASAPORTE FEU: Control sanitario e identificativo de atletas de cuatro patas.
 * 3. INMUTABILIDAD DE FECHAS (SANIDAD): El campo 'healthRecordsExpiration' (Vencimiento de Sanidad/Anemia)
 *    mantiene la lógica de persistencia inmutable (String ISO YYYY-MM-DD) para mitigar desplazamientos de
 *    zona horaria (GMT-3 local uruguayo) al realizar conversiones a través del cliente web Next.js.
 */
export const HorseForm: React.FC<HorseFormProps> = ({
  initialData,
  onSubmit,
  onCancel,
}) => {
  // Estados para búsqueda asíncrona y autocompletado de Propietarios
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedOwnerName, setSelectedOwnerName] = useState("");
  const [owners, setOwners] = useState<Owner[]>([]);
  const [isLoadingOwners, setIsLoadingOwners] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);

  // Semáforo para evitar colisiones entre el evento 'blur' y el registro asíncrono en red
  const isCreatingOwnerRef = React.useRef(false);

  // Estado del Formulario
  const [formData, setFormData] = useState<CreateHorseDto>({
    name: "",
    feuId: "",
    chipId: "",
    isFeuActive: false,
    healthRecordsExpiration: "",
    birthDate: "",
    imageUrl: "",
    ownerId: "", // Mandatorio
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  // Buscador asíncrono reactivo de Propietarios con 300ms de Debounce
  useEffect(() => {
    if (searchTerm === selectedOwnerName) {
      return;
    }

    const delayDebounceFn = setTimeout(async () => {
      if (searchTerm.trim() === "") {
        setOwners([]);
        return;
      }

      setIsLoadingOwners(true);
      try {
        const data = await OwnerService.getAll(searchTerm);
        setOwners(data);
      } catch (error) {
        console.error("Error al buscar propietarios:", error);
      } finally {
        setIsLoadingOwners(false);
      }
    }, 300);

    return () => clearTimeout(delayDebounceFn);
  }, [searchTerm, selectedOwnerName]);

  // Precarga y formateo de datos para edición de caballo
  useEffect(() => {
    if (initialData) {
      let dateValue = "";
      if (initialData.healthRecordsExpiration) {
        const dateStr = initialData.healthRecordsExpiration;
        // Garantizar formato de string inmutable YYYY-MM-DD
        dateValue =
          typeof dateStr === "string" && /^\d{4}-\d{2}-\d{2}/.test(dateStr)
            ? dateStr.substring(0, 10)
            : new Date(dateStr).toISOString().split("T")[0];
      }

      let birthDateValue = "";
      if (initialData.birthDate) {
        const dateStr = initialData.birthDate;
        birthDateValue =
          typeof dateStr === "string" && /^\d{4}-\d{2}-\d{2}/.test(dateStr)
            ? dateStr.substring(0, 10)
            : new Date(dateStr).toISOString().split("T")[0];
      }

      setFormData({
        name: initialData.name.toUpperCase(),
        feuId: initialData.feuId || "",
        chipId: initialData.chipId || "",
        isFeuActive: initialData.isFeuActive,
        healthRecordsExpiration: dateValue,
        birthDate: birthDateValue,
        imageUrl: initialData.imageUrl || "",
        ownerId: initialData.owner?.id || "",
      });

      if (initialData.owner) {
        setSearchTerm(initialData.owner.name);
        setSelectedOwnerName(initialData.owner.name);
      }
    }
  }, [initialData]);

  // Carga inicial rápida de sugerencias al enfocar el input de búsqueda
  const handleInputFocus = async () => {
    setShowDropdown(true);
    if (searchTerm.trim() === "") {
      setIsLoadingOwners(true);
      try {
        const data = await OwnerService.getAll();
        setOwners(data.slice(0, 5));
      } catch (error) {
        console.error("Error al precargar propietarios:", error);
      } finally {
        setIsLoadingOwners(false);
      }
    }
  };

  // Cierre preventivo del dropdown de sugerencias al desenfocar, coordinado para no abortar el alta inline
  const handleBlur = () => {
    setTimeout(() => {
      setShowDropdown(false);
      if (!isCreatingOwnerRef.current && searchTerm !== selectedOwnerName) {
        setSearchTerm(selectedOwnerName);
      }
    }, 200);
  };

  const handleSelectOwner = (owner: Owner) => {
    setFormData((prev) => ({
      ...prev,
      ownerId: owner.id,
    }));
    setSelectedOwnerName(owner.name);
    setSearchTerm(owner.name);
    setShowDropdown(false);
  };

  // Creación inline rápida de propietario
  const handleCreateOwnerInline = async (nameValue: string) => {
    isCreatingOwnerRef.current = true;
    try {
      setIsLoadingOwners(true);
      const newOwner = await OwnerService.create(
        nameValue.trim().toUpperCase(),
      );
      handleSelectOwner(newOwner);
    } catch (err: any) {
      alert("Error al registrar nuevo propietario: " + err.message);
    } finally {
      setIsLoadingOwners(false);
      isCreatingOwnerRef.current = false;
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const target = e.target;
    const { name, value, type, checked } = target;

    setFormData((prev) => ({
      ...prev,
      [name]:
        type === "checkbox"
          ? checked
          : name === "name"
            ? value.toUpperCase()
            : value,
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    if (!formData.name.trim()) {
      setFormError("El nombre del equino es requerido.");
      return;
    }

    if (!formData.ownerId) {
      setFormError(
        "Debe buscar y asignar un propietario legal para la trazabilidad FEU.",
      );
      return;
    }

    setIsSubmitting(true);
    try {
      const submissionData = { ...formData };
      if (
        !submissionData.healthRecordsExpiration ||
        submissionData.healthRecordsExpiration.trim() === ""
      ) {
        submissionData.healthRecordsExpiration = null;
      }
      await onSubmit(submissionData, selectedFile);
    } catch (err: any) {
      setFormError(
        err.message || "Ocurrió un error al procesar el formulario.",
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fade-in">
      <div className="bg-white rounded-2xl max-w-lg w-full max-h-[90vh] flex flex-col overflow-hidden shadow-2xl border border-slate-100 animate-slide-up">
        {/* Cabecera del Modal */}
        <div className="bg-slate-50 border-b border-slate-100 px-6 py-4 flex items-center justify-between flex-shrink-0">
          <div>
            <h3 className="text-base font-extrabold text-slate-800">
              {initialData
                ? "Modificar Registro de Caballo"
                : "Registrar Nuevo Caballo"}
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              Control de Registro y Trazabilidad - Federación Ecuestre
            </p>
          </div>

          <button
            type="button"
            onClick={onCancel}
            className="text-slate-400 hover:text-slate-600 p-1 hover:bg-slate-100 rounded-lg transition-all"
          >
            <svg
              className="w-5 h-5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
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

        {/* Formulario */}
        <form
          onSubmit={handleSubmit}
          className="p-6 space-y-4 overflow-y-auto flex-1"
        >
          {formError && (
            <div className="p-3 bg-rose-50 border border-rose-100 rounded-xl text-rose-600 text-xs font-semibold flex items-center space-x-2">
              <svg
                className="w-4 h-4 flex-shrink-0"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                />
              </svg>
              <span>{formError}</span>
            </div>
          )}

          {/* Nombre del Caballo */}
          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
              Nombre del Caballo *
            </label>
            <input
              type="text"
              name="name"
              required
              value={formData.name}
              onChange={handleChange}
              placeholder="Ej: TRUENO"
              className="w-full px-3.5 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-equus-green/20 focus:border-equus-green text-slate-800 shadow-sm uppercase"
            />
          </div>

          {/* Buscador de Propietario con Autocompletado */}
          <div className="relative">
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
              Propietario / Establecimiento *
            </label>
            <div className="relative">
              <input
                type="text"
                required
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                onFocus={handleInputFocus}
                onBlur={handleBlur}
                placeholder="Escriba para buscar o crear inline..."
                className="w-full px-3.5 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-equus-green/20 focus:border-equus-green text-slate-800 shadow-sm pr-10"
                autoComplete="off"
              />
              {isLoadingOwners && (
                <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none">
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-equus-green"></div>
                </div>
              )}
            </div>

            {showDropdown && (
              <div className="absolute z-50 mt-1 w-full rounded-xl bg-white shadow-xl ring-1 ring-black ring-opacity-5 max-h-60 overflow-auto focus:outline-none border border-slate-100/50">
                {owners.length > 0 ? (
                  <ul className="py-1 text-sm">
                    {owners.map((owner) => (
                      <li
                        key={owner.id}
                        onMouseDown={() => handleSelectOwner(owner)}
                        className="cursor-pointer select-none relative py-2.5 px-4 hover:bg-equus-green hover:text-white text-slate-700 font-medium transition-colors"
                      >
                        {owner.name}
                      </li>
                    ))}
                  </ul>
                ) : (
                  !isLoadingOwners && (
                    <div className="py-3 px-4 text-xs text-slate-400 italic">
                      No se encontraron propietarios.
                    </div>
                  )
                )}

                {searchTerm.trim().length > 0 &&
                  !owners.some(
                    (o) =>
                      o.name.toLowerCase() === searchTerm.trim().toLowerCase(),
                  ) && (
                    <button
                      type="button"
                      onMouseDown={() => handleCreateOwnerInline(searchTerm)}
                      className="w-full text-left px-4 py-2.5 text-xs text-equus-green hover:bg-slate-50 font-bold border-t border-slate-100 flex items-center"
                    >
                      <svg
                        className="h-4 w-4 mr-2"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2.5}
                          d="M12 4v16m8-8H4"
                        />
                      </svg>
                      Crear nuevo propietario: "{searchTerm}"
                    </button>
                  )}
              </div>
            )}
            <p className="mt-1 text-[10px] text-slate-400">
              El propietario es requerido legalmente por la FEU para la
              trazabilidad en planillas.
            </p>
          </div>

          {/* Fila de Datos Identificativos */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Chip RFID */}
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                Número de Chip RFID
              </label>
              <input
                type="text"
                name="chipId"
                value={formData.chipId || ""}
                onChange={handleChange}
                placeholder="Ej: 9820004..."
                className="w-full px-3.5 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-equus-green/20 focus:border-equus-green text-slate-800 shadow-sm font-sans tabular-nums"
              />
            </div>

            {/* Pasaporte FEU */}
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                Pasaporte FEU
              </label>
              <input
                type="text"
                name="feuId"
                value={formData.feuId || ""}
                onChange={handleChange}
                placeholder="Ej: URY-12345"
                className="w-full px-3.5 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-equus-green/20 focus:border-equus-green text-slate-800 shadow-sm font-sans tabular-nums"
              />
            </div>
          </div>

          {/* Fila de Fechas */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Vencimiento de Sanidad */}
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                Vencimiento Sanidad (MGAP)
              </label>
              <input
                type="date"
                name="healthRecordsExpiration"
                value={formData.healthRecordsExpiration || ""}
                onChange={handleChange}
                className="w-full px-3.5 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-equus-green/20 focus:border-equus-green text-slate-800 shadow-sm"
              />
            </div>

            {/* Fecha de Nacimiento */}
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                Fecha de Nacimiento
              </label>
              <input
                type="date"
                name="birthDate"
                value={formData.birthDate || ""}
                onChange={handleChange}
                className="w-full px-3.5 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-equus-green/20 focus:border-equus-green text-slate-800 shadow-sm"
              />
            </div>
          </div>

          {/* URL de la Foto Oficial */}
          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
              URL de la Foto Oficial (Reconocimiento Visual)
            </label>
            <input
              type="text"
              name="imageUrl"
              value={formData.imageUrl || ""}
              onChange={handleChange}
              placeholder="Ej: https://images.unsplash.com/photo..."
              className="w-full px-3.5 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-equus-green/20 focus:border-equus-green text-slate-800 shadow-sm"
            />
          </div>

          {/* Subir Foto Local */}
          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
              Subir Foto Local (Reemplaza URL)
            </label>
            {formData.imageUrl && (
              <div className="mb-2 flex items-center space-x-2 bg-slate-50 p-2 rounded-lg border border-slate-100">
                <img
                  src={formData.imageUrl}
                  alt="Vista previa"
                  className="w-10 h-10 rounded-full object-cover border border-slate-200"
                />
                <span className="text-xs text-slate-400 font-sans tabular-nums truncate max-w-[200px]">
                  {formData.imageUrl}
                </span>
              </div>
            )}
            <input
              type="file"
              accept="image/*"
              onChange={async (e) => {
                if (e.target.files && e.target.files.length > 0) {
                  try {
                    const compressed = await compressImage(e.target.files[0]);
                    setSelectedFile(compressed);
                  } catch (err) {
                    console.error("Error compressing image:", err);
                    setSelectedFile(e.target.files[0]);
                  }
                }
              }}
              className="w-full text-xs text-slate-500 file:mr-3 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-xs file:font-extrabold file:bg-slate-100 file:text-slate-700 hover:file:bg-slate-200/80 file:cursor-pointer cursor-pointer"
            />
          </div>

          {/* Estado de Habilitación FEU */}
          <div className="p-3 bg-slate-50 border border-slate-100 rounded-xl flex items-center justify-between">
            <div className="flex flex-col">
              <span className="text-xs font-bold text-slate-700">
                Estado de Competencia
              </span>
              <span className="text-[10px] text-slate-400">
                ¿El caballo está habilitado para competir oficialmente?
              </span>
            </div>

            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                name="isFeuActive"
                checked={formData.isFeuActive || false}
                onChange={handleChange}
                className="sr-only peer"
              />
              <div className="w-9 h-5 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-equus-green"></div>
            </label>
          </div>

          {/* Botones de Acción */}
          <div className="flex items-center justify-end space-x-3 pt-4 border-t border-slate-100">
            <button
              type="button"
              onClick={onCancel}
              className="px-4 py-2 text-slate-500 hover:text-slate-700 text-sm font-bold transition-all focus:outline-none"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-6 py-2 bg-equus-green hover:bg-opacity-95 disabled:bg-opacity-50 text-white font-bold text-sm rounded-xl transition-all shadow-md focus:outline-none flex items-center space-x-2"
            >
              {isSubmitting && (
                <svg
                  className="animate-spin -ml-1 mr-2 h-4 w-4 text-white"
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
              )}
              <span>{initialData ? "Guardar Cambios" : "Registrar"}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
