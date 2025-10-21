import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';

/**
 * Generate a hash for document content to use as cache key
 */
export async function generateDocumentHash(content: ArrayBuffer, metadata: {
  insurer?: string;
  fileSize?: number;
  pageCount?: number;
}): Promise<string> {
  // Create hash from content
  const hashBuffer = await crypto.subtle.digest('SHA-256', content);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const contentHash = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  
  // Include metadata in hash for better uniqueness
  const metadataString = JSON.stringify({
    insurer: metadata.insurer?.toLowerCase().trim(),
    size: metadata.fileSize,
    pages: metadata.pageCount
  });
  
  return `${contentHash}-${btoa(metadataString).slice(0, 16)}`;
}

/**
 * Check if document exists in cache and return cached data
 */
export async function getCachedDocument(
  supabaseClient: ReturnType<typeof createClient>,
  documentHash: string
): Promise<any | null> {
  try {
    const { data, error } = await supabaseClient
      .from('policy_wording_cache')
      .select('*')
      .eq('document_hash', documentHash)
      .single();
    
    if (error || !data) {
      return null;
    }
    
    // Update usage statistics
    await supabaseClient.rpc('update_cache_usage', {
      p_document_hash: documentHash
    });
    
    console.log(`✅ Cache HIT for document ${documentHash.slice(0, 8)}... (used ${data.use_count} times)`);
    
    return data.extracted_data;
  } catch (error) {
    console.error('Error checking cache:', error);
    return null;
  }
}

/**
 * Store document analysis results in cache
 */
export async function cacheDocumentResults(
  supabaseClient: ReturnType<typeof createClient>,
  documentHash: string,
  insurerName: string,
  extractedData: any,
  metadata: {
    policyType?: string;
    fileSize?: number;
    pageCount?: number;
    additionalMetadata?: Record<string, any>;
  }
): Promise<void> {
  try {
    const { error } = await supabaseClient
      .from('policy_wording_cache')
      .upsert({
        document_hash: documentHash,
        insurer_name: insurerName,
        policy_type: metadata.policyType,
        file_size_bytes: metadata.fileSize,
        page_count: metadata.pageCount,
        extracted_data: extractedData,
        document_metadata: metadata.additionalMetadata || {},
        created_at: new Date().toISOString(),
        last_used_at: new Date().toISOString(),
        use_count: 1
      }, {
        onConflict: 'document_hash'
      });
    
    if (error) {
      console.error('Error caching document:', error);
    } else {
      console.log(`💾 Cached document ${documentHash.slice(0, 8)}... for ${insurerName}`);
    }
  } catch (error) {
    console.error('Error storing cache:', error);
  }
}

/**
 * Get cache statistics for monitoring
 */
export async function getCacheStats(
  supabaseClient: ReturnType<typeof createClient>
): Promise<{
  totalCached: number;
  totalHits: number;
  topInsurers: Array<{ insurer: string; count: number }>;
}> {
  try {
    const { data, error } = await supabaseClient
      .from('policy_wording_cache')
      .select('insurer_name, use_count');
    
    if (error || !data) {
      return { totalCached: 0, totalHits: 0, topInsurers: [] };
    }
    
    const totalCached = data.length;
    const totalHits = data.reduce((sum, item) => sum + (item.use_count || 0), 0);
    
    // Group by insurer
    const insurerCounts = data.reduce((acc, item) => {
      const insurer = item.insurer_name || 'Unknown';
      acc[insurer] = (acc[insurer] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
    
    const topInsurers = Object.entries(insurerCounts)
      .map(([insurer, count]) => ({ insurer, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);
    
    return { totalCached, totalHits, topInsurers };
  } catch (error) {
    console.error('Error getting cache stats:', error);
    return { totalCached: 0, totalHits: 0, topInsurers: [] };
  }
}
