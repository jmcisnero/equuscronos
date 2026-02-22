-- ==========================================================
-- EQUUSCRONOS DATABASE SCRIPT 
-- Proyecto: Sistema de Gestión de Competencias Ecuestres
-- ==========================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. TIPOS ENUMERADOS (Gobernanza de Datos)
CREATE TYPE user_role AS ENUM ('ADMIN', 'JUDGE', 'VET', 'SPECTATOR');
CREATE TYPE owner_type AS ENUM ('PERSON', 'STUD', 'HARAS');
CREATE TYPE comp_status AS ENUM ('PLANNED', 'ACTIVE', 'COMPLETED', 'CANCELLED');
CREATE TYPE checkpoint_type AS ENUM ('START', 'VET_GATE', 'FINISH', 'WEIGH_IN');
CREATE TYPE mark_status AS ENUM ('PENDING', 'MARKED', 'WITHDRAWN');
CREATE TYPE final_status AS ENUM ('IN_PROGRESS', 'CLASSIFIED', 'ABANDONED', 'DISQUALIFIED_VET', 'DISQUALIFIED_WEIGHT');
CREATE TYPE clinical_status AS ENUM ('NORMAL', 'DEHYDRATED', 'OBSERVED', 'FAILED');
CREATE TYPE motricity_status AS ENUM ('APTO', 'NOT_APTO', 'OBSERVED');
CREATE TYPE audit_action AS ENUM ('INSERT', 'UPDATE', 'DELETE', 'LOGIN', 'SECURITY_ALERT');
CREATE TYPE participant_status AS ENUM ('IN_RACE', 'VET_CHECK', 'RESTING', 'FINISHED', 'DQ', 'DNF', 'WD');
CREATE TYPE time_record_type AS ENUM ('START', 'ARRIVAL', 'VET_IN', 'VET_OUT');

