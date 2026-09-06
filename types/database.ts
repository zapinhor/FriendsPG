export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type CampaignRole = "owner" | "gm" | "player";

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          username: string;
          display_name: string;
          avatar_url: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          username: string;
          display_name: string;
          avatar_url?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          username?: string;
          display_name?: string;
          avatar_url?: string | null;
          updated_at?: string;
        };
        Relationships: [];
      };

      campaigns: {
        Row: {
          id: string;
          name: string;
          description: string | null;
          cover_url: string | null;
          owner_id: string;
          system_name: string | null;
          settings: Json;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          description?: string | null;
          cover_url?: string | null;
          owner_id: string;
          system_name?: string | null;
          settings?: Json;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          name?: string;
          description?: string | null;
          cover_url?: string | null;
          system_name?: string | null;
          settings?: Json;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "campaigns_owner_id_fkey";
            columns: ["owner_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };

      campaign_members: {
        Row: {
          campaign_id: string;
          user_id: string;
          role: CampaignRole;
          joined_at: string;
        };
        Insert: {
          campaign_id: string;
          user_id: string;
          role?: CampaignRole;
          joined_at?: string;
        };
        Update: {
          role?: CampaignRole;
        };
        Relationships: [
          {
            foreignKeyName: "campaign_members_campaign_id_fkey";
            columns: ["campaign_id"];
            isOneToOne: false;
            referencedRelation: "campaigns";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "campaign_members_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };

      campaign_invites: {
        Row: {
          id: string;
          campaign_id: string;
          code: string;
          created_by: string;
          max_uses: number | null;
          use_count: number;
          expires_at: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          campaign_id: string;
          code?: string;
          created_by: string;
          max_uses?: number | null;
          use_count?: number;
          expires_at?: string | null;
          created_at?: string;
        };
        Update: {
          max_uses?: number | null;
          expires_at?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "campaign_invites_campaign_id_fkey";
            columns: ["campaign_id"];
            isOneToOne: false;
            referencedRelation: "campaigns";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "campaign_invites_created_by_fkey";
            columns: ["created_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };

      scenes: {
        Row: {
          id: string;
          campaign_id: string;
          name: string;
          background_url: string | null;
          background_asset_id: string | null;
          width: number;
          height: number;
          is_active: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          campaign_id: string;
          name: string;
          background_url?: string | null;
          background_asset_id?: string | null;
          width?: number;
          height?: number;
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          name?: string;
          background_url?: string | null;
          background_asset_id?: string | null;
          width?: number;
          height?: number;
          is_active?: boolean;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "scenes_campaign_id_fkey";
            columns: ["campaign_id"];
            isOneToOne: false;
            referencedRelation: "campaigns";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "scenes_background_asset_id_fkey";
            columns: ["background_asset_id"];
            isOneToOne: false;
            referencedRelation: "assets";
            referencedColumns: ["id"];
          },
        ];
      };

      assets: {
        Row: {
          id: string;
          campaign_id: string;
          uploaded_by: string;
          name: string;
          url: string | null;
          storage_path: string | null;
          mime_type: string | null;
          size_bytes: number | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          campaign_id: string;
          uploaded_by: string;
          name: string;
          url?: string | null;
          storage_path?: string | null;
          mime_type?: string | null;
          size_bytes?: number | null;
          created_at?: string;
        };
        Update: {
          name?: string;
          url?: string | null;
          storage_path?: string | null;
          mime_type?: string | null;
          size_bytes?: number | null;
        };
        Relationships: [
          {
            foreignKeyName: "assets_campaign_id_fkey";
            columns: ["campaign_id"];
            isOneToOne: false;
            referencedRelation: "campaigns";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "assets_uploaded_by_fkey";
            columns: ["uploaded_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };

      scene_props: {
        Row: {
          id: string;
          scene_id: string;
          campaign_id: string;
          asset_id: string;
          name: string;
          image_url: string;
          x: number;
          y: number;
          width: number;
          height: number;
          rotation: number;
          flip_horizontal: boolean;
          flip_vertical: boolean;
          z_index: number;
          is_locked: boolean;
          created_by: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          scene_id: string;
          campaign_id: string;
          asset_id: string;
          name: string;
          image_url: string;
          x?: number;
          y?: number;
          width?: number;
          height?: number;
          rotation?: number;
          flip_horizontal?: boolean;
          flip_vertical?: boolean;
          z_index?: number;
          is_locked?: boolean;
          created_by: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          scene_id?: string;
          campaign_id?: string;
          asset_id?: string;
          name?: string;
          image_url?: string;
          x?: number;
          y?: number;
          width?: number;
          height?: number;
          rotation?: number;
          flip_horizontal?: boolean;
          flip_vertical?: boolean;
          z_index?: number;
          is_locked?: boolean;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "scene_props_scene_id_fkey";
            columns: ["scene_id"];
            isOneToOne: false;
            referencedRelation: "scenes";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "scene_props_campaign_id_fkey";
            columns: ["campaign_id"];
            isOneToOne: false;
            referencedRelation: "campaigns";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "scene_props_asset_id_fkey";
            columns: ["asset_id"];
            isOneToOne: false;
            referencedRelation: "assets";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "scene_props_created_by_fkey";
            columns: ["created_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
    };

    Views: {
      [_ in never]: never;
    };

    Functions: {
      accept_invite: {
        Args: {
          invite_code: string;
        };
        Returns: string;
      };

      preview_invite: {
        Args: {
          invite_code: string;
        };
        Returns: {
          campaign_id: string;
          campaign_name: string;
          campaign_description: string | null;
          gm_display_name: string | null;
          valid: boolean;
        }[];
      };

      update_my_profile: {
        Args: {
          new_username: string;
          new_display_name: string;
          new_avatar_url: string | null;
        };
        Returns: undefined;
      };

      set_campaign_member_role: {
        Args: {
          target_campaign_id: string;
          target_user_id: string;
          new_role: CampaignRole;
        };
        Returns: undefined;
      };

      remove_campaign_member: {
        Args: {
          target_campaign_id: string;
          target_user_id: string;
        };
        Returns: undefined;
      };

      set_active_scene: {
        Args: {
          target_campaign_id: string;
          target_scene_id: string;
        };
        Returns: undefined;
      };
      get_scene_background_url: {
  Args: {
    target_scene_id: string;
  };
  Returns: string | null;
};
    };

    Enums: {
      campaign_role: CampaignRole;
    };

    CompositeTypes: {
      [_ in never]: never;
    };
  };
}
