-- ==========================================================
-- EQUUSCRONOS SEED SCRIPT (Datos de Prueba)
-- Proyecto: Sistema de Gestión de Competencias Ecuestres
-- Propósito: Carga inicial para entorno de Desarrollo (Dev)
-- ==========================================================

TRUNCATE audit_logs, penalties, vet_inspections, timing_records, weight_controls, 
         competition_entries, stages, competitions, competition_types, 
         riders, horses, owners, users, tenants CASCADE;

-- ==========================================================
-- 1. INFRAESTRUCTURA Y ACTORES (Maestros)
-- ==========================================================
INSERT INTO tenants (id, name, location) VALUES 
('t0000000-0000-0000-0000-000000000001', 'Sociedad Hípica de Melo', 'Melo, Cerro Largo'),
('t0000000-0000-0000-0000-000000000002', 'Federación Ecuestre Uruguaya', 'Montevideo');

INSERT INTO owners (id, name, type, contact_info) VALUES 
('o0000000-0000-0000-0000-000000000001', 'Haras El Relincho', 'HARAS', 'contacto@elrelincho.uy'),
('o0000000-0000-0000-0000-000000000002', 'Familia Silva', 'PERSON', '099123456');

INSERT INTO users (id, tenant_id, name, email, password_hash, role) VALUES 
('u0000000-0000-0000-0000-000000000001', 't0000000-0000-0000-0000-000000000001', 'Carlos Juez', 'juez@melo.uy', 'hash_simulado_123', 'JUDGE'),
('u0000000-0000-0000-0000-000000000002', 't0000000-0000-0000-0000-000000000001', 'Dra. Ana Vet', 'vet@melo.uy', 'hash_simulado_123', 'VET');

INSERT INTO horses (id, owner_id, name, feu_id, chip_id, is_feu_active, health_records_expiration) VALUES 
('h0000000-0000-0000-0000-000000000001', 'o0000000-0000-0000-0000-000000000001', 'Tormenta Criolla', 'FEU-H-101', 'CHIP-985121000', TRUE, CURRENT_DATE + INTERVAL '6 months'),
('h0000000-0000-0000-0000-000000000002', 'o0000000-0000-0000-0000-000000000002', 'Rayo Veloz', 'FEU-H-102', 'CHIP-985121001', TRUE, CURRENT_DATE + INTERVAL '1 year');

INSERT INTO riders (id, name, national_id, feu_id, is_feu_active, medical_card_expiration) VALUES 
('r0000000-0000-0000-0000-000000000001', 'Mateo Silva', '3.123.456-7', 'FEU-R-201', TRUE, CURRENT_DATE + INTERVAL '1 year'),
('r0000000-0000-0000-0000-000000000002', 'Lucía Gómez', '4.234.567-8', 'FEU-R-202', TRUE, CURRENT_DATE + INTERVAL '6 months');

-- ==========================================================
-- 2. CONFIGURACIÓN DE LA COMPETENCIA
-- ==========================================================
INSERT INTO competition_types (id, name, default_rules) VALUES 
('ct000000-0000-0000-0000-000000000001', 'Raid FEU 60km', '{"max_heart_rate": 64, "min_weight_kg": 85}');

INSERT INTO competitions (id, tenant_id, competition_type_id, name, competition_date, location, is_federated, status) VALUES 
('c0000000-0000-0000-0000-000000000001', 't0000000-0000-0000-0000-000000000001', 'ct000000-0000-0000-0000-000000000001', 'Raid Batalla de Tupambaé', '2026-03-15', 'Ruta 8, Melo', TRUE, 'ACTIVE');

INSERT INTO stages (id, competition_id, stage_number, distance_km, neutralization_minutes) VALUES 
('s0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000001', 1, 40.00, 40),
('s0000000-0000-0000-0000-000000000002', 'c0000000-0000-0000-0000-000000000001', 2, 20.00, 0);

