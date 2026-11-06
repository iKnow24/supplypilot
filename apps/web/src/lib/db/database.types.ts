export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
  public: {
    Tables: {
      buyer_orgs: {
        Row: {
          created_at: string;
          id: string;
          name: string;
          synthetic: boolean;
        };
        ComputedFields: never;
        Insert: {
          created_at?: string;
          id: string;
          name: string;
          synthetic?: boolean;
        };
        Update: {
          created_at?: string;
          id?: string;
          name?: string;
          synthetic?: boolean;
        };
        Relationships: [];
      };
      cart_lines: {
        Row: {
          cart_id: string;
          created_at: string;
          current_supplier_id: string | null;
          id: string;
          org_id: string;
          position: number;
          product_id: string;
          quantity: number;
          unit: string;
          updated_at: string;
        };
        ComputedFields: never;
        Insert: {
          cart_id: string;
          created_at?: string;
          current_supplier_id?: string | null;
          id?: string;
          org_id: string;
          position?: number;
          product_id: string;
          quantity: number;
          unit: string;
          updated_at?: string;
        };
        Update: {
          cart_id?: string;
          created_at?: string;
          current_supplier_id?: string | null;
          id?: string;
          org_id?: string;
          position?: number;
          product_id?: string;
          quantity?: number;
          unit?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "cart_lines_cart_id_org_id_fkey";
            columns: ["cart_id", "org_id"];
            isOneToOne: false;
            referencedRelation: "carts";
            referencedColumns: ["id", "org_id"];
          },
        ];
      };
      carts: {
        Row: {
          created_at: string;
          delivery_date: string | null;
          excluded_supplier_ids: string[];
          id: string;
          org_id: string;
          preferred_supplier_ids: string[];
          source_list_id: string | null;
          updated_at: string;
        };
        ComputedFields: never;
        Insert: {
          created_at?: string;
          delivery_date?: string | null;
          excluded_supplier_ids?: string[];
          id?: string;
          org_id: string;
          preferred_supplier_ids?: string[];
          source_list_id?: string | null;
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          delivery_date?: string | null;
          excluded_supplier_ids?: string[];
          id?: string;
          org_id?: string;
          preferred_supplier_ids?: string[];
          source_list_id?: string | null;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "carts_org_id_fkey";
            columns: ["org_id"];
            isOneToOne: true;
            referencedRelation: "buyer_orgs";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "carts_source_list_id_org_id_fkey";
            columns: ["source_list_id", "org_id"];
            isOneToOne: false;
            referencedRelation: "saved_lists";
            referencedColumns: ["id", "org_id"];
          },
        ];
      };
      favorites: {
        Row: {
          created_at: string;
          org_id: string;
          product_id: string;
        };
        ComputedFields: never;
        Insert: {
          created_at?: string;
          org_id: string;
          product_id: string;
        };
        Update: {
          created_at?: string;
          org_id?: string;
          product_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "favorites_org_id_fkey";
            columns: ["org_id"];
            isOneToOne: false;
            referencedRelation: "buyer_orgs";
            referencedColumns: ["id"];
          },
        ];
      };
      optimization_runs: {
        Row: {
          created_at: string;
          delivery_date: string;
          id: string;
          line_count: number;
          org_id: string;
          request: NonNullable<Json>;
          response: NonNullable<Json>;
          savings_cents: number | null;
          status: string;
          supplier_count: number | null;
          total_cents: number | null;
        };
        ComputedFields: never;
        Insert: {
          created_at?: string;
          delivery_date: string;
          id?: string;
          line_count: number;
          org_id: string;
          request: NonNullable<Json>;
          response: NonNullable<Json>;
          savings_cents?: number | null;
          status: string;
          supplier_count?: number | null;
          total_cents?: number | null;
        };
        Update: {
          created_at?: string;
          delivery_date?: string;
          id?: string;
          line_count?: number;
          org_id?: string;
          request?: NonNullable<Json>;
          response?: NonNullable<Json>;
          savings_cents?: number | null;
          status?: string;
          supplier_count?: number | null;
          total_cents?: number | null;
        };
        Relationships: [
          {
            foreignKeyName: "optimization_runs_org_id_fkey";
            columns: ["org_id"];
            isOneToOne: false;
            referencedRelation: "buyer_orgs";
            referencedColumns: ["id"];
          },
        ];
      };
      org_members: {
        Row: {
          created_at: string;
          org_id: string;
          role: string;
          user_id: string;
        };
        ComputedFields: never;
        Insert: {
          created_at?: string;
          org_id: string;
          role?: string;
          user_id: string;
        };
        Update: {
          created_at?: string;
          org_id?: string;
          role?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "org_members_org_id_fkey";
            columns: ["org_id"];
            isOneToOne: false;
            referencedRelation: "buyer_orgs";
            referencedColumns: ["id"];
          },
        ];
      };
      saved_list_lines: {
        Row: {
          current_supplier_id: string | null;
          id: string;
          list_id: string;
          org_id: string;
          position: number;
          product_id: string;
          quantity: number;
          unit: string;
        };
        ComputedFields: never;
        Insert: {
          current_supplier_id?: string | null;
          id?: string;
          list_id: string;
          org_id: string;
          position?: number;
          product_id: string;
          quantity: number;
          unit: string;
        };
        Update: {
          current_supplier_id?: string | null;
          id?: string;
          list_id?: string;
          org_id?: string;
          position?: number;
          product_id?: string;
          quantity?: number;
          unit?: string;
        };
        Relationships: [
          {
            foreignKeyName: "saved_list_lines_list_id_org_id_fkey";
            columns: ["list_id", "org_id"];
            isOneToOne: false;
            referencedRelation: "saved_lists";
            referencedColumns: ["id", "org_id"];
          },
        ];
      };
      saved_lists: {
        Row: {
          created_at: string;
          id: string;
          name: string;
          org_id: string;
          updated_at: string;
        };
        ComputedFields: never;
        Insert: {
          created_at?: string;
          id?: string;
          name: string;
          org_id: string;
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          id?: string;
          name?: string;
          org_id?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "saved_lists_org_id_fkey";
            columns: ["org_id"];
            isOneToOne: false;
            referencedRelation: "buyer_orgs";
            referencedColumns: ["id"];
          },
        ];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      add_cart_line: {
        Args: {
          p_current_supplier_id?: string;
          p_org: string;
          p_product_id: string;
          p_quantity: number;
          p_unit: string;
        };
        Returns: boolean;
      };
      duplicate_list: {
        Args: { p_list_id: string; p_name: string; p_org: string };
        Returns: string;
      };
      ensure_cart: {
        Args: { p_org: string };
        Returns: {
          created_at: string;
          delivery_date: string | null;
          excluded_supplier_ids: string[];
          id: string;
          org_id: string;
          preferred_supplier_ids: string[];
          source_list_id: string | null;
          updated_at: string;
        };
        SetofOptions: {
          from: "*";
          to: "carts";
          isOneToOne: true;
          isSetofReturn: false;
        };
      };
      is_org_member: { Args: { target_org: string }; Returns: boolean };
      load_list_into_cart: { Args: { p_list_id: string; p_org: string }; Returns: undefined };
      save_cart_as_list: { Args: { p_name: string; p_org: string }; Returns: string };
      set_cart_lines: {
        Args: { p_lines: Json; p_mode?: string; p_org: string };
        Returns: undefined;
      };
    };
    Enums: {
      [_ in never]: never;
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
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
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
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
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
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
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
> = DefaultSchemaEnumNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
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
> = PublicCompositeTypeNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never;

export const Constants = {
  public: {
    Enums: {},
  },
} as const;
