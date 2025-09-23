// Enhanced Security and Audit Logging Utilities
import { supabase } from "@/integrations/supabase/client";

interface FileAccessLog {
  user_id: string;
  file_id?: string;
  file_path?: string;
  action_type: 'upload' | 'download' | 'delete' | 'view' | 'process';
  ip_address?: string;
  user_agent?: string;
  success?: boolean;
  error_message?: string;
  metadata?: Record<string, any>;
}

interface PIIAccessLog {
  accessed_user_id: string;
  accessing_user_id: string;
  data_type: 'profile' | 'sensitive_data' | 'document' | 'financial';
  access_method: 'direct' | 'api' | 'report' | 'export';
  fields_accessed?: string[];
  purpose?: string;
  consent_required?: boolean;
  consent_given?: boolean;
  ip_address?: string;
  user_agent?: string;
  session_id?: string;
  risk_score?: number;
  success?: boolean;
  blocked_reason?: string;
  metadata?: Record<string, any>;
}

export class SecurityLogger {
  private static getClientInfo() {
    return {
      ip_address: null, // Would be set by server-side logging
      user_agent: navigator.userAgent,
      session_id: crypto.randomUUID(),
    };
  }

  /**
   * Log file access operations for audit trail
   */
  static async logFileAccess(log: Omit<FileAccessLog, 'user_id'>) {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const clientInfo = this.getClientInfo();
      
      // Use database function for audit logging
      await supabase.rpc('log_file_access', {
        p_user_id: user.id,
        p_action_type: log.action_type,
        p_file_id: log.file_id ?? null,
        p_file_path: log.file_path ?? null,
        p_ip_address: clientInfo.ip_address,
        p_user_agent: clientInfo.user_agent,
        p_success: log.success ?? true,
        p_error_message: log.error_message ?? null,
        p_metadata: log.metadata ?? {}
      });
    } catch (error) {
      console.error('Failed to log file access:', error);
    }
  }

  /**
   * Log PII data access for compliance
   */
  static async logPIIAccess(log: Omit<PIIAccessLog, 'accessing_user_id'>) {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const clientInfo = this.getClientInfo();
      
      // Use database function for audit logging
      await supabase.rpc('log_pii_access', {
        p_accessed_user_id: log.accessed_user_id,
        p_accessing_user_id: user.id,
        p_data_type: log.data_type,
        p_access_method: log.access_method,
        p_fields_accessed: log.fields_accessed ?? [],
        p_purpose: log.purpose ?? null,
        p_consent_required: log.consent_required ?? false,
        p_consent_given: log.consent_given ?? false,
        p_ip_address: clientInfo.ip_address,
        p_user_agent: clientInfo.user_agent,
        p_session_id: clientInfo.session_id,
        p_risk_score: log.risk_score ?? 25,
        p_success: log.success ?? true,
        p_blocked_reason: log.blocked_reason ?? null,
        p_metadata: log.metadata ?? {}
      });
    } catch (error) {
      console.error('Failed to log PII access:', error);
    }
  }

  /**
   * Enhanced file upload with security logging
   */
  static async secureFileUpload(
    file: File,
    bucket: string,
    path: string,
    options?: any
  ) {
    const startTime = Date.now();
    
    try {
      // Log upload attempt
      await this.logFileAccess({
        file_path: path,
        action_type: 'upload',
        success: true,
        metadata: {
          file_name: file.name,
          file_size: file.size,
          file_type: file.type,
          bucket,
        }
      });

      // Perform upload with encryption (Supabase handles AES-256 by default)
      const { data, error } = await supabase.storage
        .from(bucket)
        .upload(path, file, {
          cacheControl: '3600',
          upsert: false,
          ...options
        });

      if (error) throw error;

      // Log successful upload
      await this.logFileAccess({
        file_path: path,
        action_type: 'upload',
        success: true,
        metadata: {
          upload_duration_ms: Date.now() - startTime,
          file_name: file.name,
          file_size: file.size,
          storage_path: data.path,
        }
      });

      return { data, error: null };
    } catch (error) {
      // Log failed upload
      await this.logFileAccess({
        file_path: path,
        action_type: 'upload',
        success: false,
        error_message: error instanceof Error ? error.message : 'Upload failed',
        metadata: {
          upload_duration_ms: Date.now() - startTime,
          file_name: file.name,
          file_size: file.size,
        }
      });

      return { data: null, error };
    }
  }

  /**
   * Secure profile data access with audit logging
   */
  static async accessProfileData(targetUserId: string, purpose?: string) {
    try {
      await this.logPIIAccess({
        accessed_user_id: targetUserId,
        data_type: 'profile',
        access_method: 'api',
        fields_accessed: ['first_name', 'last_name', 'job_title', 'department'],
        purpose: purpose ?? 'Profile data access',
        consent_required: targetUserId !== (await supabase.auth.getUser()).data.user?.id,
        consent_given: false, // Would need to check consent table
        risk_score: 25,
      });

      return await supabase
        .from('profiles')
        .select('*')
        .eq('user_id', targetUserId)
        .single();
    } catch (error) {
      await this.logPIIAccess({
        accessed_user_id: targetUserId,
        data_type: 'profile',
        access_method: 'api',
        success: false,
        blocked_reason: error instanceof Error ? error.message : 'Access denied',
      });
      throw error;
    }
  }

  /**
   * Get security headers for enhanced protection
   */
  static getSecurityHeaders(): Record<string, string> {
    return {
      'Strict-Transport-Security': 'max-age=31536000; includeSubDomains; preload',
      'X-Content-Type-Options': 'nosniff',
      'X-Frame-Options': 'DENY',
      'X-XSS-Protection': '1; mode=block',
      'Referrer-Policy': 'strict-origin-when-cross-origin',
      'Content-Security-Policy': "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; font-src 'self'; connect-src 'self' https://*.supabase.co;",
      'Permissions-Policy': 'camera=(), microphone=(), geolocation=()'
    };
  }
}

