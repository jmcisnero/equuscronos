import { useState, useEffect } from 'react';
import { CompetitionRules } from '@/types/competition-type';

export interface UseCompetitionRulesFormReturn {
  name: string;
  setName: (name: string) => void;
  
  // Standard Form Fields
  maxHeartRate: number | '';
  setMaxHeartRate: (val: number | '') => void;
  minWeightKg: number | '';
  setMinWeightKg: (val: number | '') => void;
  recoveryTimeMins: number | '';
  setRecoveryTimeMins: (val: number | '') => void;
  minSpeedKh: number | '';
  setMinSpeedKh: (val: number | '') => void;
  maxTimeMins: number | '';
  setMaxTimeMins: (val: number | '') => void;

  // Expert Mode
  isExpertMode: boolean;
  setIsExpertMode: (val: boolean) => void;
  rulesJsonString: string;
  setRulesJsonString: (val: string) => void;
  
  // Status and Validation
  jsonError: string | null;
  formError: string | null;
  setFormError: (val: string | null) => void;

  // Actions
  resetForm: () => void;
  loadFromType: (name: string, rules?: CompetitionRules) => void;
  getRulesPayload: () => CompetitionRules | null;
  handleFieldChange: (field: keyof CompetitionRules, value: number | '') => void;
  handleJsonChange: (value: string) => void;
}

const DEFAULT_RULES: CompetitionRules = {
  max_heart_rate: 64,
  min_weight_kg: 75,
  min_weight: 75,
};

