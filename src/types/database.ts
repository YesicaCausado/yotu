// Tipos de la base de datos. Escritos a mano siguiendo el formato de
// `supabase gen types typescript`; cuando el proyecto esté enlazado, se pueden
// regenerar con: npx supabase gen types typescript --linked > src/types/database.ts

export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
  __InternalSupabase: {
    PostgrestVersion: "12";
  };
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          display_name: string;
          avatar_path: string | null;
          birthday: string | null;
          timezone: string;
          created_at: string;
          updated_at: string;
        };
        Insert: never;
        Update: {
          display_name?: string;
          avatar_path?: string | null;
          birthday?: string | null;
          timezone?: string;
        };
        Relationships: [];
      };
      couples: {
        Row: {
          id: string;
          name: string | null;
          anniversary_date: string | null;
          timezone: string;
          created_by: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: never;
        Update: {
          name?: string | null;
          anniversary_date?: string | null;
          timezone?: string;
        };
        Relationships: [];
      };
      couple_members: {
        Row: {
          couple_id: string;
          user_id: string;
          joined_at: string;
        };
        Insert: never;
        Update: never;
        Relationships: [
          {
            foreignKeyName: "couple_members_couple_id_fkey";
            columns: ["couple_id"];
            isOneToOne: false;
            referencedRelation: "couples";
            referencedColumns: ["id"];
          },
        ];
      };
      couple_invitations: {
        Row: {
          id: string;
          couple_id: string;
          created_by: string;
          created_at: string;
          expires_at: string;
          accepted_by: string | null;
          accepted_at: string | null;
          revoked_at: string | null;
        };
        Insert: never;
        Update: never;
        Relationships: [];
      };
      appointments: {
        Row: {
          id: string;
          couple_id: string;
          request_key: string;
          created_by: string | null;
          title: string;
          description: string | null;
          date: string;
          start_time: string;
          end_time: string | null;
          location: string | null;
          category: string;
          image_path: string | null;
          budget: number | null;
          budget_mode: BudgetMode;
          budget_currency: "COP";
          notes: string | null;
          status: string;
          is_surprise: boolean;
          reveal_at: string | null;
          starts_at: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          couple_id: string;
          request_key: string;
          created_by?: string | null;
          title: string;
          description?: string | null;
          date: string;
          start_time: string;
          end_time?: string | null;
          location?: string | null;
          category: string;
          image_path?: string | null;
          budget?: number | null;
          budget_mode?: BudgetMode;
          budget_currency?: "COP";
          notes?: string | null;
          status?: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          title?: string;
          description?: string | null;
          date?: string;
          start_time?: string;
          end_time?: string | null;
          location?: string | null;
          category?: string;
          image_path?: string | null;
          budget?: number | null;
          budget_mode?: BudgetMode;
          budget_currency?: "COP";
          notes?: string | null;
          status?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "appointments_couple_id_fkey";
            columns: ["couple_id"];
            isOneToOne: false;
            referencedRelation: "couples";
            referencedColumns: ["id"];
          },
        ];
      };
      personal_activities: {
        Row: {
          id: string;
          couple_id: string;
          user_id: string;
          request_key: string;
          activity_date: string;
          start_time: string;
          end_time: string;
          visibility: string;
          created_at: string;
          updated_at: string;
        };
        Insert: never;
        Update: never;
        Relationships: [
          {
            foreignKeyName: "personal_activities_couple_id_fkey";
            columns: ["couple_id"];
            isOneToOne: false;
            referencedRelation: "couples";
            referencedColumns: ["id"];
          },
        ];
      };
      personal_activity_details: {
        Row: {
          activity_id: string;
          user_id: string;
          title: string;
          description: string | null;
          category: string;
          location: string | null;
          personal_notes: string | null;
          color: string;
        };
        Insert: never;
        Update: never;
        Relationships: [
          {
            foreignKeyName: "personal_activity_details_owner_fkey";
            columns: ["activity_id", "user_id"];
            isOneToOne: true;
            referencedRelation: "personal_activities";
            referencedColumns: ["id", "user_id"];
          },
        ];
      };
      personal_day_notes: {
        Row: {
          id: string;
          user_id: string;
          request_key: string;
          note_date: string;
          title: string;
          content: string | null;
          reminder_at: string | null;
          is_task: boolean;
          is_completed: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id?: string;
          request_key: string;
          note_date: string;
          title: string;
          content?: string | null;
          reminder_at?: string | null;
          is_task?: boolean;
          is_completed?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          note_date?: string;
          title?: string;
          content?: string | null;
          reminder_at?: string | null;
          is_task?: boolean;
          is_completed?: boolean;
          updated_at?: string;
        };
        Relationships: [];
      };
      calendar_sync_state: {
        Row: {
          couple_id: string;
          version: number;
          updated_at: string;
        };
        Insert: never;
        Update: never;
        Relationships: [
          {
            foreignKeyName: "calendar_sync_state_couple_id_fkey";
            columns: ["couple_id"];
            isOneToOne: true;
            referencedRelation: "couples";
            referencedColumns: ["id"];
          },
        ];
      };
      appointment_budget_proposals: {
        Row: {
          id: string;
          appointment_id: string;
          couple_id: string;
          request_key: string;
          proposer_id: string;
          recipient_id: string;
          proposer_amount: number;
          recipient_amount: number;
          message: string | null;
          status: BudgetProposalStatus;
          parent_proposal_id: string | null;
          responded_by: string | null;
          created_at: string;
          responded_at: string | null;
        };
        Insert: never;
        Update: never;
        Relationships: [];
      };
      appointment_budget_agreements: {
        Row: {
          appointment_id: string;
          couple_id: string;
          first_user_id: string;
          first_amount: number;
          second_user_id: string;
          second_amount: number;
          total_amount: number;
          accepted_proposal_id: string;
          updated_at: string;
        };
        Insert: never;
        Update: never;
        Relationships: [];
      };
      appointment_expenses: {
        Row: {
          id: string;
          appointment_id: string;
          couple_id: string;
          request_key: string;
          created_by: string;
          concept: string;
          amount: number;
          paid_by: string;
          covered_by: string;
          created_at: string;
          updated_at: string;
        };
        Insert: never;
        Update: never;
        Relationships: [];
      };
      appointment_budget_notifications: {
        Row: {
          id: string;
          couple_id: string;
          appointment_id: string;
          recipient_id: string;
          actor_id: string | null;
          proposal_id: string | null;
          event_type: BudgetNotificationType;
          created_at: string;
          seen_at: string | null;
        };
        Insert: never;
        Update: { seen_at?: string | null };
        Relationships: [];
      };
      appointment_surprise_details: {
        Row: {
          appointment_id: string;
          couple_id: string;
          title: string;
          description: string | null;
          appointment_date: string;
          appointment_start_time: string;
          appointment_end_time: string | null;
          starts_at: string;
          location: string | null;
          category: string;
          image_path: string | null;
          notes: string | null;
        };
        Insert: never;
        Update: never;
        Relationships: [];
      };
      appointment_surprise_notifications: {
        Row: {
          id: string;
          couple_id: string;
          appointment_id: string;
          recipient_id: string;
          actor_id: string | null;
          event_type: SurpriseNotificationType;
          created_at: string;
          seen_at: string | null;
        };
        Insert: never;
        Update: { seen_at?: string | null };
        Relationships: [];
      };
      couple_talk_threads: {
        Row: {
          id: string;
          couple_id: string;
          created_by: string;
          request_key: string;
          category: CoupleTalkCategory;
          story: string;
          emotions: CoupleTalkEmotion[];
          needs: CoupleTalkNeed[];
          expectation: CoupleTalkExpectation;
          personal_message: string | null;
          visibility: CoupleTalkVisibility;
          status: CoupleTalkStatus;
          read_by: string[];
          resolution_votes: string[];
          pause_requested_by: string | null;
          pause_requested_at: string | null;
          shared_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: never;
        Update: never;
        Relationships: [];
      };
      couple_talk_messages: {
        Row: {
          id: string;
          thread_id: string;
          couple_id: string;
          author_id: string;
          request_key: string;
          quick_reply: CoupleTalkQuickReply | null;
          body: string | null;
          emotions: CoupleTalkEmotion[];
          needs: CoupleTalkNeed[];
          created_at: string;
        };
        Insert: never;
        Update: never;
        Relationships: [];
      };
      couple_talk_agreements: {
        Row: {
          id: string;
          thread_id: string;
          couple_id: string;
          request_key: string;
          proposed_by: string;
          description: string;
          accepted_by: string[];
          rejected_by: string | null;
          status: CoupleTalkAgreementStatus;
          created_at: string;
          updated_at: string;
        };
        Insert: never;
        Update: never;
        Relationships: [];
      };
      couple_talk_notifications: {
        Row: {
          id: string;
          couple_id: string;
          thread_id: string;
          recipient_id: string;
          actor_id: string | null;
          event_type: CoupleTalkNotificationType;
          created_at: string;
          seen_at: string | null;
        };
        Insert: never;
        Update: { seen_at?: string | null };
        Relationships: [];
      };
    };
    Views: { [_ in never]: never };
    Functions: {
      create_couple: {
        Args: { p_name?: string | null; p_anniversary_date?: string | null; p_timezone?: string };
        Returns: string;
      };
      create_invitation: {
        Args: Record<string, never>;
        Returns: { token: string; expires_at: string }[];
      };
      get_invitation_preview: {
        Args: { p_token: string };
        Returns: { status: InvitationStatus; inviter_name: string | null; expires_at: string | null }[];
      };
      accept_invitation: {
        Args: { p_token: string };
        Returns: string;
      };
      revoke_invitation: {
        Args: { p_invitation_id: string };
        Returns: undefined;
      };
      leave_couple: {
        Args: Record<string, never>;
        Returns: undefined;
      };
      current_couple_id: {
        Args: Record<string, never>;
        Returns: string | null;
      };
      save_personal_activity: {
        Args: {
          p_activity_id: string | null;
          p_request_key: string;
          p_title: string;
          p_description: string | null;
          p_activity_date: string;
          p_start_time: string;
          p_end_time: string;
          p_category: string;
          p_location: string | null;
          p_personal_notes: string | null;
          p_color: string;
          p_visibility: string;
        };
        Returns: string;
      };
      delete_personal_activity: {
        Args: { p_activity_id: string };
        Returns: undefined;
      };
      get_calendar_activities: {
        Args: { p_from: string; p_to: string };
        Returns: {
          id: string;
          owner_id: string;
          activity_date: string;
          start_time: string;
          end_time: string;
          visibility: string;
          color: string;
          title: string | null;
          description: string | null;
          category: string | null;
          location: string | null;
          personal_notes: string | null;
        }[];
      };
      create_appointment_budget_proposal: {
        Args: {
          p_appointment_id: string;
          p_request_key: string;
          p_proposer_amount: number;
          p_recipient_amount: number;
          p_message: string | null;
        };
        Returns: string;
      };
      respond_to_appointment_budget_proposal: {
        Args: {
          p_proposal_id: string;
          p_action: "accept" | "reject" | "counter";
          p_request_key: string | null;
          p_proposer_amount: number | null;
          p_recipient_amount: number | null;
          p_message: string | null;
        };
        Returns: string;
      };
      add_appointment_expense: {
        Args: {
          p_appointment_id: string;
          p_request_key: string;
          p_concept: string;
          p_amount: number;
          p_paid_by: string;
          p_covered_by: string;
        };
        Returns: string;
      };
      create_or_update_surprise_appointment: {
        Args: {
          p_appointment_id: string | null;
          p_request_key: string;
          p_title: string;
          p_description: string | null;
          p_appointment_date: string;
          p_appointment_start_time: string;
          p_appointment_end_time: string | null;
          p_reveal_at: string;
          p_location: string | null;
          p_category: string;
          p_image_path: string | null;
          p_notes: string | null;
        };
        Returns: string;
      };
      sync_appointment_surprise_notifications: {
        Args: Record<string, never>;
        Returns: undefined;
      };
      save_couple_talk_entry: {
        Args: {
          p_thread_id: string | null;
          p_request_key: string;
          p_action: "draft" | "share";
          p_category: string;
          p_story: string;
          p_emotions: string[];
          p_needs: string[];
          p_expectation: string;
          p_personal_message: string | null;
        };
        Returns: string;
      };
      delete_couple_talk_draft: {
        Args: { p_thread_id: string };
        Returns: undefined;
      };
      mark_couple_talk_read: {
        Args: { p_thread_id: string };
        Returns: undefined;
      };
      add_couple_talk_message: {
        Args: {
          p_thread_id: string;
          p_request_key: string;
          p_quick_reply: string | null;
          p_body: string | null;
          p_emotions: string[];
          p_needs: string[];
        };
        Returns: string;
      };
      set_couple_talk_progress: {
        Args: { p_thread_id: string };
        Returns: undefined;
      };
      set_couple_talk_pause: {
        Args: { p_thread_id: string; p_paused: boolean };
        Returns: undefined;
      };
      set_couple_talk_resolution: {
        Args: { p_thread_id: string; p_ready: boolean };
        Returns: CoupleTalkStatus;
      };
      propose_couple_talk_agreement: {
        Args: { p_thread_id: string; p_request_key: string; p_description: string };
        Returns: string;
      };
      respond_to_couple_talk_agreement: {
        Args: { p_agreement_id: string; p_accept: boolean };
        Returns: undefined;
      };
    };
    Enums: { [_ in never]: never };
    CompositeTypes: { [_ in never]: never };
  };
};

