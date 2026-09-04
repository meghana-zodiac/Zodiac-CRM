export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.15";
  };
  public: {
    Tables: {
      bd_team_members: {
        Row: {
          access_role: string;
          access_status: string;
          active: boolean;
          created_at: string;
          display_name: string;
          email: string;
          id: string;
          reviewed_at: string | null;
          reviewed_by: string | null;
          updated_at: string;
        };
        Insert: {
          access_role?: string;
          access_status?: string;
          active?: boolean;
          created_at?: string;
          display_name: string;
          email: string;
          id: string;
          reviewed_at?: string | null;
          reviewed_by?: string | null;
          updated_at?: string;
        };
        Update: {
          access_role?: string;
          access_status?: string;
          active?: boolean;
          created_at?: string;
          display_name?: string;
          email?: string;
          id?: string;
          reviewed_at?: string | null;
          reviewed_by?: string | null;
          updated_at?: string;
        };
        Relationships: [];
      };
      accounts: {
        Row: {
          city: string | null;
          ceipal_client_number: string | null;
          ceipal_id: string | null;
          ceipal_last_synced_at: string | null;
          client_type: string | null;
          created_at: string;
          id: string;
          industry: string | null;
          name: string;
          owner_name: string | null;
          phone: string | null;
          website: string | null;
        };
        Insert: {
          city?: string | null;
          ceipal_client_number?: string | null;
          ceipal_id?: string | null;
          ceipal_last_synced_at?: string | null;
          client_type?: string | null;
          created_at?: string;
          id?: string;
          industry?: string | null;
          name: string;
          owner_name?: string | null;
          phone?: string | null;
          website?: string | null;
        };
        Update: {
          city?: string | null;
          ceipal_client_number?: string | null;
          ceipal_id?: string | null;
          ceipal_last_synced_at?: string | null;
          client_type?: string | null;
          created_at?: string;
          id?: string;
          industry?: string | null;
          name?: string;
          owner_name?: string | null;
          phone?: string | null;
          website?: string | null;
        };
        Relationships: [];
      };
      activities: {
        Row: {
          activity_type: Database["public"]["Enums"]["activity_type"];
          created_at: string;
          due_date: string | null;
          id: string;
          notes: string | null;
          owner_name: string | null;
          related_to_id: string | null;
          related_to_type: string | null;
          service_details: Json;
          service_line: string | null;
          status: Database["public"]["Enums"]["activity_status"];
          title: string;
        };
        Insert: {
          activity_type?: Database["public"]["Enums"]["activity_type"];
          created_at?: string;
          due_date?: string | null;
          id?: string;
          notes?: string | null;
          owner_name?: string | null;
          related_to_id?: string | null;
          related_to_type?: string | null;
          service_details?: Json;
          service_line?: string | null;
          status?: Database["public"]["Enums"]["activity_status"];
          title: string;
        };
        Update: {
          activity_type?: Database["public"]["Enums"]["activity_type"];
          created_at?: string;
          due_date?: string | null;
          id?: string;
          notes?: string | null;
          owner_name?: string | null;
          related_to_id?: string | null;
          related_to_type?: string | null;
          service_details?: Json;
          service_line?: string | null;
          status?: Database["public"]["Enums"]["activity_status"];
          title?: string;
        };
        Relationships: [];
      };
      cag_targets: {
        Row: {
          bookings_actual: number;
          bookings_target: number;
          created_at: string;
          id: string;
          owner_name: string;
          period_month: string;
          revenue_general_actual: number;
          revenue_recruitment_actual: number;
          revenue_target: number;
          updated_at: string;
        };
        Insert: {
          bookings_actual?: number;
          bookings_target?: number;
          created_at?: string;
          id?: string;
          owner_name?: string;
          period_month?: string;
          revenue_general_actual?: number;
          revenue_recruitment_actual?: number;
          revenue_target?: number;
          updated_at?: string;
        };
        Update: {
          bookings_actual?: number;
          bookings_target?: number;
          created_at?: string;
          id?: string;
          owner_name?: string;
          period_month?: string;
          revenue_general_actual?: number;
          revenue_recruitment_actual?: number;
          revenue_target?: number;
          updated_at?: string;
        };
        Relationships: [];
      };
      cag_monthly_summary: {
        Row: {
          bookings_actual: number;
          bookings_target: number;
          clients_acquired_actual: number;
          clients_acquired_target: number;
          clients_billed_actual: number;
          created_at: string;
          id: string;
          month: string;
          other_services_revenue_actual: number;
          recruitment_revenue_actual: number;
          recruitment_revenue_target: number;
          team_member: string;
          total_revenue_actual: number;
          updated_at: string;
        };
        Insert: {
          bookings_actual?: number;
          bookings_target?: number;
          clients_acquired_actual?: number;
          clients_acquired_target?: number;
          clients_billed_actual?: number;
          created_at?: string;
          id?: string;
          month: string;
          other_services_revenue_actual?: number;
          recruitment_revenue_actual?: number;
          recruitment_revenue_target?: number;
          team_member: string;
          total_revenue_actual?: number;
          updated_at?: string;
        };
        Update: {
          bookings_actual?: number;
          bookings_target?: number;
          clients_acquired_actual?: number;
          clients_acquired_target?: number;
          clients_billed_actual?: number;
          created_at?: string;
          id?: string;
          month?: string;
          other_services_revenue_actual?: number;
          recruitment_revenue_actual?: number;
          recruitment_revenue_target?: number;
          team_member?: string;
          total_revenue_actual?: number;
          updated_at?: string;
        };
        Relationships: [];
      };
      call_logs: {
        Row: {
          call_type: string | null;
          created_at: string;
          duration_seconds: number | null;
          id: string;
          phone_number: string | null;
          rep_name: string | null;
        };
        Insert: {
          call_type?: string | null;
          created_at?: string;
          duration_seconds?: number | null;
          id?: string;
          phone_number?: string | null;
          rep_name?: string | null;
        };
        Update: {
          call_type?: string | null;
          created_at?: string;
          duration_seconds?: number | null;
          id?: string;
          phone_number?: string | null;
          rep_name?: string | null;
        };
        Relationships: [];
      };
      contacts: {
        Row: {
          account_id: string | null;
          additional_fields: Json;
          created_at: string;
          department: string | null;
          email: string | null;
          first_name: string | null;
          id: string;
          last_activity_date: string | null;
          last_name: string;
          owner_name: string | null;
          phone: string | null;
          title: string | null;
        };
        Insert: {
          account_id?: string | null;
          additional_fields?: Json;
          created_at?: string;
          department?: string | null;
          email?: string | null;
          first_name?: string | null;
          id?: string;
          last_activity_date?: string | null;
          last_name: string;
          owner_name?: string | null;
          phone?: string | null;
          title?: string | null;
        };
        Update: {
          account_id?: string | null;
          additional_fields?: Json;
          created_at?: string;
          department?: string | null;
          email?: string | null;
          first_name?: string | null;
          id?: string;
          last_activity_date?: string | null;
          last_name?: string;
          owner_name?: string | null;
          phone?: string | null;
          title?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "contacts_account_id_fkey";
            columns: ["account_id"];
            isOneToOne: false;
            referencedRelation: "accounts";
            referencedColumns: ["id"];
          },
        ];
      };
      deals: {
        Row: {
          account_id: string | null;
          amount: number | null;
          closing_date: string | null;
          contact_id: string | null;
          created_at: string;
          deal_name: string;
          id: string;
          owner_name: string | null;
          service_details: Json;
          service_line: string | null;
          sla_signed_date: string | null;
          stage: Database["public"]["Enums"]["bd_stage"];
        };
        Insert: {
          account_id?: string | null;
          amount?: number | null;
          closing_date?: string | null;
          contact_id?: string | null;
          created_at?: string;
          deal_name: string;
          id?: string;
          owner_name?: string | null;
          service_details?: Json;
          service_line?: string | null;
          sla_signed_date?: string | null;
          stage?: Database["public"]["Enums"]["bd_stage"];
        };
        Update: {
          account_id?: string | null;
          amount?: number | null;
          closing_date?: string | null;
          contact_id?: string | null;
          created_at?: string;
          deal_name?: string;
          id?: string;
          owner_name?: string | null;
          service_details?: Json;
          service_line?: string | null;
          sla_signed_date?: string | null;
          stage?: Database["public"]["Enums"]["bd_stage"];
        };
        Relationships: [
          {
            foreignKeyName: "deals_account_id_fkey";
            columns: ["account_id"];
            isOneToOne: false;
            referencedRelation: "accounts";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "deals_contact_id_fkey";
            columns: ["contact_id"];
            isOneToOne: false;
            referencedRelation: "contacts";
            referencedColumns: ["id"];
          },
        ];
      };
      kra_targets: {
        Row: {
          acquired_clients_target: number;
          created_at: string;
          id: string;
          month: string;
          target_bookings: number;
          target_clients_billed: number;
          target_learning_development_revenue: number;
          target_other_services_revenue: number;
          target_recruitment_revenue: number;
          target_revenue: number;
          team_member: string;
          updated_at: string;
        };
        Insert: {
          acquired_clients_target?: number;
          created_at?: string;
          id?: string;
          month: string;
          target_bookings?: number;
          target_clients_billed?: number;
          target_learning_development_revenue?: number;
          target_other_services_revenue?: number;
          target_recruitment_revenue?: number;
          target_revenue?: number;
          team_member: string;
          updated_at?: string;
        };
        Update: {
          acquired_clients_target?: number;
          created_at?: string;
          id?: string;
          month?: string;
          target_bookings?: number;
          target_clients_billed?: number;
          target_learning_development_revenue?: number;
          target_other_services_revenue?: number;
          target_recruitment_revenue?: number;
          target_revenue?: number;
          team_member?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      leads: {
        Row: {
          ceipal_contact_synced_at: string | null;
          ceipal_id: string | null;
          ceipal_last_synced_at: string | null;
          city: string | null;
          company_name: string;
          contact_name: string | null;
          created_at: string;
          email: string | null;
          estimated_value: number | null;
          id: string;
          industry: string | null;
          notes: string | null;
          owner_name: string | null;
          phone: string | null;
          service_interest: string | null;
          source: string | null;
          status: string;
          updated_at: string;
        };
        Insert: {
          ceipal_contact_synced_at?: string | null;
          ceipal_id?: string | null;
          ceipal_last_synced_at?: string | null;
          city?: string | null;
          company_name: string;
          contact_name?: string | null;
          created_at?: string;
          email?: string | null;
          estimated_value?: number | null;
          id?: string;
          industry?: string | null;
          notes?: string | null;
          owner_name?: string | null;
          phone?: string | null;
          service_interest?: string | null;
          source?: string | null;
          status?: string;
          updated_at?: string;
        };
        Update: {
          ceipal_contact_synced_at?: string | null;
          ceipal_id?: string | null;
          ceipal_last_synced_at?: string | null;
          city?: string | null;
          company_name?: string;
          contact_name?: string | null;
          created_at?: string;
          email?: string | null;
          estimated_value?: number | null;
          id?: string;
          industry?: string | null;
          notes?: string | null;
          owner_name?: string | null;
          phone?: string | null;
          service_interest?: string | null;
          source?: string | null;
          status?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      poa_entries: {
        Row: {
          actual_leads: number;
          actual_revenue: number;
          calls_made: number;
          clients_billed: number;
          clients_called: number;
          clients_onboarded: number;
          created_at: string;
          date: string;
          deals_closed_value: number;
          f2f_meetings: number;
          follow_up_calls_connected: number;
          id: string;
          learning_development_revenue: number;
          notes: string | null;
          other_services_revenue: number;
          proposals_shared: number;
          proposals_sent: number;
          recruitment_revenue: number;
          target_calls_connected: number;
          target_clients_onboarded: number;
          target_f2f_meetings: number;
          target_follow_up_calls: number;
          target_leads: number;
          target_proposals_shared: number;
          target_vc_meetings: number;
          team_member: string;
          updated_at: string;
          vc_meetings: number;
        };
        Insert: {
          actual_leads?: number;
          actual_revenue?: number;
          calls_made?: number;
          clients_billed?: number;
          clients_called?: number;
          clients_onboarded?: number;
          created_at?: string;
          date?: string;
          deals_closed_value?: number;
          f2f_meetings?: number;
          follow_up_calls_connected?: number;
          id?: string;
          learning_development_revenue?: number;
          notes?: string | null;
          other_services_revenue?: number;
          proposals_shared?: number;
          proposals_sent?: number;
          recruitment_revenue?: number;
          target_calls_connected?: number;
          target_clients_onboarded?: number;
          target_f2f_meetings?: number;
          target_follow_up_calls?: number;
          target_leads?: number;
          target_proposals_shared?: number;
          target_vc_meetings?: number;
          team_member: string;
          updated_at?: string;
          vc_meetings?: number;
        };
        Update: {
          actual_leads?: number;
          actual_revenue?: number;
          calls_made?: number;
          clients_billed?: number;
          clients_called?: number;
          clients_onboarded?: number;
          created_at?: string;
          date?: string;
          deals_closed_value?: number;
          f2f_meetings?: number;
          follow_up_calls_connected?: number;
          id?: string;
          learning_development_revenue?: number;
          notes?: string | null;
          other_services_revenue?: number;
          proposals_shared?: number;
          proposals_sent?: number;
          recruitment_revenue?: number;
          target_calls_connected?: number;
          target_clients_onboarded?: number;
          target_f2f_meetings?: number;
          target_follow_up_calls?: number;
          target_leads?: number;
          target_proposals_shared?: number;
          target_vc_meetings?: number;
          team_member?: string;
          updated_at?: string;
          vc_meetings?: number;
        };
        Relationships: [];
      };
      trainers: {
        Row: {
          bio: string | null;
          created_at: string;
          day_rate: number | null;
          email: string | null;
          expertise: string | null;
          full_name: string;
          id: string;
          phone: string | null;
          rating: number | null;
          training_type: Database["public"]["Enums"]["training_type"];
          updated_at: string;
        };
        Insert: {
          bio?: string | null;
          created_at?: string;
          day_rate?: number | null;
          email?: string | null;
          expertise?: string | null;
          full_name: string;
          id?: string;
          phone?: string | null;
          rating?: number | null;
          training_type?: Database["public"]["Enums"]["training_type"];
          updated_at?: string;
        };
        Update: {
          bio?: string | null;
          created_at?: string;
          day_rate?: number | null;
          email?: string | null;
          expertise?: string | null;
          full_name?: string;
          id?: string;
          phone?: string | null;
          rating?: number | null;
          training_type?: Database["public"]["Enums"]["training_type"];
          updated_at?: string;
        };
        Relationships: [];
      };
      training_batches: {
        Row: {
          batch_code: string;
          course_topic: string | null;
          created_at: string;
          end_date: string | null;
          id: string;
          mode: string | null;
          notes: string | null;
          participants: number | null;
          request_id: string | null;
          start_date: string | null;
          status: Database["public"]["Enums"]["batch_status"];
          trainer_id: string | null;
          training_type: Database["public"]["Enums"]["training_type"];
          updated_at: string;
        };
        Insert: {
          batch_code: string;
          course_topic?: string | null;
          created_at?: string;
          end_date?: string | null;
          id?: string;
          mode?: string | null;
          notes?: string | null;
          participants?: number | null;
          request_id?: string | null;
          start_date?: string | null;
          status?: Database["public"]["Enums"]["batch_status"];
          trainer_id?: string | null;
          training_type?: Database["public"]["Enums"]["training_type"];
          updated_at?: string;
        };
        Update: {
          batch_code?: string;
          course_topic?: string | null;
          created_at?: string;
          end_date?: string | null;
          id?: string;
          mode?: string | null;
          notes?: string | null;
          participants?: number | null;
          request_id?: string | null;
          start_date?: string | null;
          status?: Database["public"]["Enums"]["batch_status"];
          trainer_id?: string | null;
          training_type?: Database["public"]["Enums"]["training_type"];
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "training_batches_request_id_fkey";
            columns: ["request_id"];
            isOneToOne: false;
            referencedRelation: "training_requests";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "training_batches_trainer_id_fkey";
            columns: ["trainer_id"];
            isOneToOne: false;
            referencedRelation: "trainers";
            referencedColumns: ["id"];
          },
        ];
      };
      training_requests: {
        Row: {
          account_id: string | null;
          budget: number | null;
          client_name: string | null;
          course_topic: string;
          created_at: string;
          end_date: string | null;
          id: string;
          notes: string | null;
          owner_name: string | null;
          participants: number | null;
          start_date: string | null;
          status: Database["public"]["Enums"]["training_status"];
          trainer_id: string | null;
          training_type: Database["public"]["Enums"]["training_type"];
          updated_at: string;
        };
        Insert: {
          account_id?: string | null;
          budget?: number | null;
          client_name?: string | null;
          course_topic: string;
          created_at?: string;
          end_date?: string | null;
          id?: string;
          notes?: string | null;
          owner_name?: string | null;
          participants?: number | null;
          start_date?: string | null;
          status?: Database["public"]["Enums"]["training_status"];
          trainer_id?: string | null;
          training_type?: Database["public"]["Enums"]["training_type"];
          updated_at?: string;
        };
        Update: {
          account_id?: string | null;
          budget?: number | null;
          client_name?: string | null;
          course_topic?: string;
          created_at?: string;
          end_date?: string | null;
          id?: string;
          notes?: string | null;
          owner_name?: string | null;
          participants?: number | null;
          start_date?: string | null;
          status?: Database["public"]["Enums"]["training_status"];
          trainer_id?: string | null;
          training_type?: Database["public"]["Enums"]["training_type"];
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "training_requests_account_id_fkey";
            columns: ["account_id"];
            isOneToOne: false;
            referencedRelation: "accounts";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "training_requests_trainer_id_fkey";
            columns: ["trainer_id"];
            isOneToOne: false;
            referencedRelation: "trainers";
            referencedColumns: ["id"];
          },
        ];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      [_ in never]: never;
    };
    Enums: {
      activity_status: "Pending" | "In Progress" | "Completed";
      activity_type: "Task" | "Meeting" | "Call" | "Interview";
      batch_status: "Scheduled" | "In Progress" | "Completed" | "Cancelled";
      bd_stage: "New Lead" | "Pitch Scheduled" | "Proposal Sent" | "SLA Negotiation" | "SLA Signed";
      training_status:
        | "Inquiry Received"
        | "Curriculum & Quote Sent"
        | "Trainer Assigned"
        | "Batch Scheduled"
        | "Completed & Invoiced";
      training_type: "Technical" | "Soft Skills";
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">;

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">];

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R;
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] & DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R;
      }
      ? R
      : never
    : never;

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    keyof DefaultSchema["Tables"] | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I;
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I;
      }
      ? I
      : never
    : never;

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    keyof DefaultSchema["Tables"] | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U;
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U;
      }
      ? U
      : never
    : never;

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    keyof DefaultSchema["Enums"] | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never;

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    keyof DefaultSchema["CompositeTypes"] | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never;

export const Constants = {
  public: {
    Enums: {
      activity_status: ["Pending", "In Progress", "Completed"],
      activity_type: ["Task", "Meeting", "Call", "Interview"],
      batch_status: ["Scheduled", "In Progress", "Completed", "Cancelled"],
      bd_stage: ["New Lead", "Pitch Scheduled", "Proposal Sent", "SLA Negotiation", "SLA Signed"],
      training_status: [
        "Inquiry Received",
        "Curriculum & Quote Sent",
        "Trainer Assigned",
        "Batch Scheduled",
        "Completed & Invoiced",
      ],
      training_type: ["Technical", "Soft Skills"],
    },
  },
} as const;