export function useCompetitionRulesForm(): UseCompetitionRulesFormReturn {
  const [name, setName] = useState('');
  
  // Form fields
  const [maxHeartRate, setMaxHeartRate] = useState<number | ''>('');
  const [minWeightKg, setMinWeightKg] = useState<number | ''>('');
  const [recoveryTimeMins, setRecoveryTimeMins] = useState<number | ''>('');
  const [minSpeedKh, setMinSpeedKh] = useState<number | ''>('');
  const [maxTimeMins, setMaxTimeMins] = useState<number | ''>('');

  // Expert Mode
  const [isExpertMode, setIsExpertMode] = useState(false);
  const [rulesJsonString, setRulesJsonString] = useState(JSON.stringify(DEFAULT_RULES, null, 2));
  const [jsonError, setJsonError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);

  // Sync standard fields from a parsed rules object
  const syncFieldsFromRules = (rules: CompetitionRules) => {
    setMaxHeartRate(rules.max_heart_rate !== undefined ? Number(rules.max_heart_rate) : '');
    
    // Support min_weight_kg primarily, fallback to min_weight
    const weight = rules.min_weight_kg !== undefined 
      ? Number(rules.min_weight_kg) 
      : rules.min_weight !== undefined 
        ? Number(rules.min_weight) 
        : '';
    setMinWeightKg(weight);
    
    setRecoveryTimeMins(rules.recovery_time_mins !== undefined ? Number(rules.recovery_time_mins) : '');
    setMinSpeedKh(rules.min_speed_kh !== undefined ? Number(rules.min_speed_kh) : '');
    setMaxTimeMins(rules.max_time_mins !== undefined ? Number(rules.max_time_mins) : '');
  };

  // Build a rules object from standard field states, keeping any other extra keys if present in rulesJsonString
  const buildRulesFromFields = (): CompetitionRules => {
    let currentRules: Record<string, any> = {};
    try {
      if (rulesJsonString.trim()) {
        currentRules = JSON.parse(rulesJsonString);
      }
    } catch (e) {
      currentRules = {};
    }

    // Update standard fields (or remove them if empty)
    if (maxHeartRate === '') {
      delete currentRules.max_heart_rate;
    } else {
      currentRules.max_heart_rate = Number(maxHeartRate);
    }

    if (minWeightKg === '') {
      delete currentRules.min_weight_kg;
      delete currentRules.min_weight;
    } else {
      currentRules.min_weight_kg = Number(minWeightKg);
      currentRules.min_weight = Number(minWeightKg); // Backward compatibility
    }

    if (recoveryTimeMins === '') {
      delete currentRules.recovery_time_mins;
    } else {
      currentRules.recovery_time_mins = Number(recoveryTimeMins);
    }

    if (minSpeedKh === '') {
      delete currentRules.min_speed_kh;
    } else {
      currentRules.min_speed_kh = Number(minSpeedKh);
    }

    if (maxTimeMins === '') {
      delete currentRules.max_time_mins;
    } else {
      currentRules.max_time_mins = Number(maxTimeMins);
    }

    return currentRules as CompetitionRules;
  };

  // Handle manual field change in the standard UI
  const handleFieldChange = (field: keyof CompetitionRules, value: number | '') => {
    setFormError(null);
    
    // Update individual state
    if (field === 'max_heart_rate') setMaxHeartRate(value);
    if (field === 'min_weight_kg' || field === 'min_weight') setMinWeightKg(value);
    if (field === 'recovery_time_mins') setRecoveryTimeMins(value);
    if (field === 'min_speed_kh') setMinSpeedKh(value);
    if (field === 'max_time_mins') setMaxTimeMins(value);
  };

  // Sync field changes to rulesJsonString when standard inputs change (in background)
  useEffect(() => {
    if (!isExpertMode) {
      const current = buildRulesFromFields();
      setRulesJsonString(JSON.stringify(current, null, 2));
      setJsonError(null);
    }
  }, [maxHeartRate, minWeightKg, recoveryTimeMins, minSpeedKh, maxTimeMins, isExpertMode]);

  // Handle manual JSON change in the expert UI textarea
  const handleJsonChange = (value: string) => {
    setRulesJsonString(value);
    if (!value.trim()) {
      setJsonError(null);
      return;
    }
    try {
      const parsed = JSON.parse(value);
      if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
        setJsonError('El JSON de reglas debe ser un objeto: {}');
      } else {
        setJsonError(null);
        // Sync standard form fields with the edited JSON on the fly
        syncFieldsFromRules(parsed);
      }
    } catch (err: any) {
      setJsonError(`Error de sintaxis JSON: ${err.message}`);
    }
  };

  const resetForm = () => {
    setName('');
    setMaxHeartRate('');
    setMinWeightKg('');
    setRecoveryTimeMins('');
    setMinSpeedKh('');
    setMaxTimeMins('');
    setIsExpertMode(false);
    setRulesJsonString(JSON.stringify(DEFAULT_RULES, null, 2));
    setJsonError(null);
    setFormError(null);
  };

  const loadFromType = (typeName: string, rules?: CompetitionRules) => {
    setName(typeName);
    const activeRules = rules || {};
    syncFieldsFromRules(activeRules);
    setRulesJsonString(JSON.stringify(activeRules, null, 2));
    setJsonError(null);
    setFormError(null);
  };

  // Generate payload for form submission
  const getRulesPayload = (): CompetitionRules | null => {
    if (isExpertMode) {
      // Validate JSON first
      if (jsonError) {
        setFormError('Por favor corrija los errores del JSON de reglas.');
        return null;
      }
      try {
        const parsed = JSON.parse(rulesJsonString);
        if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
          setFormError('Las reglas predefinidas deben ser un objeto JSON válido.');
          return null;
        }
        return parsed as CompetitionRules;
      } catch (err: any) {
        setFormError(`El JSON de reglas no es válido: ${err.message}`);
        return null;
      }
    } else {
      return buildRulesFromFields();
    }
  };

  return {
    name,
    setName,
    maxHeartRate,
    setMaxHeartRate,
    minWeightKg,
    setMinWeightKg,
    recoveryTimeMins,
    setRecoveryTimeMins,
    minSpeedKh,
    setMinSpeedKh,
    maxTimeMins,
    setMaxTimeMins,
    isExpertMode,
    setIsExpertMode,
    rulesJsonString,
    setRulesJsonString,
    jsonError,
    formError,
    setFormError,
    resetForm,
    loadFromType,
    getRulesPayload,
    handleFieldChange,
    handleJsonChange,
  };
}