export type InvitationStatus =
  | "valid"
  | "invalid"
  | "revoked"
  | "used"
  | "expired"
  | "own"
  | "already_in_couple"
  | "couple_full";

type PublicTables = Database["public"]["Tables"];
export type Profile = PublicTables["profiles"]["Row"];
export type Couple = PublicTables["couples"]["Row"];
export type CoupleMember = PublicTables["couple_members"]["Row"];
export type CoupleInvitation = PublicTables["couple_invitations"]["Row"];
export type Appointment = PublicTables["appointments"]["Row"];
export type PersonalActivity = PublicTables["personal_activities"]["Row"];
export type PersonalActivityDetails = PublicTables["personal_activity_details"]["Row"];
export type PersonalDayNote = PublicTables["personal_day_notes"]["Row"];
export type CalendarSyncState = PublicTables["calendar_sync_state"]["Row"];

export type PersonalActivityCategory =
  | "university"
  | "work"
  | "study"
  | "exercise"
  | "errands"
  | "family"
  | "personal"
  | "rest"
  | "other";
export type ActivityVisibility = "private" | "availability" | "shared";
export type BudgetMode = "invites" | "accepts_contributions" | "split" | "shared_budget";
export type BudgetProposalStatus = "pending" | "accepted" | "rejected" | "countered";
export type BudgetNotificationType =
  | "proposal_received"
  | "proposal_accepted"
  | "proposal_rejected"
  | "counteroffer_received"
  | "agreement_confirmed"
  | "budget_updated";
