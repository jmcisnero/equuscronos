-- ==========================================================
-- EQUUSCRONOS INITIAL DATABASE SCRIPT
-- Proyecto: Sistema de Gestión de Competencias Ecuestres
-- ==========================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Limpiar base de datos si ya existe el esquema
DROP TABLE IF EXISTS audit_logs, penalties, vet_inspections, timing_records, weight_controls, 
                     competition_entries, stages, competitions, competition_types, 
                     riders, horses, owners, users, tenants CASCADE;

DROP TYPE IF EXISTS user_role, owner_type, comp_status, clinical_status, motricity_status, audit_action, participant_status, time_record_type, elimination_code, gait_status_enum, inspection_type_enum CASCADE;

-- ==========================================================
-- 1. TIPOS ENUMERADOS (Gobernanza de Datos)
-- ==========================================================
CREATE TYPE user_role AS ENUM ('ADMIN', 'JUDGE', 'VET', 'SPECTATOR', 'CLUB_ADMIN', 'TIMEKEEPER', 'USER');
CREATE TYPE owner_type AS ENUM ('PERSON', 'STUD', 'HARAS');
CREATE TYPE comp_status AS ENUM ('PLANNED', 'ACTIVE', 'PAUSED', 'COMPLETED', 'OFFICIAL', 'CANCELLED');
CREATE TYPE clinical_status AS ENUM ('NORMAL', 'DEHYDRATED', 'OBSERVED', 'FAILED');
CREATE TYPE motricity_status AS ENUM ('APTO', 'NOT_APTO', 'OBSERVED');
CREATE TYPE audit_action AS ENUM ('INSERT', 'UPDATE', 'DELETE', 'LOGIN', 'SECURITY_ALERT');

-- Estados de la Inscripción y Tiempos (Core Logic)
CREATE TYPE participant_status AS ENUM ('IN_RACE', 'VET_CHECK', 'RESTING', 'PENDING_OLYMPIC', 'FINISHED', 'DQ', 'DNF', 'WD', 'NO_COMPLETED', 'ELIMINATED_TR', 'ELIMINATED_PP', 'ELIMINATED_GAIT', 'FINISHED_PROVISIONAL');
CREATE TYPE time_record_type AS ENUM ('START', 'ARRIVAL', 'VET_IN', 'VET_OUT', 'OLYMPIC_PRESENTATION');
CREATE TYPE elimination_code AS ENUM (
    'GAIT',          -- Cojera/Claudicación
    'METABOLIC',     -- Pulso alto / Deshidratación
    'TIME',          -- Fuera de tiempo límite
    'RET',           -- Retiro voluntario (Retired)
    'DISQ',          -- Descalificación reglamentaria
    'FAIL_WEIGHT'    -- No dio el peso mínimo
);

