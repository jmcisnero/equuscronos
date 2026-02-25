-- ==========================================================
-- EQUUSCRONOS SEED SCRIPT (Datos de Prueba)
-- Proyecto: Sistema de Gestión de Competencias Ecuestres
-- Propósito: Carga inicial para entorno de Desarrollo (Dev)
-- ==========================================================

-- NOTA: 
-- Se usan UUIDs fijos para que se puedan armar colecciones de Postman estáticas.
-- Los timestamps usan '-03' para forzar la correcta interpretación de la zona horaria (Uruguay).

-- ==========================================================
-- 1. INFRAESTRUCTURA Y ACTORES (Maestros)
-- ==========================================================

-- A. Tenants (Clubes)
INSERT INTO tenants (id, name, location) VALUES 
('t0000000-0000-0000-0000-000000000001', 'Sociedad Hípica de Melo', 'Melo, Cerro Largo'),
('t0000000-0000-0000-0000-000000000002', 'Federación Ecuestre Uruguaya', 'Montevideo');

-- B. Propietarios
INSERT INTO owners (id, name, type, contact_info) VALUES 
('o0000000-0000-0000-0000-000000000001', 'Haras El Relincho', 'HARAS', 'contacto@elrelincho.uy'),
('o0000000-0000-0000-0000-000000000002', 'Familia Silva', 'PERSON', '099123456');

-- C. Usuarios (Operadores del sistema)
INSERT INTO users (id, tenant_id, name, email, password_hash, role) VALUES 
('u0000000-0000-0000-0000-000000000001', 't0000000-0000-0000-0000-000000000001', 'Carlos Juez', 'juez@melo.uy', 'hash_simulado_123', 'JUDGE'),
('u0000000-0000-0000-0000-000000000002', 't0000000-0000-0000-0000-000000000001', 'Dra. Ana Vet', 'vet@melo.uy', 'hash_simulado_123', 'VET');

-- D. Caballos
INSERT INTO horses (id, owner_id, name, feu_id, chip_id, is_feu_active) VALUES 
('h0000000-0000-0000-0000-000000000001', 'o0000000-0000-0000-0000-000000000001', 'Tormenta Criolla', 'FEU-H-101', 'CHIP-985121000', TRUE),
('h0000000-0000-0000-0000-000000000002', 'o0000000-0000-0000-0000-000000000002', 'Rayo Veloz', 'FEU-H-102', 'CHIP-985121001', TRUE);

-- E. Jinetes
INSERT INTO riders (id, name, national_id, feu_id, is_feu_active) VALUES 
('r0000000-0000-0000-0000-000000000001', 'Mateo Silva', '3.123.456-7', 'FEU-R-201', TRUE),
('r0000000-0000-0000-0000-000000000002', 'Lucía Gómez', '4.234.567-8', 'FEU-R-202', TRUE);


-- ==========================================================
-- 2. CONFIGURACIÓN DE LA COMPETENCIA
-- ==========================================================

-- F. Tipo de Competencia (Plantilla de Reglas)
INSERT INTO competition_types (id, name, default_rules) VALUES 
('ct000000-0000-0000-0000-000000000001', 'Raid FEU 60km', '{"max_heart_rate": 64, "min_weight_kg": 75}');

-- G. La Competencia
INSERT INTO competitions (id, tenant_id, competition_type_id, name, competition_date, location, is_federated, status) VALUES 
('c0000000-0000-0000-0000-000000000001', 't0000000-0000-0000-0000-000000000001', 'ct000000-0000-0000-0000-000000000001', 'Raid Batalla de Tupambaé', '2026-03-15', 'Ruta 8, Melo', TRUE, 'ACTIVE');

-- H. Etapas (Fases de la carrera)
INSERT INTO stages (id, competition_id, stage_number, distance_km, neutralization_minutes) VALUES 
('s0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000001', 1, 40.00, 40),
('s0000000-0000-0000-0000-000000000002', 'c0000000-0000-0000-0000-000000000001', 2, 20.00, 0);


