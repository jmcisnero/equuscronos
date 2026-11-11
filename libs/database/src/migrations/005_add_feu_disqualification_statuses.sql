-- ==========================================================
-- EQUUSCRONOS MIGRATION 005
-- Proyecto: Sistema de Gestión de Competencias Ecuestres
-- Descripción: Agregar valores de descalificación y causales FEU al ENUM participant_status
-- ==========================================================

ALTER TYPE participant_status ADD VALUE IF NOT EXISTS 'FAIL_WEIGHT';
ALTER TYPE participant_status ADD VALUE IF NOT EXISTS 'DQ_ROUTE';
ALTER TYPE participant_status ADD VALUE IF NOT EXISTS 'DQ_ASSISTANCE';
ALTER TYPE participant_status ADD VALUE IF NOT EXISTS 'DQ_DISMOUNTED';
ALTER TYPE participant_status ADD VALUE IF NOT EXISTS 'DQ_VET_ROUTE';
ALTER TYPE participant_status ADD VALUE IF NOT EXISTS 'DQ_OVERTIME';
ALTER TYPE participant_status ADD VALUE IF NOT EXISTS 'DQ_OLYMPIC';

