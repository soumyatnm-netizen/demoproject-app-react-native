import { supabase } from "@/integrations/supabase/client";

/**
 * Reprocess a quote to extract correct insurer data from the document
 */
export async function reprocessQuote(quoteId: string) {
  console.log('Reprocessing quote:', quoteId);
  
  const { data, error } = await supabase.functions.invoke('reprocess-quote', {
    body: { quoteId }
  });

  if (error) {
    console.error('Reprocess error:', error);
    throw error;
  }

  console.log('Reprocess result:', data);
  return data;
}

/**
 * Reprocess multiple quotes
 */
export async function reprocessMultipleQuotes(quoteIds: string[]) {
  const results = [];
  
  for (const quoteId of quoteIds) {
    try {
      const result = await reprocessQuote(quoteId);
      results.push({ quoteId, success: true, result });
    } catch (error) {
      console.error(`Failed to reprocess quote ${quoteId}:`, error);
      results.push({ quoteId, success: false, error });
    }
  }
  
  return results;
}