-- ==========================================================
-- 3. OPERACIÓN (El flujo en vivo de la carrera)
-- ==========================================================

-- I. Inscripciones (Asignación de Dorsales y Pesos)
INSERT INTO competition_entries (id, competition_id, rider_id, horse_id, represented_tenant_id, bib_number, status, check_in_weight, ballast_weight, current_stage_id) VALUES 
-- Mateo da el peso exacto (75.5kg). Cero lastre.
('ce000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000001', 'r0000000-0000-0000-0000-000000000001', 'h0000000-0000-0000-0000-000000000001', 't0000000-0000-0000-0000-000000000001', 101, 'VET_CHECK', 75.50, 0.00, 's0000000-0000-0000-0000-000000000001'),
-- Lucía pesa 68.0kg. Necesita 7.0kg de lastre de plomo.
('ce000000-0000-0000-0000-000000000002', 'c0000000-0000-0000-0000-000000000001', 'r0000000-0000-0000-0000-000000000002', 'h0000000-0000-0000-0000-000000000002', 't0000000-0000-0000-0000-000000000001', 102, 'VET_CHECK', 68.00, 7.00, 's0000000-0000-0000-0000-000000000001');

-- J. Tiempos (Cronometraje de la Etapa 1)
-- IMPORTANTE: Flujo Lógico: Largada -> Llegada a Meta -> Entrada a Veterinaria
INSERT INTO timing_records (id, entry_id, stage_id, record_type, recorded_at, heart_rate, is_approved) VALUES 
-- Binomio 101 (Mateo)
('tr000000-0000-0000-0000-000000000101', 'ce000000-0000-0000-0000-000000000001', 's0000000-0000-0000-0000-000000000001', 'START', '2026-03-15 07:00:00-03', NULL, TRUE),
('tr000000-0000-0000-0000-000000000102', 'ce000000-0000-0000-0000-000000000001', 's0000000-0000-0000-0000-000000000001', 'ARRIVAL', '2026-03-15 08:30:15-03', NULL, TRUE),
('tr000000-0000-0000-0000-000000000103', 'ce000000-0000-0000-0000-000000000001', 's0000000-0000-0000-0000-000000000001', 'VET_IN', '2026-03-15 08:35:10-03', 56, TRUE), -- Recuperó en ~5 mins
-- Binomio 102 (Lucía)
('tr000000-0000-0000-0000-000000000201', 'ce000000-0000-0000-0000-000000000002', 's0000000-0000-0000-0000-000000000001', 'START', '2026-03-15 07:00:00-03', NULL, TRUE),
('tr000000-0000-0000-0000-000000000202', 'ce000000-0000-0000-0000-000000000002', 's0000000-0000-0000-0000-000000000001', 'ARRIVAL', '2026-03-15 08:29:40-03', NULL, TRUE), -- Llegó un poco antes
('tr000000-0000-0000-0000-000000000203', 'ce000000-0000-0000-0000-000000000002', 's0000000-0000-0000-0000-000000000001', 'VET_IN', '2026-03-15 08:42:00-03', 62, TRUE); -- Tardó ~12 mins en bajar el pulso (tiempo de recuperación más alto)

-- K. Inspecciones Clínicas (Vinculadas a los eventos VET_IN)
INSERT INTO vet_inspections (id, timing_record_id, temperature, motricity, metabolic, attempt_number, is_recheck_required, notes) VALUES 
-- Mateo (Caballo en perfectas condiciones)
('vi000000-0000-0000-0000-000000000001', 'tr000000-0000-0000-0000-000000000103', 38.5, 'APTO', 'NORMAL', 1, FALSE, 'Excelente recuperación capilar.'),
-- Lucía (Caballo con pulso alto, el veterinario pide rechequeo antes de largar la etapa 2)
('vi000000-0000-0000-0000-000000000002', 'tr000000-0000-0000-0000-000000000203', 39.0, 'APTO', 'OBSERVED', 1, TRUE, 'Trote limpio pero algo deshidratado. Se solicita re-inspección a las 09:10.');
