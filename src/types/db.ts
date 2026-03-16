export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          user_id: string;
          full_name: string;
          student_stage: string;
          target_outcome: string;
          project_track: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          full_name: string;
          student_stage: string;
          target_outcome: string;
          project_track?: string;
          created_at?: string;
          updated_at?: string;
        };
      };
      intakes: {
        Row: {
          id: string;
          user_id: string;
          project_track: string;
          interests: string[];
          favorite_subjects: string[];
          coding_experience: string | null;
          weekly_time_available: number;
          preferred_project_style: string | null;
          known_tools: string[];
          target_schools_or_companies: string[];
          preferred_difficulty: string | null;
          constraints: string | null;
          track_payload_json: Json;
          raw_answers_json: Json;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          project_track?: string;
          interests: string[];
          favorite_subjects: string[];
          coding_experience?: string | null;
          weekly_time_available: number;
          preferred_project_style?: string | null;
          known_tools?: string[];
          target_schools_or_companies?: string[];
          preferred_difficulty?: string | null;
          constraints?: string | null;
          track_payload_json?: Json;
          raw_answers_json: Json;
          created_at?: string;
        };
      };
      normalized_profiles: {
        Row: {
          id: string;
          user_id: string;
          intake_id: string;
          project_track: string;
          summary: string;
          interpreted_interests: string[];
          skill_assessment: string;
          risk_flags: string[];
          track_payload_json: Json;
          raw_model_output_json: Json;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          intake_id: string;
          project_track?: string;
          summary: string;
          interpreted_interests: string[];
          skill_assessment: string;
          risk_flags: string[];
          track_payload_json?: Json;
          raw_model_output_json: Json;
          created_at?: string;
        };
      };
      project_recommendations: {
        Row: {
          id: string;
          user_id: string;
          intake_id: string;
          normalized_profile_id: string;
          project_track: string;
          title: string;
          summary: string;
          rationale: string;
          difficulty: string;
          estimated_weeks: number;
          weekly_hours: number;
          skills_demonstrated: string[];
          tools_needed: string[];
          impressiveness_score: number;
          finishability_score: number;
          authenticity_note: string;
          track_payload_json: Json;
          raw_model_output_json: Json;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          intake_id: string;
          normalized_profile_id: string;
          project_track?: string;
          title: string;
          summary: string;
          rationale: string;
          difficulty: string;
          estimated_weeks: number;
          weekly_hours: number;
          skills_demonstrated: string[];
          tools_needed: string[];
          impressiveness_score: number;
          finishability_score: number;
          authenticity_note: string;
          track_payload_json?: Json;
          raw_model_output_json: Json;
          created_at?: string;
        };
      };
      projects: {
        Row: {
          id: string;
          user_id: string;
          recommendation_id: string;
          project_track: string;
          title: string;
          status: string;
          selected_at: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          recommendation_id: string;
          project_track?: string;
          title: string;
          status?: string;
          selected_at?: string;
          created_at?: string;
          updated_at?: string;
        };
      };
      project_roadmaps: {
        Row: {
          id: string;
          project_id: string;
          project_track: string;
          overview: string;
          mvp_scope: string;
          repo_structure: Json;
          readme_draft: string;
          stretch_goals: string[];
          explanation_guide: Json;
          track_payload_json: Json;
          raw_model_output_json: Json;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          project_id: string;
          project_track?: string;
          overview: string;
          mvp_scope: string;
          repo_structure: Json;
          readme_draft: string;
          stretch_goals: string[];
          explanation_guide: Json;
          track_payload_json?: Json;
          raw_model_output_json: Json;
          created_at?: string;
          updated_at?: string;
        };
      };
      milestones: {
        Row: {
          id: string;
          project_id: string;
          order_index: number;
          title: string;
          description: string;
          objective: string | null;
          deliverable: string | null;
          rough_time_estimate: string | null;
          completed: boolean;
          completed_at: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          project_id: string;
          order_index: number;
          title: string;
          description: string;
          objective?: string | null;
          deliverable?: string | null;
          rough_time_estimate?: string | null;
          completed?: boolean;
          completed_at?: string | null;
          created_at?: string;
        };
      };
      milestone_guidance: {
        Row: {
          id: string;
          milestone_id: string;
          guidance_json: Json;
          email_payload_json: Json;
          raw_model_output_json: Json;
          generation_version: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          milestone_id: string;
          guidance_json: Json;
          email_payload_json: Json;
          raw_model_output_json: Json;
          generation_version: string;
          created_at?: string;
          updated_at?: string;
        };
      };
      subscriptions: {
        Row: {
          id: string;
          user_id: string;
          stripe_customer_id: string | null;
          stripe_subscription_id: string | null;
          stripe_checkout_session_id: string | null;
          plan: "free" | "pro_monthly";
          status: string;
          current_period_end: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          stripe_customer_id?: string | null;
          stripe_subscription_id?: string | null;
          stripe_checkout_session_id?: string | null;
          plan?: "free" | "pro_monthly";
          status?: string;
          current_period_end?: string | null;
          created_at?: string;
          updated_at?: string;
        };
      };
      usage_events: {
        Row: {
          id: string;
          user_id: string;
          event_type: string;
          metadata_json: Json;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          event_type: string;
          metadata_json?: Json;
          created_at?: string;
        };
      };
    };
  };
}