-- ==========================================================
-- 2. ENTIDADES MAESTRAS (Infraestructura y Actores)
-- ==========================================================
CREATE TABLE tenants (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL UNIQUE,
    location VARCHAR(255),
    federation_number INT UNIQUE,
    jersey_image_url VARCHAR(550),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE owners (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    type owner_type NOT NULL DEFAULT 'PERSON',
    contact_info VARCHAR(255),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID REFERENCES tenants(id) ON DELETE RESTRICT,
    name VARCHAR(255) NOT NULL,
    email VARCHAR(255) NOT NULL UNIQUE,
    password_hash VARCHAR(255),
    google_id VARCHAR(255) UNIQUE,
    apple_id VARCHAR(255) UNIQUE,
    role user_role NOT NULL DEFAULT 'SPECTATOR',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE horses (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    owner_id UUID REFERENCES owners(id) ON DELETE SET NULL,
    name VARCHAR(255) NOT NULL,
    feu_id VARCHAR(50) UNIQUE,
    chip_id VARCHAR(100) UNIQUE,
    is_feu_active BOOLEAN DEFAULT FALSE,
    health_records_expiration DATE, -- Sanidad MGAP
    birth_date DATE, -- Fecha de Nacimiento
    image_url VARCHAR(550), -- URL de la foto oficial
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE riders (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    national_id VARCHAR(50) NOT NULL UNIQUE,
    feu_id VARCHAR(50) UNIQUE,
    is_feu_active BOOLEAN DEFAULT FALSE,
    birth_date DATE, -- Fecha de Nacimiento (inmutable para evitar bugs de zona horaria)
    medical_card_expiration DATE, -- Carnet de Salud / Ficha Médica	
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- ==========================================================
-- 3. CONFIGURACIÓN DE COMPETENCIA
-- ==========================================================
CREATE TABLE competition_types (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(100) NOT NULL UNIQUE,
    default_rules JSONB, 
    rules_config JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE competitions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE RESTRICT,
    competition_type_id UUID NOT NULL REFERENCES competition_types(id),
    name VARCHAR(255) NOT NULL,
    competition_date DATE NOT NULL,
    location VARCHAR(255),
    is_federated BOOLEAN DEFAULT FALSE,
    max_heart_rate INT DEFAULT 65,
    status comp_status DEFAULT 'PLANNED',
    start_time TIME NOT NULL DEFAULT '07:00:00',
    control_closure_time TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE stages (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
	tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE RESTRICT,
    competition_id UUID NOT NULL REFERENCES competitions(id) ON DELETE CASCADE,
    stage_number INT NOT NULL,
    distance_km DECIMAL(6,2) NOT NULL,
    neutralization_minutes INT DEFAULT 0,
    UNIQUE(competition_id, stage_number)
);

-- ==========================================================
-- 4. OPERACIÓN: INSCRIPCIONES Y CRONOMETRAJE (El "Motor")
-- ==========================================================
-- Tabla Única de Inscripción
CREATE TABLE competition_entries (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
	tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE RESTRICT,
    competition_id UUID NOT NULL REFERENCES competitions(id) ON DELETE CASCADE,
    rider_id UUID NOT NULL REFERENCES riders(id) ON DELETE RESTRICT,
    horse_id UUID NOT NULL REFERENCES horses(id) ON DELETE RESTRICT,
    represented_tenant_id UUID REFERENCES tenants(id), -- Club al que representa
    
    bib_number INTEGER NOT NULL,
    status participant_status DEFAULT 'IN_RACE',
    qualifies_for_points BOOLEAN DEFAULT FALSE,
    final_position INT, -- Se llena al finalizar la carrera
    
    ballast_weight DECIMAL(5, 2) DEFAULT 0.00,    
    rider_weight DECIMAL(5, 2),
    tack_weight DECIMAL(5, 2),
    sealed_items JSONB,
    seal_number VARCHAR(255),
    weigh_in_at TIMESTAMP WITH TIME ZONE,
    current_stage_id UUID REFERENCES stages(id), 
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(competition_id, bib_number),
    UNIQUE(competition_id, rider_id, horse_id) -- Binomio único por carrera
);

-- Auditoría de Pesajes Dinámicos (Sorteos y Final)
CREATE TABLE weight_controls (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    entry_id UUID NOT NULL REFERENCES competition_entries(id) ON DELETE CASCADE,
    stage_id UUID REFERENCES stages(id) ON DELETE CASCADE,
    weight_recorded DECIMAL(5,2) NOT NULL,
    control_type VARCHAR(50) NOT NULL, -- Ej: 'STAGE_END', 'RANDOM_CHECK'
    recorded_by UUID REFERENCES users(id) ON DELETE SET NULL,
    recorded_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Log Transaccional de Tiempos
CREATE TABLE timing_records (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
	tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE RESTRICT,
    entry_id UUID NOT NULL REFERENCES competition_entries(id) ON DELETE CASCADE,
    stage_id UUID NOT NULL REFERENCES stages(id) ON DELETE RESTRICT,
    
    record_type time_record_type NOT NULL,
    recorded_at TIMESTAMP WITH TIME ZONE NOT NULL, 

    is_approved BOOLEAN DEFAULT true, 
    elimination_type elimination_code, 
    elimination_reason TEXT,          
    
    -- Caché algorítmico (Calculado por el Backend)
    scheduled_departure_time TIMESTAMP WITH TIME ZONE, 
    
    -- Auditoría de Modificaciones de Jueces
    is_void BOOLEAN DEFAULT false,
    void_reason TEXT,
    is_automatic BOOLEAN DEFAULT false,
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TYPE gait_status_enum AS ENUM ('APPROVED', 'LAMENESS_ELIMINATED', 'OBSERVATION');
CREATE TYPE inspection_type_enum AS ENUM ('STANDARD', 'RE_INSPECTION_MANDATORY', 'RE_INSPECTION_REQUESTED');

-- Detalle Clínico Veterinario 
CREATE TABLE vet_inspections (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE RESTRICT,
    competence_id UUID NOT NULL REFERENCES competitions(id) ON DELETE CASCADE,
    vet_gate_number INT NOT NULL,
    rider_dorsal VARCHAR(50) NOT NULL,
    arrival_time TIMESTAMP WITH TIME ZONE NOT NULL,
    vet_in_time TIMESTAMP WITH TIME ZONE NOT NULL,
    heart_rate INT NOT NULL,
    gait_status gait_status_enum NOT NULL DEFAULT 'APPROVED',
    inspection_type inspection_type_enum NOT NULL DEFAULT 'STANDARD',
    requires_recheck BOOLEAN NOT NULL DEFAULT FALSE,
    attempt_number INT NOT NULL DEFAULT 1,
    is_recheck_required BOOLEAN NOT NULL DEFAULT FALSE,
    next_check_time TIMESTAMP WITH TIME ZONE,
    is_final_decision BOOLEAN NOT NULL DEFAULT TRUE,
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE penalties (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
	tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE RESTRICT,
    entry_id UUID NOT NULL REFERENCES competition_entries(id) ON DELETE CASCADE,
    stage_id UUID REFERENCES stages(id) ON DELETE CASCADE,
    time_penalty_seconds INT NOT NULL,
    reason VARCHAR(255) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- ==========================================================
-- 5. CAJA NEGRA (Auditoría Global)
-- ==========================================================
CREATE TABLE audit_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
	tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE RESTRICT,
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    action audit_action NOT NULL,
    entity_name VARCHAR(50) NOT NULL,
    entity_id UUID NOT NULL,
    old_data JSONB,
    new_data JSONB,
    ip_address VARCHAR(45),
    user_agent TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- ==========================================================
-- 6. ÍNDICES DE ALTO RENDIMIENTO
-- ==========================================================
-- Consultas críticas para el Leaderboard en Tiempo Real
CREATE INDEX idx_timing_entry ON timing_records(entry_id, recorded_at);
CREATE INDEX idx_timing_stage ON timing_records(stage_id);
CREATE INDEX idx_entry_competition ON competition_entries(competition_id, status);
CREATE INDEX idx_vet_competence_dorsal ON vet_inspections(competence_id, rider_dorsal);
CREATE INDEX idx_weight_controls_entry ON weight_controls(entry_id);

-- Consultas rápidas de Autenticación y Búsqueda
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_riders_ids ON riders(national_id, feu_id);
CREATE INDEX idx_horses_ids ON horses(chip_id, feu_id);
CREATE INDEX idx_audit_chrono ON audit_logs(created_at DESC);

-- ==========================================================
-- 7. SEGURIDAD Y AISLAMIENTO (RLS)
-- ==========================================================
ALTER TABLE owners ENABLE ROW LEVEL SECURITY;
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE horses ENABLE ROW LEVEL SECURITY;
ALTER TABLE riders ENABLE ROW LEVEL SECURITY;
ALTER TABLE competition_types ENABLE ROW LEVEL SECURITY;
ALTER TABLE competitions ENABLE ROW LEVEL SECURITY;
ALTER TABLE stages ENABLE ROW LEVEL SECURITY;
ALTER TABLE competition_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE weight_controls ENABLE ROW LEVEL SECURITY;
ALTER TABLE timing_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE vet_inspections ENABLE ROW LEVEL SECURITY;
ALTER TABLE penalties ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION current_tenant_id() RETURNS UUID AS $$
DECLARE
  val TEXT;
BEGIN
  val := current_setting('app.current_tenant_id', true);
  IF val IS NULL OR val = '' THEN
    RETURN NULL;
  END IF;
  RETURN val::UUID;
EXCEPTION WHEN OTHERS THEN
  RETURN NULL;
END;
$$ LANGUAGE plpgsql STABLE;

-- POLÍTICAS GLOBALES (Acceso abierto a catálogo)
CREATE POLICY global_access_owners ON owners FOR ALL USING (true);
CREATE POLICY global_access_horses ON horses FOR ALL USING (true);
CREATE POLICY global_access_riders ON riders FOR ALL USING (true);
CREATE POLICY global_access_competition_types ON competition_types FOR ALL USING (true);

-- POLÍTICAS LOCALES (Aislamiento estricto B2B para Clubes)
CREATE POLICY tenant_isolation_users ON users FOR ALL USING (tenant_id = current_tenant_id() OR current_tenant_id() IS NULL); 
CREATE POLICY tenant_isolation_competitions ON competitions FOR ALL USING (tenant_id = current_tenant_id() OR current_tenant_id() IS NULL);
CREATE POLICY tenant_isolation_stages ON stages FOR ALL USING (tenant_id = current_tenant_id() OR current_tenant_id() IS NULL);
CREATE POLICY tenant_isolation_competition_entries ON competition_entries FOR ALL USING (tenant_id = current_tenant_id() OR current_tenant_id() IS NULL);
CREATE POLICY tenant_isolation_weight_controls ON weight_controls FOR ALL USING ((SELECT tenant_id FROM competition_entries WHERE id = entry_id) = current_tenant_id() OR current_tenant_id() IS NULL);
CREATE POLICY tenant_isolation_timing_records ON timing_records FOR ALL USING (tenant_id = current_tenant_id() OR current_tenant_id() IS NULL);
CREATE POLICY tenant_isolation_vet_inspections ON vet_inspections FOR ALL USING (tenant_id = current_tenant_id() OR current_tenant_id() IS NULL);
CREATE POLICY tenant_isolation_penalties ON penalties FOR ALL USING (tenant_id = current_tenant_id() OR current_tenant_id() IS NULL);
CREATE POLICY tenant_isolation_audit_logs ON audit_logs FOR ALL USING (tenant_id = current_tenant_id() OR current_tenant_id() IS NULL);

-- Forzar RLS para el propietario/administrador de las tablas
ALTER TABLE owners FORCE ROW LEVEL SECURITY;
ALTER TABLE users FORCE ROW LEVEL SECURITY;
ALTER TABLE horses FORCE ROW LEVEL SECURITY;
ALTER TABLE riders FORCE ROW LEVEL SECURITY;
ALTER TABLE competition_types FORCE ROW LEVEL SECURITY;
ALTER TABLE competitions FORCE ROW LEVEL SECURITY;
ALTER TABLE stages FORCE ROW LEVEL SECURITY;
ALTER TABLE competition_entries FORCE ROW LEVEL SECURITY;
ALTER TABLE weight_controls FORCE ROW LEVEL SECURITY;
ALTER TABLE timing_records FORCE ROW LEVEL SECURITY;
ALTER TABLE vet_inspections FORCE ROW LEVEL SECURITY;
ALTER TABLE penalties FORCE ROW LEVEL SECURITY;
ALTER TABLE audit_logs FORCE ROW LEVEL SECURITY;

-- Crear el rol de la aplicación con privilegios limitados (no superusuario) para cumplir RLS
DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_catalog.pg_roles WHERE rolname = 'equus_app') THEN
    CREATE ROLE equus_app WITH LOGIN PASSWORD 'equus_secure_pass_2026';
  END IF;
END
$$;

-- Otorgar todos los permisos sobre el esquema y las tablas al rol equus_app
GRANT USAGE, CREATE ON SCHEMA public TO equus_app;
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO equus_app;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO equus_app;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO equus_app;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO equus_app;
