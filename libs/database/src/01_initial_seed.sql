DO $$ 
DECLARE 
    v_tenant_id UUID;
    v_owner_id UUID;
    v_horse_id UUID;
    v_rider_id UUID;
    v_comp_type_id UUID;
    v_comp_id UUID;
    v_stage_id UUID;
    v_user_id UUID;
BEGIN
    -- 1. CREAR UN CLUB (TENANT)
    INSERT INTO tenants (name, location) 
    VALUES ('Centro Hípico Sarandí del Yí', 'Durazno, Uruguay')
    RETURNING id INTO v_tenant_id;

    -- 2. CREAR UN PROPIETARIO (OWNER - TIPO STUD)
    INSERT INTO owners (name, type, contact_info) 
    VALUES ('Stud Los Amigos', 'STUD', 'contacto@studlosamigos.com')
    RETURNING id INTO v_owner_id;

    -- 3. CREAR UN USUARIO (ADMIN DEL CLUB)
    INSERT INTO users (tenant_id, name, email, role, password_hash) 
    VALUES (v_tenant_id, 'Admin Equus', 'admin@sarandi.com', 'ADMIN', 'hash_de_prueba_123')
    RETURNING id INTO v_user_id;

    -- 4. CREAR UN CABALLO (HORSES)
    INSERT INTO horses (owner_id, name, feu_id, chip_id, is_feu_active) 
    VALUES (v_owner_id, 'Cronos del Este', 'FEU-H-998', '985121006788234', TRUE)
    RETURNING id INTO v_horse_id;

    -- 5. CREAR UN JINETE (RIDERS)
    INSERT INTO riders (name, national_id, feu_id, is_feu_active) 
    VALUES ('Juan Carlos Pérez', '1.234.567-8', 'FEU-R-450', TRUE)
    RETURNING id INTO v_rider_id;

    -- 6. CREAR TIPO DE COMPETENCIA (RAID FEU)
    INSERT INTO competition_types (name, default_rules) 
    VALUES ('Raid Federado 60km', '{
        "max_pulse": 65, 
        "min_weight": 75, 
        "recovery_time_limit": 20,
        "is_federated_default": true
    }')
    RETURNING id INTO v_comp_type_id;

    -- 7. CREAR UNA COMPETENCIA (EVENTO)
    INSERT INTO competitions (tenant_id, competition_type_id, name, competition_date, location, is_federated, status) 
    VALUES (v_tenant_id, v_comp_type_id, 'Raid Grito de Asencio - 60 Edición', '2026-05-15', 'Sarandí del Yí', TRUE, 'PLANNED')
    RETURNING id INTO v_comp_id;

    -- 8. CREAR ETAPA 1
    INSERT INTO stages (competition_id, stage_number, distance_km, neutralization_minutes) 
    VALUES (v_comp_id, 1, 40.00, 30)
    RETURNING id INTO v_stage_id;

    -- 9. CREAR PUNTOS DE CONTROL PARA LA ETAPA 1
    INSERT INTO checkpoints (stage_id, name, type, distance_from_start_km) 
    VALUES 
        (v_stage_id, 'Largada Plaza Principal', 'START', 0.00),
        (v_stage_id, 'Neutralización Local Hipódromo', 'VET_GATE', 40.00);

    -- 10. INSCRIBIR AL BINOMIO (REGISTRATIONS)
    INSERT INTO registrations (
        competition_id, 
        rider_id, 
        horse_id, 
        represented_tenant_id, 
        number, 
        initial_rider_weight, 
        initial_equipment_weight, 
        qualifies_for_points
    ) 
    VALUES (
        v_comp_id, 
        v_rider_id, 
        v_horse_id, 
        v_tenant_id, 
        '15', 
        72.5, 
        3.5, 
        TRUE
    );

    RAISE NOTICE 'Datos iniciales cargados con éxito para la competencia: %', v_comp_id;

END $$;
