export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "13.0.5"
  }
  public: {
    Tables: {
      medical_history: {
        Row: {
          allergies: string[] | null
          attack_history: Json | null
          chronic_conditions: string[] | null
          created_at: string | null
          current_symptoms: string[] | null
          diagnosis_date: string | null
          diagnosis_status: boolean
          family_history: boolean | null
          id: string
          known_triggers: string[] | null
          respiratory_issues: string[] | null
          smoking_status: string | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          allergies?: string[] | null
          attack_history?: Json | null
          chronic_conditions?: string[] | null
          created_at?: string | null
          current_symptoms?: string[] | null
          diagnosis_date?: string | null
          diagnosis_status: boolean
          family_history?: boolean | null
          id?: string
          known_triggers?: string[] | null
          respiratory_issues?: string[] | null
          smoking_status?: string | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          allergies?: string[] | null
          attack_history?: Json | null
          chronic_conditions?: string[] | null
          created_at?: string | null
          current_symptoms?: string[] | null
          diagnosis_date?: string | null
          diagnosis_status?: boolean
          family_history?: boolean | null
          id?: string
          known_triggers?: string[] | null
          respiratory_issues?: string[] | null
          smoking_status?: string | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      monitoring_data: {
        Row: {
          attack_prediction: boolean | null
          co: number | null
          created_at: string | null
          grass_pollen: number | null
          ground_truth: boolean | null
          ground_truth_updated_at: string | null
          heart_rate: number | null
          id: string
          latitude: number | null
          longitude: number | null
          nh3: number | null
          no: number | null
          no2: number | null
          o3: number | null
          pm10: number | null
          pm2_5: number | null
          prediction_confidence: number | null
          pressure: number | null
          so2: number | null
          temperature: number | null
          timestamp: string | null
          tree_pollen: number | null
          user_id: string
          weed_pollen: number | null
        }
        Insert: {
          attack_prediction?: boolean | null
          co?: number | null
          created_at?: string | null
          grass_pollen?: number | null
          ground_truth?: boolean | null
          ground_truth_updated_at?: string | null
          heart_rate?: number | null
          id?: string
          latitude?: number | null
          longitude?: number | null
          nh3?: number | null
          no?: number | null
          no2?: number | null
          o3?: number | null
          pm10?: number | null
          pm2_5?: number | null
          prediction_confidence?: number | null
          pressure?: number | null
          so2?: number | null
          temperature?: number | null
          timestamp?: string | null
          tree_pollen?: number | null
          user_id: string
          weed_pollen?: number | null
        }
        Update: {
          attack_prediction?: boolean | null
          co?: number | null
          created_at?: string | null
          grass_pollen?: number | null
          ground_truth?: boolean | null
          ground_truth_updated_at?: string | null
          heart_rate?: number | null
          id?: string
          latitude?: number | null
          longitude?: number | null
          nh3?: number | null
          no?: number | null
          no2?: number | null
          o3?: number | null
          pm10?: number | null
          pm2_5?: number | null
          prediction_confidence?: number | null
          pressure?: number | null
          so2?: number | null
          temperature?: number | null
          timestamp?: string | null
          tree_pollen?: number | null
          user_id?: string
          weed_pollen?: number | null
        }
        Relationships: []
      }
      profiles: {
        Row: {
          created_at: string | null
          dob: string
          gender: string
          id: string
          phone_number: string | null
          email_id: string | null
          updated_at: string | null
          username: string
        }
        Insert: {
          created_at?: string | null
          dob: string
          gender: string
          id: string
          phone_number?: string | null
          email_id?: string | null
          updated_at?: string | null
          username: string
        }
        Update: {
          created_at?: string | null
          dob?: string
          gender?: string
          id?: string
          phone_number?: string | null
          email_id?: string | null
          updated_at?: string | null
          username?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {},
  },
} as const
