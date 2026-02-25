-- ==========================================================
-- EQUUSCRONOS INITIAL DATABASE SCRIPT
-- Proyecto: Sistema de Gestión de Competencias Ecuestres
-- ==========================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ==========================================================
-- 1. TIPOS ENUMERADOS (Gobernanza de Datos)
-- ==========================================================
CREATE TYPE user_role AS ENUM ('ADMIN', 'JUDGE', 'VET', 'SPECTATOR');
CREATE TYPE owner_type AS ENUM ('PERSON', 'STUD', 'HARAS');
CREATE TYPE comp_status AS ENUM ('PLANNED', 'ACTIVE', 'COMPLETED', 'CANCELLED');
CREATE TYPE clinical_status AS ENUM ('NORMAL', 'DEHYDRATED', 'OBSERVED', 'FAILED');
CREATE TYPE motricity_status AS ENUM ('APTO', 'NOT_APTO', 'OBSERVED');
CREATE TYPE audit_action AS ENUM ('INSERT', 'UPDATE', 'DELETE', 'LOGIN', 'SECURITY_ALERT');

-- Estados de la Inscripción y Tiempos (Core Logic)
CREATE TYPE participant_status AS ENUM ('IN_RACE', 'VET_CHECK', 'RESTING', 'FINISHED', 'DQ', 'DNF', 'WD');
CREATE TYPE time_record_type AS ENUM ('START', 'ARRIVAL', 'VET_IN', 'VET_OUT');
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
    feu_id VARCHAR(50) UNIQUE,
    chip_id VARCHAR(100) UNIQUE,
    is_feu_active BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE riders (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    national_id VARCHAR(50) NOT NULL UNIQUE,
    feu_id VARCHAR(50) UNIQUE,
    is_feu_active BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- ==========================================================
-- 3. CONFIGURACIÓN DE COMPETENCIA
-- ==========================================================
CREATE TABLE competition_types (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(100) NOT NULL UNIQUE,
    default_rules JSONB, 
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE competitions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES tenants(id),
    competition_type_id UUID NOT NULL REFERENCES competition_types(id),
    name VARCHAR(255) NOT NULL,
    competition_date DATE NOT NULL,
    location VARCHAR(255),
    is_federated BOOLEAN DEFAULT FALSE,
    status comp_status DEFAULT 'PLANNED',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE stages (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
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
    competition_id UUID NOT NULL REFERENCES competitions(id) ON DELETE CASCADE,
    rider_id UUID NOT NULL REFERENCES riders(id) ON DELETE RESTRICT,
    horse_id UUID NOT NULL REFERENCES horses(id) ON DELETE RESTRICT,
    represented_tenant_id UUID REFERENCES tenants(id), -- Club al que representa
    
    bib_number INTEGER NOT NULL,
    status participant_status DEFAULT 'IN_RACE',
    qualifies_for_points BOOLEAN DEFAULT FALSE,
    final_position INT, -- Se llena al finalizar la carrera
    
    -- Control de Pesaje Oficial
    initial_rider_weight DECIMAL(5, 2),
    initial_equipment_weight DECIMAL(5, 2),
    check_in_weight DECIMAL(5, 2),  
    check_out_weight DECIMAL(5, 2),
    ballast_weight DECIMAL(5, 2) DEFAULT 0.00,
    
    current_stage_id UUID REFERENCES stages(id), 
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(competition_id, bib_number),
    UNIQUE(competition_id, rider_id, horse_id) -- Binomio único por carrera
);

-- Log Transaccional de Tiempos
CREATE TABLE timing_records (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    entry_id UUID NOT NULL REFERENCES competition_entries(id) ON DELETE CASCADE,
    stage_id UUID NOT NULL REFERENCES stages(id) ON DELETE RESTRICT,
    
    record_type time_record_type NOT NULL,
    recorded_at TIMESTAMP WITH TIME ZONE NOT NULL, 
    
    -- Veredicto Principal (La clínica detallada va en vet_inspections)
    heart_rate INTEGER,              
    is_approved BOOLEAN DEFAULT true, 
    elimination_type elimination_code, 
    elimination_reason TEXT,          
    
    -- Caché algorítmico (Calculado por el Backend)
    scheduled_departure_time TIMESTAMP WITH TIME ZONE, 
    
    -- Auditoría de Modificaciones de Jueces
    is_void BOOLEAN DEFAULT false,
    void_reason TEXT,
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Detalle Clínico Veterinario 
-- Se vincula 1:1 o M:1 a un timing_record de tipo 'VET_IN'
CREATE TABLE vet_inspections (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    timing_record_id UUID NOT NULL REFERENCES timing_records(id) ON DELETE CASCADE,
    
    temperature DECIMAL(4,1),
    motricity motricity_status DEFAULT 'APTO',
    metabolic clinical_status DEFAULT 'NORMAL',
    attempt_number INT DEFAULT 1, 
    is_recheck_required BOOLEAN DEFAULT FALSE,
    next_check_time TIMESTAMP WITH TIME ZONE,
    notes TEXT,
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE penalties (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
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
CREATE INDEX idx_vet_timing ON vet_inspections(timing_record_id);

-- Consultas rápidas de Autenticación y Búsqueda
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_riders_ids ON riders(national_id, feu_id);
CREATE INDEX idx_horses_ids ON horses(chip_id, feu_id);
CREATE INDEX idx_audit_chrono ON audit_logs(created_at DESC);
