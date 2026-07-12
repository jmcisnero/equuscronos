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
('a1000000-0000-0000-0000-000000000001', 'Sociedad Hípica de Melo', 'Melo, Cerro Largo'),
('a1000000-0000-0000-0000-000000000002', 'Federación Ecuestre Uruguaya', 'Montevideo');

INSERT INTO owners (id, name, type, contact_info) VALUES 
('b1000000-0000-0000-0000-000000000001', 'Haras El Relincho', 'HARAS', 'contacto@elrelincho.uy'),
('b1000000-0000-0000-0000-000000000002', 'Familia Silva', 'PERSON', '099123456');

INSERT INTO users (id, tenant_id, name, email, password_hash, role) VALUES 
('e1000000-0000-0000-0000-000000000001', 'a1000000-0000-0000-0000-000000000001', 'Carlos Juez', 'juez@melo.uy', '$2b$10$qeemt2ydZCq12MKMyCxrE.FLWL2oAKpbp/qPWm6Rz4.6eITejNkza', 'JUDGE'),
('e1000000-0000-0000-0000-000000000002', 'a1000000-0000-0000-0000-000000000001', 'Dra. Ana Vet', 'vet@melo.uy', '$2b$10$BcoXvxWGDqBmmUM2KzZ8L.BwtyKN4ZGHaaqtch6RFEA1A2l0iMSCi', 'VET'),
('e1000000-0000-0000-0000-000000000003', 'a1000000-0000-0000-0000-000000000001', 'Admin General', 'admin@equuscronos.com', '$2b$10$gf0AiDPdNP4f7z4vvf9AneFTYJFrqarnpZxI/dRgkt1zOn4/1SlDG', 'ADMIN');

INSERT INTO horses (id, owner_id, name, feu_id, chip_id, is_feu_active, health_records_expiration, birth_date, image_url) VALUES 
('d1000000-0000-0000-0000-000000000001', 'b1000000-0000-0000-0000-000000000001', 'Tormenta Criolla', 'FEU-H-101', 'CHIP-985121000', TRUE, CURRENT_DATE + INTERVAL '6 months', CURRENT_DATE - INTERVAL '7 years', 'https://images.unsplash.com/photo-1534447677768-be436bb09401?w=600'),
('d1000000-0000-0000-0000-000000000002', 'b1000000-0000-0000-0000-000000000002', 'Rayo Veloz', 'FEU-H-102', 'CHIP-985121001', TRUE, CURRENT_DATE + INTERVAL '1 year', CURRENT_DATE - INTERVAL '5 years', 'https://images.unsplash.com/photo-1553284965-83fd3e82fa5a?w=600');

INSERT INTO riders (id, name, national_id, feu_id, is_feu_active, medical_card_expiration) VALUES 
('f1000000-0000-0000-0000-000000000001', 'Mateo Silva', '3.123.456-7', 'FEU-R-201', TRUE, CURRENT_DATE + INTERVAL '1 year'),
('f1000000-0000-0000-0000-000000000002', 'Lucía Gómez', '4.234.567-8', 'FEU-R-202', TRUE, CURRENT_DATE + INTERVAL '6 months');

-- ==========================================================
-- 2. CONFIGURACIÓN DE LA COMPETENCIA
-- ==========================================================
INSERT INTO competition_types (id, name, default_rules, rules_config) VALUES 
('c1000000-0000-0000-0000-000000000001', 'Raid FEU 60km', '{"max_heart_rate": 64, "min_weight_kg": 85}', '{"distance_tolerance_rules": [{"min_distance": 0, "max_distance": 80, "tolerance_minutes": 30}, {"min_distance": 80, "max_distance": 100, "tolerance_minutes": 45}, {"min_distance": 100, "max_distance": null, "tolerance_minutes": 60}]}');

INSERT INTO competitions (id, tenant_id, competition_type_id, name, competition_date, location, is_federated, status, start_time) VALUES 
('c2000000-0000-0000-0000-000000000001', 'a1000000-0000-0000-0000-000000000001', 'c1000000-0000-0000-0000-000000000001', 'Raid Batalla de Tupambaé', '2026-03-15', 'Ruta 8, Melo', TRUE, 'ACTIVE', '07:00:00');

INSERT INTO stages (id, tenant_id, competition_id, stage_number, distance_km, neutralization_minutes) VALUES 
('e2000000-0000-0000-0000-000000000001', 'a1000000-0000-0000-0000-000000000001', 'c2000000-0000-0000-0000-000000000001', 1, 40.00, 40),
('e2000000-0000-0000-0000-000000000002', 'a1000000-0000-0000-0000-000000000001', 'c2000000-0000-0000-0000-000000000001', 2, 20.00, 0);