// Enhanced encryption utilities
export class EncryptionUtils {
  /**
   * Client-side field encryption before storage (additional layer)
   */
  static async encryptField(data: string, key?: string): Promise<string> {
    // Note: This is additional client-side encryption
    // Supabase already provides AES-256 encryption at rest
    try {
      const encoder = new TextEncoder();
      const dataBuffer = encoder.encode(data);
      
      // Generate a key from password or use default
      const keyMaterial = await crypto.subtle.importKey(
        'raw',
        encoder.encode(key ?? 'default-encryption-key'),
        { name: 'PBKDF2' },
        false,
        ['deriveBits', 'deriveKey']
      );
      
      const salt = crypto.getRandomValues(new Uint8Array(16));
      const derivedKey = await crypto.subtle.deriveKey(
        {
          name: 'PBKDF2',
          salt,
          iterations: 100000,
          hash: 'SHA-256'
        },
        keyMaterial,
        { name: 'AES-GCM', length: 256 },
        false,
        ['encrypt']
      );
      
      const iv = crypto.getRandomValues(new Uint8Array(12));
      const encrypted = await crypto.subtle.encrypt(
        { name: 'AES-GCM', iv },
        derivedKey,
        dataBuffer
      );
      
      // Combine salt, iv, and encrypted data
      const combined = new Uint8Array(salt.length + iv.length + encrypted.byteLength);
      combined.set(salt, 0);
      combined.set(iv, salt.length);
      combined.set(new Uint8Array(encrypted), salt.length + iv.length);
      
      return btoa(String.fromCharCode(...combined));
    } catch (error) {
      console.error('Encryption failed:', error);
      return data; // Return original if encryption fails
    }
  }

  /**
   * Client-side field decryption
   */
  static async decryptField(encryptedData: string, key?: string): Promise<string> {
    try {
      const combined = new Uint8Array(
        atob(encryptedData).split('').map(char => char.charCodeAt(0))
      );
      
      const salt = combined.slice(0, 16);
      const iv = combined.slice(16, 28);
      const encrypted = combined.slice(28);
      
      const encoder = new TextEncoder();
      const keyMaterial = await crypto.subtle.importKey(
        'raw',
        encoder.encode(key ?? 'default-encryption-key'),
        { name: 'PBKDF2' },
        false,
        ['deriveBits', 'deriveKey']
      );
      
      const derivedKey = await crypto.subtle.deriveKey(
        {
          name: 'PBKDF2',
          salt,
          iterations: 100000,
          hash: 'SHA-256'
        },
        keyMaterial,
        { name: 'AES-GCM', length: 256 },
        false,
        ['decrypt']
      );
      
      const decrypted = await crypto.subtle.decrypt(
        { name: 'AES-GCM', iv },
        derivedKey,
        encrypted
      );
      
      const decoder = new TextDecoder();
      return decoder.decode(decrypted);
    } catch (error) {
      console.error('Decryption failed:', error);
      return encryptedData; // Return original if decryption fails
    }
  }
}