export type SurpriseNotificationType =
  | "surprise_received"
  | "surprise_revealed"
  | "date_approaching"
  | "date_started";
export type CoupleTalkVisibility = "draft" | "shared";
export type CoupleTalkStatus =
  | "draft"
  | "pending_read"
  | "read"
  | "conversation"
  | "in_progress"
  | "resolved";
export type CoupleTalkCategory =
  | "argument"
  | "upset"
  | "ignored"
  | "distant"
  | "disappointed"
  | "important"
  | "pending"
  | "other";
export type CoupleTalkEmotion =
  | "sadness"
  | "anger"
  | "disappointment"
  | "frustration"
  | "anxiety"
  | "hurt"
  | "confusion"
  | "loneliness"
  | "vulnerable"
  | "affection"
  | "calm"
  | "exhausted";
export type CoupleTalkNeed =
  | "listen"
  | "affection"
  | "talk"
  | "apology"
  | "love"
  | "space"
  | "agreement"
  | "solution"
  | "understand"
  | "recognize";
export type CoupleTalkExpectation =
  | "talk_now"
  | "before_sleep"
  | "partner_initiative"
  | "time_to_think"
  | "reconcile"
  | "express_only";
export type CoupleTalkQuickReply = "talk_solve" | "affection" | "listen" | "understand" | "think";
export type CoupleTalkAgreementStatus = "pending" | "accepted" | "rejected";
export type CoupleTalkNotificationType =
  | "entry_shared"
  | "message_received"
  | "pause_requested"
  | "resolution_requested"
  | "thread_resolved"
  | "agreement_proposed"
  | "agreement_accepted"
  | "agreement_rejected";
export type CoupleTalkThread = PublicTables["couple_talk_threads"]["Row"];
export type CoupleTalkMessage = PublicTables["couple_talk_messages"]["Row"];
export type CoupleTalkAgreement = PublicTables["couple_talk_agreements"]["Row"];
export type CoupleTalkNotification = PublicTables["couple_talk_notifications"]["Row"];