-- ==========================================================
-- 3. OPERACIÓN (El flujo en vivo de la carrera)
-- ==========================================================
-- Inscripciones (Solo el lastre va aquí)
INSERT INTO competition_entries (id, competition_id, rider_id, horse_id, represented_tenant_id, bib_number, status, ballast_weight, current_stage_id) VALUES 
('ce000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000001', 'r0000000-0000-0000-0000-000000000001', 'h0000000-0000-0000-0000-000000000001', 't0000000-0000-0000-0000-000000000001', 101, 'VET_CHECK', 0.00, 's0000000-0000-0000-0000-000000000001'),
('ce000000-0000-0000-0000-000000000002', 'c0000000-0000-0000-0000-000000000001', 'r0000000-0000-0000-0000-000000000002', 'h0000000-0000-0000-0000-000000000002', 't0000000-0000-0000-0000-000000000001', 102, 'VET_CHECK', 7.00, 's0000000-0000-0000-0000-000000000001');

-- Pesaje Inicial Oficial 
INSERT INTO weight_controls (entry_id, stage_id, weight_recorded, control_type, recorded_by) VALUES 
('ce000000-0000-0000-0000-000000000001', NULL, 85.00, 'INITIAL', 'u0000000-0000-0000-0000-000000000001'),
('ce000000-0000-0000-0000-000000000002', NULL, 85.00, 'INITIAL', 'u0000000-0000-0000-0000-000000000001');

-- Tiempos (Pura bitácora temporal - Notar la diferencia de 20 min exactos)
INSERT INTO timing_records (id, entry_id, stage_id, record_type, recorded_at, is_approved) VALUES 
-- Binomio 101 (Mateo)
('tr000000-0000-0000-0000-000000000101', 'ce000000-0000-0000-0000-000000000001', 's0000000-0000-0000-0000-000000000001', 'START', '2026-03-15 07:00:00-03', TRUE),
('tr000000-0000-0000-0000-000000000102', 'ce000000-0000-0000-0000-000000000001', 's0000000-0000-0000-0000-000000000001', 'ARRIVAL', '2026-03-15 08:30:15-03', TRUE),
('tr000000-0000-0000-0000-000000000103', 'ce000000-0000-0000-0000-000000000001', 's0000000-0000-0000-0000-000000000001', 'VET_IN', '2026-03-15 08:50:15-03', TRUE), -- Llegada + 20 min reglamentarios

-- Binomio 102 (Lucía)
('tr000000-0000-0000-0000-000000000201', 'ce000000-0000-0000-0000-000000000002', 's0000000-0000-0000-0000-000000000001', 'START', '2026-03-15 07:00:00-03', TRUE),
('tr000000-0000-0000-0000-000000000202', 'ce000000-0000-0000-0000-000000000002', 's0000000-0000-0000-0000-000000000001', 'ARRIVAL', '2026-03-15 08:29:40-03', TRUE),
('tr000000-0000-0000-0000-000000000203', 'ce000000-0000-0000-0000-000000000002', 's0000000-0000-0000-0000-000000000001', 'VET_IN', '2026-03-15 08:49:40-03', TRUE); -- Llegada + 20 min reglamentarios

-- Inspecciones Clínicas (El Veterinario toma el pulso a los 20 min exactos de la llegada)
INSERT INTO vet_inspections (id, timing_record_id, heart_rate, temperature, motricity, metabolic, attempt_number, is_recheck_required, notes) VALUES 
('vi000000-0000-0000-0000-000000000001', 'tr000000-0000-0000-0000-000000000103', 56, 38.5, 'APTO', 'NORMAL', 1, FALSE, 'Excelente recuperación.'),
('vi000000-0000-0000-0000-000000000002', 'tr000000-0000-0000-0000-000000000203', 62, 39.0, 'APTO', 'OBSERVED', 1, TRUE, 'Se solicita re-inspección a las 09:10 antes de largar.');
