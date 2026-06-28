export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      ai_runs: {
        Row: {
          attempts: Json | null
          completion_tokens: number
          cost_usd: number
          created_at: string
          department: string | null
          id: string
          input: Json
          metadata: Json
          needs_approval: boolean
          output: string | null
          prompt_tokens: number
          provider_id: string | null
          provider_kind: string | null
          shared_skill_id: string | null
          status: string
          template_id: string | null
          title: string | null
          user_id: string
          user_skill_id: string | null
        }
        Insert: {
          attempts?: Json | null
          completion_tokens?: number
          cost_usd?: number
          created_at?: string
          department?: string | null
          id?: string
          input?: Json
          metadata?: Json
          needs_approval?: boolean
          output?: string | null
          prompt_tokens?: number
          provider_id?: string | null
          provider_kind?: string | null
          shared_skill_id?: string | null
          status?: string
          template_id?: string | null
          title?: string | null
          user_id: string
          user_skill_id?: string | null
        }
        Update: {
          attempts?: Json | null
          completion_tokens?: number
          cost_usd?: number
          created_at?: string
          department?: string | null
          id?: string
          input?: Json
          metadata?: Json
          needs_approval?: boolean
          output?: string | null
          prompt_tokens?: number
          provider_id?: string | null
          provider_kind?: string | null
          shared_skill_id?: string | null
          status?: string
          template_id?: string | null
          title?: string | null
          user_id?: string
          user_skill_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ai_runs_shared_skill_id_fkey"
            columns: ["shared_skill_id"]
            isOneToOne: false
            referencedRelation: "shared_skills"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ai_runs_user_skill_id_fkey"
            columns: ["user_skill_id"]
            isOneToOne: false
            referencedRelation: "user_skills"
            referencedColumns: ["id"]
          },
        ]
      }
      app_settings: {
        Row: {
          key: string
          updated_at: string
          updated_by: string | null
          value: Json
        }
        Insert: {
          key: string
          updated_at?: string
          updated_by?: string | null
          value?: Json
        }
        Update: {
          key?: string
          updated_at?: string
          updated_by?: string | null
          value?: Json
        }
        Relationships: []
      }
      approvals: {
        Row: {
          approver_id: string | null
          created_at: string
          decided_at: string | null
          id: string
          note: string | null
          requester_id: string
          run_id: string
          status: string
        }
        Insert: {
          approver_id?: string | null
          created_at?: string
          decided_at?: string | null
          id?: string
          note?: string | null
          requester_id: string
          run_id: string
          status?: string
        }
        Update: {
          approver_id?: string | null
          created_at?: string
          decided_at?: string | null
          id?: string
          note?: string | null
          requester_id?: string
          run_id?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "approvals_run_id_fkey"
            columns: ["run_id"]
            isOneToOne: false
            referencedRelation: "ai_runs"
            referencedColumns: ["id"]
          },
        ]
      }
      audit_logs: {
        Row: {
          action: string
          created_at: string
          id: string
          metadata: Json
          resource: string | null
          user_id: string | null
        }
        Insert: {
          action: string
          created_at?: string
          id?: string
          metadata?: Json
          resource?: string | null
          user_id?: string | null
        }
        Update: {
          action?: string
          created_at?: string
          id?: string
          metadata?: Json
          resource?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      chat_messages: {
        Row: {
          citations: Json
          content: string
          created_at: string
          id: string
          role: string
          thread_id: string
          user_id: string
        }
        Insert: {
          citations?: Json
          content: string
          created_at?: string
          id?: string
          role: string
          thread_id: string
          user_id: string
        }
        Update: {
          citations?: Json
          content?: string
          created_at?: string
          id?: string
          role?: string
          thread_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "chat_messages_thread_id_fkey"
            columns: ["thread_id"]
            isOneToOne: false
            referencedRelation: "chat_threads"
            referencedColumns: ["id"]
          },
        ]
      }
      chat_threads: {
        Row: {
          category_filter: string | null
          created_at: string
          id: string
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          category_filter?: string | null
          created_at?: string
          id?: string
          title?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          category_filter?: string | null
          created_at?: string
          id?: string
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      custom_templates: {
        Row: {
          category: string
          created_at: string
          created_by: string | null
          desc_en: string
          desc_th: string
          fields: Json
          icon: string
          id: string
          is_active: boolean
          slug: string
          system_prompt_th: string
          title_en: string
          title_th: string
          updated_at: string
        }
        Insert: {
          category?: string
          created_at?: string
          created_by?: string | null
          desc_en?: string
          desc_th?: string
          fields?: Json
          icon?: string
          id?: string
          is_active?: boolean
          slug: string
          system_prompt_th: string
          title_en?: string
          title_th: string
          updated_at?: string
        }
        Update: {
          category?: string
          created_at?: string
          created_by?: string | null
          desc_en?: string
          desc_th?: string
          fields?: Json
          icon?: string
          id?: string
          is_active?: boolean
          slug?: string
          system_prompt_th?: string
          title_en?: string
          title_th?: string
          updated_at?: string
        }
        Relationships: []
      }
      dept_model_providers: {
        Row: {
          api_key_secret_name: string | null
          base_url: string | null
          created_at: string
          created_by: string | null
          department: string
          enabled: boolean
          id: string
          kind: string
          model_id: string
          name: string
          price_in_per_mtok: number
          price_out_per_mtok: number
          sort_order: number
          updated_at: string
        }
        Insert: {
          api_key_secret_name?: string | null
          base_url?: string | null
          created_at?: string
          created_by?: string | null
          department: string
          enabled?: boolean
          id?: string
          kind: string
          model_id: string
          name: string
          price_in_per_mtok?: number
          price_out_per_mtok?: number
          sort_order?: number
          updated_at?: string
        }
        Update: {
          api_key_secret_name?: string | null
          base_url?: string | null
          created_at?: string
          created_by?: string | null
          department?: string
          enabled?: boolean
          id?: string
          kind?: string
          model_id?: string
          name?: string
          price_in_per_mtok?: number
          price_out_per_mtok?: number
          sort_order?: number
          updated_at?: string
        }
        Relationships: []
      }
      dept_model_routes: {
        Row: {
          chain: Json
          created_at: string
          created_by: string | null
          department: string
          id: string
          is_default: boolean
          name: string
          updated_at: string
        }
        Insert: {
          chain?: Json
          created_at?: string
          created_by?: string | null
          department: string
          id?: string
          is_default?: boolean
          name: string
          updated_at?: string
        }
        Update: {
          chain?: Json
          created_at?: string
          created_by?: string | null
          department?: string
          id?: string
          is_default?: boolean
          name?: string
          updated_at?: string
        }
        Relationships: []
      }
      kb_chunks: {
        Row: {
          chunk_index: number
          content: string
          created_at: string
          document_id: string
          embedding: string | null
          id: string
          tokens: number
        }
        Insert: {
          chunk_index: number
          content: string
          created_at?: string
          document_id: string
          embedding?: string | null
          id?: string
          tokens?: number
        }
        Update: {
          chunk_index?: number
          content?: string
          created_at?: string
          document_id?: string
          embedding?: string | null
          id?: string
          tokens?: number
        }
        Relationships: [
          {
            foreignKeyName: "kb_chunks_document_id_fkey"
            columns: ["document_id"]
            isOneToOne: false
            referencedRelation: "kb_documents"
            referencedColumns: ["id"]
          },
        ]
      }
      kb_documents: {
        Row: {
          category: string
          chunk_count: number
          created_at: string
          error: string | null
          id: string
          mime_type: string | null
          source: string | null
          status: string
          storage_path: string | null
          title: string
          updated_at: string
          uploaded_by: string
        }
        Insert: {
          category?: string
          chunk_count?: number
          created_at?: string
          error?: string | null
          id?: string
          mime_type?: string | null
          source?: string | null
          status?: string
          storage_path?: string | null
          title: string
          updated_at?: string
          uploaded_by: string
        }
        Update: {
          category?: string
          chunk_count?: number
          created_at?: string
          error?: string | null
          id?: string
          mime_type?: string | null
          source?: string | null
          status?: string
          storage_path?: string | null
          title?: string
          updated_at?: string
          uploaded_by?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          created_at: string
          department: string | null
          display_name: string | null
          id: string
          language_pref: string
          signature_data_url: string | null
          signer_position: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          department?: string | null
          display_name?: string | null
          id: string
          language_pref?: string
          signature_data_url?: string | null
          signer_position?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          department?: string | null
          display_name?: string | null
          id?: string
          language_pref?: string
          signature_data_url?: string | null
          signer_position?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      project_notes: {
        Row: {
          content_md: string
          created_at: string
          id: string
          metadata: Json
          origin: string
          project_id: string
          source_id: string | null
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          content_md?: string
          created_at?: string
          id?: string
          metadata?: Json
          origin?: string
          project_id: string
          source_id?: string | null
          title: string
          updated_at?: string
          user_id: string
        }
        Update: {
          content_md?: string
          created_at?: string
          id?: string
          metadata?: Json
          origin?: string
          project_id?: string
          source_id?: string | null
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "project_notes_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "user_projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_notes_source_id_fkey"
            columns: ["source_id"]
            isOneToOne: false
            referencedRelation: "project_sources"
            referencedColumns: ["id"]
          },
        ]
      }
      project_sources: {
        Row: {
          content_md: string | null
          created_at: string
          file_path: string | null
          id: string
          kind: string
          metadata: Json
          project_id: string
          title: string
          updated_at: string
          url: string | null
          user_id: string
        }
        Insert: {
          content_md?: string | null
          created_at?: string
          file_path?: string | null
          id?: string
          kind: string
          metadata?: Json
          project_id: string
          title: string
          updated_at?: string
          url?: string | null
          user_id: string
        }
        Update: {
          content_md?: string | null
          created_at?: string
          file_path?: string | null
          id?: string
          kind?: string
          metadata?: Json
          project_id?: string
          title?: string
          updated_at?: string
          url?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "project_sources_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "user_projects"
            referencedColumns: ["id"]
          },
        ]
      }
      shared_skills: {
        Row: {
          category: string | null
          conversation_starters: string[]
          created_at: string
          created_by: string | null
          description: string | null
          example_output: string | null
          icon: string | null
          id: string
          is_active: boolean
          name: string
          recommended_model: string | null
          role_prompt: string
          sort_order: number
          updated_at: string
        }
        Insert: {
          category?: string | null
          conversation_starters?: string[]
          created_at?: string
          created_by?: string | null
          description?: string | null
          example_output?: string | null
          icon?: string | null
          id?: string
          is_active?: boolean
          name: string
          recommended_model?: string | null
          role_prompt: string
          sort_order?: number
          updated_at?: string
        }
        Update: {
          category?: string | null
          conversation_starters?: string[]
          created_at?: string
          created_by?: string | null
          description?: string | null
          example_output?: string | null
          icon?: string | null
          id?: string
          is_active?: boolean
          name?: string
          recommended_model?: string | null
          role_prompt?: string
          sort_order?: number
          updated_at?: string
        }
        Relationships: []
      }
      signed_documents: {
        Row: {
          agency_name: string
          content_hash: string
          created_at: string
          document_subject: string
          id: string
          ref_no: string
          run_id: string | null
          signed_at: string
          signer_name: string
          signer_position: string
          user_id: string
        }
        Insert: {
          agency_name?: string
          content_hash: string
          created_at?: string
          document_subject?: string
          id?: string
          ref_no?: string
          run_id?: string | null
          signed_at?: string
          signer_name: string
          signer_position?: string
          user_id: string
        }
        Update: {
          agency_name?: string
          content_hash?: string
          created_at?: string
          document_subject?: string
          id?: string
          ref_no?: string
          run_id?: string | null
          signed_at?: string
          signer_name?: string
          signer_position?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "signed_documents_run_id_fkey"
            columns: ["run_id"]
            isOneToOne: false
            referencedRelation: "ai_runs"
            referencedColumns: ["id"]
          },
        ]
      }
      source_embeddings: {
        Row: {
          chunk_index: number
          content: string
          created_at: string
          embedding: string
          id: string
          project_id: string
          source_id: string
          user_id: string
        }
        Insert: {
          chunk_index: number
          content: string
          created_at?: string
          embedding: string
          id?: string
          project_id: string
          source_id: string
          user_id: string
        }
        Update: {
          chunk_index?: number
          content?: string
          created_at?: string
          embedding?: string
          id?: string
          project_id?: string
          source_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "source_embeddings_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "user_projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "source_embeddings_source_id_fkey"
            columns: ["source_id"]
            isOneToOne: false
            referencedRelation: "project_sources"
            referencedColumns: ["id"]
          },
        ]
      }
      task_events: {
        Row: {
          created_at: string
          end_at: string
          id: string
          remind_at: string | null
          reminded_at: string | null
          start_at: string
          task_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          end_at: string
          id?: string
          remind_at?: string | null
          reminded_at?: string | null
          start_at: string
          task_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          end_at?: string
          id?: string
          remind_at?: string | null
          reminded_at?: string | null
          start_at?: string
          task_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "task_events_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      tasks: {
        Row: {
          completed_at: string | null
          created_at: string
          description: string | null
          due_at: string | null
          est_minutes: number | null
          id: string
          priority: number
          project_id: string | null
          sort_order: number
          source_batch_id: string | null
          status: string
          suggested_tool: Json | null
          title: string
          type: string
          updated_at: string
          user_id: string
        }
        Insert: {
          completed_at?: string | null
          created_at?: string
          description?: string | null
          due_at?: string | null
          est_minutes?: number | null
          id?: string
          priority?: number
          project_id?: string | null
          sort_order?: number
          source_batch_id?: string | null
          status?: string
          suggested_tool?: Json | null
          title: string
          type?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          completed_at?: string | null
          created_at?: string
          description?: string | null
          due_at?: string | null
          est_minutes?: number | null
          id?: string
          priority?: number
          project_id?: string | null
          sort_order?: number
          source_batch_id?: string | null
          status?: string
          suggested_tool?: Json | null
          title?: string
          type?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "tasks_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "user_projects"
            referencedColumns: ["id"]
          },
        ]
      }
      template_favorites: {
        Row: {
          created_at: string
          id: string
          template_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          template_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          template_id?: string
          user_id?: string
        }
        Relationships: []
      }
      transformations: {
        Row: {
          created_at: string
          description: string | null
          icon: string | null
          id: string
          is_default: boolean
          name: string
          owner_id: string
          prompt: string
          sort_order: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          icon?: string | null
          id?: string
          is_default?: boolean
          name: string
          owner_id: string
          prompt: string
          sort_order?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          icon?: string | null
          id?: string
          is_default?: boolean
          name?: string
          owner_id?: string
          prompt?: string
          sort_order?: number
          updated_at?: string
        }
        Relationships: []
      }
      user_memory: {
        Row: {
          created_at: string
          id: string
          key: string
          updated_at: string
          user_id: string
          value: string
        }
        Insert: {
          created_at?: string
          id?: string
          key: string
          updated_at?: string
          user_id: string
          value: string
        }
        Update: {
          created_at?: string
          id?: string
          key?: string
          updated_at?: string
          user_id?: string
          value?: string
        }
        Relationships: []
      }
      user_projects: {
        Row: {
          archived: boolean
          color: string | null
          context: string | null
          created_at: string
          id: string
          name: string
          updated_at: string
          user_id: string
        }
        Insert: {
          archived?: boolean
          color?: string | null
          context?: string | null
          created_at?: string
          id?: string
          name: string
          updated_at?: string
          user_id: string
        }
        Update: {
          archived?: boolean
          color?: string | null
          context?: string | null
          created_at?: string
          id?: string
          name?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      user_skills: {
        Row: {
          created_at: string
          default_model_selector: string | null
          description: string | null
          example_output: string | null
          icon: string | null
          id: string
          name: string
          role_prompt: string
          sort_order: number
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          default_model_selector?: string | null
          description?: string | null
          example_output?: string | null
          icon?: string | null
          id?: string
          name: string
          role_prompt: string
          sort_order?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          default_model_selector?: string | null
          description?: string | null
          example_output?: string | null
          icon?: string | null
          id?: string
          name?: string
          role_prompt?: string
          sort_order?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      approvals_update_safe: {
        Args: {
          _new: Database["public"]["Tables"]["approvals"]["Row"]
          _old: Database["public"]["Tables"]["approvals"]["Row"]
        }
        Returns: boolean
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_dept_admin: {
        Args: { _dept: string; _user_id: string }
        Returns: boolean
      }
      is_in_department: {
        Args: { _dept: string; _user_id: string }
        Returns: boolean
      }
      log_audit: {
        Args: { p_action: string; p_metadata?: Json; p_resource: string }
        Returns: undefined
      }
      match_kb_chunks: {
        Args: {
          match_count?: number
          query_embedding: string
          similarity_threshold?: number
        }
        Returns: {
          category: string
          chunk_index: number
          content: string
          document_id: string
          id: string
          similarity: number
          source: string
          title: string
        }[]
      }
      match_source_chunks: {
        Args: {
          match_count?: number
          p_project_id: string
          query_embedding: string
          similarity_threshold?: number
        }
        Returns: {
          chunk_index: number
          content: string
          similarity: number
          source_id: string
          title: string
          url: string
        }[]
      }
      verify_signed_document: {
        Args: { p_id: string }
        Returns: {
          agency_name: string
          content_hash: string
          document_subject: string
          id: string
          ref_no: string
          signed_at: string
          signer_name: string
          signer_position: string
        }[]
      }
    }
    Enums: {
      app_role: "user" | "approver" | "admin" | "dept_admin"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      app_role: ["user", "approver", "admin", "dept_admin"],
    },
  },
} as const
