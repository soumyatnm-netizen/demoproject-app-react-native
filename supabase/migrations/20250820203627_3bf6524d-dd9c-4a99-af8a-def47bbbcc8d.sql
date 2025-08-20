-- Create enhanced quote analysis function to support detailed comparison
CREATE OR REPLACE FUNCTION public.analyze_quote_coverage(
  p_quote_id uuid,
  p_analysis_criteria jsonb DEFAULT '{}'::jsonb
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  v_quote_data record;
  v_analysis_result jsonb;
  v_coverage_score integer;
  v_quality_score integer;
  v_competitiveness_score integer;
BEGIN
  -- Get quote data
  SELECT * INTO v_quote_data
  FROM structured_quotes
  WHERE id = p_quote_id;
  
  IF NOT FOUND THEN
    RETURN '{"error": "Quote not found"}'::jsonb;
  END IF;
  
  -- Calculate coverage score (0-100)
  v_coverage_score := CASE
    WHEN v_quote_data.coverage_limits IS NOT NULL THEN 85
    ELSE 60
  END;
  
  -- Calculate quality score based on inclusions/exclusions
  v_quality_score := CASE
    WHEN array_length(v_quote_data.inclusions, 1) > 5 THEN 90
    WHEN array_length(v_quote_data.inclusions, 1) > 3 THEN 75
    ELSE 60
  END;
  
  -- Calculate competitiveness score based on premium
  v_competitiveness_score := CASE
    WHEN v_quote_data.premium_amount < 5000 THEN 95
    WHEN v_quote_data.premium_amount < 10000 THEN 80
    WHEN v_quote_data.premium_amount < 20000 THEN 65
    ELSE 50
  END;
  
  -- Build comprehensive analysis result
  v_analysis_result := jsonb_build_object(
    'quote_id', p_quote_id,
    'insurer_name', v_quote_data.insurer_name,
    'analysis_timestamp', now(),
    'scores', jsonb_build_object(
      'coverage_score', v_coverage_score,
      'quality_score', v_quality_score,
      'competitiveness_score', v_competitiveness_score,
      'overall_score', round((v_coverage_score + v_quality_score + v_competitiveness_score) / 3)
    ),
    'detailed_analysis', jsonb_build_object(
      'premium_analysis', jsonb_build_object(
        'amount', v_quote_data.premium_amount,
        'currency', v_quote_data.premium_currency,
        'competitiveness', CASE
          WHEN v_quote_data.premium_amount < 5000 THEN 'Highly Competitive'
          WHEN v_quote_data.premium_amount < 10000 THEN 'Competitive'
          WHEN v_quote_data.premium_amount < 20000 THEN 'Market Rate'
          ELSE 'Premium Pricing'
        END
      ),
      'coverage_analysis', jsonb_build_object(
        'limits', COALESCE(v_quote_data.coverage_limits, '{}'::jsonb),
        'inner_limits', COALESCE(v_quote_data.inner_limits, '{}'::jsonb),
        'deductible', v_quote_data.deductible_amount,
        'coverage_breadth', CASE
          WHEN array_length(v_quote_data.inclusions, 1) > 5 THEN 'Comprehensive'
          WHEN array_length(v_quote_data.inclusions, 1) > 3 THEN 'Standard'
          ELSE 'Basic'
        END
      ),
      'policy_features', jsonb_build_object(
        'inclusions', COALESCE(v_quote_data.inclusions, ARRAY[]::text[]),
        'exclusions', COALESCE(v_quote_data.exclusions, ARRAY[]::text[]),
        'policy_terms', COALESCE(v_quote_data.policy_terms, '{}'::jsonb)
      ),
      'risk_assessment', jsonb_build_object(
        'product_type', v_quote_data.product_type,
        'industry_fit', v_quote_data.industry,
        'revenue_alignment', v_quote_data.revenue_band
      )
    ),
    'recommendations', jsonb_build_array(
      CASE
        WHEN v_competitiveness_score > 85 THEN 'Excellent value for money - strongly recommended'
        WHEN v_competitiveness_score > 70 THEN 'Good competitive position'
        ELSE 'Consider negotiating terms or exploring alternatives'
      END,
      CASE
        WHEN v_coverage_score > 80 THEN 'Comprehensive coverage package'
        ELSE 'Review coverage gaps and consider enhancements'
      END
    ),
    'risk_highlights', jsonb_build_array(
      CASE
        WHEN array_length(v_quote_data.exclusions, 1) > 3 THEN 'Multiple exclusions - review carefully'
        ELSE 'Standard exclusions apply'
      END,
      CASE
        WHEN v_quote_data.deductible_amount > 10000 THEN 'High deductible - assess client risk tolerance'
        ELSE 'Reasonable deductible level'
      END
    )
  );
  
  RETURN v_analysis_result;
END;
$$;

-- Create intelligent quote ranking function
CREATE OR REPLACE FUNCTION public.rank_quotes_for_client(
  p_client_id uuid,
  p_quote_ids uuid[] DEFAULT NULL
) RETURNS TABLE(
  quote_id uuid,
  insurer_name text,
  rank_position integer,
  overall_score integer,
  premium_amount numeric,
  coverage_score integer,
  quality_score integer,
  competitiveness_score integer,
  recommendation_category text,
  key_strengths text[],
  areas_of_concern text[]
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  v_quote_analysis jsonb;
  v_quote record;
  v_rank_counter integer := 1;
BEGIN
  -- Get quotes to analyze (either specified ones or all for client)
  FOR v_quote IN 
    SELECT sq.*
    FROM structured_quotes sq
    WHERE sq.user_id = auth.uid()
    AND (p_quote_ids IS NULL OR sq.id = ANY(p_quote_ids))
    ORDER BY sq.created_at DESC
  LOOP
    -- Analyze each quote
    SELECT public.analyze_quote_coverage(v_quote.id) INTO v_quote_analysis;
    
    -- Return ranked results
    quote_id := v_quote.id;
    insurer_name := v_quote.insurer_name;
    rank_position := v_rank_counter;
    overall_score := (v_quote_analysis->'scores'->>'overall_score')::integer;
    premium_amount := v_quote.premium_amount;
    coverage_score := (v_quote_analysis->'scores'->>'coverage_score')::integer;
    quality_score := (v_quote_analysis->'scores'->>'quality_score')::integer;
    competitiveness_score := (v_quote_analysis->'scores'->>'competitiveness_score')::integer;
    
    recommendation_category := CASE
      WHEN overall_score >= 85 THEN 'Highly Recommended'
      WHEN overall_score >= 70 THEN 'Recommended'
      WHEN overall_score >= 55 THEN 'Consider with Caution'
      ELSE 'Not Recommended'
    END;
    
    key_strengths := ARRAY[
      CASE WHEN competitiveness_score > 80 THEN 'Competitive Pricing' ELSE NULL END,
      CASE WHEN coverage_score > 80 THEN 'Comprehensive Coverage' ELSE NULL END,
      CASE WHEN quality_score > 80 THEN 'Quality Policy Terms' ELSE NULL END
    ];
    key_strengths := array_remove(key_strengths, NULL);
    
    areas_of_concern := ARRAY[
      CASE WHEN competitiveness_score < 60 THEN 'High Premium' ELSE NULL END,
      CASE WHEN coverage_score < 60 THEN 'Limited Coverage' ELSE NULL END,
      CASE WHEN quality_score < 60 THEN 'Basic Policy Terms' ELSE NULL END
    ];
    areas_of_concern := array_remove(areas_of_concern, NULL);
    
    v_rank_counter := v_rank_counter + 1;
    
    RETURN NEXT;
  END LOOP;
END;
$$;