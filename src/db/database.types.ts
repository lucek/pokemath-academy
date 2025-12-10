export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export interface Database {
  graphql_public: {
    Tables: Record<never, never>;
    Views: Record<never, never>;
    Functions: {
      graphql: {
        Args: {
          extensions?: Json;
          operationName?: string;
          query?: string;
          variables?: Json;
        };
        Returns: Json;
      };
    };
    Enums: Record<never, never>;
    CompositeTypes: Record<never, never>;
  };
  public: {
    Tables: {
      captured_pokemon: {
        Row: {
          captured_at: string | null;
          id: number;
          pokemon_id: number;
          user_id: string;
          variant: Database['public']['Enums']['variant_enum'];
        };
        Insert: {
          captured_at?: string | null;
          id?: number;
          pokemon_id: number;
          user_id: string;
          variant: Database['public']['Enums']['variant_enum'];
        };
        Update: {
          captured_at?: string | null;
          id?: number;
          pokemon_id?: number;
          user_id?: string;
          variant?: Database['public']['Enums']['variant_enum'];
        };
        Relationships: [
          {
            foreignKeyName: 'fk_captured_pokemon_pokemon';
            columns: ['pokemon_id'];
            isOneToOne: false;
            referencedRelation: 'pokemon';
            referencedColumns: ['id'];
          },
        ];
      };
      pokemon: {
        Row: {
          created_at: string | null;
          flavor_text: string | null;
          id: number;
          name: string;
          region: string | null;
          sprites: Json;
          stats: Json;
        };
        Insert: {
          created_at?: string | null;
          flavor_text?: string | null;
          id: number;
          name: string;
          region?: string | null;
          sprites: Json;
          stats: Json;
        };
        Update: {
          created_at?: string | null;
          flavor_text?: string | null;
          id?: number;
          name?: string;
          region?: string | null;
          sprites?: Json;
          stats?: Json;
        };
        Relationships: [];
      };
      pokemon_evolutions: {
        Row: {
          base_id: number;
          evolution_id: number;
          trigger: Json | null;
        };
        Insert: {
          base_id: number;
          evolution_id: number;
          trigger?: Json | null;
        };
        Update: {
          base_id?: number;
          evolution_id?: number;
          trigger?: Json | null;
        };
        Relationships: [
          {
            foreignKeyName: 'fk_pokemon_evolutions_base';
            columns: ['base_id'];
            isOneToOne: false;
            referencedRelation: 'pokemon';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'fk_pokemon_evolutions_evolution';
            columns: ['evolution_id'];
            isOneToOne: false;
            referencedRelation: 'pokemon';
            referencedColumns: ['id'];
          },
        ];
      };
      pokemon_types: {
        Row: {
          pokemon_id: number;
          slot: number;
          type_id: number;
        };
        Insert: {
          pokemon_id: number;
          slot: number;
          type_id: number;
        };
        Update: {
          pokemon_id?: number;
          slot?: number;
          type_id?: number;
        };
        Relationships: [
          {
            foreignKeyName: 'fk_pokemon_types_pokemon';
            columns: ['pokemon_id'];
            isOneToOne: false;
            referencedRelation: 'pokemon';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'fk_pokemon_types_type';
            columns: ['type_id'];
            isOneToOne: false;
            referencedRelation: 'types';
            referencedColumns: ['id'];
          },
        ];
      };
      profiles: {
        Row: {
          avatar_url: string | null;
          created_at: string | null;
          display_name: string | null;
          user_id: string;
        };
        Insert: {
          avatar_url?: string | null;
          created_at?: string | null;
          display_name?: string | null;
          user_id: string;
        };
        Update: {
          avatar_url?: string | null;
          created_at?: string | null;
          display_name?: string | null;
          user_id?: string;
        };
        Relationships: [];
      };
      types: {
        Row: {
          id: number;
          name: string;
        };
        Insert: {
          id: number;
          name: string;
        };
        Update: {
          id?: number;
          name?: string;
        };
        Relationships: [];
      };
    };
    Views: {
      my_collection_vw: {
        Row: {
          capture_id: number | null;
          captured_at: string | null;
          pokemon_id: number | null;
          pokemon_name: string | null;
          region: string | null;
          sprites: Json | null;
          stats: Json | null;
          type_details: Json | null;
          user_id: string | null;
          variant: Database['public']['Enums']['variant_enum'] | null;
        };
        Relationships: [
          {
            foreignKeyName: 'fk_captured_pokemon_pokemon';
            columns: ['pokemon_id'];
            isOneToOne: false;
            referencedRelation: 'pokemon';
            referencedColumns: ['id'];
          },
        ];
      };
      pokemon_catalog_vw: {
        Row: {
          pokemon_id: number | null;
          pokemon_name: string | null;
          region: string | null;
          sprites: Json | null;
          stats: Json | null;
          type_details: Json | null;
        };
        Relationships: [];
      };
      user_capture_stats: {
        Row: {
          last_capture_at: string | null;
          normal_count: number | null;
          shiny_count: number | null;
          total_captured: number | null;
          unique_pokemon_count: number | null;
          user_id: string | null;
        };
        Relationships: [];
      };
      user_pokedex_vw: {
        Row: {
          captured_at: string | null;
          is_caught: boolean | null;
          pokemon_id: number | null;
          pokemon_name: string | null;
          region: string | null;
          sprites: Json | null;
          stats: Json | null;
          type_details: Json | null;
          user_id: string | null;
          variant: Database['public']['Enums']['variant_enum'] | null;
        };
        Relationships: [];
      };
    };
    Functions: Record<never, never>;
    Enums: {
      variant_enum: 'normal' | 'shiny';
    };
    CompositeTypes: Record<never, never>;
  };
}

type DatabaseWithoutInternals = Omit<Database, '__InternalSupabase'>;

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, 'public'>];

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema['Tables'] & DefaultSchema['Views'])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Views'])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Views'])[TableName] extends {
      Row: infer R;
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema['Tables'] & DefaultSchema['Views'])
    ? (DefaultSchema['Tables'] & DefaultSchema['Views'])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R;
      }
      ? R
      : never
    : never;

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema['Tables']
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables']
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'][TableName] extends {
      Insert: infer I;
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema['Tables']
    ? DefaultSchema['Tables'][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I;
      }
      ? I
      : never
    : never;

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema['Tables']
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables']
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'][TableName] extends {
      Update: infer U;
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema['Tables']
    ? DefaultSchema['Tables'][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U;
      }
      ? U
      : never
    : never;

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema['Enums']
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions['schema']]['Enums']
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions['schema']]['Enums'][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema['Enums']
    ? DefaultSchema['Enums'][DefaultSchemaEnumNameOrOptions]
    : never;

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema['CompositeTypes']
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions['schema']]['CompositeTypes']
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions['schema']]['CompositeTypes'][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema['CompositeTypes']
    ? DefaultSchema['CompositeTypes'][PublicCompositeTypeNameOrOptions]
    : never;

export const Constants = {
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {
      variant_enum: ['normal', 'shiny'],
    },
  },
} as const;
