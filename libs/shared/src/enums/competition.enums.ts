export enum RegulationType {
  FEU = 'FEU',               // Reglas Fed. Ecuestre Uruguaya
  FEI = 'FEI',               // Reglas Fed. Ecuestre Internacional
  INDEPENDENT = 'INDEPENDENT' // Pruebas locales o de entrenamiento
}

//CONTROLLED_SPEED (Velocidad Controlada): Es la base del Raid Hípico Uruguayo (FEU). Se rige por promedios de tiempo y penalizaciones por exceso de velocidad.
//FREE_SPEED (Velocidad Libre): Es el estándar de Endurance FEI y de las pruebas de largo aliento de la FEU. Aquí el binomio gestiona su ritmo, pero el cronómetro no se detiene hasta que el pulso baja del límite (ej. 64 bpm).
//FLAT_RACING (Carrera Plana): Es el estándar del Turf / Hipódromos. No hay etapas ni Vet Gates.
export enum CompetitionModality {
  CONTROLLED_SPEED = 'CONTROLLED_SPEED', // Raid: Promedio objetivo (FEU)
  FREE_SPEED = 'FREE_SPEED',             // Endurance: Tiempo + Recuperación
  FLAT_RACING = 'FLAT_RACING'            // Carrera común: Tiempo de pista
}

export enum CompetitionStatus {
  PLANNED = 'PLANNED',     // Organización, pesaje y revisión inicial
  ACTIVE = 'ACTIVE',       // Carrera en curso y cronómetros activos
  PAUSED = 'PAUSED',       // Suspensión temporal por fuerza mayor
  COMPLETED = 'COMPLETED', // Cruce de meta finalizado (Pre-oficial)
  OFFICIAL = 'OFFICIAL'    // Resultados firmados e inmutables
}

export enum DisciplineType {
  ENDURANCE = 'ENDURANCE', // Apto para Raid y Endurance
  FLAT_RACING = 'FLAT_RACING', // Apto para Turf y Pencas
  DUAL = 'DUAL'            // Ejemplares polivalentes
}
