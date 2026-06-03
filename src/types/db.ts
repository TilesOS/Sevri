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
          scheduled_start_date: string | null;
          scheduled_end_date: string | null;
          schedule_timezone: string;
          schedule_generation_source:
            | "roadmap_generation"
            | "manual_regenerate"
            | "rebalance_downstream"
            | "move_only"
            | null;
          last_schedule_rebalanced_at: string | null;
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
          scheduled_start_date?: string | null;
          scheduled_end_date?: string | null;
          schedule_timezone?: string;
          schedule_generation_source?:
            | "roadmap_generation"
            | "manual_regenerate"
            | "rebalance_downstream"
            | "move_only"
            | null;
          last_schedule_rebalanced_at?: string | null;
          raw_model_output_json: Json;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          recommendation_id?: string;
          project_track?: string;
          title?: string;
          status?: string;
          selected_at?: string;
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
          due_date: string | null;
          schedule_duration_days: number | null;
          is_user_scheduled_override: boolean;
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
          due_date?: string | null;
          schedule_duration_days?: number | null;
          is_user_scheduled_override?: boolean;
          completed?: boolean;
          completed_at?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          project_id?: string;
          order_index?: number;
          title?: string;
          description?: string;
          objective?: string | null;
          deliverable?: string | null;
          rough_time_estimate?: string | null;
          due_date?: string | null;
          schedule_duration_days?: number | null;
          is_user_scheduled_override?: boolean;
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
      milestone_submissions: {
        Row: {
          id: string;
          milestone_id: string;
          user_id: string;
          submission_kind: "pasted_text" | "file_upload";
          submission_text: string | null;
          submission_filename: string | null;
          storage_path: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          milestone_id: string;
          user_id: string;
          submission_kind: "pasted_text" | "file_upload";
          submission_text?: string | null;
          submission_filename?: string | null;
          storage_path?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          milestone_id?: string;
          user_id?: string;
          submission_kind?: "pasted_text" | "file_upload";
          submission_text?: string | null;
          submission_filename?: string | null;
          storage_path?: string | null;
          created_at?: string;
          updated_at?: string;
        };
      };
      milestone_submission_evaluations: {
        Row: {
          id: string;
          submission_id: string;
          user_id: string;
          evaluation_json: Json | null;
          status: "pending" | "completed" | "failed";
          failure_message: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          submission_id: string;
          user_id: string;
          evaluation_json?: Json | null;
          status?: "pending" | "completed" | "failed";
          failure_message?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          submission_id?: string;
          user_id?: string;
          evaluation_json?: Json | null;
          status?: "pending" | "completed" | "failed";
          failure_message?: string | null;
          created_at?: string;
          updated_at?: string;
        };
      };
      generation_feedback: {
        Row: {
          id: string;
          user_id: string;
          stage: "recommendations" | "roadmap" | "step_guidance" | "work_evaluation";
          signal: "good" | "mixed" | "bad";
          notes: string | null;
          normalized_profile_id: string | null;
          closest_recommendation_id: string | null;
          roadmap_id: string | null;
          milestone_guidance_id: string | null;
          submission_evaluation_id: string | null;
          project_track: string | null;
          project_id: string | null;
          milestone_id: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          stage: "recommendations" | "roadmap" | "step_guidance" | "work_evaluation";
          signal: "good" | "mixed" | "bad";
          notes?: string | null;
          normalized_profile_id?: string | null;
          closest_recommendation_id?: string | null;
          roadmap_id?: string | null;
          milestone_guidance_id?: string | null;
          submission_evaluation_id?: string | null;
          project_track?: string | null;
          project_id?: string | null;
          milestone_id?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          stage?: "recommendations" | "roadmap" | "step_guidance" | "work_evaluation";
          signal?: "good" | "mixed" | "bad";
          notes?: string | null;
          normalized_profile_id?: string | null;
          closest_recommendation_id?: string | null;
          roadmap_id?: string | null;
          milestone_guidance_id?: string | null;
          submission_evaluation_id?: string | null;
          project_track?: string | null;
          project_id?: string | null;
          milestone_id?: string | null;
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
    Functions: {
      create_milestone_submission_with_pending_evaluation: {
        Args: {
          p_milestone_id: string;
          p_submission_kind: "pasted_text" | "file_upload";
          p_submission_text: string;
          p_submission_filename?: string | null;
        };
        Returns: {
          submission_id: string;
          submission_kind: "pasted_text" | "file_upload";
          submission_filename: string | null;
          submission_created_at: string;
          submission_updated_at: string;
          evaluation_id: string;
          evaluation_status: "pending" | "completed" | "failed";
          evaluation_created_at: string;
          evaluation_updated_at: string;
        }[];
      };
      complete_milestone_submission_evaluation: {
        Args: {
          p_evaluation_id: string;
          p_evaluation_json: Json;
        };
        Returns: undefined;
      };
      fail_milestone_submission_evaluation: {
        Args: {
          p_evaluation_id: string;
          p_failure_message: string;
        };
        Returns: undefined;
      };
    };
  };
}
