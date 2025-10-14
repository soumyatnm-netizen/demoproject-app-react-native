/**
 * Shared validation utilities for edge functions
 * Provides strict input validation to prevent injection attacks and resource exhaustion
 */

// Import zod from esm.sh (Deno-compatible)
import { z } from 'https://deno.land/x/zod@v3.22.4/mod.ts';

/**
 * UUID validation schema
 */
export const uuidSchema = z.string().uuid('Invalid UUID format');

/**
 * Client name validation - alphanumeric with limited special chars
 * Max 200 characters to prevent resource exhaustion
 */
export const clientNameSchema = z.string()
  .min(1, 'Client name is required')
  .max(200, 'Client name must be less than 200 characters')
  .regex(/^[a-zA-Z0-9\s\-&'.,()]+$/, 'Client name contains invalid characters');

/**
 * URL validation with length limits to prevent SSRF
 */
export const urlSchema = z.string()
  .url('Invalid URL format')
  .max(2048, 'URL must be less than 2048 characters');

/**
 * Email validation
 */
export const emailSchema = z.string()
  .email('Invalid email format')
  .max(255, 'Email must be less than 255 characters');

/**
 * Phone validation - flexible international format
 */
export const phoneSchema = z.string()
  .regex(/^\+?[0-9\s\-()]{6,20}$/, 'Invalid phone number format')
  .max(20, 'Phone number must be less than 20 characters');

/**
 * Generic text field validation with configurable max length
 */
export const createTextSchema = (maxLength = 1000) => 
  z.string()
    .max(maxLength, `Text must be less than ${maxLength} characters`);

/**
 * Process document request schema
 */
export const processDocumentSchema = z.object({
  documentId: uuidSchema,
  clientName: clientNameSchema,
});

/**
 * Process appetite document request schema
 */
export const processAppetiteDocumentSchema = z.object({
  appetiteDocumentId: uuidSchema,
  underwriterName: z.string()
    .min(1)
    .max(200)
    .regex(/^[a-zA-Z0-9\s\-&'.,()]+$/, 'Invalid underwriter name'),
  sourceUrl: urlSchema.optional(),
});

/**
 * Scan client document request schema
 */
export const scanClientDocumentSchema = z.object({
  documentId: uuidSchema,
});

/**
 * Preflight classify request schema
 */
export const preflightClassifySchema = z.object({
  documentId: uuidSchema,
});

/**
 * Reprocess quote request schema
 */
export const reprocessQuoteSchema = z.object({
  quoteId: uuidSchema,
  clientName: clientNameSchema,
});

/**
 * Sanitize output strings to prevent XSS
 * Removes potentially dangerous HTML/JS characters
 */
export function sanitizeOutput(text: string): string {
  if (!text) return '';
  return text
    .replace(/[<>]/g, '') // Remove HTML tags
    .replace(/javascript:/gi, '') // Remove javascript: protocol
    .replace(/on\w+=/gi, ''); // Remove event handlers
}

/**
 * Validate and sanitize request body
 * Returns validated data or throws validation error with details
 */
export async function validateRequest<T>(
  req: Request,
  schema: z.ZodSchema<T>
): Promise<T> {
  try {
    const body = await req.json();
    const validated = schema.parse(body);
    return validated;
  } catch (error) {
    if (error instanceof z.ZodError) {
      const messages = error.errors.map(e => `${e.path.join('.')}: ${e.message}`).join(', ');
      throw new Error(`Validation failed: ${messages}`);
    }
    throw new Error('Invalid request body');
  }
}

/**
 * Create standard error response
 */
export function createErrorResponse(
  req: Request,
  status: number,
  message: string,
  corsHeaders: Record<string, string>
) {
  return new Response(
    JSON.stringify({
      ok: false,
      error: sanitizeOutput(message),
    }),
    {
      status,
      headers: {
        'Content-Type': 'application/json',
        ...corsHeaders,
      },
    }
  );
}
