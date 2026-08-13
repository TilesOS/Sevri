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
          project_goal: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          full_name: string;
          student_stage: string;
          project_goal?: string | null;
          created_at?: string;
          updated_at?: string;
        };
      };
      intakes: {
        Row: {
          id: string;
          user_id: string;
          interests: string[];
          favorite_subjects: string[];
          project_goal: string;
          success_definition: string;
          open_to_anything: boolean;
          format_preferences: string[];
          preference_notes: string | null;
          experience_level: string;
          existing_skills: string[];
          available_resources: string | null;
          weekly_time_available: number;
          completion_date: string | null;
          budget_constraints: string | null;
          preferred_challenge: string;
          other_constraints: string | null;
          raw_answers_json: Json;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          interests: string[];
          favorite_subjects: string[];
          project_goal: string;
          success_definition: string;
          open_to_anything?: boolean;
          format_preferences?: string[];
          preference_notes?: string | null;
          experience_level: string;
          existing_skills?: string[];
          available_resources?: string | null;
          weekly_time_available: number;
          completion_date?: string | null;
          budget_constraints?: string | null;
          preferred_challenge?: string;
          other_constraints?: string | null;
          raw_answers_json: Json;
          created_at?: string;
        };
      };
      normalized_profiles: {
        Row: {
          id: string;
          user_id: string;
          intake_id: string;
          summary: string;
          interpreted_interests: string[];
          skill_assessment: string;
          risk_flags: string[];
          project_context_json: Json;
          raw_model_output_json: Json;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          intake_id: string;
          summary: string;
          interpreted_interests: string[];
          skill_assessment: string;
          risk_flags: string[];
          project_context_json?: Json;
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
          project_kind_label: string;
          repository_relevance: string;
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
          project_blueprint_json: Json;
          grounding_sources_json: Json;
          raw_model_output_json: Json;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          intake_id: string;
          normalized_profile_id: string;
          project_kind_label: string;
          repository_relevance?: string;
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
          project_blueprint_json?: Json;
          grounding_sources_json?: Json;
          raw_model_output_json: Json;
          created_at?: string;
        };
      };
      projects: {
        Row: {
          id: string;
          user_id: string;
          recommendation_id: string;
          project_kind_label: string;
          repository_relevance: string;
          title: string;
          status: string;
          archived_at: string | null;
          selection_operation_id: string;
          last_meaningful_activity_at: string;
          selected_at: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          recommendation_id: string;
          project_kind_label: string;
          repository_relevance?: string;
          title: string;
          status?: string;
          archived_at?: string | null;
          selection_operation_id?: string;
          last_meaningful_activity_at?: string;
          selected_at?: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          recommendation_id?: string;
          project_kind_label?: string;
          repository_relevance?: string;
          title?: string;
          status?: string;
          archived_at?: string | null;
          selection_operation_id?: string;
          last_meaningful_activity_at?: string;
          selected_at?: string;
          created_at?: string;
          updated_at?: string;
        };
      };
      email_preferences: {
        Row: {
          user_id: string;
          lifecycle_enabled: boolean;
          onboarding_default_enabled: boolean;
          enrolled_at: string | null;
          unsubscribed_at: string | null;
          delivery_suppressed_at: string | null;
          delivery_suppression_reason: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          user_id: string;
          lifecycle_enabled?: boolean;
          onboarding_default_enabled?: boolean;
          enrolled_at?: string | null;
          unsubscribed_at?: string | null;
          delivery_suppressed_at?: string | null;
          delivery_suppression_reason?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["email_preferences"]["Insert"]>;
      };
      email_messages: {
        Row: {
          id: string;
          user_id: string;
          project_id: string | null;
          intake_id: string | null;
          message_type: string;
          dedupe_key: string;
          to_email: string;
          from_alias: "hello" | "coach";
          payload_json: Json;
          status: string;
          scheduled_for: string;
          next_attempt_at: string;
          attempt_count: number;
          provider_email_id: string | null;
          last_error: string | null;
          last_event_at: string | null;
          sent_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          project_id?: string | null;
          intake_id?: string | null;
          message_type: string;
          dedupe_key: string;
          to_email: string;
          from_alias: "hello" | "coach";
          payload_json?: Json;
          status?: string;
          scheduled_for?: string;
          next_attempt_at?: string;
          attempt_count?: number;
          provider_email_id?: string | null;
          last_error?: string | null;
          last_event_at?: string | null;
          sent_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["email_messages"]["Insert"]>;
      };
      email_webhook_events: {
        Row: {
          provider_event_id: string;
          provider_email_id: string | null;
          event_type: string;
          occurred_at: string;
          received_at: string;
          processed_at: string | null;
        };
        Insert: {
          provider_event_id: string;
          provider_email_id?: string | null;
          event_type: string;
          occurred_at: string;
          received_at?: string;
          processed_at?: string | null;
        };
        Update: Partial<Database["public"]["Tables"]["email_webhook_events"]["Insert"]>;
      };
      email_planner_state: {
        Row: {
          planner_key: string;
          cursor_user_id: string | null;
          updated_at: string;
        };
        Insert: {
          planner_key: string;
          cursor_user_id?: string | null;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["email_planner_state"]["Insert"]>;
      };
      project_roadmaps: {
        Row: {
          id: string;
          project_id: string;
          overview: string;
          core_scope: string;
          artifact_plan: Json;
          project_overview_draft: string;
          stretch_goals: string[];
          explanation_guide: Json;
          roadmap_context_json: Json;
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
          overview: string;
          core_scope: string;
          artifact_plan: Json;
          project_overview_draft: string;
          stretch_goals: string[];
          explanation_guide: Json;
          roadmap_context_json?: Json;
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
          project_id?: string;
          overview?: string;
          core_scope?: string;
          artifact_plan?: Json;
          project_overview_draft?: string;
          stretch_goals?: string[];
          explanation_guide?: Json;
          roadmap_context_json?: Json;
          scheduled_start_date?: string | null;
          scheduled_end_date?: string | null;
          schedule_timezone?: string;
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
          submission_kind: "pasted_text" | "artifact_bundle";
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
          submission_kind: "pasted_text" | "artifact_bundle";
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
          submission_kind?: "pasted_text" | "artifact_bundle";
          submission_text?: string | null;
          submission_filename?: string | null;
          storage_path?: string | null;
          created_at?: string;
          updated_at?: string;
        };
      };
      milestone_submission_artifacts: {
        Row: {
          id: string;
          submission_id: string;
          owner_user_id: string;
          upload_path: string | null;
          external_url: string | null;
          display_name: string;
          mime_type: string | null;
          size_bytes: number | null;
          caption: string | null;
          alt_text: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          submission_id: string;
          owner_user_id: string;
          upload_path?: string | null;
          external_url?: string | null;
          display_name: string;
          mime_type?: string | null;
          size_bytes?: number | null;
          caption?: string | null;
          alt_text?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["milestone_submission_artifacts"]["Insert"]>;
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
      milestone_reviews: {
        Row: {
          id: string;
          milestone_id: string;
          reviewer_user_id: string;
          submission_id: string | null;
          strength: string;
          tighten: string;
          next_action: string;
          ready_to_mark_complete: boolean;
          created_at: string;
          superseded_at: string | null;
        };
        Insert: {
          id?: string;
          milestone_id: string;
          reviewer_user_id: string;
          submission_id?: string | null;
          strength: string;
          tighten: string;
          next_action: string;
          ready_to_mark_complete: boolean;
          created_at?: string;
          superseded_at?: string | null;
        };
        Update: Partial<Database["public"]["Tables"]["milestone_reviews"]["Insert"]>;
      };
      deadline_extension_events: {
        Row: {
          id: string;
          user_id: string;
          project_id: string;
          milestone_id: string | null;
          item_type: "milestone" | "project_end";
          previous_date: string;
          requested_date: string;
          move_mode: "move_only" | "rebalance_downstream";
          extension_number: number;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          project_id: string;
          milestone_id?: string | null;
          item_type: "milestone" | "project_end";
          previous_date: string;
          requested_date: string;
          move_mode: "move_only" | "rebalance_downstream";
          extension_number: number;
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          project_id?: string;
          milestone_id?: string | null;
          item_type?: "milestone" | "project_end";
          previous_date?: string;
          requested_date?: string;
          move_mode?: "move_only" | "rebalance_downstream";
          extension_number?: number;
          created_at?: string;
        };
      };
      user_integrations: {
        Row: {
          id: string;
          user_id: string;
          provider: "github" | "google_calendar";
          access_token_encrypted: string;
          refresh_token_encrypted: string | null;
          token_expires_at: string | null;
          scopes: string[];
          provider_user_id: string;
          provider_username: string;
          status: "active" | "revoked" | "invalid";
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          provider: "github" | "google_calendar";
          access_token_encrypted: string | Buffer;
          refresh_token_encrypted?: string | Buffer | null;
          token_expires_at?: string | null;
          scopes?: string[];
          provider_user_id: string;
          provider_username: string;
          status?: "active" | "revoked" | "invalid";
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          provider?: "github" | "google_calendar";
          access_token_encrypted?: string | Buffer;
          refresh_token_encrypted?: string | Buffer | null;
          token_expires_at?: string | null;
          scopes?: string[];
          provider_user_id?: string;
          provider_username?: string;
          status?: "active" | "revoked" | "invalid";
          created_at?: string;
          updated_at?: string;
        };
      };
      google_calendar_sync_settings: {
        Row: {
          id: string;
          user_id: string;
          integration_id: string;
          calendar_id: string | null;
          calendar_summary: string;
          sync_enabled: boolean;
          status: "active" | "invalid" | "error";
          last_synced_at: string | null;
          last_error: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          integration_id: string;
          calendar_id?: string | null;
          calendar_summary?: string;
          sync_enabled?: boolean;
          status?: "active" | "invalid" | "error";
          last_synced_at?: string | null;
          last_error?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          integration_id?: string;
          calendar_id?: string | null;
          calendar_summary?: string;
          sync_enabled?: boolean;
          status?: "active" | "invalid" | "error";
          last_synced_at?: string | null;
          last_error?: string | null;
          created_at?: string;
          updated_at?: string;
        };
      };
      google_calendar_sync_events: {
        Row: {
          id: string;
          user_id: string;
          project_id: string;
          item_key: string;
          item_type: "project_start" | "milestone" | "project_end" | "work_session";
          google_calendar_id: string;
          google_event_id: string;
          last_synced_hash: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          project_id: string;
          item_key: string;
          item_type: "project_start" | "milestone" | "project_end" | "work_session";
          google_calendar_id: string;
          google_event_id: string;
          last_synced_hash: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          project_id?: string;
          item_key?: string;
          item_type?: "project_start" | "milestone" | "project_end" | "work_session";
          google_calendar_id?: string;
          google_event_id?: string;
          last_synced_hash?: string;
          created_at?: string;
          updated_at?: string;
        };
      };
      project_work_sessions: {
        Row: {
          id: string;
          user_id: string;
          project_id: string;
          milestone_id: string | null;
          local_date: string;
          local_time: string;
          schedule_timezone: string;
          trigger_context: string;
          work_description: string;
          location: string | null;
          duration_minutes: number;
          completed_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          project_id: string;
          milestone_id?: string | null;
          local_date: string;
          local_time: string;
          schedule_timezone?: string;
          trigger_context?: string;
          work_description: string;
          location?: string | null;
          duration_minutes: number;
          completed_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          project_id?: string;
          milestone_id?: string | null;
          local_date?: string;
          local_time?: string;
          schedule_timezone?: string;
          trigger_context?: string;
          work_description?: string;
          location?: string | null;
          duration_minutes?: number;
          completed_at?: string | null;
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
          project_id?: string | null;
          milestone_id?: string | null;
          created_at?: string;
          updated_at?: string;
        };
      };
      portfolio_featured_artifacts: {
        Row: {
          portfolio_entry_id: string;
          artifact_id: string;
          owner_user_id: string;
          display_order: number;
          public_caption: string;
          public_alt_text: string;
          created_at: string;
        };
        Insert: {
          portfolio_entry_id: string;
          artifact_id: string;
          owner_user_id: string;
          display_order?: number;
          public_caption: string;
          public_alt_text: string;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["portfolio_featured_artifacts"]["Insert"]>;
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
      auth_rate_limits: {
        Row: {
          id: string;
          bucket: string;
          key_hash: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          bucket: string;
          key_hash: string;
          created_at?: string;
        };
      };
    };
    Functions: {
      claim_email_messages: {
        Args: { p_limit?: number; p_now?: string };
        Returns: Database["public"]["Tables"]["email_messages"]["Row"][];
      };
      select_project_from_recommendation: {
        Args: {
          p_recommendation_id: string;
          p_operation_id: string;
          p_allow_duplicate?: boolean;
        };
        Returns: {
          project_id: string;
          project_title: string;
          project_kind_label: string;
          repository_relevance: string;
          selection_outcome: "created" | "replayed" | "duplicate";
        }[];
      };
      create_milestone_submission_with_pending_evaluation: {
        Args: {
          p_milestone_id: string;
          p_submission_kind: "pasted_text" | "artifact_bundle";
          p_submission_text: string;
          p_submission_filename?: string | null;
        };
        Returns: {
          submission_id: string;
          submission_kind: "pasted_text" | "artifact_bundle";
          submission_filename: string | null;
          submission_created_at: string;
          submission_updated_at: string;
          evaluation_id: string;
          evaluation_status: "pending" | "completed" | "failed";
          evaluation_created_at: string;
          evaluation_updated_at: string;
        }[];
      };
      create_milestone_artifact_bundle_with_pending_evaluation: {
        Args: { p_milestone_id: string; p_submission_text: string; p_artifacts: Json };
        Returns: { submission_id: string; evaluation_id: string }[];
      };
      set_portfolio_featured_artifacts: { Args: { p_entry_id: string; p_artifact_ids: string[] }; Returns: undefined };
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
