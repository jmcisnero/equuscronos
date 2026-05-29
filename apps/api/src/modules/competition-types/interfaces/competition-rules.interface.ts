export interface CompetitionRules {
  max_heart_rate?: number;
  min_weight?: number;
  min_weight_kg?: number;
  recovery_time_mins?: number;
  max_time_mins?: number;
  min_speed_kh?: number;
  [key: string]: string | number | boolean | undefined;
}
