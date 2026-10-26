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