-- 2. ENTIDADES MAESTRAS (Datos Persistentes)
CREATE TABLE tenants (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL UNIQUE,
    location VARCHAR(255),
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
    tenant_id UUID REFERENCES tenants(id) ON DELETE SET NULL,
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
    feu_id VARCHAR(50) UNIQUE, -- ID oficial FEU para ranking
    chip_id VARCHAR(100) UNIQUE, -- Identificación electrónica de campo
    is_feu_active BOOLEAN DEFAULT FALSE, -- Habilitación deportiva actual
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE riders (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    national_id VARCHAR(50) NOT NULL UNIQUE, -- CI (Identificación civil)
    feu_id VARCHAR(50) UNIQUE, -- ID Federado (Puntaje deportivo)
    is_feu_active BOOLEAN DEFAULT FALSE, -- Pago de anualidad/ficha médica
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 3. CONFIGURACIÓN DE EVENTO
CREATE TABLE competition_types (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(100) NOT NULL UNIQUE,
    default_rules JSONB, -- Reglas base (pulsaciones, tiempos max, etc.)
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE competitions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES tenants(id),
    competition_type_id UUID NOT NULL REFERENCES competition_types(id),
    name VARCHAR(255) NOT NULL,
    competition_date DATE NOT NULL,
    location VARCHAR(255),
    is_federated BOOLEAN DEFAULT FALSE, -- Activa rigor normativo FEU
    status comp_status DEFAULT 'PLANNED',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 4. GEOGRAFÍA Y TIEMPOS DE CARRERA
CREATE TABLE stages (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    competition_id UUID NOT NULL REFERENCES competitions(id) ON DELETE CASCADE,
    stage_number INT NOT NULL,
    distance_km DECIMAL(6,2) NOT NULL,
    neutralization_minutes INT DEFAULT 0, -- Tiempo de descanso post-etapa
    UNIQUE(competition_id, stage_number)
);

CREATE TABLE competition_entries (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    competition_id UUID REFERENCES competitions(id) ON DELETE CASCADE,
    rider_id UUID REFERENCES riders(id) ON DELETE RESTRICT,
    horse_id UUID REFERENCES horses(id) ON DELETE RESTRICT,
    bib_number INTEGER NOT NULL,
    status participant_status DEFAULT 'IN_RACE',
    ballast_weight DECIMAL(5, 2) DEFAULT 0.00,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    -- Un mismo dorsal no puede repetirse en la misma competencia
    UNIQUE(competition_id, bib_number)
);

CREATE TABLE timing_records (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    entry_id UUID REFERENCES competition_entries(id) ON DELETE CASCADE,
    stage_order INTEGER NOT NULL,
    record_type time_record_type NOT NULL,
    recorded_at TIMESTAMP NOT NULL, -- Hora del evento capturada por el juez
    heart_rate INTEGER,              -- Pulsaciones (solo para VET_IN)
    is_approved BOOLEAN DEFAULT true, -- Resultado de la inspección veterinaria
    elimination_reason VARCHAR(255), -- Motivo si is_approved es false
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE checkpoints (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    stage_id UUID NOT NULL REFERENCES stages(id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL,
    type checkpoint_type NOT NULL,
    distance_from_start_km DECIMAL(6,2) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 5. INSCRIPCIÓN Y AFILIACIÓN DINÁMICA
CREATE TABLE registrations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    competition_id UUID NOT NULL REFERENCES competitions(id) ON DELETE CASCADE,
    rider_id UUID NOT NULL REFERENCES riders(id),
    horse_id UUID NOT NULL REFERENCES horses(id),
    represented_tenant_id UUID REFERENCES tenants(id), -- Club representado hoy
    number VARCHAR(10) NOT NULL, -- Dorsal
    mark_status mark_status DEFAULT 'PENDING',
    initial_rider_weight DECIMAL(5,2),
    initial_equipment_weight DECIMAL(5,2),
    qualifies_for_points BOOLEAN DEFAULT FALSE, -- Basado en estatus FEU al largar
    final_status final_status DEFAULT 'IN_PROGRESS',
    final_position INT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(competition_id, number),
    UNIQUE(competition_id, rider_id, horse_id)
);

-- 6. RESULTADOS, VETERINARIA Y PESAJES
CREATE TABLE results (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    registration_id UUID NOT NULL REFERENCES registrations(id) ON DELETE CASCADE,
    checkpoint_id UUID NOT NULL REFERENCES checkpoints(id),
    arrival_timestamp TIMESTAMP WITH TIME ZONE NOT NULL, -- Hora de Llegada
    scheduled_departure_time TIMESTAMP WITH TIME ZONE, -- Próxima Largada calculada
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE weigh_ins (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    result_id UUID NOT NULL UNIQUE REFERENCES results(id) ON DELETE CASCADE,
    rider_weight DECIMAL(5,2) NOT NULL,
    equipment_weight DECIMAL(5,2) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE vet_checks (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    result_id UUID NOT NULL REFERENCES results(id) ON DELETE CASCADE,
    check_timestamp TIMESTAMP WITH TIME ZONE NOT NULL, -- Hora de Presentación
    heart_rate INT,
    temperature DECIMAL(4,1),
    motricity motricity_status DEFAULT 'APTO',
    metabolic clinical_status DEFAULT 'NORMAL',
    status clinical_status NOT NULL, -- Aprobado/Falla
    attempt_number INT DEFAULT 1, -- Para rechequeos
    is_recheck_required BOOLEAN DEFAULT FALSE,
    next_check_time TIMESTAMP WITH TIME ZONE,
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE penalties (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    registration_id UUID NOT NULL REFERENCES registrations(id) ON DELETE CASCADE,
    checkpoint_id UUID REFERENCES checkpoints(id),
    time_penalty_seconds INT NOT NULL,
    reason VARCHAR(255) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 7. AUDITORÍA (Black Box)
CREATE TABLE audit_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
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

-- 8. ÍNDICES DE ALTO RENDIMIENTO (Validación 100% Optimizada)
CREATE INDEX idx_results_perf ON results(registration_id, arrival_timestamp);
CREATE INDEX idx_vet_attempts ON vet_checks(result_id, attempt_number);
CREATE INDEX idx_registrations_lookup ON registrations(competition_id, number);
CREATE INDEX idx_audit_chrono ON audit_logs(created_at DESC);
CREATE INDEX idx_riders_ids ON riders(national_id, feu_id);
CREATE INDEX idx_horses_ids ON horses(chip_id, feu_id);
CREATE INDEX idx_timing_entry ON timing_records(entry_id);
CREATE INDEX idx_entry_competition ON competition_entries(competition_id);
