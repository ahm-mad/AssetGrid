export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  public: {
    Tables: {
      activation_attempt_devices: {
        Row: {
          activation_attempt_id: number
          activation_status: string
          created_at: string
          id: number
          provider_reference: string | null
          provider_status: string | null
          updated_at: string
          validation_status: string
          xnid: string
        }
        Insert: {
          activation_attempt_id: number
          activation_status?: string
          created_at?: string
          id?: number
          provider_reference?: string | null
          provider_status?: string | null
          updated_at?: string
          validation_status?: string
          xnid: string
        }
        Update: {
          activation_attempt_id?: number
          activation_status?: string
          created_at?: string
          id?: number
          provider_reference?: string | null
          provider_status?: string | null
          updated_at?: string
          validation_status?: string
          xnid?: string
        }
        Relationships: [
          {
            foreignKeyName: "activation_attempt_devices_activation_attempt_id_fkey"
            columns: ["activation_attempt_id"]
            isOneToOne: false
            referencedRelation: "activation_attempts"
            referencedColumns: ["id"]
          },
        ]
      }
      activation_attempts: {
        Row: {
          billing_mode: Database["public"]["Enums"]["billing_mode"]
          billing_xnid: string | null
          checkout_session_id: string | null
          completed_at: string | null
          created_at: string
          dealer_xnid: string | null
          device_count: number
          email: string
          id: number
          idempotency_key: string | null
          owner_xnid: string | null
          payment_provider: Database["public"]["Enums"]["payment_provider"]
          plan_id: number
          provider_customer_id: string | null
          provider_reference_id: string | null
          provider_subscription_id: string | null
          session_id: string | null
          status: Database["public"]["Enums"]["activation_attempt_status"]
          updated_at: string
          user_id: string | null
        }
        Insert: {
          billing_mode: Database["public"]["Enums"]["billing_mode"]
          billing_xnid?: string | null
          checkout_session_id?: string | null
          completed_at?: string | null
          created_at?: string
          dealer_xnid?: string | null
          device_count: number
          email: string
          id?: number
          idempotency_key?: string | null
          owner_xnid?: string | null
          payment_provider?: Database["public"]["Enums"]["payment_provider"]
          plan_id: number
          provider_customer_id?: string | null
          provider_reference_id?: string | null
          provider_subscription_id?: string | null
          session_id?: string | null
          status?: Database["public"]["Enums"]["activation_attempt_status"]
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          billing_mode?: Database["public"]["Enums"]["billing_mode"]
          billing_xnid?: string | null
          checkout_session_id?: string | null
          completed_at?: string | null
          created_at?: string
          dealer_xnid?: string | null
          device_count?: number
          email?: string
          id?: number
          idempotency_key?: string | null
          owner_xnid?: string | null
          payment_provider?: Database["public"]["Enums"]["payment_provider"]
          plan_id?: number
          provider_customer_id?: string | null
          provider_reference_id?: string | null
          provider_subscription_id?: string | null
          session_id?: string | null
          status?: Database["public"]["Enums"]["activation_attempt_status"]
          updated_at?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "activation_attempts_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "plans"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "activation_attempts_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      alert_log: {
        Row: {
          channel: Database["public"]["Enums"]["notification_channel"]
          created_at: string
          device_name: string | null
          id: number
          message: string
          recipient: string
          subject: string | null
          telemetry_id: number | null
          user_device_id: number | null
          user_id: string | null
        }
        Insert: {
          channel: Database["public"]["Enums"]["notification_channel"]
          created_at?: string
          device_name?: string | null
          id?: number
          message: string
          recipient: string
          subject?: string | null
          telemetry_id?: number | null
          user_device_id?: number | null
          user_id?: string | null
        }
        Update: {
          channel?: Database["public"]["Enums"]["notification_channel"]
          created_at?: string
          device_name?: string | null
          id?: number
          message?: string
          recipient?: string
          subject?: string | null
          telemetry_id?: number | null
          user_device_id?: number | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "alert_log_user_device_id_fkey"
            columns: ["user_device_id"]
            isOneToOne: false
            referencedRelation: "user_devices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "alert_log_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      alert_rules: {
        Row: {
          conditions: Json | null
          created_at: string
          devices: Json | null
          id: number
          is_active: boolean
          notifie: string | null
          title: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          conditions?: Json | null
          created_at?: string
          devices?: Json | null
          id?: number
          is_active?: boolean
          notifie?: string | null
          title?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          conditions?: Json | null
          created_at?: string
          devices?: Json | null
          id?: number
          is_active?: boolean
          notifie?: string | null
          title?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "alert_rules_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      alert_state: {
        Row: {
          admin_bypass: boolean
          alerts_count_24h: number
          attribute_id: number | null
          created_at: string
          dev_eui: string
          id: number
          inventory_device_id: number | null
          is_alert: boolean
          last_alert_at: string | null
          notification: string | null
          notification_type: string
          notifications_paused: boolean
          notifie_id: number | null
          paused_until: string | null
          prev_value: number | null
          product_id: number | null
          support_email_sent_at: string | null
          triggering_reading_id: number | null
          updated_at: string
          user_device_id: number
          value: number | null
          window_started_at: string | null
        }
        Insert: {
          admin_bypass?: boolean
          alerts_count_24h?: number
          attribute_id?: number | null
          created_at?: string
          dev_eui: string
          id?: number
          inventory_device_id?: number | null
          is_alert?: boolean
          last_alert_at?: string | null
          notification?: string | null
          notification_type?: string
          notifications_paused?: boolean
          notifie_id?: number | null
          paused_until?: string | null
          prev_value?: number | null
          product_id?: number | null
          support_email_sent_at?: string | null
          triggering_reading_id?: number | null
          updated_at?: string
          user_device_id: number
          value?: number | null
          window_started_at?: string | null
        }
        Update: {
          admin_bypass?: boolean
          alerts_count_24h?: number
          attribute_id?: number | null
          created_at?: string
          dev_eui?: string
          id?: number
          inventory_device_id?: number | null
          is_alert?: boolean
          last_alert_at?: string | null
          notification?: string | null
          notification_type?: string
          notifications_paused?: boolean
          notifie_id?: number | null
          paused_until?: string | null
          prev_value?: number | null
          product_id?: number | null
          support_email_sent_at?: string | null
          triggering_reading_id?: number | null
          updated_at?: string
          user_device_id?: number
          value?: number | null
          window_started_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "alert_state_attribute_id_fkey"
            columns: ["attribute_id"]
            isOneToOne: false
            referencedRelation: "attributes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "alert_state_inventory_device_id_fkey"
            columns: ["inventory_device_id"]
            isOneToOne: false
            referencedRelation: "inventory_devices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "alert_state_notifie_id_fkey"
            columns: ["notifie_id"]
            isOneToOne: false
            referencedRelation: "notifies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "alert_state_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "alert_state_user_device_id_fkey"
            columns: ["user_device_id"]
            isOneToOne: false
            referencedRelation: "user_devices"
            referencedColumns: ["id"]
          },
        ]
      }
      alert_windows: {
        Row: {
          attribute_key: string
          building_id: number | null
          company_id: number | null
          created_at: string
          days: string[] | null
          end_time: string
          id: number
          inventories: Json | null
          marina_id: number | null
          recurrence: Database["public"]["Enums"]["scheduler_recurrence"]
          rule_name: string | null
          start_time: string
          timezone: string
          updated_at: string
        }
        Insert: {
          attribute_key: string
          building_id?: number | null
          company_id?: number | null
          created_at?: string
          days?: string[] | null
          end_time: string
          id?: number
          inventories?: Json | null
          marina_id?: number | null
          recurrence?: Database["public"]["Enums"]["scheduler_recurrence"]
          rule_name?: string | null
          start_time: string
          timezone?: string
          updated_at?: string
        }
        Update: {
          attribute_key?: string
          building_id?: number | null
          company_id?: number | null
          created_at?: string
          days?: string[] | null
          end_time?: string
          id?: number
          inventories?: Json | null
          marina_id?: number | null
          recurrence?: Database["public"]["Enums"]["scheduler_recurrence"]
          rule_name?: string | null
          start_time?: string
          timezone?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "alert_windows_building_id_fkey"
            columns: ["building_id"]
            isOneToOne: false
            referencedRelation: "buildings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "alert_windows_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      app_xup: {
        Row: {
          app_id: number
          created_at: string
          id: number
          updated_at: string
          xup_id: number
        }
        Insert: {
          app_id: number
          created_at?: string
          id?: number
          updated_at?: string
          xup_id: number
        }
        Update: {
          app_id?: number
          created_at?: string
          id?: number
          updated_at?: string
          xup_id?: number
        }
        Relationships: [
          {
            foreignKeyName: "app_xup_app_id_fkey"
            columns: ["app_id"]
            isOneToOne: false
            referencedRelation: "apps"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "app_xup_xup_id_fkey"
            columns: ["xup_id"]
            isOneToOne: false
            referencedRelation: "xups"
            referencedColumns: ["id"]
          },
        ]
      }
      apps: {
        Row: {
          app_name: string
          created_at: string
          id: number
          optional_parameters: Json | null
          updated_at: string
          xup_id: number | null
        }
        Insert: {
          app_name: string
          created_at?: string
          id?: number
          optional_parameters?: Json | null
          updated_at?: string
          xup_id?: number | null
        }
        Update: {
          app_name?: string
          created_at?: string
          id?: number
          optional_parameters?: Json | null
          updated_at?: string
          xup_id?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "apps_xup_id_fkey"
            columns: ["xup_id"]
            isOneToOne: false
            referencedRelation: "xups"
            referencedColumns: ["id"]
          },
        ]
      }
      areas: {
        Row: {
          building_id: number
          created_at: string
          id: number
          name: string
          unit_id: number
          updated_at: string
        }
        Insert: {
          building_id: number
          created_at?: string
          id?: number
          name: string
          unit_id: number
          updated_at?: string
        }
        Update: {
          building_id?: number
          created_at?: string
          id?: number
          name?: string
          unit_id?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "areas_building_id_fkey"
            columns: ["building_id"]
            isOneToOne: false
            referencedRelation: "buildings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "areas_unit_id_fkey"
            columns: ["unit_id"]
            isOneToOne: false
            referencedRelation: "units"
            referencedColumns: ["id"]
          },
        ]
      }
      attributes: {
        Row: {
          alert_channel: string
          alert_message: string | null
          checkin: boolean
          comparison: string
          created_at: string
          description: string | null
          id: number
          neo_event_code: string | null
          notifie_id: number
          subject: string
          threshold: string | null
          updated_at: string
          xup_id: number | null
        }
        Insert: {
          alert_channel?: string
          alert_message?: string | null
          checkin?: boolean
          comparison: string
          created_at?: string
          description?: string | null
          id?: number
          neo_event_code?: string | null
          notifie_id: number
          subject: string
          threshold?: string | null
          updated_at?: string
          xup_id?: number | null
        }
        Update: {
          alert_channel?: string
          alert_message?: string | null
          checkin?: boolean
          comparison?: string
          created_at?: string
          description?: string | null
          id?: number
          neo_event_code?: string | null
          notifie_id?: number
          subject?: string
          threshold?: string | null
          updated_at?: string
          xup_id?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "attributes_notifie_id_fkey"
            columns: ["notifie_id"]
            isOneToOne: false
            referencedRelation: "notifies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attributes_xup_id_fkey"
            columns: ["xup_id"]
            isOneToOne: false
            referencedRelation: "xups"
            referencedColumns: ["id"]
          },
        ]
      }
      buildings: {
        Row: {
          building_code: string
          building_id: string
          city: string | null
          city_code: string
          clli_code: string | null
          company_id: number | null
          country: string | null
          county_code: string
          created_at: string
          id: number
          lata: string | null
          latitude: number | null
          location_code: string
          longitude: number | null
          noaa: string | null
          npa: string | null
          nxx: string | null
          on_net_type: string
          postal_code: string | null
          state_province: string | null
          street_address: string | null
          structure_category: string
          updated_at: string
        }
        Insert: {
          building_code: string
          building_id: string
          city?: string | null
          city_code: string
          clli_code?: string | null
          company_id?: number | null
          country?: string | null
          county_code: string
          created_at?: string
          id?: number
          lata?: string | null
          latitude?: number | null
          location_code: string
          longitude?: number | null
          noaa?: string | null
          npa?: string | null
          nxx?: string | null
          on_net_type?: string
          postal_code?: string | null
          state_province?: string | null
          street_address?: string | null
          structure_category?: string
          updated_at?: string
        }
        Update: {
          building_code?: string
          building_id?: string
          city?: string | null
          city_code?: string
          clli_code?: string | null
          company_id?: number | null
          country?: string | null
          county_code?: string
          created_at?: string
          id?: number
          lata?: string | null
          latitude?: number | null
          location_code?: string
          longitude?: number | null
          noaa?: string | null
          npa?: string | null
          nxx?: string | null
          on_net_type?: string
          postal_code?: string | null
          state_province?: string | null
          street_address?: string | null
          structure_category?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "buildings_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      charging_timers: {
        Row: {
          created_at: string
          id: number
          is_active: boolean
          kind: Database["public"]["Enums"]["charging_timer_kind"]
          seconds: number | null
          updated_at: string
          user_device_id: number | null
          user_id: string | null
        }
        Insert: {
          created_at?: string
          id?: number
          is_active?: boolean
          kind?: Database["public"]["Enums"]["charging_timer_kind"]
          seconds?: number | null
          updated_at?: string
          user_device_id?: number | null
          user_id?: string | null
        }
        Update: {
          created_at?: string
          id?: number
          is_active?: boolean
          kind?: Database["public"]["Enums"]["charging_timer_kind"]
          seconds?: number | null
          updated_at?: string
          user_device_id?: number | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "charging_timers_user_device_id_fkey"
            columns: ["user_device_id"]
            isOneToOne: false
            referencedRelation: "user_devices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "charging_timers_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      companies: {
        Row: {
          company_name: string
          created_at: string
          email: string
          id: number
          updated_at: string
          username: string
        }
        Insert: {
          company_name: string
          created_at?: string
          email: string
          id?: number
          updated_at?: string
          username: string
        }
        Update: {
          company_name?: string
          created_at?: string
          email?: string
          id?: number
          updated_at?: string
          username?: string
        }
        Relationships: []
      }
      containers: {
        Row: {
          code: string
          created_at: string
          id: number
          updated_at: string
        }
        Insert: {
          code: string
          created_at?: string
          id?: number
          updated_at?: string
        }
        Update: {
          code?: string
          created_at?: string
          id?: number
          updated_at?: string
        }
        Relationships: []
      }
      device_assignments: {
        Row: {
          assigned_at: string
          created_at: string
          entitlement_id: number
          id: number
          provider_subscription_id: string | null
          status: Database["public"]["Enums"]["device_assignment_status"]
          updated_at: string
          xnid: string
        }
        Insert: {
          assigned_at?: string
          created_at?: string
          entitlement_id: number
          id?: number
          provider_subscription_id?: string | null
          status?: Database["public"]["Enums"]["device_assignment_status"]
          updated_at?: string
          xnid: string
        }
        Update: {
          assigned_at?: string
          created_at?: string
          entitlement_id?: number
          id?: number
          provider_subscription_id?: string | null
          status?: Database["public"]["Enums"]["device_assignment_status"]
          updated_at?: string
          xnid?: string
        }
        Relationships: [
          {
            foreignKeyName: "device_assignments_entitlement_id_fkey"
            columns: ["entitlement_id"]
            isOneToOne: false
            referencedRelation: "subscription_entitlements"
            referencedColumns: ["id"]
          },
        ]
      }
      device_charging_state: {
        Row: {
          dev_eui: string | null
          inventory_device_id: number | null
          is_charging: boolean
          is_on: boolean | null
          last_command: string | null
          last_command_at: string | null
          last_status: string | null
          updated_at: string
          user_device_id: number
          user_id: string | null
        }
        Insert: {
          dev_eui?: string | null
          inventory_device_id?: number | null
          is_charging?: boolean
          is_on?: boolean | null
          last_command?: string | null
          last_command_at?: string | null
          last_status?: string | null
          updated_at?: string
          user_device_id: number
          user_id?: string | null
        }
        Update: {
          dev_eui?: string | null
          inventory_device_id?: number | null
          is_charging?: boolean
          is_on?: boolean | null
          last_command?: string | null
          last_command_at?: string | null
          last_status?: string | null
          updated_at?: string
          user_device_id?: number
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "device_charging_state_inventory_device_id_fkey"
            columns: ["inventory_device_id"]
            isOneToOne: false
            referencedRelation: "inventory_devices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "device_charging_state_user_device_id_fkey"
            columns: ["user_device_id"]
            isOneToOne: true
            referencedRelation: "user_devices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "device_charging_state_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      device_health_schedulers: {
        Row: {
          created_at: string
          days: Json | null
          id: number
          schedule_title: string
          selected_devices: Json | null
          time: string
          time_zone: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          days?: Json | null
          id?: number
          schedule_title: string
          selected_devices?: Json | null
          time: string
          time_zone: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          days?: Json | null
          id?: number
          schedule_title?: string
          selected_devices?: Json | null
          time?: string
          time_zone?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "device_health_schedulers_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      device_notification_recipients: {
        Row: {
          created_at: string
          emails: string[]
          id: number
          phone_numbers: string[]
          updated_at: string
          user_device_id: number | null
          user_id: string | null
        }
        Insert: {
          created_at?: string
          emails?: string[]
          id?: number
          phone_numbers?: string[]
          updated_at?: string
          user_device_id?: number | null
          user_id?: string | null
        }
        Update: {
          created_at?: string
          emails?: string[]
          id?: number
          phone_numbers?: string[]
          updated_at?: string
          user_device_id?: number | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "device_notification_recipients_user_device_id_fkey"
            columns: ["user_device_id"]
            isOneToOne: true
            referencedRelation: "user_devices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "device_notification_recipients_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      device_parameters: {
        Row: {
          battery_capacity: number | null
          battery_voltage: number | null
          charger_amperes: number | null
          charger_voltage: number | null
          charging_limits: number | null
          created_at: string
          desired_charging: number | null
          dev_eui: string | null
          email_alert: boolean
          id: number
          inventory_device_id: number | null
          is_default: boolean
          over_current_protection: boolean
          over_voltage_protection: boolean
          sms_alert: boolean
          updated_at: string
          user_device_id: number | null
          user_id: string | null
        }
        Insert: {
          battery_capacity?: number | null
          battery_voltage?: number | null
          charger_amperes?: number | null
          charger_voltage?: number | null
          charging_limits?: number | null
          created_at?: string
          desired_charging?: number | null
          dev_eui?: string | null
          email_alert?: boolean
          id?: number
          inventory_device_id?: number | null
          is_default?: boolean
          over_current_protection?: boolean
          over_voltage_protection?: boolean
          sms_alert?: boolean
          updated_at?: string
          user_device_id?: number | null
          user_id?: string | null
        }
        Update: {
          battery_capacity?: number | null
          battery_voltage?: number | null
          charger_amperes?: number | null
          charger_voltage?: number | null
          charging_limits?: number | null
          created_at?: string
          desired_charging?: number | null
          dev_eui?: string | null
          email_alert?: boolean
          id?: number
          inventory_device_id?: number | null
          is_default?: boolean
          over_current_protection?: boolean
          over_voltage_protection?: boolean
          sms_alert?: boolean
          updated_at?: string
          user_device_id?: number | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "device_parameters_inventory_device_id_fkey"
            columns: ["inventory_device_id"]
            isOneToOne: false
            referencedRelation: "inventory_devices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "device_parameters_user_device_id_fkey"
            columns: ["user_device_id"]
            isOneToOne: false
            referencedRelation: "user_devices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "device_parameters_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      device_schedules: {
        Row: {
          created_at: string
          device_type_id: number
          end_time: string
          id: number
          reminder: boolean
          selected_days: Json
          start_time: string
          turn_on: boolean
          updated_at: string
          user_device_id: number | null
        }
        Insert: {
          created_at?: string
          device_type_id: number
          end_time: string
          id?: number
          reminder?: boolean
          selected_days: Json
          start_time: string
          turn_on?: boolean
          updated_at?: string
          user_device_id?: number | null
        }
        Update: {
          created_at?: string
          device_type_id?: number
          end_time?: string
          id?: number
          reminder?: boolean
          selected_days?: Json
          start_time?: string
          turn_on?: boolean
          updated_at?: string
          user_device_id?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "device_schedules_device_type_id_fkey"
            columns: ["device_type_id"]
            isOneToOne: false
            referencedRelation: "device_types"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "device_schedules_user_device_id_fkey"
            columns: ["user_device_id"]
            isOneToOne: false
            referencedRelation: "user_devices"
            referencedColumns: ["id"]
          },
        ]
      }
      device_types: {
        Row: {
          created_at: string
          description: string | null
          id: number
          name: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: number
          name: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: number
          name?: string
          updated_at?: string
        }
        Relationships: []
      }
      domains: {
        Row: {
          created_at: string
          domain_url: string
          id: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          domain_url: string
          id?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          domain_url?: string
          id?: number
          updated_at?: string
        }
        Relationships: []
      }
      energy_usage_sessions: {
        Row: {
          counter: number | null
          created_at: string
          dev_eui: string
          energy_consumed: number | null
          id: number
          status: string
          updated_at: string
          user_device_id: number | null
        }
        Insert: {
          counter?: number | null
          created_at?: string
          dev_eui: string
          energy_consumed?: number | null
          id?: number
          status: string
          updated_at?: string
          user_device_id?: number | null
        }
        Update: {
          counter?: number | null
          created_at?: string
          dev_eui?: string
          energy_consumed?: number | null
          id?: number
          status?: string
          updated_at?: string
          user_device_id?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "energy_usage_sessions_user_device_id_fkey"
            columns: ["user_device_id"]
            isOneToOne: false
            referencedRelation: "user_devices"
            referencedColumns: ["id"]
          },
        ]
      }
      floors: {
        Row: {
          building_id: number
          created_at: string
          id: number
          name: string
          updated_at: string
        }
        Insert: {
          building_id: number
          created_at?: string
          id?: number
          name: string
          updated_at?: string
        }
        Update: {
          building_id?: number
          created_at?: string
          id?: number
          name?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "floors_building_id_fkey"
            columns: ["building_id"]
            isOneToOne: false
            referencedRelation: "buildings"
            referencedColumns: ["id"]
          },
        ]
      }
      impersonation_log: {
        Row: {
          actor_id: string
          ended_at: string | null
          id: number
          ip: unknown
          started_at: string
          target_id: string
          user_agent: string | null
        }
        Insert: {
          actor_id: string
          ended_at?: string | null
          id?: number
          ip?: unknown
          started_at?: string
          target_id: string
          user_agent?: string | null
        }
        Update: {
          actor_id?: string
          ended_at?: string | null
          id?: number
          ip?: unknown
          started_at?: string
          target_id?: string
          user_agent?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "impersonation_log_actor_id_fkey"
            columns: ["actor_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "impersonation_log_target_id_fkey"
            columns: ["target_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      inventory_device_secrets: {
        Row: {
          app_eui: string | null
          app_key: string | null
          appskey: string | null
          dev_addr: string | null
          inventory_device_id: number
          nwkskey: string | null
          updated_at: string
        }
        Insert: {
          app_eui?: string | null
          app_key?: string | null
          appskey?: string | null
          dev_addr?: string | null
          inventory_device_id: number
          nwkskey?: string | null
          updated_at?: string
        }
        Update: {
          app_eui?: string | null
          app_key?: string | null
          appskey?: string | null
          dev_addr?: string | null
          inventory_device_id?: number
          nwkskey?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "inventory_device_secrets_inventory_device_id_fkey"
            columns: ["inventory_device_id"]
            isOneToOne: true
            referencedRelation: "inventory_devices"
            referencedColumns: ["id"]
          },
        ]
      }
      inventory_devices: {
        Row: {
          activation_code: string | null
          company_id: number | null
          container_id: number
          created_at: string
          description: string | null
          dev_eui: string | null
          device_type_id: number | null
          id: number
          name: string
          part_number: string | null
          product_id: number
          serial_number: string | null
          t_code: string | null
          updated_at: string
          xnid: string | null
        }
        Insert: {
          activation_code?: string | null
          company_id?: number | null
          container_id: number
          created_at?: string
          description?: string | null
          dev_eui?: string | null
          device_type_id?: number | null
          id?: number
          name: string
          part_number?: string | null
          product_id: number
          serial_number?: string | null
          t_code?: string | null
          updated_at?: string
          xnid?: string | null
        }
        Update: {
          activation_code?: string | null
          company_id?: number | null
          container_id?: number
          created_at?: string
          description?: string | null
          dev_eui?: string | null
          device_type_id?: number | null
          id?: number
          name?: string
          part_number?: string | null
          product_id?: number
          serial_number?: string | null
          t_code?: string | null
          updated_at?: string
          xnid?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "inventory_devices_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_devices_container_id_fkey"
            columns: ["container_id"]
            isOneToOne: false
            referencedRelation: "containers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_devices_device_type_id_fkey"
            columns: ["device_type_id"]
            isOneToOne: false
            referencedRelation: "device_types"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_devices_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      modules: {
        Row: {
          code: string
          created_at: string
          description: string | null
          id: number
          name: string | null
          updated_at: string
        }
        Insert: {
          code: string
          created_at?: string
          description?: string | null
          id: number
          name?: string | null
          updated_at?: string
        }
        Update: {
          code?: string
          created_at?: string
          description?: string | null
          id?: number
          name?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      neo_alarm_logs: {
        Row: {
          account_code: string
          cid_code: string
          cid_payload: string | null
          cid_sent: boolean
          cid_sent_at: string | null
          created_at: string
          error_message: string | null
          event_code: string
          id: number
          point: number
          status: Database["public"]["Enums"]["neo_alarm_status"]
          telemetry_id: number | null
          uc_payload: Json | null
          uc_sent: boolean
          uc_sent_at: string | null
          updated_at: string
        }
        Insert: {
          account_code: string
          cid_code: string
          cid_payload?: string | null
          cid_sent?: boolean
          cid_sent_at?: string | null
          created_at?: string
          error_message?: string | null
          event_code: string
          id?: number
          point?: number
          status?: Database["public"]["Enums"]["neo_alarm_status"]
          telemetry_id?: number | null
          uc_payload?: Json | null
          uc_sent?: boolean
          uc_sent_at?: string | null
          updated_at?: string
        }
        Update: {
          account_code?: string
          cid_code?: string
          cid_payload?: string | null
          cid_sent?: boolean
          cid_sent_at?: string | null
          created_at?: string
          error_message?: string | null
          event_code?: string
          id?: number
          point?: number
          status?: Database["public"]["Enums"]["neo_alarm_status"]
          telemetry_id?: number | null
          uc_payload?: Json | null
          uc_sent?: boolean
          uc_sent_at?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      notification_prefs: {
        Row: {
          company_id: number | null
          created_at: string
          customer_email_enabled: boolean
          customer_phone_enabled: boolean
          device_email_enabled: boolean
          device_phone_enabled: boolean
          email_enabled: boolean
          id: number
          manager_email_enabled: boolean
          manager_phone_enabled: boolean
          phone_enabled: boolean
          updated_at: string
          user_device_id: number | null
          user_id: string | null
        }
        Insert: {
          company_id?: number | null
          created_at?: string
          customer_email_enabled?: boolean
          customer_phone_enabled?: boolean
          device_email_enabled?: boolean
          device_phone_enabled?: boolean
          email_enabled?: boolean
          id?: number
          manager_email_enabled?: boolean
          manager_phone_enabled?: boolean
          phone_enabled?: boolean
          updated_at?: string
          user_device_id?: number | null
          user_id?: string | null
        }
        Update: {
          company_id?: number | null
          created_at?: string
          customer_email_enabled?: boolean
          customer_phone_enabled?: boolean
          device_email_enabled?: boolean
          device_phone_enabled?: boolean
          email_enabled?: boolean
          id?: number
          manager_email_enabled?: boolean
          manager_phone_enabled?: boolean
          phone_enabled?: boolean
          updated_at?: string
          user_device_id?: number | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "notification_prefs_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notification_prefs_user_device_id_fkey"
            columns: ["user_device_id"]
            isOneToOne: false
            referencedRelation: "user_devices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notification_prefs_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      notifies: {
        Row: {
          created_at: string
          id: number
          name: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: number
          name?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: number
          name?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      packages: {
        Row: {
          created_at: string
          description: string | null
          duration: string | null
          id: number
          name: string
          price: number | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          duration?: string | null
          id?: number
          name: string
          price?: number | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          duration?: string | null
          id?: number
          name?: string
          price?: number | null
          updated_at?: string
        }
        Relationships: []
      }
      payment_details: {
        Row: {
          address_1: string | null
          address_2: string | null
          card_brand: string | null
          card_last4: string | null
          city: string | null
          country: string | null
          created_at: string
          first_name: string | null
          id: number
          last_name: string | null
          month: string | null
          payment_id: number
          state: string | null
          updated_at: string
          year: string | null
          zip_code: string | null
        }
        Insert: {
          address_1?: string | null
          address_2?: string | null
          card_brand?: string | null
          card_last4?: string | null
          city?: string | null
          country?: string | null
          created_at?: string
          first_name?: string | null
          id?: number
          last_name?: string | null
          month?: string | null
          payment_id: number
          state?: string | null
          updated_at?: string
          year?: string | null
          zip_code?: string | null
        }
        Update: {
          address_1?: string | null
          address_2?: string | null
          card_brand?: string | null
          card_last4?: string | null
          city?: string | null
          country?: string | null
          created_at?: string
          first_name?: string | null
          id?: number
          last_name?: string | null
          month?: string | null
          payment_id?: number
          state?: string | null
          updated_at?: string
          year?: string | null
          zip_code?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "payment_details_payment_id_fkey"
            columns: ["payment_id"]
            isOneToOne: true
            referencedRelation: "payments"
            referencedColumns: ["id"]
          },
        ]
      }
      payments: {
        Row: {
          amount: number
          created_at: string
          id: number
          payment_method: string | null
          payment_provider: Database["public"]["Enums"]["payment_provider"]
          provider_invoice_id: string | null
          provider_payment_id: string | null
          updated_at: string
          xnid: string | null
        }
        Insert: {
          amount?: number
          created_at?: string
          id?: number
          payment_method?: string | null
          payment_provider: Database["public"]["Enums"]["payment_provider"]
          provider_invoice_id?: string | null
          provider_payment_id?: string | null
          updated_at?: string
          xnid?: string | null
        }
        Update: {
          amount?: number
          created_at?: string
          id?: number
          payment_method?: string | null
          payment_provider?: Database["public"]["Enums"]["payment_provider"]
          provider_invoice_id?: string | null
          provider_payment_id?: string | null
          updated_at?: string
          xnid?: string | null
        }
        Relationships: []
      }
      plans: {
        Row: {
          activation_type: string
          amount: number | null
          billing_interval: string | null
          billing_modes: Database["public"]["Enums"]["billing_mode"][]
          billing_type: string
          created_at: string
          deleted_at: string | null
          device_limit: number
          id: number
          is_active: boolean
          max_devices_per_batch: number | null
          name: string
          notes: string | null
          plan_code: string
          plan_family: string
          provisioning_price_id: string | null
          requires_provisioning: boolean
          stripe_price_id: string | null
          stripe_product_id: string | null
          tags: string | null
          updated_at: string
          xero_account_code: string | null
          xero_revenue_code: string | null
        }
        Insert: {
          activation_type?: string
          amount?: number | null
          billing_interval?: string | null
          billing_modes?: Database["public"]["Enums"]["billing_mode"][]
          billing_type?: string
          created_at?: string
          deleted_at?: string | null
          device_limit?: number
          id?: number
          is_active?: boolean
          max_devices_per_batch?: number | null
          name: string
          notes?: string | null
          plan_code: string
          plan_family?: string
          provisioning_price_id?: string | null
          requires_provisioning?: boolean
          stripe_price_id?: string | null
          stripe_product_id?: string | null
          tags?: string | null
          updated_at?: string
          xero_account_code?: string | null
          xero_revenue_code?: string | null
        }
        Update: {
          activation_type?: string
          amount?: number | null
          billing_interval?: string | null
          billing_modes?: Database["public"]["Enums"]["billing_mode"][]
          billing_type?: string
          created_at?: string
          deleted_at?: string | null
          device_limit?: number
          id?: number
          is_active?: boolean
          max_devices_per_batch?: number | null
          name?: string
          notes?: string | null
          plan_code?: string
          plan_family?: string
          provisioning_price_id?: string | null
          requires_provisioning?: boolean
          stripe_price_id?: string | null
          stripe_product_id?: string | null
          tags?: string | null
          updated_at?: string
          xero_account_code?: string | null
          xero_revenue_code?: string | null
        }
        Relationships: []
      }
      product_plans: {
        Row: {
          plan_id: number
          product_id: number
        }
        Insert: {
          plan_id: number
          product_id: number
        }
        Update: {
          plan_id?: number
          product_id?: number
        }
        Relationships: [
          {
            foreignKeyName: "product_plans_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "plans"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_plans_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      products: {
        Row: {
          app_id: number | null
          company_id: number | null
          created_at: string
          device_id: string | null
          device_type_id: number | null
          dimensions: Json | null
          domain_id: number | null
          id: number
          image: string | null
          model: string | null
          notifie_id: number | null
          price: number | null
          product_description: string | null
          product_name: string | null
          sku: string | null
          sort_order: number | null
          status: boolean
          updated_at: string
          vendor_id: number | null
        }
        Insert: {
          app_id?: number | null
          company_id?: number | null
          created_at?: string
          device_id?: string | null
          device_type_id?: number | null
          dimensions?: Json | null
          domain_id?: number | null
          id?: number
          image?: string | null
          model?: string | null
          notifie_id?: number | null
          price?: number | null
          product_description?: string | null
          product_name?: string | null
          sku?: string | null
          sort_order?: number | null
          status?: boolean
          updated_at?: string
          vendor_id?: number | null
        }
        Update: {
          app_id?: number | null
          company_id?: number | null
          created_at?: string
          device_id?: string | null
          device_type_id?: number | null
          dimensions?: Json | null
          domain_id?: number | null
          id?: number
          image?: string | null
          model?: string | null
          notifie_id?: number | null
          price?: number | null
          product_description?: string | null
          product_name?: string | null
          sku?: string | null
          sort_order?: number | null
          status?: boolean
          updated_at?: string
          vendor_id?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "products_app_id_fkey"
            columns: ["app_id"]
            isOneToOne: false
            referencedRelation: "apps"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "products_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "products_device_type_id_fkey"
            columns: ["device_type_id"]
            isOneToOne: false
            referencedRelation: "device_types"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "products_domain_id_fkey"
            columns: ["domain_id"]
            isOneToOne: false
            referencedRelation: "domains"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "products_notifie_id_fkey"
            columns: ["notifie_id"]
            isOneToOne: false
            referencedRelation: "notifies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "products_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "vendors"
            referencedColumns: ["id"]
          },
        ]
      }
      profile_details: {
        Row: {
          address_1: string | null
          address_2: string | null
          city: string | null
          container_codes: string[]
          country: string | null
          created_at: string
          dealer_id: string | null
          email_notification: boolean
          id: number
          inventory_device_ids: number[]
          manager_email: Json | null
          manager_phone: Json | null
          notification_email: Json | null
          notification_phone: Json | null
          phone_notification: boolean
          phone_number: string | null
          phone_type: string | null
          postal_code: string | null
          state: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          address_1?: string | null
          address_2?: string | null
          city?: string | null
          container_codes?: string[]
          country?: string | null
          created_at?: string
          dealer_id?: string | null
          email_notification?: boolean
          id?: number
          inventory_device_ids?: number[]
          manager_email?: Json | null
          manager_phone?: Json | null
          notification_email?: Json | null
          notification_phone?: Json | null
          phone_notification?: boolean
          phone_number?: string | null
          phone_type?: string | null
          postal_code?: string | null
          state?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          address_1?: string | null
          address_2?: string | null
          city?: string | null
          container_codes?: string[]
          country?: string | null
          created_at?: string
          dealer_id?: string | null
          email_notification?: boolean
          id?: number
          inventory_device_ids?: number[]
          manager_email?: Json | null
          manager_phone?: Json | null
          notification_email?: Json | null
          notification_phone?: Json | null
          phone_notification?: boolean
          phone_number?: string | null
          phone_type?: string | null
          postal_code?: string | null
          state?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "profile_details_dealer_id_fkey"
            columns: ["dealer_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "profile_details_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          company_id: number | null
          created_at: string
          deleted_at: string | null
          domain_id: number | null
          fcm_token: string | null
          first_name: string | null
          id: string
          last_name: string | null
          legacy_id: number | null
          residence_customer: boolean
          role_type_id: number
          updated_at: string
          xnid: string | null
        }
        Insert: {
          company_id?: number | null
          created_at?: string
          deleted_at?: string | null
          domain_id?: number | null
          fcm_token?: string | null
          first_name?: string | null
          id: string
          last_name?: string | null
          legacy_id?: number | null
          residence_customer?: boolean
          role_type_id?: number
          updated_at?: string
          xnid?: string | null
        }
        Update: {
          company_id?: number | null
          created_at?: string
          deleted_at?: string | null
          domain_id?: number | null
          fcm_token?: string | null
          first_name?: string | null
          id?: string
          last_name?: string | null
          legacy_id?: number | null
          residence_customer?: boolean
          role_type_id?: number
          updated_at?: string
          xnid?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "profiles_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "profiles_domain_id_fkey"
            columns: ["domain_id"]
            isOneToOne: false
            referencedRelation: "domains"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "profiles_role_type_id_fkey"
            columns: ["role_type_id"]
            isOneToOne: false
            referencedRelation: "role_types"
            referencedColumns: ["id"]
          },
        ]
      }
      promo_codes: {
        Row: {
          created_at: string
          description: string | null
          id: number
          promo_code: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: number
          promo_code: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: number
          promo_code?: string
          updated_at?: string
        }
        Relationships: []
      }
      role_permissions: {
        Row: {
          can_create: boolean
          can_delete: boolean
          can_read: boolean
          can_update: boolean
          created_at: string
          module_id: number
          role_type_id: number
          updated_at: string
        }
        Insert: {
          can_create?: boolean
          can_delete?: boolean
          can_read?: boolean
          can_update?: boolean
          created_at?: string
          module_id: number
          role_type_id: number
          updated_at?: string
        }
        Update: {
          can_create?: boolean
          can_delete?: boolean
          can_read?: boolean
          can_update?: boolean
          created_at?: string
          module_id?: number
          role_type_id?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "role_permissions_module_id_fkey"
            columns: ["module_id"]
            isOneToOne: false
            referencedRelation: "modules"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "role_permissions_role_type_id_fkey"
            columns: ["role_type_id"]
            isOneToOne: false
            referencedRelation: "role_types"
            referencedColumns: ["id"]
          },
        ]
      }
      role_types: {
        Row: {
          created_at: string
          created_by: string | null
          description: string | null
          id: number
          title: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          description?: string | null
          id: number
          title: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: number
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "role_types_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      safeguard_configurations: {
        Row: {
          abnormal_alert_limit: number
          alert_interval_hours: number
          created_at: string
          id: number
          inventory_device_id: number | null
          is_active: boolean
          notifications_paused: boolean
          support_email_sent: Json | null
          support_email_sent_at: string | null
          support_number_sent: Json | null
          updated_at: string
          user_device_id: number | null
          user_id: string | null
        }
        Insert: {
          abnormal_alert_limit?: number
          alert_interval_hours?: number
          created_at?: string
          id?: number
          inventory_device_id?: number | null
          is_active?: boolean
          notifications_paused?: boolean
          support_email_sent?: Json | null
          support_email_sent_at?: string | null
          support_number_sent?: Json | null
          updated_at?: string
          user_device_id?: number | null
          user_id?: string | null
        }
        Update: {
          abnormal_alert_limit?: number
          alert_interval_hours?: number
          created_at?: string
          id?: number
          inventory_device_id?: number | null
          is_active?: boolean
          notifications_paused?: boolean
          support_email_sent?: Json | null
          support_email_sent_at?: string | null
          support_number_sent?: Json | null
          updated_at?: string
          user_device_id?: number | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "safeguard_configurations_inventory_device_id_fkey"
            columns: ["inventory_device_id"]
            isOneToOne: false
            referencedRelation: "inventory_devices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "safeguard_configurations_user_device_id_fkey"
            columns: ["user_device_id"]
            isOneToOne: false
            referencedRelation: "user_devices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "safeguard_configurations_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      sites: {
        Row: {
          accessory: string | null
          area_id: number
          building_id: number
          central_office_code: string | null
          city: string | null
          clli_code: string | null
          country: string | null
          created_at: string
          end_point: string | null
          id: number
          interface: string | null
          inventory_device_id: number | null
          lata: string | null
          latitude: number | null
          longitude: number | null
          market: string | null
          noaa: string | null
          npa: string | null
          nxx: string | null
          point: string
          postal_code: string | null
          room_name: string
          state_province: string | null
          street_address: string | null
          unit_label: string | null
          updated_at: string
          user_id: string | null
          xnid: string | null
        }
        Insert: {
          accessory?: string | null
          area_id: number
          building_id: number
          central_office_code?: string | null
          city?: string | null
          clli_code?: string | null
          country?: string | null
          created_at?: string
          end_point?: string | null
          id?: number
          interface?: string | null
          inventory_device_id?: number | null
          lata?: string | null
          latitude?: number | null
          longitude?: number | null
          market?: string | null
          noaa?: string | null
          npa?: string | null
          nxx?: string | null
          point?: string
          postal_code?: string | null
          room_name: string
          state_province?: string | null
          street_address?: string | null
          unit_label?: string | null
          updated_at?: string
          user_id?: string | null
          xnid?: string | null
        }
        Update: {
          accessory?: string | null
          area_id?: number
          building_id?: number
          central_office_code?: string | null
          city?: string | null
          clli_code?: string | null
          country?: string | null
          created_at?: string
          end_point?: string | null
          id?: number
          interface?: string | null
          inventory_device_id?: number | null
          lata?: string | null
          latitude?: number | null
          longitude?: number | null
          market?: string | null
          noaa?: string | null
          npa?: string | null
          nxx?: string | null
          point?: string
          postal_code?: string | null
          room_name?: string
          state_province?: string | null
          street_address?: string | null
          unit_label?: string | null
          updated_at?: string
          user_id?: string | null
          xnid?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "sites_area_id_fkey"
            columns: ["area_id"]
            isOneToOne: false
            referencedRelation: "areas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sites_building_id_fkey"
            columns: ["building_id"]
            isOneToOne: false
            referencedRelation: "buildings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sites_inventory_device_id_fkey"
            columns: ["inventory_device_id"]
            isOneToOne: true
            referencedRelation: "inventory_devices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sites_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      stripe_events: {
        Row: {
          created_at: string
          event_id: string
          id: number
          type: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          event_id: string
          id?: number
          type: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          event_id?: string
          id?: number
          type?: string
          updated_at?: string
        }
        Relationships: []
      }
      subscription_entitlements: {
        Row: {
          active_device_count: number
          billing_mode: Database["public"]["Enums"]["billing_mode"] | null
          billing_xnid: string | null
          cancelled_at: string | null
          created_at: string
          dealer_xnid: string | null
          id: number
          max_devices_allowed: number | null
          owner_xnid: string | null
          payment_provider: Database["public"]["Enums"]["payment_provider"]
          plan_id: number | null
          provider_customer_id: string | null
          provider_subscription_id: string | null
          source: Database["public"]["Enums"]["entitlement_source"]
          started_at: string | null
          status: string
          updated_at: string
          user_id: string | null
        }
        Insert: {
          active_device_count?: number
          billing_mode?: Database["public"]["Enums"]["billing_mode"] | null
          billing_xnid?: string | null
          cancelled_at?: string | null
          created_at?: string
          dealer_xnid?: string | null
          id?: number
          max_devices_allowed?: number | null
          owner_xnid?: string | null
          payment_provider?: Database["public"]["Enums"]["payment_provider"]
          plan_id?: number | null
          provider_customer_id?: string | null
          provider_subscription_id?: string | null
          source?: Database["public"]["Enums"]["entitlement_source"]
          started_at?: string | null
          status?: string
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          active_device_count?: number
          billing_mode?: Database["public"]["Enums"]["billing_mode"] | null
          billing_xnid?: string | null
          cancelled_at?: string | null
          created_at?: string
          dealer_xnid?: string | null
          id?: number
          max_devices_allowed?: number | null
          owner_xnid?: string | null
          payment_provider?: Database["public"]["Enums"]["payment_provider"]
          plan_id?: number | null
          provider_customer_id?: string | null
          provider_subscription_id?: string | null
          source?: Database["public"]["Enums"]["entitlement_source"]
          started_at?: string | null
          status?: string
          updated_at?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "subscription_entitlements_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "plans"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "subscription_entitlements_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      sunset_rises: {
        Row: {
          created_at: string
          device_type_id: number
          id: number
          reminder: boolean
          selected_days: Json
          sunrise: number
          sunset: number
          turn_on: boolean
          updated_at: string
          user_device_id: number
        }
        Insert: {
          created_at?: string
          device_type_id: number
          id?: number
          reminder?: boolean
          selected_days: Json
          sunrise: number
          sunset: number
          turn_on: boolean
          updated_at?: string
          user_device_id: number
        }
        Update: {
          created_at?: string
          device_type_id?: number
          id?: number
          reminder?: boolean
          selected_days?: Json
          sunrise?: number
          sunset?: number
          turn_on?: boolean
          updated_at?: string
          user_device_id?: number
        }
        Relationships: [
          {
            foreignKeyName: "sunset_rises_device_type_id_fkey"
            columns: ["device_type_id"]
            isOneToOne: false
            referencedRelation: "device_types"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sunset_rises_user_device_id_fkey"
            columns: ["user_device_id"]
            isOneToOne: false
            referencedRelation: "user_devices"
            referencedColumns: ["id"]
          },
        ]
      }
      telemetry: {
        Row: {
          active_power: number | null
          altitude: number | null
          apparent_power: number | null
          created_at: string
          current: number | null
          dev_eui: string
          energy_consumption_meter_consumed: number | null
          energy_consumption_meter_elapsed: number | null
          external_input: boolean | null
          gateway_id: string | null
          humidity: number | null
          id: number
          inventory_device_id: number | null
          latitude: number | null
          legacy_id: number | null
          legacy_mongo_id: string | null
          light: boolean | null
          longitude: number | null
          luminosity: number | null
          move: boolean | null
          power_factor: number | null
          raw_body: Json | null
          raw_packet: string | null
          raw_source: string
          reactive_power: number | null
          reed_state: number | null
          temperature: number | null
          updated_at: string
          user_device_id: number | null
          user_id: string | null
          voltage: number | null
          xup_decoded_edr: Json | null
          xup_encoded_edr: string | null
        }
        Insert: {
          active_power?: number | null
          altitude?: number | null
          apparent_power?: number | null
          created_at: string
          current?: number | null
          dev_eui: string
          energy_consumption_meter_consumed?: number | null
          energy_consumption_meter_elapsed?: number | null
          external_input?: boolean | null
          gateway_id?: string | null
          humidity?: number | null
          id?: number
          inventory_device_id?: number | null
          latitude?: number | null
          legacy_id?: number | null
          legacy_mongo_id?: string | null
          light?: boolean | null
          longitude?: number | null
          luminosity?: number | null
          move?: boolean | null
          power_factor?: number | null
          raw_body?: Json | null
          raw_packet?: string | null
          raw_source?: string
          reactive_power?: number | null
          reed_state?: number | null
          temperature?: number | null
          updated_at?: string
          user_device_id?: number | null
          user_id?: string | null
          voltage?: number | null
          xup_decoded_edr?: Json | null
          xup_encoded_edr?: string | null
        }
        Update: {
          active_power?: number | null
          altitude?: number | null
          apparent_power?: number | null
          created_at?: string
          current?: number | null
          dev_eui?: string
          energy_consumption_meter_consumed?: number | null
          energy_consumption_meter_elapsed?: number | null
          external_input?: boolean | null
          gateway_id?: string | null
          humidity?: number | null
          id?: number
          inventory_device_id?: number | null
          latitude?: number | null
          legacy_id?: number | null
          legacy_mongo_id?: string | null
          light?: boolean | null
          longitude?: number | null
          luminosity?: number | null
          move?: boolean | null
          power_factor?: number | null
          raw_body?: Json | null
          raw_packet?: string | null
          raw_source?: string
          reactive_power?: number | null
          reed_state?: number | null
          temperature?: number | null
          updated_at?: string
          user_device_id?: number | null
          user_id?: string | null
          voltage?: number | null
          xup_decoded_edr?: Json | null
          xup_encoded_edr?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "telemetry_inventory_device_id_fkey"
            columns: ["inventory_device_id"]
            isOneToOne: false
            referencedRelation: "inventory_devices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "telemetry_user_device_id_fkey"
            columns: ["user_device_id"]
            isOneToOne: false
            referencedRelation: "user_devices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "telemetry_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      telemetry_2024_01: {
        Row: {
          active_power: number | null
          altitude: number | null
          apparent_power: number | null
          created_at: string
          current: number | null
          dev_eui: string
          energy_consumption_meter_consumed: number | null
          energy_consumption_meter_elapsed: number | null
          external_input: boolean | null
          gateway_id: string | null
          humidity: number | null
          id: number
          inventory_device_id: number | null
          latitude: number | null
          legacy_id: number | null
          legacy_mongo_id: string | null
          light: boolean | null
          longitude: number | null
          luminosity: number | null
          move: boolean | null
          power_factor: number | null
          raw_body: Json | null
          raw_packet: string | null
          raw_source: string
          reactive_power: number | null
          reed_state: number | null
          temperature: number | null
          updated_at: string
          user_device_id: number | null
          user_id: string | null
          voltage: number | null
          xup_decoded_edr: Json | null
          xup_encoded_edr: string | null
        }
        Insert: {
          active_power?: number | null
          altitude?: number | null
          apparent_power?: number | null
          created_at: string
          current?: number | null
          dev_eui: string
          energy_consumption_meter_consumed?: number | null
          energy_consumption_meter_elapsed?: number | null
          external_input?: boolean | null
          gateway_id?: string | null
          humidity?: number | null
          id?: number
          inventory_device_id?: number | null
          latitude?: number | null
          legacy_id?: number | null
          legacy_mongo_id?: string | null
          light?: boolean | null
          longitude?: number | null
          luminosity?: number | null
          move?: boolean | null
          power_factor?: number | null
          raw_body?: Json | null
          raw_packet?: string | null
          raw_source?: string
          reactive_power?: number | null
          reed_state?: number | null
          temperature?: number | null
          updated_at?: string
          user_device_id?: number | null
          user_id?: string | null
          voltage?: number | null
          xup_decoded_edr?: Json | null
          xup_encoded_edr?: string | null
        }
        Update: {
          active_power?: number | null
          altitude?: number | null
          apparent_power?: number | null
          created_at?: string
          current?: number | null
          dev_eui?: string
          energy_consumption_meter_consumed?: number | null
          energy_consumption_meter_elapsed?: number | null
          external_input?: boolean | null
          gateway_id?: string | null
          humidity?: number | null
          id?: number
          inventory_device_id?: number | null
          latitude?: number | null
          legacy_id?: number | null
          legacy_mongo_id?: string | null
          light?: boolean | null
          longitude?: number | null
          luminosity?: number | null
          move?: boolean | null
          power_factor?: number | null
          raw_body?: Json | null
          raw_packet?: string | null
          raw_source?: string
          reactive_power?: number | null
          reed_state?: number | null
          temperature?: number | null
          updated_at?: string
          user_device_id?: number | null
          user_id?: string | null
          voltage?: number | null
          xup_decoded_edr?: Json | null
          xup_encoded_edr?: string | null
        }
        Relationships: []
      }
      telemetry_2024_02: {
        Row: {
          active_power: number | null
          altitude: number | null
          apparent_power: number | null
          created_at: string
          current: number | null
          dev_eui: string
          energy_consumption_meter_consumed: number | null
          energy_consumption_meter_elapsed: number | null
          external_input: boolean | null
          gateway_id: string | null
          humidity: number | null
          id: number
          inventory_device_id: number | null
          latitude: number | null
          legacy_id: number | null
          legacy_mongo_id: string | null
          light: boolean | null
          longitude: number | null
          luminosity: number | null
          move: boolean | null
          power_factor: number | null
          raw_body: Json | null
          raw_packet: string | null
          raw_source: string
          reactive_power: number | null
          reed_state: number | null
          temperature: number | null
          updated_at: string
          user_device_id: number | null
          user_id: string | null
          voltage: number | null
          xup_decoded_edr: Json | null
          xup_encoded_edr: string | null
        }
        Insert: {
          active_power?: number | null
          altitude?: number | null
          apparent_power?: number | null
          created_at: string
          current?: number | null
          dev_eui: string
          energy_consumption_meter_consumed?: number | null
          energy_consumption_meter_elapsed?: number | null
          external_input?: boolean | null
          gateway_id?: string | null
          humidity?: number | null
          id?: number
          inventory_device_id?: number | null
          latitude?: number | null
          legacy_id?: number | null
          legacy_mongo_id?: string | null
          light?: boolean | null
          longitude?: number | null
          luminosity?: number | null
          move?: boolean | null
          power_factor?: number | null
          raw_body?: Json | null
          raw_packet?: string | null
          raw_source?: string
          reactive_power?: number | null
          reed_state?: number | null
          temperature?: number | null
          updated_at?: string
          user_device_id?: number | null
          user_id?: string | null
          voltage?: number | null
          xup_decoded_edr?: Json | null
          xup_encoded_edr?: string | null
        }
        Update: {
          active_power?: number | null
          altitude?: number | null
          apparent_power?: number | null
          created_at?: string
          current?: number | null
          dev_eui?: string
          energy_consumption_meter_consumed?: number | null
          energy_consumption_meter_elapsed?: number | null
          external_input?: boolean | null
          gateway_id?: string | null
          humidity?: number | null
          id?: number
          inventory_device_id?: number | null
          latitude?: number | null
          legacy_id?: number | null
          legacy_mongo_id?: string | null
          light?: boolean | null
          longitude?: number | null
          luminosity?: number | null
          move?: boolean | null
          power_factor?: number | null
          raw_body?: Json | null
          raw_packet?: string | null
          raw_source?: string
          reactive_power?: number | null
          reed_state?: number | null
          temperature?: number | null
          updated_at?: string
          user_device_id?: number | null
          user_id?: string | null
          voltage?: number | null
          xup_decoded_edr?: Json | null
          xup_encoded_edr?: string | null
        }
        Relationships: []
      }
      telemetry_2024_03: {
        Row: {
          active_power: number | null
          altitude: number | null
          apparent_power: number | null
          created_at: string
          current: number | null
          dev_eui: string
          energy_consumption_meter_consumed: number | null
          energy_consumption_meter_elapsed: number | null
          external_input: boolean | null
          gateway_id: string | null
          humidity: number | null
          id: number
          inventory_device_id: number | null
          latitude: number | null
          legacy_id: number | null
          legacy_mongo_id: string | null
          light: boolean | null
          longitude: number | null
          luminosity: number | null
          move: boolean | null
          power_factor: number | null
          raw_body: Json | null
          raw_packet: string | null
          raw_source: string
          reactive_power: number | null
          reed_state: number | null
          temperature: number | null
          updated_at: string
          user_device_id: number | null
          user_id: string | null
          voltage: number | null
          xup_decoded_edr: Json | null
          xup_encoded_edr: string | null
        }
        Insert: {
          active_power?: number | null
          altitude?: number | null
          apparent_power?: number | null
          created_at: string
          current?: number | null
          dev_eui: string
          energy_consumption_meter_consumed?: number | null
          energy_consumption_meter_elapsed?: number | null
          external_input?: boolean | null
          gateway_id?: string | null
          humidity?: number | null
          id?: number
          inventory_device_id?: number | null
          latitude?: number | null
          legacy_id?: number | null
          legacy_mongo_id?: string | null
          light?: boolean | null
          longitude?: number | null
          luminosity?: number | null
          move?: boolean | null
          power_factor?: number | null
          raw_body?: Json | null
          raw_packet?: string | null
          raw_source?: string
          reactive_power?: number | null
          reed_state?: number | null
          temperature?: number | null
          updated_at?: string
          user_device_id?: number | null
          user_id?: string | null
          voltage?: number | null
          xup_decoded_edr?: Json | null
          xup_encoded_edr?: string | null
        }
        Update: {
          active_power?: number | null
          altitude?: number | null
          apparent_power?: number | null
          created_at?: string
          current?: number | null
          dev_eui?: string
          energy_consumption_meter_consumed?: number | null
          energy_consumption_meter_elapsed?: number | null
          external_input?: boolean | null
          gateway_id?: string | null
          humidity?: number | null
          id?: number
          inventory_device_id?: number | null
          latitude?: number | null
          legacy_id?: number | null
          legacy_mongo_id?: string | null
          light?: boolean | null
          longitude?: number | null
          luminosity?: number | null
          move?: boolean | null
          power_factor?: number | null
          raw_body?: Json | null
          raw_packet?: string | null
          raw_source?: string
          reactive_power?: number | null
          reed_state?: number | null
          temperature?: number | null
          updated_at?: string
          user_device_id?: number | null
          user_id?: string | null
          voltage?: number | null
          xup_decoded_edr?: Json | null
          xup_encoded_edr?: string | null
        }
        Relationships: []
      }
      telemetry_2024_04: {
        Row: {
          active_power: number | null
          altitude: number | null
          apparent_power: number | null
          created_at: string
          current: number | null
          dev_eui: string
          energy_consumption_meter_consumed: number | null
          energy_consumption_meter_elapsed: number | null
          external_input: boolean | null
          gateway_id: string | null
          humidity: number | null
          id: number
          inventory_device_id: number | null
          latitude: number | null
          legacy_id: number | null
          legacy_mongo_id: string | null
          light: boolean | null
          longitude: number | null
          luminosity: number | null
          move: boolean | null
          power_factor: number | null
          raw_body: Json | null
          raw_packet: string | null
          raw_source: string
          reactive_power: number | null
          reed_state: number | null
          temperature: number | null
          updated_at: string
          user_device_id: number | null
          user_id: string | null
          voltage: number | null
          xup_decoded_edr: Json | null
          xup_encoded_edr: string | null
        }
        Insert: {
          active_power?: number | null
          altitude?: number | null
          apparent_power?: number | null
          created_at: string
          current?: number | null
          dev_eui: string
          energy_consumption_meter_consumed?: number | null
          energy_consumption_meter_elapsed?: number | null
          external_input?: boolean | null
          gateway_id?: string | null
          humidity?: number | null
          id?: number
          inventory_device_id?: number | null
          latitude?: number | null
          legacy_id?: number | null
          legacy_mongo_id?: string | null
          light?: boolean | null
          longitude?: number | null
          luminosity?: number | null
          move?: boolean | null
          power_factor?: number | null
          raw_body?: Json | null
          raw_packet?: string | null
          raw_source?: string
          reactive_power?: number | null
          reed_state?: number | null
          temperature?: number | null
          updated_at?: string
          user_device_id?: number | null
          user_id?: string | null
          voltage?: number | null
          xup_decoded_edr?: Json | null
          xup_encoded_edr?: string | null
        }
        Update: {
          active_power?: number | null
          altitude?: number | null
          apparent_power?: number | null
          created_at?: string
          current?: number | null
          dev_eui?: string
          energy_consumption_meter_consumed?: number | null
          energy_consumption_meter_elapsed?: number | null
          external_input?: boolean | null
          gateway_id?: string | null
          humidity?: number | null
          id?: number
          inventory_device_id?: number | null
          latitude?: number | null
          legacy_id?: number | null
          legacy_mongo_id?: string | null
          light?: boolean | null
          longitude?: number | null
          luminosity?: number | null
          move?: boolean | null
          power_factor?: number | null
          raw_body?: Json | null
          raw_packet?: string | null
          raw_source?: string
          reactive_power?: number | null
          reed_state?: number | null
          temperature?: number | null
          updated_at?: string
          user_device_id?: number | null
          user_id?: string | null
          voltage?: number | null
          xup_decoded_edr?: Json | null
          xup_encoded_edr?: string | null
        }
        Relationships: []
      }
      telemetry_2024_05: {
        Row: {
          active_power: number | null
          altitude: number | null
          apparent_power: number | null
          created_at: string
          current: number | null
          dev_eui: string
          energy_consumption_meter_consumed: number | null
          energy_consumption_meter_elapsed: number | null
          external_input: boolean | null
          gateway_id: string | null
          humidity: number | null
          id: number
          inventory_device_id: number | null
          latitude: number | null
          legacy_id: number | null
          legacy_mongo_id: string | null
          light: boolean | null
          longitude: number | null
          luminosity: number | null
          move: boolean | null
          power_factor: number | null
          raw_body: Json | null
          raw_packet: string | null
          raw_source: string
          reactive_power: number | null
          reed_state: number | null
          temperature: number | null
          updated_at: string
          user_device_id: number | null
          user_id: string | null
          voltage: number | null
          xup_decoded_edr: Json | null
          xup_encoded_edr: string | null
        }
        Insert: {
          active_power?: number | null
          altitude?: number | null
          apparent_power?: number | null
          created_at: string
          current?: number | null
          dev_eui: string
          energy_consumption_meter_consumed?: number | null
          energy_consumption_meter_elapsed?: number | null
          external_input?: boolean | null
          gateway_id?: string | null
          humidity?: number | null
          id?: number
          inventory_device_id?: number | null
          latitude?: number | null
          legacy_id?: number | null
          legacy_mongo_id?: string | null
          light?: boolean | null
          longitude?: number | null
          luminosity?: number | null
          move?: boolean | null
          power_factor?: number | null
          raw_body?: Json | null
          raw_packet?: string | null
          raw_source?: string
          reactive_power?: number | null
          reed_state?: number | null
          temperature?: number | null
          updated_at?: string
          user_device_id?: number | null
          user_id?: string | null
          voltage?: number | null
          xup_decoded_edr?: Json | null
          xup_encoded_edr?: string | null
        }
        Update: {
          active_power?: number | null
          altitude?: number | null
          apparent_power?: number | null
          created_at?: string
          current?: number | null
          dev_eui?: string
          energy_consumption_meter_consumed?: number | null
          energy_consumption_meter_elapsed?: number | null
          external_input?: boolean | null
          gateway_id?: string | null
          humidity?: number | null
          id?: number
          inventory_device_id?: number | null
          latitude?: number | null
          legacy_id?: number | null
          legacy_mongo_id?: string | null
          light?: boolean | null
          longitude?: number | null
          luminosity?: number | null
          move?: boolean | null
          power_factor?: number | null
          raw_body?: Json | null
          raw_packet?: string | null
          raw_source?: string
          reactive_power?: number | null
          reed_state?: number | null
          temperature?: number | null
          updated_at?: string
          user_device_id?: number | null
          user_id?: string | null
          voltage?: number | null
          xup_decoded_edr?: Json | null
          xup_encoded_edr?: string | null
        }
        Relationships: []
      }
      telemetry_2024_06: {
        Row: {
          active_power: number | null
          altitude: number | null
          apparent_power: number | null
          created_at: string
          current: number | null
          dev_eui: string
          energy_consumption_meter_consumed: number | null
          energy_consumption_meter_elapsed: number | null
          external_input: boolean | null
          gateway_id: string | null
          humidity: number | null
          id: number
          inventory_device_id: number | null
          latitude: number | null
          legacy_id: number | null
          legacy_mongo_id: string | null
          light: boolean | null
          longitude: number | null
          luminosity: number | null
          move: boolean | null
          power_factor: number | null
          raw_body: Json | null
          raw_packet: string | null
          raw_source: string
          reactive_power: number | null
          reed_state: number | null
          temperature: number | null
          updated_at: string
          user_device_id: number | null
          user_id: string | null
          voltage: number | null
          xup_decoded_edr: Json | null
          xup_encoded_edr: string | null
        }
        Insert: {
          active_power?: number | null
          altitude?: number | null
          apparent_power?: number | null
          created_at: string
          current?: number | null
          dev_eui: string
          energy_consumption_meter_consumed?: number | null
          energy_consumption_meter_elapsed?: number | null
          external_input?: boolean | null
          gateway_id?: string | null
          humidity?: number | null
          id?: number
          inventory_device_id?: number | null
          latitude?: number | null
          legacy_id?: number | null
          legacy_mongo_id?: string | null
          light?: boolean | null
          longitude?: number | null
          luminosity?: number | null
          move?: boolean | null
          power_factor?: number | null
          raw_body?: Json | null
          raw_packet?: string | null
          raw_source?: string
          reactive_power?: number | null
          reed_state?: number | null
          temperature?: number | null
          updated_at?: string
          user_device_id?: number | null
          user_id?: string | null
          voltage?: number | null
          xup_decoded_edr?: Json | null
          xup_encoded_edr?: string | null
        }
        Update: {
          active_power?: number | null
          altitude?: number | null
          apparent_power?: number | null
          created_at?: string
          current?: number | null
          dev_eui?: string
          energy_consumption_meter_consumed?: number | null
          energy_consumption_meter_elapsed?: number | null
          external_input?: boolean | null
          gateway_id?: string | null
          humidity?: number | null
          id?: number
          inventory_device_id?: number | null
          latitude?: number | null
          legacy_id?: number | null
          legacy_mongo_id?: string | null
          light?: boolean | null
          longitude?: number | null
          luminosity?: number | null
          move?: boolean | null
          power_factor?: number | null
          raw_body?: Json | null
          raw_packet?: string | null
          raw_source?: string
          reactive_power?: number | null
          reed_state?: number | null
          temperature?: number | null
          updated_at?: string
          user_device_id?: number | null
          user_id?: string | null
          voltage?: number | null
          xup_decoded_edr?: Json | null
          xup_encoded_edr?: string | null
        }
        Relationships: []
      }
      telemetry_2024_07: {
        Row: {
          active_power: number | null
          altitude: number | null
          apparent_power: number | null
          created_at: string
          current: number | null
          dev_eui: string
          energy_consumption_meter_consumed: number | null
          energy_consumption_meter_elapsed: number | null
          external_input: boolean | null
          gateway_id: string | null
          humidity: number | null
          id: number
          inventory_device_id: number | null
          latitude: number | null
          legacy_id: number | null
          legacy_mongo_id: string | null
          light: boolean | null
          longitude: number | null
          luminosity: number | null
          move: boolean | null
          power_factor: number | null
          raw_body: Json | null
          raw_packet: string | null
          raw_source: string
          reactive_power: number | null
          reed_state: number | null
          temperature: number | null
          updated_at: string
          user_device_id: number | null
          user_id: string | null
          voltage: number | null
          xup_decoded_edr: Json | null
          xup_encoded_edr: string | null
        }
        Insert: {
          active_power?: number | null
          altitude?: number | null
          apparent_power?: number | null
          created_at: string
          current?: number | null
          dev_eui: string
          energy_consumption_meter_consumed?: number | null
          energy_consumption_meter_elapsed?: number | null
          external_input?: boolean | null
          gateway_id?: string | null
          humidity?: number | null
          id?: number
          inventory_device_id?: number | null
          latitude?: number | null
          legacy_id?: number | null
          legacy_mongo_id?: string | null
          light?: boolean | null
          longitude?: number | null
          luminosity?: number | null
          move?: boolean | null
          power_factor?: number | null
          raw_body?: Json | null
          raw_packet?: string | null
          raw_source?: string
          reactive_power?: number | null
          reed_state?: number | null
          temperature?: number | null
          updated_at?: string
          user_device_id?: number | null
          user_id?: string | null
          voltage?: number | null
          xup_decoded_edr?: Json | null
          xup_encoded_edr?: string | null
        }
        Update: {
          active_power?: number | null
          altitude?: number | null
          apparent_power?: number | null
          created_at?: string
          current?: number | null
          dev_eui?: string
          energy_consumption_meter_consumed?: number | null
          energy_consumption_meter_elapsed?: number | null
          external_input?: boolean | null
          gateway_id?: string | null
          humidity?: number | null
          id?: number
          inventory_device_id?: number | null
          latitude?: number | null
          legacy_id?: number | null
          legacy_mongo_id?: string | null
          light?: boolean | null
          longitude?: number | null
          luminosity?: number | null
          move?: boolean | null
          power_factor?: number | null
          raw_body?: Json | null
          raw_packet?: string | null
          raw_source?: string
          reactive_power?: number | null
          reed_state?: number | null
          temperature?: number | null
          updated_at?: string
          user_device_id?: number | null
          user_id?: string | null
          voltage?: number | null
          xup_decoded_edr?: Json | null
          xup_encoded_edr?: string | null
        }
        Relationships: []
      }
      telemetry_2024_08: {
        Row: {
          active_power: number | null
          altitude: number | null
          apparent_power: number | null
          created_at: string
          current: number | null
          dev_eui: string
          energy_consumption_meter_consumed: number | null
          energy_consumption_meter_elapsed: number | null
          external_input: boolean | null
          gateway_id: string | null
          humidity: number | null
          id: number
          inventory_device_id: number | null
          latitude: number | null
          legacy_id: number | null
          legacy_mongo_id: string | null
          light: boolean | null
          longitude: number | null
          luminosity: number | null
          move: boolean | null
          power_factor: number | null
          raw_body: Json | null
          raw_packet: string | null
          raw_source: string
          reactive_power: number | null
          reed_state: number | null
          temperature: number | null
          updated_at: string
          user_device_id: number | null
          user_id: string | null
          voltage: number | null
          xup_decoded_edr: Json | null
          xup_encoded_edr: string | null
        }
        Insert: {
          active_power?: number | null
          altitude?: number | null
          apparent_power?: number | null
          created_at: string
          current?: number | null
          dev_eui: string
          energy_consumption_meter_consumed?: number | null
          energy_consumption_meter_elapsed?: number | null
          external_input?: boolean | null
          gateway_id?: string | null
          humidity?: number | null
          id?: number
          inventory_device_id?: number | null
          latitude?: number | null
          legacy_id?: number | null
          legacy_mongo_id?: string | null
          light?: boolean | null
          longitude?: number | null
          luminosity?: number | null
          move?: boolean | null
          power_factor?: number | null
          raw_body?: Json | null
          raw_packet?: string | null
          raw_source?: string
          reactive_power?: number | null
          reed_state?: number | null
          temperature?: number | null
          updated_at?: string
          user_device_id?: number | null
          user_id?: string | null
          voltage?: number | null
          xup_decoded_edr?: Json | null
          xup_encoded_edr?: string | null
        }
        Update: {
          active_power?: number | null
          altitude?: number | null
          apparent_power?: number | null
          created_at?: string
          current?: number | null
          dev_eui?: string
          energy_consumption_meter_consumed?: number | null
          energy_consumption_meter_elapsed?: number | null
          external_input?: boolean | null
          gateway_id?: string | null
          humidity?: number | null
          id?: number
          inventory_device_id?: number | null
          latitude?: number | null
          legacy_id?: number | null
          legacy_mongo_id?: string | null
          light?: boolean | null
          longitude?: number | null
          luminosity?: number | null
          move?: boolean | null
          power_factor?: number | null
          raw_body?: Json | null
          raw_packet?: string | null
          raw_source?: string
          reactive_power?: number | null
          reed_state?: number | null
          temperature?: number | null
          updated_at?: string
          user_device_id?: number | null
          user_id?: string | null
          voltage?: number | null
          xup_decoded_edr?: Json | null
          xup_encoded_edr?: string | null
        }
        Relationships: []
      }
      telemetry_2024_09: {
        Row: {
          active_power: number | null
          altitude: number | null
          apparent_power: number | null
          created_at: string
          current: number | null
          dev_eui: string
          energy_consumption_meter_consumed: number | null
          energy_consumption_meter_elapsed: number | null
          external_input: boolean | null
          gateway_id: string | null
          humidity: number | null
          id: number
          inventory_device_id: number | null
          latitude: number | null
          legacy_id: number | null
          legacy_mongo_id: string | null
          light: boolean | null
          longitude: number | null
          luminosity: number | null
          move: boolean | null
          power_factor: number | null
          raw_body: Json | null
          raw_packet: string | null
          raw_source: string
          reactive_power: number | null
          reed_state: number | null
          temperature: number | null
          updated_at: string
          user_device_id: number | null
          user_id: string | null
          voltage: number | null
          xup_decoded_edr: Json | null
          xup_encoded_edr: string | null
        }
        Insert: {
          active_power?: number | null
          altitude?: number | null
          apparent_power?: number | null
          created_at: string
          current?: number | null
          dev_eui: string
          energy_consumption_meter_consumed?: number | null
          energy_consumption_meter_elapsed?: number | null
          external_input?: boolean | null
          gateway_id?: string | null
          humidity?: number | null
          id?: number
          inventory_device_id?: number | null
          latitude?: number | null
          legacy_id?: number | null
          legacy_mongo_id?: string | null
          light?: boolean | null
          longitude?: number | null
          luminosity?: number | null
          move?: boolean | null
          power_factor?: number | null
          raw_body?: Json | null
          raw_packet?: string | null
          raw_source?: string
          reactive_power?: number | null
          reed_state?: number | null
          temperature?: number | null
          updated_at?: string
          user_device_id?: number | null
          user_id?: string | null
          voltage?: number | null
          xup_decoded_edr?: Json | null
          xup_encoded_edr?: string | null
        }
        Update: {
          active_power?: number | null
          altitude?: number | null
          apparent_power?: number | null
          created_at?: string
          current?: number | null
          dev_eui?: string
          energy_consumption_meter_consumed?: number | null
          energy_consumption_meter_elapsed?: number | null
          external_input?: boolean | null
          gateway_id?: string | null
          humidity?: number | null
          id?: number
          inventory_device_id?: number | null
          latitude?: number | null
          legacy_id?: number | null
          legacy_mongo_id?: string | null
          light?: boolean | null
          longitude?: number | null
          luminosity?: number | null
          move?: boolean | null
          power_factor?: number | null
          raw_body?: Json | null
          raw_packet?: string | null
          raw_source?: string
          reactive_power?: number | null
          reed_state?: number | null
          temperature?: number | null
          updated_at?: string
          user_device_id?: number | null
          user_id?: string | null
          voltage?: number | null
          xup_decoded_edr?: Json | null
          xup_encoded_edr?: string | null
        }
        Relationships: []
      }
      telemetry_2024_10: {
        Row: {
          active_power: number | null
          altitude: number | null
          apparent_power: number | null
          created_at: string
          current: number | null
          dev_eui: string
          energy_consumption_meter_consumed: number | null
          energy_consumption_meter_elapsed: number | null
          external_input: boolean | null
          gateway_id: string | null
          humidity: number | null
          id: number
          inventory_device_id: number | null
          latitude: number | null
          legacy_id: number | null
          legacy_mongo_id: string | null
          light: boolean | null
          longitude: number | null
          luminosity: number | null
          move: boolean | null
          power_factor: number | null
          raw_body: Json | null
          raw_packet: string | null
          raw_source: string
          reactive_power: number | null
          reed_state: number | null
          temperature: number | null
          updated_at: string
          user_device_id: number | null
          user_id: string | null
          voltage: number | null
          xup_decoded_edr: Json | null
          xup_encoded_edr: string | null
        }
        Insert: {
          active_power?: number | null
          altitude?: number | null
          apparent_power?: number | null
          created_at: string
          current?: number | null
          dev_eui: string
          energy_consumption_meter_consumed?: number | null
          energy_consumption_meter_elapsed?: number | null
          external_input?: boolean | null
          gateway_id?: string | null
          humidity?: number | null
          id?: number
          inventory_device_id?: number | null
          latitude?: number | null
          legacy_id?: number | null
          legacy_mongo_id?: string | null
          light?: boolean | null
          longitude?: number | null
          luminosity?: number | null
          move?: boolean | null
          power_factor?: number | null
          raw_body?: Json | null
          raw_packet?: string | null
          raw_source?: string
          reactive_power?: number | null
          reed_state?: number | null
          temperature?: number | null
          updated_at?: string
          user_device_id?: number | null
          user_id?: string | null
          voltage?: number | null
          xup_decoded_edr?: Json | null
          xup_encoded_edr?: string | null
        }
        Update: {
          active_power?: number | null
          altitude?: number | null
          apparent_power?: number | null
          created_at?: string
          current?: number | null
          dev_eui?: string
          energy_consumption_meter_consumed?: number | null
          energy_consumption_meter_elapsed?: number | null
          external_input?: boolean | null
          gateway_id?: string | null
          humidity?: number | null
          id?: number
          inventory_device_id?: number | null
          latitude?: number | null
          legacy_id?: number | null
          legacy_mongo_id?: string | null
          light?: boolean | null
          longitude?: number | null
          luminosity?: number | null
          move?: boolean | null
          power_factor?: number | null
          raw_body?: Json | null
          raw_packet?: string | null
          raw_source?: string
          reactive_power?: number | null
          reed_state?: number | null
          temperature?: number | null
          updated_at?: string
          user_device_id?: number | null
          user_id?: string | null
          voltage?: number | null
          xup_decoded_edr?: Json | null
          xup_encoded_edr?: string | null
        }
        Relationships: []
      }
      telemetry_2024_11: {
        Row: {
          active_power: number | null
          altitude: number | null
          apparent_power: number | null
          created_at: string
          current: number | null
          dev_eui: string
          energy_consumption_meter_consumed: number | null
          energy_consumption_meter_elapsed: number | null
          external_input: boolean | null
          gateway_id: string | null
          humidity: number | null
          id: number
          inventory_device_id: number | null
          latitude: number | null
          legacy_id: number | null
          legacy_mongo_id: string | null
          light: boolean | null
          longitude: number | null
          luminosity: number | null
          move: boolean | null
          power_factor: number | null
          raw_body: Json | null
          raw_packet: string | null
          raw_source: string
          reactive_power: number | null
          reed_state: number | null
          temperature: number | null
          updated_at: string
          user_device_id: number | null
          user_id: string | null
          voltage: number | null
          xup_decoded_edr: Json | null
          xup_encoded_edr: string | null
        }
        Insert: {
          active_power?: number | null
          altitude?: number | null
          apparent_power?: number | null
          created_at: string
          current?: number | null
          dev_eui: string
          energy_consumption_meter_consumed?: number | null
          energy_consumption_meter_elapsed?: number | null
          external_input?: boolean | null
          gateway_id?: string | null
          humidity?: number | null
          id?: number
          inventory_device_id?: number | null
          latitude?: number | null
          legacy_id?: number | null
          legacy_mongo_id?: string | null
          light?: boolean | null
          longitude?: number | null
          luminosity?: number | null
          move?: boolean | null
          power_factor?: number | null
          raw_body?: Json | null
          raw_packet?: string | null
          raw_source?: string
          reactive_power?: number | null
          reed_state?: number | null
          temperature?: number | null
          updated_at?: string
          user_device_id?: number | null
          user_id?: string | null
          voltage?: number | null
          xup_decoded_edr?: Json | null
          xup_encoded_edr?: string | null
        }
        Update: {
          active_power?: number | null
          altitude?: number | null
          apparent_power?: number | null
          created_at?: string
          current?: number | null
          dev_eui?: string
          energy_consumption_meter_consumed?: number | null
          energy_consumption_meter_elapsed?: number | null
          external_input?: boolean | null
          gateway_id?: string | null
          humidity?: number | null
          id?: number
          inventory_device_id?: number | null
          latitude?: number | null
          legacy_id?: number | null
          legacy_mongo_id?: string | null
          light?: boolean | null
          longitude?: number | null
          luminosity?: number | null
          move?: boolean | null
          power_factor?: number | null
          raw_body?: Json | null
          raw_packet?: string | null
          raw_source?: string
          reactive_power?: number | null
          reed_state?: number | null
          temperature?: number | null
          updated_at?: string
          user_device_id?: number | null
          user_id?: string | null
          voltage?: number | null
          xup_decoded_edr?: Json | null
          xup_encoded_edr?: string | null
        }
        Relationships: []
      }
      telemetry_2024_12: {
        Row: {
          active_power: number | null
          altitude: number | null
          apparent_power: number | null
          created_at: string
          current: number | null
          dev_eui: string
          energy_consumption_meter_consumed: number | null
          energy_consumption_meter_elapsed: number | null
          external_input: boolean | null
          gateway_id: string | null
          humidity: number | null
          id: number
          inventory_device_id: number | null
          latitude: number | null
          legacy_id: number | null
          legacy_mongo_id: string | null
          light: boolean | null
          longitude: number | null
          luminosity: number | null
          move: boolean | null
          power_factor: number | null
          raw_body: Json | null
          raw_packet: string | null
          raw_source: string
          reactive_power: number | null
          reed_state: number | null
          temperature: number | null
          updated_at: string
          user_device_id: number | null
          user_id: string | null
          voltage: number | null
          xup_decoded_edr: Json | null
          xup_encoded_edr: string | null
        }
        Insert: {
          active_power?: number | null
          altitude?: number | null
          apparent_power?: number | null
          created_at: string
          current?: number | null
          dev_eui: string
          energy_consumption_meter_consumed?: number | null
          energy_consumption_meter_elapsed?: number | null
          external_input?: boolean | null
          gateway_id?: string | null
          humidity?: number | null
          id?: number
          inventory_device_id?: number | null
          latitude?: number | null
          legacy_id?: number | null
          legacy_mongo_id?: string | null
          light?: boolean | null
          longitude?: number | null
          luminosity?: number | null
          move?: boolean | null
          power_factor?: number | null
          raw_body?: Json | null
          raw_packet?: string | null
          raw_source?: string
          reactive_power?: number | null
          reed_state?: number | null
          temperature?: number | null
          updated_at?: string
          user_device_id?: number | null
          user_id?: string | null
          voltage?: number | null
          xup_decoded_edr?: Json | null
          xup_encoded_edr?: string | null
        }
        Update: {
          active_power?: number | null
          altitude?: number | null
          apparent_power?: number | null
          created_at?: string
          current?: number | null
          dev_eui?: string
          energy_consumption_meter_consumed?: number | null
          energy_consumption_meter_elapsed?: number | null
          external_input?: boolean | null
          gateway_id?: string | null
          humidity?: number | null
          id?: number
          inventory_device_id?: number | null
          latitude?: number | null
          legacy_id?: number | null
          legacy_mongo_id?: string | null
          light?: boolean | null
          longitude?: number | null
          luminosity?: number | null
          move?: boolean | null
          power_factor?: number | null
          raw_body?: Json | null
          raw_packet?: string | null
          raw_source?: string
          reactive_power?: number | null
          reed_state?: number | null
          temperature?: number | null
          updated_at?: string
          user_device_id?: number | null
          user_id?: string | null
          voltage?: number | null
          xup_decoded_edr?: Json | null
          xup_encoded_edr?: string | null
        }
        Relationships: []
      }
      telemetry_2025_01: {
        Row: {
          active_power: number | null
          altitude: number | null
          apparent_power: number | null
          created_at: string
          current: number | null
          dev_eui: string
          energy_consumption_meter_consumed: number | null
          energy_consumption_meter_elapsed: number | null
          external_input: boolean | null
          gateway_id: string | null
          humidity: number | null
          id: number
          inventory_device_id: number | null
          latitude: number | null
          legacy_id: number | null
          legacy_mongo_id: string | null
          light: boolean | null
          longitude: number | null
          luminosity: number | null
          move: boolean | null
          power_factor: number | null
          raw_body: Json | null
          raw_packet: string | null
          raw_source: string
          reactive_power: number | null
          reed_state: number | null
          temperature: number | null
          updated_at: string
          user_device_id: number | null
          user_id: string | null
          voltage: number | null
          xup_decoded_edr: Json | null
          xup_encoded_edr: string | null
        }
        Insert: {
          active_power?: number | null
          altitude?: number | null
          apparent_power?: number | null
          created_at: string
          current?: number | null
          dev_eui: string
          energy_consumption_meter_consumed?: number | null
          energy_consumption_meter_elapsed?: number | null
          external_input?: boolean | null
          gateway_id?: string | null
          humidity?: number | null
          id?: number
          inventory_device_id?: number | null
          latitude?: number | null
          legacy_id?: number | null
          legacy_mongo_id?: string | null
          light?: boolean | null
          longitude?: number | null
          luminosity?: number | null
          move?: boolean | null
          power_factor?: number | null
          raw_body?: Json | null
          raw_packet?: string | null
          raw_source?: string
          reactive_power?: number | null
          reed_state?: number | null
          temperature?: number | null
          updated_at?: string
          user_device_id?: number | null
          user_id?: string | null
          voltage?: number | null
          xup_decoded_edr?: Json | null
          xup_encoded_edr?: string | null
        }
        Update: {
          active_power?: number | null
          altitude?: number | null
          apparent_power?: number | null
          created_at?: string
          current?: number | null
          dev_eui?: string
          energy_consumption_meter_consumed?: number | null
          energy_consumption_meter_elapsed?: number | null
          external_input?: boolean | null
          gateway_id?: string | null
          humidity?: number | null
          id?: number
          inventory_device_id?: number | null
          latitude?: number | null
          legacy_id?: number | null
          legacy_mongo_id?: string | null
          light?: boolean | null
          longitude?: number | null
          luminosity?: number | null
          move?: boolean | null
          power_factor?: number | null
          raw_body?: Json | null
          raw_packet?: string | null
          raw_source?: string
          reactive_power?: number | null
          reed_state?: number | null
          temperature?: number | null
          updated_at?: string
          user_device_id?: number | null
          user_id?: string | null
          voltage?: number | null
          xup_decoded_edr?: Json | null
          xup_encoded_edr?: string | null
        }
        Relationships: []
      }
      telemetry_2025_02: {
        Row: {
          active_power: number | null
          altitude: number | null
          apparent_power: number | null
          created_at: string
          current: number | null
          dev_eui: string
          energy_consumption_meter_consumed: number | null
          energy_consumption_meter_elapsed: number | null
          external_input: boolean | null
          gateway_id: string | null
          humidity: number | null
          id: number
          inventory_device_id: number | null
          latitude: number | null
          legacy_id: number | null
          legacy_mongo_id: string | null
          light: boolean | null
          longitude: number | null
          luminosity: number | null
          move: boolean | null
          power_factor: number | null
          raw_body: Json | null
          raw_packet: string | null
          raw_source: string
          reactive_power: number | null
          reed_state: number | null
          temperature: number | null
          updated_at: string
          user_device_id: number | null
          user_id: string | null
          voltage: number | null
          xup_decoded_edr: Json | null
          xup_encoded_edr: string | null
        }
        Insert: {
          active_power?: number | null
          altitude?: number | null
          apparent_power?: number | null
          created_at: string
          current?: number | null
          dev_eui: string
          energy_consumption_meter_consumed?: number | null
          energy_consumption_meter_elapsed?: number | null
          external_input?: boolean | null
          gateway_id?: string | null
          humidity?: number | null
          id?: number
          inventory_device_id?: number | null
          latitude?: number | null
          legacy_id?: number | null
          legacy_mongo_id?: string | null
          light?: boolean | null
          longitude?: number | null
          luminosity?: number | null
          move?: boolean | null
          power_factor?: number | null
          raw_body?: Json | null
          raw_packet?: string | null
          raw_source?: string
          reactive_power?: number | null
          reed_state?: number | null
          temperature?: number | null
          updated_at?: string
          user_device_id?: number | null
          user_id?: string | null
          voltage?: number | null
          xup_decoded_edr?: Json | null
          xup_encoded_edr?: string | null
        }
        Update: {
          active_power?: number | null
          altitude?: number | null
          apparent_power?: number | null
          created_at?: string
          current?: number | null
          dev_eui?: string
          energy_consumption_meter_consumed?: number | null
          energy_consumption_meter_elapsed?: number | null
          external_input?: boolean | null
          gateway_id?: string | null
          humidity?: number | null
          id?: number
          inventory_device_id?: number | null
          latitude?: number | null
          legacy_id?: number | null
          legacy_mongo_id?: string | null
          light?: boolean | null
          longitude?: number | null
          luminosity?: number | null
          move?: boolean | null
          power_factor?: number | null
          raw_body?: Json | null
          raw_packet?: string | null
          raw_source?: string
          reactive_power?: number | null
          reed_state?: number | null
          temperature?: number | null
          updated_at?: string
          user_device_id?: number | null
          user_id?: string | null
          voltage?: number | null
          xup_decoded_edr?: Json | null
          xup_encoded_edr?: string | null
        }
        Relationships: []
      }
      telemetry_2025_03: {
        Row: {
          active_power: number | null
          altitude: number | null
          apparent_power: number | null
          created_at: string
          current: number | null
          dev_eui: string
          energy_consumption_meter_consumed: number | null
          energy_consumption_meter_elapsed: number | null
          external_input: boolean | null
          gateway_id: string | null
          humidity: number | null
          id: number
          inventory_device_id: number | null
          latitude: number | null
          legacy_id: number | null
          legacy_mongo_id: string | null
          light: boolean | null
          longitude: number | null
          luminosity: number | null
          move: boolean | null
          power_factor: number | null
          raw_body: Json | null
          raw_packet: string | null
          raw_source: string
          reactive_power: number | null
          reed_state: number | null
          temperature: number | null
          updated_at: string
          user_device_id: number | null
          user_id: string | null
          voltage: number | null
          xup_decoded_edr: Json | null
          xup_encoded_edr: string | null
        }
        Insert: {
          active_power?: number | null
          altitude?: number | null
          apparent_power?: number | null
          created_at: string
          current?: number | null
          dev_eui: string
          energy_consumption_meter_consumed?: number | null
          energy_consumption_meter_elapsed?: number | null
          external_input?: boolean | null
          gateway_id?: string | null
          humidity?: number | null
          id?: number
          inventory_device_id?: number | null
          latitude?: number | null
          legacy_id?: number | null
          legacy_mongo_id?: string | null
          light?: boolean | null
          longitude?: number | null
          luminosity?: number | null
          move?: boolean | null
          power_factor?: number | null
          raw_body?: Json | null
          raw_packet?: string | null
          raw_source?: string
          reactive_power?: number | null
          reed_state?: number | null
          temperature?: number | null
          updated_at?: string
          user_device_id?: number | null
          user_id?: string | null
          voltage?: number | null
          xup_decoded_edr?: Json | null
          xup_encoded_edr?: string | null
        }
        Update: {
          active_power?: number | null
          altitude?: number | null
          apparent_power?: number | null
          created_at?: string
          current?: number | null
          dev_eui?: string
          energy_consumption_meter_consumed?: number | null
          energy_consumption_meter_elapsed?: number | null
          external_input?: boolean | null
          gateway_id?: string | null
          humidity?: number | null
          id?: number
          inventory_device_id?: number | null
          latitude?: number | null
          legacy_id?: number | null
          legacy_mongo_id?: string | null
          light?: boolean | null
          longitude?: number | null
          luminosity?: number | null
          move?: boolean | null
          power_factor?: number | null
          raw_body?: Json | null
          raw_packet?: string | null
          raw_source?: string
          reactive_power?: number | null
          reed_state?: number | null
          temperature?: number | null
          updated_at?: string
          user_device_id?: number | null
          user_id?: string | null
          voltage?: number | null
          xup_decoded_edr?: Json | null
          xup_encoded_edr?: string | null
        }
        Relationships: []
      }
      telemetry_2025_04: {
        Row: {
          active_power: number | null
          altitude: number | null
          apparent_power: number | null
          created_at: string
          current: number | null
          dev_eui: string
          energy_consumption_meter_consumed: number | null
          energy_consumption_meter_elapsed: number | null
          external_input: boolean | null
          gateway_id: string | null
          humidity: number | null
          id: number
          inventory_device_id: number | null
          latitude: number | null
          legacy_id: number | null
          legacy_mongo_id: string | null
          light: boolean | null
          longitude: number | null
          luminosity: number | null
          move: boolean | null
          power_factor: number | null
          raw_body: Json | null
          raw_packet: string | null
          raw_source: string
          reactive_power: number | null
          reed_state: number | null
          temperature: number | null
          updated_at: string
          user_device_id: number | null
          user_id: string | null
          voltage: number | null
          xup_decoded_edr: Json | null
          xup_encoded_edr: string | null
        }
        Insert: {
          active_power?: number | null
          altitude?: number | null
          apparent_power?: number | null
          created_at: string
          current?: number | null
          dev_eui: string
          energy_consumption_meter_consumed?: number | null
          energy_consumption_meter_elapsed?: number | null
          external_input?: boolean | null
          gateway_id?: string | null
          humidity?: number | null
          id?: number
          inventory_device_id?: number | null
          latitude?: number | null
          legacy_id?: number | null
          legacy_mongo_id?: string | null
          light?: boolean | null
          longitude?: number | null
          luminosity?: number | null
          move?: boolean | null
          power_factor?: number | null
          raw_body?: Json | null
          raw_packet?: string | null
          raw_source?: string
          reactive_power?: number | null
          reed_state?: number | null
          temperature?: number | null
          updated_at?: string
          user_device_id?: number | null
          user_id?: string | null
          voltage?: number | null
          xup_decoded_edr?: Json | null
          xup_encoded_edr?: string | null
        }
        Update: {
          active_power?: number | null
          altitude?: number | null
          apparent_power?: number | null
          created_at?: string
          current?: number | null
          dev_eui?: string
          energy_consumption_meter_consumed?: number | null
          energy_consumption_meter_elapsed?: number | null
          external_input?: boolean | null
          gateway_id?: string | null
          humidity?: number | null
          id?: number
          inventory_device_id?: number | null
          latitude?: number | null
          legacy_id?: number | null
          legacy_mongo_id?: string | null
          light?: boolean | null
          longitude?: number | null
          luminosity?: number | null
          move?: boolean | null
          power_factor?: number | null
          raw_body?: Json | null
          raw_packet?: string | null
          raw_source?: string
          reactive_power?: number | null
          reed_state?: number | null
          temperature?: number | null
          updated_at?: string
          user_device_id?: number | null
          user_id?: string | null
          voltage?: number | null
          xup_decoded_edr?: Json | null
          xup_encoded_edr?: string | null
        }
        Relationships: []
      }
      telemetry_2025_05: {
        Row: {
          active_power: number | null
          altitude: number | null
          apparent_power: number | null
          created_at: string
          current: number | null
          dev_eui: string
          energy_consumption_meter_consumed: number | null
          energy_consumption_meter_elapsed: number | null
          external_input: boolean | null
          gateway_id: string | null
          humidity: number | null
          id: number
          inventory_device_id: number | null
          latitude: number | null
          legacy_id: number | null
          legacy_mongo_id: string | null
          light: boolean | null
          longitude: number | null
          luminosity: number | null
          move: boolean | null
          power_factor: number | null
          raw_body: Json | null
          raw_packet: string | null
          raw_source: string
          reactive_power: number | null
          reed_state: number | null
          temperature: number | null
          updated_at: string
          user_device_id: number | null
          user_id: string | null
          voltage: number | null
          xup_decoded_edr: Json | null
          xup_encoded_edr: string | null
        }
        Insert: {
          active_power?: number | null
          altitude?: number | null
          apparent_power?: number | null
          created_at: string
          current?: number | null
          dev_eui: string
          energy_consumption_meter_consumed?: number | null
          energy_consumption_meter_elapsed?: number | null
          external_input?: boolean | null
          gateway_id?: string | null
          humidity?: number | null
          id?: number
          inventory_device_id?: number | null
          latitude?: number | null
          legacy_id?: number | null
          legacy_mongo_id?: string | null
          light?: boolean | null
          longitude?: number | null
          luminosity?: number | null
          move?: boolean | null
          power_factor?: number | null
          raw_body?: Json | null
          raw_packet?: string | null
          raw_source?: string
          reactive_power?: number | null
          reed_state?: number | null
          temperature?: number | null
          updated_at?: string
          user_device_id?: number | null
          user_id?: string | null
          voltage?: number | null
          xup_decoded_edr?: Json | null
          xup_encoded_edr?: string | null
        }
        Update: {
          active_power?: number | null
          altitude?: number | null
          apparent_power?: number | null
          created_at?: string
          current?: number | null
          dev_eui?: string
          energy_consumption_meter_consumed?: number | null
          energy_consumption_meter_elapsed?: number | null
          external_input?: boolean | null
          gateway_id?: string | null
          humidity?: number | null
          id?: number
          inventory_device_id?: number | null
          latitude?: number | null
          legacy_id?: number | null
          legacy_mongo_id?: string | null
          light?: boolean | null
          longitude?: number | null
          luminosity?: number | null
          move?: boolean | null
          power_factor?: number | null
          raw_body?: Json | null
          raw_packet?: string | null
          raw_source?: string
          reactive_power?: number | null
          reed_state?: number | null
          temperature?: number | null
          updated_at?: string
          user_device_id?: number | null
          user_id?: string | null
          voltage?: number | null
          xup_decoded_edr?: Json | null
          xup_encoded_edr?: string | null
        }
        Relationships: []
      }
      telemetry_2025_06: {
        Row: {
          active_power: number | null
          altitude: number | null
          apparent_power: number | null
          created_at: string
          current: number | null
          dev_eui: string
          energy_consumption_meter_consumed: number | null
          energy_consumption_meter_elapsed: number | null
          external_input: boolean | null
          gateway_id: string | null
          humidity: number | null
          id: number
          inventory_device_id: number | null
          latitude: number | null
          legacy_id: number | null
          legacy_mongo_id: string | null
          light: boolean | null
          longitude: number | null
          luminosity: number | null
          move: boolean | null
          power_factor: number | null
          raw_body: Json | null
          raw_packet: string | null
          raw_source: string
          reactive_power: number | null
          reed_state: number | null
          temperature: number | null
          updated_at: string
          user_device_id: number | null
          user_id: string | null
          voltage: number | null
          xup_decoded_edr: Json | null
          xup_encoded_edr: string | null
        }
        Insert: {
          active_power?: number | null
          altitude?: number | null
          apparent_power?: number | null
          created_at: string
          current?: number | null
          dev_eui: string
          energy_consumption_meter_consumed?: number | null
          energy_consumption_meter_elapsed?: number | null
          external_input?: boolean | null
          gateway_id?: string | null
          humidity?: number | null
          id?: number
          inventory_device_id?: number | null
          latitude?: number | null
          legacy_id?: number | null
          legacy_mongo_id?: string | null
          light?: boolean | null
          longitude?: number | null
          luminosity?: number | null
          move?: boolean | null
          power_factor?: number | null
          raw_body?: Json | null
          raw_packet?: string | null
          raw_source?: string
          reactive_power?: number | null
          reed_state?: number | null
          temperature?: number | null
          updated_at?: string
          user_device_id?: number | null
          user_id?: string | null
          voltage?: number | null
          xup_decoded_edr?: Json | null
          xup_encoded_edr?: string | null
        }
        Update: {
          active_power?: number | null
          altitude?: number | null
          apparent_power?: number | null
          created_at?: string
          current?: number | null
          dev_eui?: string
          energy_consumption_meter_consumed?: number | null
          energy_consumption_meter_elapsed?: number | null
          external_input?: boolean | null
          gateway_id?: string | null
          humidity?: number | null
          id?: number
          inventory_device_id?: number | null
          latitude?: number | null
          legacy_id?: number | null
          legacy_mongo_id?: string | null
          light?: boolean | null
          longitude?: number | null
          luminosity?: number | null
          move?: boolean | null
          power_factor?: number | null
          raw_body?: Json | null
          raw_packet?: string | null
          raw_source?: string
          reactive_power?: number | null
          reed_state?: number | null
          temperature?: number | null
          updated_at?: string
          user_device_id?: number | null
          user_id?: string | null
          voltage?: number | null
          xup_decoded_edr?: Json | null
          xup_encoded_edr?: string | null
        }
        Relationships: []
      }
      telemetry_2025_07: {
        Row: {
          active_power: number | null
          altitude: number | null
          apparent_power: number | null
          created_at: string
          current: number | null
          dev_eui: string
          energy_consumption_meter_consumed: number | null
          energy_consumption_meter_elapsed: number | null
          external_input: boolean | null
          gateway_id: string | null
          humidity: number | null
          id: number
          inventory_device_id: number | null
          latitude: number | null
          legacy_id: number | null
          legacy_mongo_id: string | null
          light: boolean | null
          longitude: number | null
          luminosity: number | null
          move: boolean | null
          power_factor: number | null
          raw_body: Json | null
          raw_packet: string | null
          raw_source: string
          reactive_power: number | null
          reed_state: number | null
          temperature: number | null
          updated_at: string
          user_device_id: number | null
          user_id: string | null
          voltage: number | null
          xup_decoded_edr: Json | null
          xup_encoded_edr: string | null
        }
        Insert: {
          active_power?: number | null
          altitude?: number | null
          apparent_power?: number | null
          created_at: string
          current?: number | null
          dev_eui: string
          energy_consumption_meter_consumed?: number | null
          energy_consumption_meter_elapsed?: number | null
          external_input?: boolean | null
          gateway_id?: string | null
          humidity?: number | null
          id?: number
          inventory_device_id?: number | null
          latitude?: number | null
          legacy_id?: number | null
          legacy_mongo_id?: string | null
          light?: boolean | null
          longitude?: number | null
          luminosity?: number | null
          move?: boolean | null
          power_factor?: number | null
          raw_body?: Json | null
          raw_packet?: string | null
          raw_source?: string
          reactive_power?: number | null
          reed_state?: number | null
          temperature?: number | null
          updated_at?: string
          user_device_id?: number | null
          user_id?: string | null
          voltage?: number | null
          xup_decoded_edr?: Json | null
          xup_encoded_edr?: string | null
        }
        Update: {
          active_power?: number | null
          altitude?: number | null
          apparent_power?: number | null
          created_at?: string
          current?: number | null
          dev_eui?: string
          energy_consumption_meter_consumed?: number | null
          energy_consumption_meter_elapsed?: number | null
          external_input?: boolean | null
          gateway_id?: string | null
          humidity?: number | null
          id?: number
          inventory_device_id?: number | null
          latitude?: number | null
          legacy_id?: number | null
          legacy_mongo_id?: string | null
          light?: boolean | null
          longitude?: number | null
          luminosity?: number | null
          move?: boolean | null
          power_factor?: number | null
          raw_body?: Json | null
          raw_packet?: string | null
          raw_source?: string
          reactive_power?: number | null
          reed_state?: number | null
          temperature?: number | null
          updated_at?: string
          user_device_id?: number | null
          user_id?: string | null
          voltage?: number | null
          xup_decoded_edr?: Json | null
          xup_encoded_edr?: string | null
        }
        Relationships: []
      }
      telemetry_2025_08: {
        Row: {
          active_power: number | null
          altitude: number | null
          apparent_power: number | null
          created_at: string
          current: number | null
          dev_eui: string
          energy_consumption_meter_consumed: number | null
          energy_consumption_meter_elapsed: number | null
          external_input: boolean | null
          gateway_id: string | null
          humidity: number | null
          id: number
          inventory_device_id: number | null
          latitude: number | null
          legacy_id: number | null
          legacy_mongo_id: string | null
          light: boolean | null
          longitude: number | null
          luminosity: number | null
          move: boolean | null
          power_factor: number | null
          raw_body: Json | null
          raw_packet: string | null
          raw_source: string
          reactive_power: number | null
          reed_state: number | null
          temperature: number | null
          updated_at: string
          user_device_id: number | null
          user_id: string | null
          voltage: number | null
          xup_decoded_edr: Json | null
          xup_encoded_edr: string | null
        }
        Insert: {
          active_power?: number | null
          altitude?: number | null
          apparent_power?: number | null
          created_at: string
          current?: number | null
          dev_eui: string
          energy_consumption_meter_consumed?: number | null
          energy_consumption_meter_elapsed?: number | null
          external_input?: boolean | null
          gateway_id?: string | null
          humidity?: number | null
          id?: number
          inventory_device_id?: number | null
          latitude?: number | null
          legacy_id?: number | null
          legacy_mongo_id?: string | null
          light?: boolean | null
          longitude?: number | null
          luminosity?: number | null
          move?: boolean | null
          power_factor?: number | null
          raw_body?: Json | null
          raw_packet?: string | null
          raw_source?: string
          reactive_power?: number | null
          reed_state?: number | null
          temperature?: number | null
          updated_at?: string
          user_device_id?: number | null
          user_id?: string | null
          voltage?: number | null
          xup_decoded_edr?: Json | null
          xup_encoded_edr?: string | null
        }
        Update: {
          active_power?: number | null
          altitude?: number | null
          apparent_power?: number | null
          created_at?: string
          current?: number | null
          dev_eui?: string
          energy_consumption_meter_consumed?: number | null
          energy_consumption_meter_elapsed?: number | null
          external_input?: boolean | null
          gateway_id?: string | null
          humidity?: number | null
          id?: number
          inventory_device_id?: number | null
          latitude?: number | null
          legacy_id?: number | null
          legacy_mongo_id?: string | null
          light?: boolean | null
          longitude?: number | null
          luminosity?: number | null
          move?: boolean | null
          power_factor?: number | null
          raw_body?: Json | null
          raw_packet?: string | null
          raw_source?: string
          reactive_power?: number | null
          reed_state?: number | null
          temperature?: number | null
          updated_at?: string
          user_device_id?: number | null
          user_id?: string | null
          voltage?: number | null
          xup_decoded_edr?: Json | null
          xup_encoded_edr?: string | null
        }
        Relationships: []
      }
      telemetry_2025_09: {
        Row: {
          active_power: number | null
          altitude: number | null
          apparent_power: number | null
          created_at: string
          current: number | null
          dev_eui: string
          energy_consumption_meter_consumed: number | null
          energy_consumption_meter_elapsed: number | null
          external_input: boolean | null
          gateway_id: string | null
          humidity: number | null
          id: number
          inventory_device_id: number | null
          latitude: number | null
          legacy_id: number | null
          legacy_mongo_id: string | null
          light: boolean | null
          longitude: number | null
          luminosity: number | null
          move: boolean | null
          power_factor: number | null
          raw_body: Json | null
          raw_packet: string | null
          raw_source: string
          reactive_power: number | null
          reed_state: number | null
          temperature: number | null
          updated_at: string
          user_device_id: number | null
          user_id: string | null
          voltage: number | null
          xup_decoded_edr: Json | null
          xup_encoded_edr: string | null
        }
        Insert: {
          active_power?: number | null
          altitude?: number | null
          apparent_power?: number | null
          created_at: string
          current?: number | null
          dev_eui: string
          energy_consumption_meter_consumed?: number | null
          energy_consumption_meter_elapsed?: number | null
          external_input?: boolean | null
          gateway_id?: string | null
          humidity?: number | null
          id?: number
          inventory_device_id?: number | null
          latitude?: number | null
          legacy_id?: number | null
          legacy_mongo_id?: string | null
          light?: boolean | null
          longitude?: number | null
          luminosity?: number | null
          move?: boolean | null
          power_factor?: number | null
          raw_body?: Json | null
          raw_packet?: string | null
          raw_source?: string
          reactive_power?: number | null
          reed_state?: number | null
          temperature?: number | null
          updated_at?: string
          user_device_id?: number | null
          user_id?: string | null
          voltage?: number | null
          xup_decoded_edr?: Json | null
          xup_encoded_edr?: string | null
        }
        Update: {
          active_power?: number | null
          altitude?: number | null
          apparent_power?: number | null
          created_at?: string
          current?: number | null
          dev_eui?: string
          energy_consumption_meter_consumed?: number | null
          energy_consumption_meter_elapsed?: number | null
          external_input?: boolean | null
          gateway_id?: string | null
          humidity?: number | null
          id?: number
          inventory_device_id?: number | null
          latitude?: number | null
          legacy_id?: number | null
          legacy_mongo_id?: string | null
          light?: boolean | null
          longitude?: number | null
          luminosity?: number | null
          move?: boolean | null
          power_factor?: number | null
          raw_body?: Json | null
          raw_packet?: string | null
          raw_source?: string
          reactive_power?: number | null
          reed_state?: number | null
          temperature?: number | null
          updated_at?: string
          user_device_id?: number | null
          user_id?: string | null
          voltage?: number | null
          xup_decoded_edr?: Json | null
          xup_encoded_edr?: string | null
        }
        Relationships: []
      }
      telemetry_2025_10: {
        Row: {
          active_power: number | null
          altitude: number | null
          apparent_power: number | null
          created_at: string
          current: number | null
          dev_eui: string
          energy_consumption_meter_consumed: number | null
          energy_consumption_meter_elapsed: number | null
          external_input: boolean | null
          gateway_id: string | null
          humidity: number | null
          id: number
          inventory_device_id: number | null
          latitude: number | null
          legacy_id: number | null
          legacy_mongo_id: string | null
          light: boolean | null
          longitude: number | null
          luminosity: number | null
          move: boolean | null
          power_factor: number | null
          raw_body: Json | null
          raw_packet: string | null
          raw_source: string
          reactive_power: number | null
          reed_state: number | null
          temperature: number | null
          updated_at: string
          user_device_id: number | null
          user_id: string | null
          voltage: number | null
          xup_decoded_edr: Json | null
          xup_encoded_edr: string | null
        }
        Insert: {
          active_power?: number | null
          altitude?: number | null
          apparent_power?: number | null
          created_at: string
          current?: number | null
          dev_eui: string
          energy_consumption_meter_consumed?: number | null
          energy_consumption_meter_elapsed?: number | null
          external_input?: boolean | null
          gateway_id?: string | null
          humidity?: number | null
          id?: number
          inventory_device_id?: number | null
          latitude?: number | null
          legacy_id?: number | null
          legacy_mongo_id?: string | null
          light?: boolean | null
          longitude?: number | null
          luminosity?: number | null
          move?: boolean | null
          power_factor?: number | null
          raw_body?: Json | null
          raw_packet?: string | null
          raw_source?: string
          reactive_power?: number | null
          reed_state?: number | null
          temperature?: number | null
          updated_at?: string
          user_device_id?: number | null
          user_id?: string | null
          voltage?: number | null
          xup_decoded_edr?: Json | null
          xup_encoded_edr?: string | null
        }
        Update: {
          active_power?: number | null
          altitude?: number | null
          apparent_power?: number | null
          created_at?: string
          current?: number | null
          dev_eui?: string
          energy_consumption_meter_consumed?: number | null
          energy_consumption_meter_elapsed?: number | null
          external_input?: boolean | null
          gateway_id?: string | null
          humidity?: number | null
          id?: number
          inventory_device_id?: number | null
          latitude?: number | null
          legacy_id?: number | null
          legacy_mongo_id?: string | null
          light?: boolean | null
          longitude?: number | null
          luminosity?: number | null
          move?: boolean | null
          power_factor?: number | null
          raw_body?: Json | null
          raw_packet?: string | null
          raw_source?: string
          reactive_power?: number | null
          reed_state?: number | null
          temperature?: number | null
          updated_at?: string
          user_device_id?: number | null
          user_id?: string | null
          voltage?: number | null
          xup_decoded_edr?: Json | null
          xup_encoded_edr?: string | null
        }
        Relationships: []
      }
      telemetry_2025_11: {
        Row: {
          active_power: number | null
          altitude: number | null
          apparent_power: number | null
          created_at: string
          current: number | null
          dev_eui: string
          energy_consumption_meter_consumed: number | null
          energy_consumption_meter_elapsed: number | null
          external_input: boolean | null
          gateway_id: string | null
          humidity: number | null
          id: number
          inventory_device_id: number | null
          latitude: number | null
          legacy_id: number | null
          legacy_mongo_id: string | null
          light: boolean | null
          longitude: number | null
          luminosity: number | null
          move: boolean | null
          power_factor: number | null
          raw_body: Json | null
          raw_packet: string | null
          raw_source: string
          reactive_power: number | null
          reed_state: number | null
          temperature: number | null
          updated_at: string
          user_device_id: number | null
          user_id: string | null
          voltage: number | null
          xup_decoded_edr: Json | null
          xup_encoded_edr: string | null
        }
        Insert: {
          active_power?: number | null
          altitude?: number | null
          apparent_power?: number | null
          created_at: string
          current?: number | null
          dev_eui: string
          energy_consumption_meter_consumed?: number | null
          energy_consumption_meter_elapsed?: number | null
          external_input?: boolean | null
          gateway_id?: string | null
          humidity?: number | null
          id?: number
          inventory_device_id?: number | null
          latitude?: number | null
          legacy_id?: number | null
          legacy_mongo_id?: string | null
          light?: boolean | null
          longitude?: number | null
          luminosity?: number | null
          move?: boolean | null
          power_factor?: number | null
          raw_body?: Json | null
          raw_packet?: string | null
          raw_source?: string
          reactive_power?: number | null
          reed_state?: number | null
          temperature?: number | null
          updated_at?: string
          user_device_id?: number | null
          user_id?: string | null
          voltage?: number | null
          xup_decoded_edr?: Json | null
          xup_encoded_edr?: string | null
        }
        Update: {
          active_power?: number | null
          altitude?: number | null
          apparent_power?: number | null
          created_at?: string
          current?: number | null
          dev_eui?: string
          energy_consumption_meter_consumed?: number | null
          energy_consumption_meter_elapsed?: number | null
          external_input?: boolean | null
          gateway_id?: string | null
          humidity?: number | null
          id?: number
          inventory_device_id?: number | null
          latitude?: number | null
          legacy_id?: number | null
          legacy_mongo_id?: string | null
          light?: boolean | null
          longitude?: number | null
          luminosity?: number | null
          move?: boolean | null
          power_factor?: number | null
          raw_body?: Json | null
          raw_packet?: string | null
          raw_source?: string
          reactive_power?: number | null
          reed_state?: number | null
          temperature?: number | null
          updated_at?: string
          user_device_id?: number | null
          user_id?: string | null
          voltage?: number | null
          xup_decoded_edr?: Json | null
          xup_encoded_edr?: string | null
        }
        Relationships: []
      }
      telemetry_2025_12: {
        Row: {
          active_power: number | null
          altitude: number | null
          apparent_power: number | null
          created_at: string
          current: number | null
          dev_eui: string
          energy_consumption_meter_consumed: number | null
          energy_consumption_meter_elapsed: number | null
          external_input: boolean | null
          gateway_id: string | null
          humidity: number | null
          id: number
          inventory_device_id: number | null
          latitude: number | null
          legacy_id: number | null
          legacy_mongo_id: string | null
          light: boolean | null
          longitude: number | null
          luminosity: number | null
          move: boolean | null
          power_factor: number | null
          raw_body: Json | null
          raw_packet: string | null
          raw_source: string
          reactive_power: number | null
          reed_state: number | null
          temperature: number | null
          updated_at: string
          user_device_id: number | null
          user_id: string | null
          voltage: number | null
          xup_decoded_edr: Json | null
          xup_encoded_edr: string | null
        }
        Insert: {
          active_power?: number | null
          altitude?: number | null
          apparent_power?: number | null
          created_at: string
          current?: number | null
          dev_eui: string
          energy_consumption_meter_consumed?: number | null
          energy_consumption_meter_elapsed?: number | null
          external_input?: boolean | null
          gateway_id?: string | null
          humidity?: number | null
          id?: number
          inventory_device_id?: number | null
          latitude?: number | null
          legacy_id?: number | null
          legacy_mongo_id?: string | null
          light?: boolean | null
          longitude?: number | null
          luminosity?: number | null
          move?: boolean | null
          power_factor?: number | null
          raw_body?: Json | null
          raw_packet?: string | null
          raw_source?: string
          reactive_power?: number | null
          reed_state?: number | null
          temperature?: number | null
          updated_at?: string
          user_device_id?: number | null
          user_id?: string | null
          voltage?: number | null
          xup_decoded_edr?: Json | null
          xup_encoded_edr?: string | null
        }
        Update: {
          active_power?: number | null
          altitude?: number | null
          apparent_power?: number | null
          created_at?: string
          current?: number | null
          dev_eui?: string
          energy_consumption_meter_consumed?: number | null
          energy_consumption_meter_elapsed?: number | null
          external_input?: boolean | null
          gateway_id?: string | null
          humidity?: number | null
          id?: number
          inventory_device_id?: number | null
          latitude?: number | null
          legacy_id?: number | null
          legacy_mongo_id?: string | null
          light?: boolean | null
          longitude?: number | null
          luminosity?: number | null
          move?: boolean | null
          power_factor?: number | null
          raw_body?: Json | null
          raw_packet?: string | null
          raw_source?: string
          reactive_power?: number | null
          reed_state?: number | null
          temperature?: number | null
          updated_at?: string
          user_device_id?: number | null
          user_id?: string | null
          voltage?: number | null
          xup_decoded_edr?: Json | null
          xup_encoded_edr?: string | null
        }
        Relationships: []
      }
      telemetry_2026_01: {
        Row: {
          active_power: number | null
          altitude: number | null
          apparent_power: number | null
          created_at: string
          current: number | null
          dev_eui: string
          energy_consumption_meter_consumed: number | null
          energy_consumption_meter_elapsed: number | null
          external_input: boolean | null
          gateway_id: string | null
          humidity: number | null
          id: number
          inventory_device_id: number | null
          latitude: number | null
          legacy_id: number | null
          legacy_mongo_id: string | null
          light: boolean | null
          longitude: number | null
          luminosity: number | null
          move: boolean | null
          power_factor: number | null
          raw_body: Json | null
          raw_packet: string | null
          raw_source: string
          reactive_power: number | null
          reed_state: number | null
          temperature: number | null
          updated_at: string
          user_device_id: number | null
          user_id: string | null
          voltage: number | null
          xup_decoded_edr: Json | null
          xup_encoded_edr: string | null
        }
        Insert: {
          active_power?: number | null
          altitude?: number | null
          apparent_power?: number | null
          created_at: string
          current?: number | null
          dev_eui: string
          energy_consumption_meter_consumed?: number | null
          energy_consumption_meter_elapsed?: number | null
          external_input?: boolean | null
          gateway_id?: string | null
          humidity?: number | null
          id?: number
          inventory_device_id?: number | null
          latitude?: number | null
          legacy_id?: number | null
          legacy_mongo_id?: string | null
          light?: boolean | null
          longitude?: number | null
          luminosity?: number | null
          move?: boolean | null
          power_factor?: number | null
          raw_body?: Json | null
          raw_packet?: string | null
          raw_source?: string
          reactive_power?: number | null
          reed_state?: number | null
          temperature?: number | null
          updated_at?: string
          user_device_id?: number | null
          user_id?: string | null
          voltage?: number | null
          xup_decoded_edr?: Json | null
          xup_encoded_edr?: string | null
        }
        Update: {
          active_power?: number | null
          altitude?: number | null
          apparent_power?: number | null
          created_at?: string
          current?: number | null
          dev_eui?: string
          energy_consumption_meter_consumed?: number | null
          energy_consumption_meter_elapsed?: number | null
          external_input?: boolean | null
          gateway_id?: string | null
          humidity?: number | null
          id?: number
          inventory_device_id?: number | null
          latitude?: number | null
          legacy_id?: number | null
          legacy_mongo_id?: string | null
          light?: boolean | null
          longitude?: number | null
          luminosity?: number | null
          move?: boolean | null
          power_factor?: number | null
          raw_body?: Json | null
          raw_packet?: string | null
          raw_source?: string
          reactive_power?: number | null
          reed_state?: number | null
          temperature?: number | null
          updated_at?: string
          user_device_id?: number | null
          user_id?: string | null
          voltage?: number | null
          xup_decoded_edr?: Json | null
          xup_encoded_edr?: string | null
        }
        Relationships: []
      }
      telemetry_2026_02: {
        Row: {
          active_power: number | null
          altitude: number | null
          apparent_power: number | null
          created_at: string
          current: number | null
          dev_eui: string
          energy_consumption_meter_consumed: number | null
          energy_consumption_meter_elapsed: number | null
          external_input: boolean | null
          gateway_id: string | null
          humidity: number | null
          id: number
          inventory_device_id: number | null
          latitude: number | null
          legacy_id: number | null
          legacy_mongo_id: string | null
          light: boolean | null
          longitude: number | null
          luminosity: number | null
          move: boolean | null
          power_factor: number | null
          raw_body: Json | null
          raw_packet: string | null
          raw_source: string
          reactive_power: number | null
          reed_state: number | null
          temperature: number | null
          updated_at: string
          user_device_id: number | null
          user_id: string | null
          voltage: number | null
          xup_decoded_edr: Json | null
          xup_encoded_edr: string | null
        }
        Insert: {
          active_power?: number | null
          altitude?: number | null
          apparent_power?: number | null
          created_at: string
          current?: number | null
          dev_eui: string
          energy_consumption_meter_consumed?: number | null
          energy_consumption_meter_elapsed?: number | null
          external_input?: boolean | null
          gateway_id?: string | null
          humidity?: number | null
          id?: number
          inventory_device_id?: number | null
          latitude?: number | null
          legacy_id?: number | null
          legacy_mongo_id?: string | null
          light?: boolean | null
          longitude?: number | null
          luminosity?: number | null
          move?: boolean | null
          power_factor?: number | null
          raw_body?: Json | null
          raw_packet?: string | null
          raw_source?: string
          reactive_power?: number | null
          reed_state?: number | null
          temperature?: number | null
          updated_at?: string
          user_device_id?: number | null
          user_id?: string | null
          voltage?: number | null
          xup_decoded_edr?: Json | null
          xup_encoded_edr?: string | null
        }
        Update: {
          active_power?: number | null
          altitude?: number | null
          apparent_power?: number | null
          created_at?: string
          current?: number | null
          dev_eui?: string
          energy_consumption_meter_consumed?: number | null
          energy_consumption_meter_elapsed?: number | null
          external_input?: boolean | null
          gateway_id?: string | null
          humidity?: number | null
          id?: number
          inventory_device_id?: number | null
          latitude?: number | null
          legacy_id?: number | null
          legacy_mongo_id?: string | null
          light?: boolean | null
          longitude?: number | null
          luminosity?: number | null
          move?: boolean | null
          power_factor?: number | null
          raw_body?: Json | null
          raw_packet?: string | null
          raw_source?: string
          reactive_power?: number | null
          reed_state?: number | null
          temperature?: number | null
          updated_at?: string
          user_device_id?: number | null
          user_id?: string | null
          voltage?: number | null
          xup_decoded_edr?: Json | null
          xup_encoded_edr?: string | null
        }
        Relationships: []
      }
      telemetry_2026_03: {
        Row: {
          active_power: number | null
          altitude: number | null
          apparent_power: number | null
          created_at: string
          current: number | null
          dev_eui: string
          energy_consumption_meter_consumed: number | null
          energy_consumption_meter_elapsed: number | null
          external_input: boolean | null
          gateway_id: string | null
          humidity: number | null
          id: number
          inventory_device_id: number | null
          latitude: number | null
          legacy_id: number | null
          legacy_mongo_id: string | null
          light: boolean | null
          longitude: number | null
          luminosity: number | null
          move: boolean | null
          power_factor: number | null
          raw_body: Json | null
          raw_packet: string | null
          raw_source: string
          reactive_power: number | null
          reed_state: number | null
          temperature: number | null
          updated_at: string
          user_device_id: number | null
          user_id: string | null
          voltage: number | null
          xup_decoded_edr: Json | null
          xup_encoded_edr: string | null
        }
        Insert: {
          active_power?: number | null
          altitude?: number | null
          apparent_power?: number | null
          created_at: string
          current?: number | null
          dev_eui: string
          energy_consumption_meter_consumed?: number | null
          energy_consumption_meter_elapsed?: number | null
          external_input?: boolean | null
          gateway_id?: string | null
          humidity?: number | null
          id?: number
          inventory_device_id?: number | null
          latitude?: number | null
          legacy_id?: number | null
          legacy_mongo_id?: string | null
          light?: boolean | null
          longitude?: number | null
          luminosity?: number | null
          move?: boolean | null
          power_factor?: number | null
          raw_body?: Json | null
          raw_packet?: string | null
          raw_source?: string
          reactive_power?: number | null
          reed_state?: number | null
          temperature?: number | null
          updated_at?: string
          user_device_id?: number | null
          user_id?: string | null
          voltage?: number | null
          xup_decoded_edr?: Json | null
          xup_encoded_edr?: string | null
        }
        Update: {
          active_power?: number | null
          altitude?: number | null
          apparent_power?: number | null
          created_at?: string
          current?: number | null
          dev_eui?: string
          energy_consumption_meter_consumed?: number | null
          energy_consumption_meter_elapsed?: number | null
          external_input?: boolean | null
          gateway_id?: string | null
          humidity?: number | null
          id?: number
          inventory_device_id?: number | null
          latitude?: number | null
          legacy_id?: number | null
          legacy_mongo_id?: string | null
          light?: boolean | null
          longitude?: number | null
          luminosity?: number | null
          move?: boolean | null
          power_factor?: number | null
          raw_body?: Json | null
          raw_packet?: string | null
          raw_source?: string
          reactive_power?: number | null
          reed_state?: number | null
          temperature?: number | null
          updated_at?: string
          user_device_id?: number | null
          user_id?: string | null
          voltage?: number | null
          xup_decoded_edr?: Json | null
          xup_encoded_edr?: string | null
        }
        Relationships: []
      }
      telemetry_2026_04: {
        Row: {
          active_power: number | null
          altitude: number | null
          apparent_power: number | null
          created_at: string
          current: number | null
          dev_eui: string
          energy_consumption_meter_consumed: number | null
          energy_consumption_meter_elapsed: number | null
          external_input: boolean | null
          gateway_id: string | null
          humidity: number | null
          id: number
          inventory_device_id: number | null
          latitude: number | null
          legacy_id: number | null
          legacy_mongo_id: string | null
          light: boolean | null
          longitude: number | null
          luminosity: number | null
          move: boolean | null
          power_factor: number | null
          raw_body: Json | null
          raw_packet: string | null
          raw_source: string
          reactive_power: number | null
          reed_state: number | null
          temperature: number | null
          updated_at: string
          user_device_id: number | null
          user_id: string | null
          voltage: number | null
          xup_decoded_edr: Json | null
          xup_encoded_edr: string | null
        }
        Insert: {
          active_power?: number | null
          altitude?: number | null
          apparent_power?: number | null
          created_at: string
          current?: number | null
          dev_eui: string
          energy_consumption_meter_consumed?: number | null
          energy_consumption_meter_elapsed?: number | null
          external_input?: boolean | null
          gateway_id?: string | null
          humidity?: number | null
          id?: number
          inventory_device_id?: number | null
          latitude?: number | null
          legacy_id?: number | null
          legacy_mongo_id?: string | null
          light?: boolean | null
          longitude?: number | null
          luminosity?: number | null
          move?: boolean | null
          power_factor?: number | null
          raw_body?: Json | null
          raw_packet?: string | null
          raw_source?: string
          reactive_power?: number | null
          reed_state?: number | null
          temperature?: number | null
          updated_at?: string
          user_device_id?: number | null
          user_id?: string | null
          voltage?: number | null
          xup_decoded_edr?: Json | null
          xup_encoded_edr?: string | null
        }
        Update: {
          active_power?: number | null
          altitude?: number | null
          apparent_power?: number | null
          created_at?: string
          current?: number | null
          dev_eui?: string
          energy_consumption_meter_consumed?: number | null
          energy_consumption_meter_elapsed?: number | null
          external_input?: boolean | null
          gateway_id?: string | null
          humidity?: number | null
          id?: number
          inventory_device_id?: number | null
          latitude?: number | null
          legacy_id?: number | null
          legacy_mongo_id?: string | null
          light?: boolean | null
          longitude?: number | null
          luminosity?: number | null
          move?: boolean | null
          power_factor?: number | null
          raw_body?: Json | null
          raw_packet?: string | null
          raw_source?: string
          reactive_power?: number | null
          reed_state?: number | null
          temperature?: number | null
          updated_at?: string
          user_device_id?: number | null
          user_id?: string | null
          voltage?: number | null
          xup_decoded_edr?: Json | null
          xup_encoded_edr?: string | null
        }
        Relationships: []
      }
      telemetry_2026_05: {
        Row: {
          active_power: number | null
          altitude: number | null
          apparent_power: number | null
          created_at: string
          current: number | null
          dev_eui: string
          energy_consumption_meter_consumed: number | null
          energy_consumption_meter_elapsed: number | null
          external_input: boolean | null
          gateway_id: string | null
          humidity: number | null
          id: number
          inventory_device_id: number | null
          latitude: number | null
          legacy_id: number | null
          legacy_mongo_id: string | null
          light: boolean | null
          longitude: number | null
          luminosity: number | null
          move: boolean | null
          power_factor: number | null
          raw_body: Json | null
          raw_packet: string | null
          raw_source: string
          reactive_power: number | null
          reed_state: number | null
          temperature: number | null
          updated_at: string
          user_device_id: number | null
          user_id: string | null
          voltage: number | null
          xup_decoded_edr: Json | null
          xup_encoded_edr: string | null
        }
        Insert: {
          active_power?: number | null
          altitude?: number | null
          apparent_power?: number | null
          created_at: string
          current?: number | null
          dev_eui: string
          energy_consumption_meter_consumed?: number | null
          energy_consumption_meter_elapsed?: number | null
          external_input?: boolean | null
          gateway_id?: string | null
          humidity?: number | null
          id?: number
          inventory_device_id?: number | null
          latitude?: number | null
          legacy_id?: number | null
          legacy_mongo_id?: string | null
          light?: boolean | null
          longitude?: number | null
          luminosity?: number | null
          move?: boolean | null
          power_factor?: number | null
          raw_body?: Json | null
          raw_packet?: string | null
          raw_source?: string
          reactive_power?: number | null
          reed_state?: number | null
          temperature?: number | null
          updated_at?: string
          user_device_id?: number | null
          user_id?: string | null
          voltage?: number | null
          xup_decoded_edr?: Json | null
          xup_encoded_edr?: string | null
        }
        Update: {
          active_power?: number | null
          altitude?: number | null
          apparent_power?: number | null
          created_at?: string
          current?: number | null
          dev_eui?: string
          energy_consumption_meter_consumed?: number | null
          energy_consumption_meter_elapsed?: number | null
          external_input?: boolean | null
          gateway_id?: string | null
          humidity?: number | null
          id?: number
          inventory_device_id?: number | null
          latitude?: number | null
          legacy_id?: number | null
          legacy_mongo_id?: string | null
          light?: boolean | null
          longitude?: number | null
          luminosity?: number | null
          move?: boolean | null
          power_factor?: number | null
          raw_body?: Json | null
          raw_packet?: string | null
          raw_source?: string
          reactive_power?: number | null
          reed_state?: number | null
          temperature?: number | null
          updated_at?: string
          user_device_id?: number | null
          user_id?: string | null
          voltage?: number | null
          xup_decoded_edr?: Json | null
          xup_encoded_edr?: string | null
        }
        Relationships: []
      }
      telemetry_2026_06: {
        Row: {
          active_power: number | null
          altitude: number | null
          apparent_power: number | null
          created_at: string
          current: number | null
          dev_eui: string
          energy_consumption_meter_consumed: number | null
          energy_consumption_meter_elapsed: number | null
          external_input: boolean | null
          gateway_id: string | null
          humidity: number | null
          id: number
          inventory_device_id: number | null
          latitude: number | null
          legacy_id: number | null
          legacy_mongo_id: string | null
          light: boolean | null
          longitude: number | null
          luminosity: number | null
          move: boolean | null
          power_factor: number | null
          raw_body: Json | null
          raw_packet: string | null
          raw_source: string
          reactive_power: number | null
          reed_state: number | null
          temperature: number | null
          updated_at: string
          user_device_id: number | null
          user_id: string | null
          voltage: number | null
          xup_decoded_edr: Json | null
          xup_encoded_edr: string | null
        }
        Insert: {
          active_power?: number | null
          altitude?: number | null
          apparent_power?: number | null
          created_at: string
          current?: number | null
          dev_eui: string
          energy_consumption_meter_consumed?: number | null
          energy_consumption_meter_elapsed?: number | null
          external_input?: boolean | null
          gateway_id?: string | null
          humidity?: number | null
          id?: number
          inventory_device_id?: number | null
          latitude?: number | null
          legacy_id?: number | null
          legacy_mongo_id?: string | null
          light?: boolean | null
          longitude?: number | null
          luminosity?: number | null
          move?: boolean | null
          power_factor?: number | null
          raw_body?: Json | null
          raw_packet?: string | null
          raw_source?: string
          reactive_power?: number | null
          reed_state?: number | null
          temperature?: number | null
          updated_at?: string
          user_device_id?: number | null
          user_id?: string | null
          voltage?: number | null
          xup_decoded_edr?: Json | null
          xup_encoded_edr?: string | null
        }
        Update: {
          active_power?: number | null
          altitude?: number | null
          apparent_power?: number | null
          created_at?: string
          current?: number | null
          dev_eui?: string
          energy_consumption_meter_consumed?: number | null
          energy_consumption_meter_elapsed?: number | null
          external_input?: boolean | null
          gateway_id?: string | null
          humidity?: number | null
          id?: number
          inventory_device_id?: number | null
          latitude?: number | null
          legacy_id?: number | null
          legacy_mongo_id?: string | null
          light?: boolean | null
          longitude?: number | null
          luminosity?: number | null
          move?: boolean | null
          power_factor?: number | null
          raw_body?: Json | null
          raw_packet?: string | null
          raw_source?: string
          reactive_power?: number | null
          reed_state?: number | null
          temperature?: number | null
          updated_at?: string
          user_device_id?: number | null
          user_id?: string | null
          voltage?: number | null
          xup_decoded_edr?: Json | null
          xup_encoded_edr?: string | null
        }
        Relationships: []
      }
      telemetry_2026_07: {
        Row: {
          active_power: number | null
          altitude: number | null
          apparent_power: number | null
          created_at: string
          current: number | null
          dev_eui: string
          energy_consumption_meter_consumed: number | null
          energy_consumption_meter_elapsed: number | null
          external_input: boolean | null
          gateway_id: string | null
          humidity: number | null
          id: number
          inventory_device_id: number | null
          latitude: number | null
          legacy_id: number | null
          legacy_mongo_id: string | null
          light: boolean | null
          longitude: number | null
          luminosity: number | null
          move: boolean | null
          power_factor: number | null
          raw_body: Json | null
          raw_packet: string | null
          raw_source: string
          reactive_power: number | null
          reed_state: number | null
          temperature: number | null
          updated_at: string
          user_device_id: number | null
          user_id: string | null
          voltage: number | null
          xup_decoded_edr: Json | null
          xup_encoded_edr: string | null
        }
        Insert: {
          active_power?: number | null
          altitude?: number | null
          apparent_power?: number | null
          created_at: string
          current?: number | null
          dev_eui: string
          energy_consumption_meter_consumed?: number | null
          energy_consumption_meter_elapsed?: number | null
          external_input?: boolean | null
          gateway_id?: string | null
          humidity?: number | null
          id?: number
          inventory_device_id?: number | null
          latitude?: number | null
          legacy_id?: number | null
          legacy_mongo_id?: string | null
          light?: boolean | null
          longitude?: number | null
          luminosity?: number | null
          move?: boolean | null
          power_factor?: number | null
          raw_body?: Json | null
          raw_packet?: string | null
          raw_source?: string
          reactive_power?: number | null
          reed_state?: number | null
          temperature?: number | null
          updated_at?: string
          user_device_id?: number | null
          user_id?: string | null
          voltage?: number | null
          xup_decoded_edr?: Json | null
          xup_encoded_edr?: string | null
        }
        Update: {
          active_power?: number | null
          altitude?: number | null
          apparent_power?: number | null
          created_at?: string
          current?: number | null
          dev_eui?: string
          energy_consumption_meter_consumed?: number | null
          energy_consumption_meter_elapsed?: number | null
          external_input?: boolean | null
          gateway_id?: string | null
          humidity?: number | null
          id?: number
          inventory_device_id?: number | null
          latitude?: number | null
          legacy_id?: number | null
          legacy_mongo_id?: string | null
          light?: boolean | null
          longitude?: number | null
          luminosity?: number | null
          move?: boolean | null
          power_factor?: number | null
          raw_body?: Json | null
          raw_packet?: string | null
          raw_source?: string
          reactive_power?: number | null
          reed_state?: number | null
          temperature?: number | null
          updated_at?: string
          user_device_id?: number | null
          user_id?: string | null
          voltage?: number | null
          xup_decoded_edr?: Json | null
          xup_encoded_edr?: string | null
        }
        Relationships: []
      }
      telemetry_2026_08: {
        Row: {
          active_power: number | null
          altitude: number | null
          apparent_power: number | null
          created_at: string
          current: number | null
          dev_eui: string
          energy_consumption_meter_consumed: number | null
          energy_consumption_meter_elapsed: number | null
          external_input: boolean | null
          gateway_id: string | null
          humidity: number | null
          id: number
          inventory_device_id: number | null
          latitude: number | null
          legacy_id: number | null
          legacy_mongo_id: string | null
          light: boolean | null
          longitude: number | null
          luminosity: number | null
          move: boolean | null
          power_factor: number | null
          raw_body: Json | null
          raw_packet: string | null
          raw_source: string
          reactive_power: number | null
          reed_state: number | null
          temperature: number | null
          updated_at: string
          user_device_id: number | null
          user_id: string | null
          voltage: number | null
          xup_decoded_edr: Json | null
          xup_encoded_edr: string | null
        }
        Insert: {
          active_power?: number | null
          altitude?: number | null
          apparent_power?: number | null
          created_at: string
          current?: number | null
          dev_eui: string
          energy_consumption_meter_consumed?: number | null
          energy_consumption_meter_elapsed?: number | null
          external_input?: boolean | null
          gateway_id?: string | null
          humidity?: number | null
          id?: number
          inventory_device_id?: number | null
          latitude?: number | null
          legacy_id?: number | null
          legacy_mongo_id?: string | null
          light?: boolean | null
          longitude?: number | null
          luminosity?: number | null
          move?: boolean | null
          power_factor?: number | null
          raw_body?: Json | null
          raw_packet?: string | null
          raw_source?: string
          reactive_power?: number | null
          reed_state?: number | null
          temperature?: number | null
          updated_at?: string
          user_device_id?: number | null
          user_id?: string | null
          voltage?: number | null
          xup_decoded_edr?: Json | null
          xup_encoded_edr?: string | null
        }
        Update: {
          active_power?: number | null
          altitude?: number | null
          apparent_power?: number | null
          created_at?: string
          current?: number | null
          dev_eui?: string
          energy_consumption_meter_consumed?: number | null
          energy_consumption_meter_elapsed?: number | null
          external_input?: boolean | null
          gateway_id?: string | null
          humidity?: number | null
          id?: number
          inventory_device_id?: number | null
          latitude?: number | null
          legacy_id?: number | null
          legacy_mongo_id?: string | null
          light?: boolean | null
          longitude?: number | null
          luminosity?: number | null
          move?: boolean | null
          power_factor?: number | null
          raw_body?: Json | null
          raw_packet?: string | null
          raw_source?: string
          reactive_power?: number | null
          reed_state?: number | null
          temperature?: number | null
          updated_at?: string
          user_device_id?: number | null
          user_id?: string | null
          voltage?: number | null
          xup_decoded_edr?: Json | null
          xup_encoded_edr?: string | null
        }
        Relationships: []
      }
      telemetry_2026_09: {
        Row: {
          active_power: number | null
          altitude: number | null
          apparent_power: number | null
          created_at: string
          current: number | null
          dev_eui: string
          energy_consumption_meter_consumed: number | null
          energy_consumption_meter_elapsed: number | null
          external_input: boolean | null
          gateway_id: string | null
          humidity: number | null
          id: number
          inventory_device_id: number | null
          latitude: number | null
          legacy_id: number | null
          legacy_mongo_id: string | null
          light: boolean | null
          longitude: number | null
          luminosity: number | null
          move: boolean | null
          power_factor: number | null
          raw_body: Json | null
          raw_packet: string | null
          raw_source: string
          reactive_power: number | null
          reed_state: number | null
          temperature: number | null
          updated_at: string
          user_device_id: number | null
          user_id: string | null
          voltage: number | null
          xup_decoded_edr: Json | null
          xup_encoded_edr: string | null
        }
        Insert: {
          active_power?: number | null
          altitude?: number | null
          apparent_power?: number | null
          created_at: string
          current?: number | null
          dev_eui: string
          energy_consumption_meter_consumed?: number | null
          energy_consumption_meter_elapsed?: number | null
          external_input?: boolean | null
          gateway_id?: string | null
          humidity?: number | null
          id?: number
          inventory_device_id?: number | null
          latitude?: number | null
          legacy_id?: number | null
          legacy_mongo_id?: string | null
          light?: boolean | null
          longitude?: number | null
          luminosity?: number | null
          move?: boolean | null
          power_factor?: number | null
          raw_body?: Json | null
          raw_packet?: string | null
          raw_source?: string
          reactive_power?: number | null
          reed_state?: number | null
          temperature?: number | null
          updated_at?: string
          user_device_id?: number | null
          user_id?: string | null
          voltage?: number | null
          xup_decoded_edr?: Json | null
          xup_encoded_edr?: string | null
        }
        Update: {
          active_power?: number | null
          altitude?: number | null
          apparent_power?: number | null
          created_at?: string
          current?: number | null
          dev_eui?: string
          energy_consumption_meter_consumed?: number | null
          energy_consumption_meter_elapsed?: number | null
          external_input?: boolean | null
          gateway_id?: string | null
          humidity?: number | null
          id?: number
          inventory_device_id?: number | null
          latitude?: number | null
          legacy_id?: number | null
          legacy_mongo_id?: string | null
          light?: boolean | null
          longitude?: number | null
          luminosity?: number | null
          move?: boolean | null
          power_factor?: number | null
          raw_body?: Json | null
          raw_packet?: string | null
          raw_source?: string
          reactive_power?: number | null
          reed_state?: number | null
          temperature?: number | null
          updated_at?: string
          user_device_id?: number | null
          user_id?: string | null
          voltage?: number | null
          xup_decoded_edr?: Json | null
          xup_encoded_edr?: string | null
        }
        Relationships: []
      }
      telemetry_2026_10: {
        Row: {
          active_power: number | null
          altitude: number | null
          apparent_power: number | null
          created_at: string
          current: number | null
          dev_eui: string
          energy_consumption_meter_consumed: number | null
          energy_consumption_meter_elapsed: number | null
          external_input: boolean | null
          gateway_id: string | null
          humidity: number | null
          id: number
          inventory_device_id: number | null
          latitude: number | null
          legacy_id: number | null
          legacy_mongo_id: string | null
          light: boolean | null
          longitude: number | null
          luminosity: number | null
          move: boolean | null
          power_factor: number | null
          raw_body: Json | null
          raw_packet: string | null
          raw_source: string
          reactive_power: number | null
          reed_state: number | null
          temperature: number | null
          updated_at: string
          user_device_id: number | null
          user_id: string | null
          voltage: number | null
          xup_decoded_edr: Json | null
          xup_encoded_edr: string | null
        }
        Insert: {
          active_power?: number | null
          altitude?: number | null
          apparent_power?: number | null
          created_at: string
          current?: number | null
          dev_eui: string
          energy_consumption_meter_consumed?: number | null
          energy_consumption_meter_elapsed?: number | null
          external_input?: boolean | null
          gateway_id?: string | null
          humidity?: number | null
          id?: number
          inventory_device_id?: number | null
          latitude?: number | null
          legacy_id?: number | null
          legacy_mongo_id?: string | null
          light?: boolean | null
          longitude?: number | null
          luminosity?: number | null
          move?: boolean | null
          power_factor?: number | null
          raw_body?: Json | null
          raw_packet?: string | null
          raw_source?: string
          reactive_power?: number | null
          reed_state?: number | null
          temperature?: number | null
          updated_at?: string
          user_device_id?: number | null
          user_id?: string | null
          voltage?: number | null
          xup_decoded_edr?: Json | null
          xup_encoded_edr?: string | null
        }
        Update: {
          active_power?: number | null
          altitude?: number | null
          apparent_power?: number | null
          created_at?: string
          current?: number | null
          dev_eui?: string
          energy_consumption_meter_consumed?: number | null
          energy_consumption_meter_elapsed?: number | null
          external_input?: boolean | null
          gateway_id?: string | null
          humidity?: number | null
          id?: number
          inventory_device_id?: number | null
          latitude?: number | null
          legacy_id?: number | null
          legacy_mongo_id?: string | null
          light?: boolean | null
          longitude?: number | null
          luminosity?: number | null
          move?: boolean | null
          power_factor?: number | null
          raw_body?: Json | null
          raw_packet?: string | null
          raw_source?: string
          reactive_power?: number | null
          reed_state?: number | null
          temperature?: number | null
          updated_at?: string
          user_device_id?: number | null
          user_id?: string | null
          voltage?: number | null
          xup_decoded_edr?: Json | null
          xup_encoded_edr?: string | null
        }
        Relationships: []
      }
      telemetry_2026_11: {
        Row: {
          active_power: number | null
          altitude: number | null
          apparent_power: number | null
          created_at: string
          current: number | null
          dev_eui: string
          energy_consumption_meter_consumed: number | null
          energy_consumption_meter_elapsed: number | null
          external_input: boolean | null
          gateway_id: string | null
          humidity: number | null
          id: number
          inventory_device_id: number | null
          latitude: number | null
          legacy_id: number | null
          legacy_mongo_id: string | null
          light: boolean | null
          longitude: number | null
          luminosity: number | null
          move: boolean | null
          power_factor: number | null
          raw_body: Json | null
          raw_packet: string | null
          raw_source: string
          reactive_power: number | null
          reed_state: number | null
          temperature: number | null
          updated_at: string
          user_device_id: number | null
          user_id: string | null
          voltage: number | null
          xup_decoded_edr: Json | null
          xup_encoded_edr: string | null
        }
        Insert: {
          active_power?: number | null
          altitude?: number | null
          apparent_power?: number | null
          created_at: string
          current?: number | null
          dev_eui: string
          energy_consumption_meter_consumed?: number | null
          energy_consumption_meter_elapsed?: number | null
          external_input?: boolean | null
          gateway_id?: string | null
          humidity?: number | null
          id?: number
          inventory_device_id?: number | null
          latitude?: number | null
          legacy_id?: number | null
          legacy_mongo_id?: string | null
          light?: boolean | null
          longitude?: number | null
          luminosity?: number | null
          move?: boolean | null
          power_factor?: number | null
          raw_body?: Json | null
          raw_packet?: string | null
          raw_source?: string
          reactive_power?: number | null
          reed_state?: number | null
          temperature?: number | null
          updated_at?: string
          user_device_id?: number | null
          user_id?: string | null
          voltage?: number | null
          xup_decoded_edr?: Json | null
          xup_encoded_edr?: string | null
        }
        Update: {
          active_power?: number | null
          altitude?: number | null
          apparent_power?: number | null
          created_at?: string
          current?: number | null
          dev_eui?: string
          energy_consumption_meter_consumed?: number | null
          energy_consumption_meter_elapsed?: number | null
          external_input?: boolean | null
          gateway_id?: string | null
          humidity?: number | null
          id?: number
          inventory_device_id?: number | null
          latitude?: number | null
          legacy_id?: number | null
          legacy_mongo_id?: string | null
          light?: boolean | null
          longitude?: number | null
          luminosity?: number | null
          move?: boolean | null
          power_factor?: number | null
          raw_body?: Json | null
          raw_packet?: string | null
          raw_source?: string
          reactive_power?: number | null
          reed_state?: number | null
          temperature?: number | null
          updated_at?: string
          user_device_id?: number | null
          user_id?: string | null
          voltage?: number | null
          xup_decoded_edr?: Json | null
          xup_encoded_edr?: string | null
        }
        Relationships: []
      }
      telemetry_2026_12: {
        Row: {
          active_power: number | null
          altitude: number | null
          apparent_power: number | null
          created_at: string
          current: number | null
          dev_eui: string
          energy_consumption_meter_consumed: number | null
          energy_consumption_meter_elapsed: number | null
          external_input: boolean | null
          gateway_id: string | null
          humidity: number | null
          id: number
          inventory_device_id: number | null
          latitude: number | null
          legacy_id: number | null
          legacy_mongo_id: string | null
          light: boolean | null
          longitude: number | null
          luminosity: number | null
          move: boolean | null
          power_factor: number | null
          raw_body: Json | null
          raw_packet: string | null
          raw_source: string
          reactive_power: number | null
          reed_state: number | null
          temperature: number | null
          updated_at: string
          user_device_id: number | null
          user_id: string | null
          voltage: number | null
          xup_decoded_edr: Json | null
          xup_encoded_edr: string | null
        }
        Insert: {
          active_power?: number | null
          altitude?: number | null
          apparent_power?: number | null
          created_at: string
          current?: number | null
          dev_eui: string
          energy_consumption_meter_consumed?: number | null
          energy_consumption_meter_elapsed?: number | null
          external_input?: boolean | null
          gateway_id?: string | null
          humidity?: number | null
          id?: number
          inventory_device_id?: number | null
          latitude?: number | null
          legacy_id?: number | null
          legacy_mongo_id?: string | null
          light?: boolean | null
          longitude?: number | null
          luminosity?: number | null
          move?: boolean | null
          power_factor?: number | null
          raw_body?: Json | null
          raw_packet?: string | null
          raw_source?: string
          reactive_power?: number | null
          reed_state?: number | null
          temperature?: number | null
          updated_at?: string
          user_device_id?: number | null
          user_id?: string | null
          voltage?: number | null
          xup_decoded_edr?: Json | null
          xup_encoded_edr?: string | null
        }
        Update: {
          active_power?: number | null
          altitude?: number | null
          apparent_power?: number | null
          created_at?: string
          current?: number | null
          dev_eui?: string
          energy_consumption_meter_consumed?: number | null
          energy_consumption_meter_elapsed?: number | null
          external_input?: boolean | null
          gateway_id?: string | null
          humidity?: number | null
          id?: number
          inventory_device_id?: number | null
          latitude?: number | null
          legacy_id?: number | null
          legacy_mongo_id?: string | null
          light?: boolean | null
          longitude?: number | null
          luminosity?: number | null
          move?: boolean | null
          power_factor?: number | null
          raw_body?: Json | null
          raw_packet?: string | null
          raw_source?: string
          reactive_power?: number | null
          reed_state?: number | null
          temperature?: number | null
          updated_at?: string
          user_device_id?: number | null
          user_id?: string | null
          voltage?: number | null
          xup_decoded_edr?: Json | null
          xup_encoded_edr?: string | null
        }
        Relationships: []
      }
      telemetry_2027_01: {
        Row: {
          active_power: number | null
          altitude: number | null
          apparent_power: number | null
          created_at: string
          current: number | null
          dev_eui: string
          energy_consumption_meter_consumed: number | null
          energy_consumption_meter_elapsed: number | null
          external_input: boolean | null
          gateway_id: string | null
          humidity: number | null
          id: number
          inventory_device_id: number | null
          latitude: number | null
          legacy_id: number | null
          legacy_mongo_id: string | null
          light: boolean | null
          longitude: number | null
          luminosity: number | null
          move: boolean | null
          power_factor: number | null
          raw_body: Json | null
          raw_packet: string | null
          raw_source: string
          reactive_power: number | null
          reed_state: number | null
          temperature: number | null
          updated_at: string
          user_device_id: number | null
          user_id: string | null
          voltage: number | null
          xup_decoded_edr: Json | null
          xup_encoded_edr: string | null
        }
        Insert: {
          active_power?: number | null
          altitude?: number | null
          apparent_power?: number | null
          created_at: string
          current?: number | null
          dev_eui: string
          energy_consumption_meter_consumed?: number | null
          energy_consumption_meter_elapsed?: number | null
          external_input?: boolean | null
          gateway_id?: string | null
          humidity?: number | null
          id?: number
          inventory_device_id?: number | null
          latitude?: number | null
          legacy_id?: number | null
          legacy_mongo_id?: string | null
          light?: boolean | null
          longitude?: number | null
          luminosity?: number | null
          move?: boolean | null
          power_factor?: number | null
          raw_body?: Json | null
          raw_packet?: string | null
          raw_source?: string
          reactive_power?: number | null
          reed_state?: number | null
          temperature?: number | null
          updated_at?: string
          user_device_id?: number | null
          user_id?: string | null
          voltage?: number | null
          xup_decoded_edr?: Json | null
          xup_encoded_edr?: string | null
        }
        Update: {
          active_power?: number | null
          altitude?: number | null
          apparent_power?: number | null
          created_at?: string
          current?: number | null
          dev_eui?: string
          energy_consumption_meter_consumed?: number | null
          energy_consumption_meter_elapsed?: number | null
          external_input?: boolean | null
          gateway_id?: string | null
          humidity?: number | null
          id?: number
          inventory_device_id?: number | null
          latitude?: number | null
          legacy_id?: number | null
          legacy_mongo_id?: string | null
          light?: boolean | null
          longitude?: number | null
          luminosity?: number | null
          move?: boolean | null
          power_factor?: number | null
          raw_body?: Json | null
          raw_packet?: string | null
          raw_source?: string
          reactive_power?: number | null
          reed_state?: number | null
          temperature?: number | null
          updated_at?: string
          user_device_id?: number | null
          user_id?: string | null
          voltage?: number | null
          xup_decoded_edr?: Json | null
          xup_encoded_edr?: string | null
        }
        Relationships: []
      }
      telemetry_2027_02: {
        Row: {
          active_power: number | null
          altitude: number | null
          apparent_power: number | null
          created_at: string
          current: number | null
          dev_eui: string
          energy_consumption_meter_consumed: number | null
          energy_consumption_meter_elapsed: number | null
          external_input: boolean | null
          gateway_id: string | null
          humidity: number | null
          id: number
          inventory_device_id: number | null
          latitude: number | null
          legacy_id: number | null
          legacy_mongo_id: string | null
          light: boolean | null
          longitude: number | null
          luminosity: number | null
          move: boolean | null
          power_factor: number | null
          raw_body: Json | null
          raw_packet: string | null
          raw_source: string
          reactive_power: number | null
          reed_state: number | null
          temperature: number | null
          updated_at: string
          user_device_id: number | null
          user_id: string | null
          voltage: number | null
          xup_decoded_edr: Json | null
          xup_encoded_edr: string | null
        }
        Insert: {
          active_power?: number | null
          altitude?: number | null
          apparent_power?: number | null
          created_at: string
          current?: number | null
          dev_eui: string
          energy_consumption_meter_consumed?: number | null
          energy_consumption_meter_elapsed?: number | null
          external_input?: boolean | null
          gateway_id?: string | null
          humidity?: number | null
          id?: number
          inventory_device_id?: number | null
          latitude?: number | null
          legacy_id?: number | null
          legacy_mongo_id?: string | null
          light?: boolean | null
          longitude?: number | null
          luminosity?: number | null
          move?: boolean | null
          power_factor?: number | null
          raw_body?: Json | null
          raw_packet?: string | null
          raw_source?: string
          reactive_power?: number | null
          reed_state?: number | null
          temperature?: number | null
          updated_at?: string
          user_device_id?: number | null
          user_id?: string | null
          voltage?: number | null
          xup_decoded_edr?: Json | null
          xup_encoded_edr?: string | null
        }
        Update: {
          active_power?: number | null
          altitude?: number | null
          apparent_power?: number | null
          created_at?: string
          current?: number | null
          dev_eui?: string
          energy_consumption_meter_consumed?: number | null
          energy_consumption_meter_elapsed?: number | null
          external_input?: boolean | null
          gateway_id?: string | null
          humidity?: number | null
          id?: number
          inventory_device_id?: number | null
          latitude?: number | null
          legacy_id?: number | null
          legacy_mongo_id?: string | null
          light?: boolean | null
          longitude?: number | null
          luminosity?: number | null
          move?: boolean | null
          power_factor?: number | null
          raw_body?: Json | null
          raw_packet?: string | null
          raw_source?: string
          reactive_power?: number | null
          reed_state?: number | null
          temperature?: number | null
          updated_at?: string
          user_device_id?: number | null
          user_id?: string | null
          voltage?: number | null
          xup_decoded_edr?: Json | null
          xup_encoded_edr?: string | null
        }
        Relationships: []
      }
      telemetry_2027_03: {
        Row: {
          active_power: number | null
          altitude: number | null
          apparent_power: number | null
          created_at: string
          current: number | null
          dev_eui: string
          energy_consumption_meter_consumed: number | null
          energy_consumption_meter_elapsed: number | null
          external_input: boolean | null
          gateway_id: string | null
          humidity: number | null
          id: number
          inventory_device_id: number | null
          latitude: number | null
          legacy_id: number | null
          legacy_mongo_id: string | null
          light: boolean | null
          longitude: number | null
          luminosity: number | null
          move: boolean | null
          power_factor: number | null
          raw_body: Json | null
          raw_packet: string | null
          raw_source: string
          reactive_power: number | null
          reed_state: number | null
          temperature: number | null
          updated_at: string
          user_device_id: number | null
          user_id: string | null
          voltage: number | null
          xup_decoded_edr: Json | null
          xup_encoded_edr: string | null
        }
        Insert: {
          active_power?: number | null
          altitude?: number | null
          apparent_power?: number | null
          created_at: string
          current?: number | null
          dev_eui: string
          energy_consumption_meter_consumed?: number | null
          energy_consumption_meter_elapsed?: number | null
          external_input?: boolean | null
          gateway_id?: string | null
          humidity?: number | null
          id?: number
          inventory_device_id?: number | null
          latitude?: number | null
          legacy_id?: number | null
          legacy_mongo_id?: string | null
          light?: boolean | null
          longitude?: number | null
          luminosity?: number | null
          move?: boolean | null
          power_factor?: number | null
          raw_body?: Json | null
          raw_packet?: string | null
          raw_source?: string
          reactive_power?: number | null
          reed_state?: number | null
          temperature?: number | null
          updated_at?: string
          user_device_id?: number | null
          user_id?: string | null
          voltage?: number | null
          xup_decoded_edr?: Json | null
          xup_encoded_edr?: string | null
        }
        Update: {
          active_power?: number | null
          altitude?: number | null
          apparent_power?: number | null
          created_at?: string
          current?: number | null
          dev_eui?: string
          energy_consumption_meter_consumed?: number | null
          energy_consumption_meter_elapsed?: number | null
          external_input?: boolean | null
          gateway_id?: string | null
          humidity?: number | null
          id?: number
          inventory_device_id?: number | null
          latitude?: number | null
          legacy_id?: number | null
          legacy_mongo_id?: string | null
          light?: boolean | null
          longitude?: number | null
          luminosity?: number | null
          move?: boolean | null
          power_factor?: number | null
          raw_body?: Json | null
          raw_packet?: string | null
          raw_source?: string
          reactive_power?: number | null
          reed_state?: number | null
          temperature?: number | null
          updated_at?: string
          user_device_id?: number | null
          user_id?: string | null
          voltage?: number | null
          xup_decoded_edr?: Json | null
          xup_encoded_edr?: string | null
        }
        Relationships: []
      }
      telemetry_2027_08: {
        Row: {
          active_power: number | null
          altitude: number | null
          apparent_power: number | null
          created_at: string
          current: number | null
          dev_eui: string
          energy_consumption_meter_consumed: number | null
          energy_consumption_meter_elapsed: number | null
          external_input: boolean | null
          gateway_id: string | null
          humidity: number | null
          id: number
          inventory_device_id: number | null
          latitude: number | null
          legacy_id: number | null
          legacy_mongo_id: string | null
          light: boolean | null
          longitude: number | null
          luminosity: number | null
          move: boolean | null
          power_factor: number | null
          raw_body: Json | null
          raw_packet: string | null
          raw_source: string
          reactive_power: number | null
          reed_state: number | null
          temperature: number | null
          updated_at: string
          user_device_id: number | null
          user_id: string | null
          voltage: number | null
          xup_decoded_edr: Json | null
          xup_encoded_edr: string | null
        }
        Insert: {
          active_power?: number | null
          altitude?: number | null
          apparent_power?: number | null
          created_at: string
          current?: number | null
          dev_eui: string
          energy_consumption_meter_consumed?: number | null
          energy_consumption_meter_elapsed?: number | null
          external_input?: boolean | null
          gateway_id?: string | null
          humidity?: number | null
          id?: number
          inventory_device_id?: number | null
          latitude?: number | null
          legacy_id?: number | null
          legacy_mongo_id?: string | null
          light?: boolean | null
          longitude?: number | null
          luminosity?: number | null
          move?: boolean | null
          power_factor?: number | null
          raw_body?: Json | null
          raw_packet?: string | null
          raw_source?: string
          reactive_power?: number | null
          reed_state?: number | null
          temperature?: number | null
          updated_at?: string
          user_device_id?: number | null
          user_id?: string | null
          voltage?: number | null
          xup_decoded_edr?: Json | null
          xup_encoded_edr?: string | null
        }
        Update: {
          active_power?: number | null
          altitude?: number | null
          apparent_power?: number | null
          created_at?: string
          current?: number | null
          dev_eui?: string
          energy_consumption_meter_consumed?: number | null
          energy_consumption_meter_elapsed?: number | null
          external_input?: boolean | null
          gateway_id?: string | null
          humidity?: number | null
          id?: number
          inventory_device_id?: number | null
          latitude?: number | null
          legacy_id?: number | null
          legacy_mongo_id?: string | null
          light?: boolean | null
          longitude?: number | null
          luminosity?: number | null
          move?: boolean | null
          power_factor?: number | null
          raw_body?: Json | null
          raw_packet?: string | null
          raw_source?: string
          reactive_power?: number | null
          reed_state?: number | null
          temperature?: number | null
          updated_at?: string
          user_device_id?: number | null
          user_id?: string | null
          voltage?: number | null
          xup_decoded_edr?: Json | null
          xup_encoded_edr?: string | null
        }
        Relationships: []
      }
      telemetry_default: {
        Row: {
          active_power: number | null
          altitude: number | null
          apparent_power: number | null
          created_at: string
          current: number | null
          dev_eui: string
          energy_consumption_meter_consumed: number | null
          energy_consumption_meter_elapsed: number | null
          external_input: boolean | null
          gateway_id: string | null
          humidity: number | null
          id: number
          inventory_device_id: number | null
          latitude: number | null
          legacy_id: number | null
          legacy_mongo_id: string | null
          light: boolean | null
          longitude: number | null
          luminosity: number | null
          move: boolean | null
          power_factor: number | null
          raw_body: Json | null
          raw_packet: string | null
          raw_source: string
          reactive_power: number | null
          reed_state: number | null
          temperature: number | null
          updated_at: string
          user_device_id: number | null
          user_id: string | null
          voltage: number | null
          xup_decoded_edr: Json | null
          xup_encoded_edr: string | null
        }
        Insert: {
          active_power?: number | null
          altitude?: number | null
          apparent_power?: number | null
          created_at: string
          current?: number | null
          dev_eui: string
          energy_consumption_meter_consumed?: number | null
          energy_consumption_meter_elapsed?: number | null
          external_input?: boolean | null
          gateway_id?: string | null
          humidity?: number | null
          id?: number
          inventory_device_id?: number | null
          latitude?: number | null
          legacy_id?: number | null
          legacy_mongo_id?: string | null
          light?: boolean | null
          longitude?: number | null
          luminosity?: number | null
          move?: boolean | null
          power_factor?: number | null
          raw_body?: Json | null
          raw_packet?: string | null
          raw_source?: string
          reactive_power?: number | null
          reed_state?: number | null
          temperature?: number | null
          updated_at?: string
          user_device_id?: number | null
          user_id?: string | null
          voltage?: number | null
          xup_decoded_edr?: Json | null
          xup_encoded_edr?: string | null
        }
        Update: {
          active_power?: number | null
          altitude?: number | null
          apparent_power?: number | null
          created_at?: string
          current?: number | null
          dev_eui?: string
          energy_consumption_meter_consumed?: number | null
          energy_consumption_meter_elapsed?: number | null
          external_input?: boolean | null
          gateway_id?: string | null
          humidity?: number | null
          id?: number
          inventory_device_id?: number | null
          latitude?: number | null
          legacy_id?: number | null
          legacy_mongo_id?: string | null
          light?: boolean | null
          longitude?: number | null
          luminosity?: number | null
          move?: boolean | null
          power_factor?: number | null
          raw_body?: Json | null
          raw_packet?: string | null
          raw_source?: string
          reactive_power?: number | null
          reed_state?: number | null
          temperature?: number | null
          updated_at?: string
          user_device_id?: number | null
          user_id?: string | null
          voltage?: number | null
          xup_decoded_edr?: Json | null
          xup_encoded_edr?: string | null
        }
        Relationships: []
      }
      units: {
        Row: {
          building_id: number
          created_at: string
          floor_id: number
          id: number
          name: string
          updated_at: string
        }
        Insert: {
          building_id: number
          created_at?: string
          floor_id: number
          id?: number
          name: string
          updated_at?: string
        }
        Update: {
          building_id?: number
          created_at?: string
          floor_id?: number
          id?: number
          name?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "units_building_id_fkey"
            columns: ["building_id"]
            isOneToOne: false
            referencedRelation: "buildings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "units_floor_id_fkey"
            columns: ["floor_id"]
            isOneToOne: false
            referencedRelation: "floors"
            referencedColumns: ["id"]
          },
        ]
      }
      user_devices: {
        Row: {
          activated_at: string | null
          activation_status: string | null
          created_at: string
          dev_eui: string | null
          device_activation_code: string | null
          device_location: string | null
          device_name: string | null
          entitlement_id: number | null
          id: number
          inventory_device_id: number | null
          last_dev_eui: string | null
          last_reading: Json | null
          last_reading_at: string | null
          last_reading_id: number | null
          notification_email: string | null
          notification_phone_number: string | null
          package_id: number | null
          promo_code_id: number | null
          provider_subscription_id: string | null
          session_id: string | null
          status: Database["public"]["Enums"]["user_device_status"]
          toggle_status: boolean
          updated_at: string
          user_id: string
          xnid: string | null
        }
        Insert: {
          activated_at?: string | null
          activation_status?: string | null
          created_at?: string
          dev_eui?: string | null
          device_activation_code?: string | null
          device_location?: string | null
          device_name?: string | null
          entitlement_id?: number | null
          id?: number
          inventory_device_id?: number | null
          last_dev_eui?: string | null
          last_reading?: Json | null
          last_reading_at?: string | null
          last_reading_id?: number | null
          notification_email?: string | null
          notification_phone_number?: string | null
          package_id?: number | null
          promo_code_id?: number | null
          provider_subscription_id?: string | null
          session_id?: string | null
          status?: Database["public"]["Enums"]["user_device_status"]
          toggle_status?: boolean
          updated_at?: string
          user_id: string
          xnid?: string | null
        }
        Update: {
          activated_at?: string | null
          activation_status?: string | null
          created_at?: string
          dev_eui?: string | null
          device_activation_code?: string | null
          device_location?: string | null
          device_name?: string | null
          entitlement_id?: number | null
          id?: number
          inventory_device_id?: number | null
          last_dev_eui?: string | null
          last_reading?: Json | null
          last_reading_at?: string | null
          last_reading_id?: number | null
          notification_email?: string | null
          notification_phone_number?: string | null
          package_id?: number | null
          promo_code_id?: number | null
          provider_subscription_id?: string | null
          session_id?: string | null
          status?: Database["public"]["Enums"]["user_device_status"]
          toggle_status?: boolean
          updated_at?: string
          user_id?: string
          xnid?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "user_devices_entitlement_id_fkey"
            columns: ["entitlement_id"]
            isOneToOne: false
            referencedRelation: "subscription_entitlements"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_devices_inventory_device_id_fkey"
            columns: ["inventory_device_id"]
            isOneToOne: false
            referencedRelation: "inventory_devices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_devices_package_id_fkey"
            columns: ["package_id"]
            isOneToOne: false
            referencedRelation: "packages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_devices_promo_code_id_fkey"
            columns: ["promo_code_id"]
            isOneToOne: false
            referencedRelation: "promo_codes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_devices_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      user_permissions: {
        Row: {
          can_create: boolean
          can_delete: boolean
          can_read: boolean
          can_update: boolean
          created_at: string
          created_by: string | null
          module_id: number
          updated_at: string
          user_id: string
        }
        Insert: {
          can_create?: boolean
          can_delete?: boolean
          can_read?: boolean
          can_update?: boolean
          created_at?: string
          created_by?: string | null
          module_id: number
          updated_at?: string
          user_id: string
        }
        Update: {
          can_create?: boolean
          can_delete?: boolean
          can_read?: boolean
          can_update?: boolean
          created_at?: string
          created_by?: string | null
          module_id?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_permissions_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_permissions_module_id_fkey"
            columns: ["module_id"]
            isOneToOne: false
            referencedRelation: "modules"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_permissions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      user_scopes: {
        Row: {
          asset_ids: number[]
          asset_labels: Json | null
          created_at: string
          created_by: string | null
          entity_type: string
          updated_at: string
          user_id: string
        }
        Insert: {
          asset_ids: number[]
          asset_labels?: Json | null
          created_at?: string
          created_by?: string | null
          entity_type: string
          updated_at?: string
          user_id: string
        }
        Update: {
          asset_ids?: number[]
          asset_labels?: Json | null
          created_at?: string
          created_by?: string | null
          entity_type?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_scopes_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_scopes_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      user_xup_preferences: {
        Row: {
          attribute_id: number | null
          created_at: string
          id: number
          is_visible: boolean
          notifie_id: number | null
          product_id: number
          send_notification: boolean
          updated_at: string
          user_id: string
          xup_id: number | null
        }
        Insert: {
          attribute_id?: number | null
          created_at?: string
          id?: number
          is_visible?: boolean
          notifie_id?: number | null
          product_id: number
          send_notification?: boolean
          updated_at?: string
          user_id: string
          xup_id?: number | null
        }
        Update: {
          attribute_id?: number | null
          created_at?: string
          id?: number
          is_visible?: boolean
          notifie_id?: number | null
          product_id?: number
          send_notification?: boolean
          updated_at?: string
          user_id?: string
          xup_id?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "user_xup_preferences_attribute_id_fkey"
            columns: ["attribute_id"]
            isOneToOne: false
            referencedRelation: "attributes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_xup_preferences_notifie_id_fkey"
            columns: ["notifie_id"]
            isOneToOne: false
            referencedRelation: "notifies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_xup_preferences_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_xup_preferences_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_xup_preferences_xup_id_fkey"
            columns: ["xup_id"]
            isOneToOne: false
            referencedRelation: "xups"
            referencedColumns: ["id"]
          },
        ]
      }
      vendors: {
        Row: {
          address: string | null
          created_at: string
          description: string | null
          id: number
          name: string
          updated_at: string
        }
        Insert: {
          address?: string | null
          created_at?: string
          description?: string | null
          id?: number
          name: string
          updated_at?: string
        }
        Update: {
          address?: string | null
          created_at?: string
          description?: string | null
          id?: number
          name?: string
          updated_at?: string
        }
        Relationships: []
      }
      xups: {
        Row: {
          code: string
          created_at: string
          data_type: string
          description: string | null
          format: string | null
          id: number
          label: string | null
          units: string | null
          updated_at: string
          version: string
        }
        Insert: {
          code: string
          created_at?: string
          data_type: string
          description?: string | null
          format?: string | null
          id?: number
          label?: string | null
          units?: string | null
          updated_at?: string
          version: string
        }
        Update: {
          code?: string
          created_at?: string
          data_type?: string
          description?: string | null
          format?: string | null
          id?: number
          label?: string | null
          units?: string | null
          updated_at?: string
          version?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      auth_can: {
        Args: { p_action: string; p_module: string; p_user?: string }
        Returns: boolean
      }
      auth_is_customer: { Args: { p_user?: string }; Returns: boolean }
      auth_is_super_admin: { Args: { p_user?: string }; Returns: boolean }
      auth_owns_user_device: {
        Args: { p_user?: string; p_user_device: number }
        Returns: boolean
      }
      auth_role_title: { Args: { p_user?: string }; Returns: string }
      auth_scope_allows: {
        Args: { p_asset: number; p_entity: string; p_user?: string }
        Returns: boolean
      }
      auth_scope_grant_allowed: {
        Args: { p_actor?: string; p_asset_ids: number[]; p_entity: string }
        Returns: boolean
      }
      create_telemetry_partition: {
        Args: { p_month: string }
        Returns: undefined
      }
      custom_access_token_hook: { Args: { event: Json }; Returns: Json }
      gen_xnid: { Args: { prefix: string }; Returns: string }
      rls_catalog_read: { Args: never; Returns: boolean }
    }
    Enums: {
      activation_attempt_status: "pending" | "completed" | "expired" | "failed"
      billing_mode: "direct" | "dealer_assisted" | "dealer_billed"
      charging_timer_kind: "standard" | "quick"
      contract_status: "required" | "sent" | "signed" | "expired" | "cancelled"
      device_assignment_status: "active" | "suspended" | "released" | "inactive"
      entitlement_source: "stripe" | "admin" | "system"
      invoice_status: "unpaid" | "paid" | "void" | "partially_paid"
      neo_alarm_status: "pending" | "success" | "failed" | "partial"
      notification_channel: "email" | "sms"
      payment_provider: "stripe" | "cash"
      pos_txn_type: "charge" | "credit"
      rate_plan_type: "percent" | "fixed"
      scheduler_recurrence: "daily" | "weekly" | "bi-weekly"
      user_device_status: "decline" | "captured"
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
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
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
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
      activation_attempt_status: ["pending", "completed", "expired", "failed"],
      billing_mode: ["direct", "dealer_assisted", "dealer_billed"],
      charging_timer_kind: ["standard", "quick"],
      contract_status: ["required", "sent", "signed", "expired", "cancelled"],
      device_assignment_status: ["active", "suspended", "released", "inactive"],
      entitlement_source: ["stripe", "admin", "system"],
      invoice_status: ["unpaid", "paid", "void", "partially_paid"],
      neo_alarm_status: ["pending", "success", "failed", "partial"],
      notification_channel: ["email", "sms"],
      payment_provider: ["stripe", "cash"],
      pos_txn_type: ["charge", "credit"],
      rate_plan_type: ["percent", "fixed"],
      scheduler_recurrence: ["daily", "weekly", "bi-weekly"],
      user_device_status: ["decline", "captured"],
    },
  },
} as const