-- ==========================================================
-- 3. OPERACIÓN (El flujo en vivo de la carrera)
-- ==========================================================
-- Inscripciones (Solo el lastre va aquí)
INSERT INTO competition_entries (id, tenant_id, competition_id, rider_id, horse_id, represented_tenant_id, bib_number, status, ballast_weight, seal_number, weigh_in_at, current_stage_id) VALUES 
('a3000000-0000-0000-0000-000000000001', 'a1000000-0000-0000-0000-000000000001', 'c2000000-0000-0000-0000-000000000001', 'f1000000-0000-0000-0000-000000000001', 'd1000000-0000-0000-0000-000000000001', 'a1000000-0000-0000-0000-000000000001', 101, 'IN_RACE', 85.00, 'PREC-2026-001', CURRENT_TIMESTAMP, 'e2000000-0000-0000-0000-000000000001'),
('a3000000-0000-0000-0000-000000000002', 'a1000000-0000-0000-0000-000000000001', 'c2000000-0000-0000-0000-000000000001', 'f1000000-0000-0000-0000-000000000002', 'd1000000-0000-0000-0000-000000000002', 'a1000000-0000-0000-0000-000000000001', 102, 'IN_RACE', 92.00, 'PREC-2026-002', CURRENT_TIMESTAMP, 'e2000000-0000-0000-0000-000000000001');

-- Pesaje Inicial Oficial 
INSERT INTO weight_controls (entry_id, stage_id, weight_recorded, control_type, recorded_by) VALUES 
('a3000000-0000-0000-0000-000000000001', NULL, 85.00, 'INITIAL', 'e1000000-0000-0000-0000-000000000001'),
('a3000000-0000-0000-0000-000000000002', NULL, 85.00, 'INITIAL', 'e1000000-0000-0000-0000-000000000001');

-- Tiempos (Pura bitácora temporal - Notar la diferencia de 20 min exactos)
INSERT INTO timing_records (id, tenant_id, entry_id, stage_id, record_type, recorded_at, is_approved) VALUES 
-- Binomio 101 (Mateo)
('a4000000-0000-0000-0000-000000000101', 'a1000000-0000-0000-0000-000000000001', 'a3000000-0000-0000-0000-000000000001', 'e2000000-0000-0000-0000-000000000001', 'START', '2026-03-15 07:00:00-03', TRUE),
('a4000000-0000-0000-0000-000000000102', 'a1000000-0000-0000-0000-000000000001', 'a3000000-0000-0000-0000-000000000001', 'e2000000-0000-0000-0000-000000000001', 'ARRIVAL', '2026-03-15 08:30:15-03', TRUE),
('a4000000-0000-0000-0000-000000000103', 'a1000000-0000-0000-0000-000000000001', 'a3000000-0000-0000-0000-000000000001', 'e2000000-0000-0000-0000-000000000001', 'VET_IN', '2026-03-15 08:50:15-03', TRUE), -- Llegada + 20 min reglamentarios

-- Binomio 102 (Lucía)
('a4000000-0000-0000-0000-000000000201', 'a1000000-0000-0000-0000-000000000001', 'a3000000-0000-0000-0000-000000000002', 'e2000000-0000-0000-0000-000000000001', 'START', '2026-03-15 07:00:00-03', TRUE),
('a4000000-0000-0000-0000-000000000202', 'a1000000-0000-0000-0000-000000000001', 'a3000000-0000-0000-0000-000000000002', 'e2000000-0000-0000-0000-000000000001', 'ARRIVAL', '2026-03-15 08:29:40-03', TRUE),
('a4000000-0000-0000-0000-000000000203', 'a1000000-0000-0000-0000-000000000001', 'a3000000-0000-0000-0000-000000000002', 'e2000000-0000-0000-0000-000000000001', 'VET_IN', '2026-03-15 08:49:40-03', TRUE); -- Llegada + 20 min reglamentarios

-- Inspecciones Clínicas
INSERT INTO vet_inspections (id, tenant_id, competence_id, vet_gate_number, rider_dorsal, arrival_time, vet_in_time, heart_rate, gait_status, inspection_type, requires_recheck, is_final_decision, notes) VALUES 
('a5000000-0000-0000-0000-000000000001', 'a1000000-0000-0000-0000-000000000001', 'c2000000-0000-0000-0000-000000000001', 1, '101', '2026-03-15 08:30:15-03', '2026-03-15 08:50:15-03', 56, 'APPROVED', 'STANDARD', FALSE, TRUE, 'Excelente recuperación.'),
('a5000000-0000-0000-0000-000000000002', 'a1000000-0000-0000-0000-000000000001', 'c2000000-0000-0000-0000-000000000001', 1, '102', '2026-03-15 08:29:40-03', '2026-03-15 08:49:40-03', 62, 'APPROVED', 'STANDARD', FALSE, TRUE, 'Se solicita re-inspección a las 09:10 antes de largar.');
