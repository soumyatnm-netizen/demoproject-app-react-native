/**
 * PII Redaction Utility
 * Client-side only - does not modify database data
 */

// PII field keys that should be redacted for super admins
const PII_FIELDS = [
  'client_name',
  'business_name',
  'company_name',
  'name',
  'email',
  'phone',
  'address',
  'website',
  'contact_name',
  'first_name',
  'last_name',
  'domain',
  'city',
  'country',
  'personal_address',
  'insured_name',
  'current_broker',
];

// Redacted display component styles
export const REDACTED_STYLE = "bg-destructive/90 text-destructive-foreground px-2 py-0.5 rounded text-xs font-mono select-none";
export const REDACTED_TEXT = "██████████";

/**
 * Check if a field key is a PII field
 */
export const isPIIField = (fieldKey: string): boolean => {
  const lowerKey = fieldKey.toLowerCase();
  return PII_FIELDS.some(pii => 
    lowerKey.includes(pii.toLowerCase()) || 
    lowerKey === pii.toLowerCase()
  );
};

/**
 * Redact a single value if it's considered PII
 */
export const redactValue = (value: string | null | undefined, shouldRedact: boolean): string => {
  if (!shouldRedact || !value) return value || '';
  return REDACTED_TEXT;
};

/**
 * Redact PII fields from an object
 * Returns a new object with PII fields redacted
 */
export const redactPII = <T extends Record<string, any>>(
  data: T,
  shouldRedact: boolean
): T => {
  if (!shouldRedact || !data) return data;

  const redacted: Record<string, any> = { ...data };
  
  for (const key of Object.keys(redacted)) {
    const value = redacted[key];
    
    // Handle nested objects
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      redacted[key] = redactPII(value, shouldRedact);
    }
    // Handle string values
    else if (typeof value === 'string' && isPIIField(key)) {
      redacted[key] = REDACTED_TEXT;
    }
  }

  return redacted as T;
};

/**
 * Redact PII fields from an array of objects
 */
export const redactPIIArray = <T extends Record<string, any>>(
  data: T[],
  shouldRedact: boolean
): T[] => {
  if (!shouldRedact || !data) return data;
  return data.map(item => redactPII(item, shouldRedact));
};

/**
 * Component for displaying redacted text inline
 */
export const RedactedText = ({ 
  value, 
  shouldRedact,
  className = "" 
}: { 
  value: string | null | undefined; 
  shouldRedact: boolean;
  className?: string;
}) => {
  if (!shouldRedact || !value) {
    return <span className={className}>{value || ''}</span>;
  }
  
  return (
    <span className={`${REDACTED_STYLE} ${className}`} title="Redacted for privacy">
      {REDACTED_TEXT}
    </span>
  );
};
