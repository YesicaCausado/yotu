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
