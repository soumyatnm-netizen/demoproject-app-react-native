export const QUOTE_COMPARISON_SCHEMA = {
  name: "quote_comparison",
  schema: {
    $schema: "https://json-schema.org/draft/2020-12/schema",
    title: "QuoteComparison",
    type: "object",
    additionalProperties: false,
    required: ["summary", "quotes", "differences", "red_flags"],
    properties: {
      summary: {
        type: "object",
        additionalProperties: false,
        required: ["highlights", "open_questions"],
        properties: {
          highlights: { type: "array", items: { type: "string" } },
          open_questions: { type: "array", items: { type: "string" } }
        }
      },
      quotes: {
        type: "array",
        minItems: 1,
        items: {
          type: "object",
          additionalProperties: false,
          required: ["carrier", "product", "limits", "deductibles", "exclusions", "endorsements", "premium"],
          properties: {
            carrier: { type: "string" },
            product: { type: "string" },
            effective_date: { type: "string" },
            expiry_date: { type: "string" },
            jurisdiction: { type: "string" },
            territory: { type: "string" },
            retro_date: { type: "string" },
            premium: {
              type: "object",
              additionalProperties: false,
              required: ["base", "taxes_fees", "total"],
              properties: {
                base: { type: ["number", "null"] },
                taxes_fees: { type: ["number", "null"] },
                total: { type: ["number", "null"] }
              }
            },
            limits: {
              type: "array",
              items: {
                type: "object",
                additionalProperties: false,
                required: ["name", "amount"],
                properties: {
                  name: { type: "string" },
                  amount: { type: "string" },
                  aggregate: { type: "string" }
                }
              }
            },
            sublimits: {
              type: "array",
              items: {
                type: "object",
                additionalProperties: false,
                required: ["name", "amount"],
                properties: {
                  name: { type: "string" },
                  amount: { type: "string" }
                }
              }
            },
            deductibles: {
              type: "array",
              items: {
                type: "object",
                additionalProperties: false,
                required: ["name", "amount"],
                properties: {
                  name: { type: "string" },
                  amount: { type: "string" }
                }
              }
            },
            warranties: { type: "array", items: { type: "string" } },
            conditions: { type: "array", items: { type: "string" } },
            exclusions: { type: "array", items: { type: "string" } },
            endorsements: { type: "array", items: { type: "string" } },
            notable_terms: { type: "array", items: { type: "string" } },
            missing_data: { type: "array", items: { type: "string" } },
            citations: {
              type: "array",
              items: {
                type: "object",
                additionalProperties: false,
                required: ["page", "snippet"],
                properties: {
                  page: { type: "integer", minimum: 1 },
                  snippet: { type: "string" }
                }
              }
            }
          }
        }
      },
      differences: {
        type: "object",
        additionalProperties: false,
        required: ["material_differences", "best_overall_for"],
        properties: {
          material_differences: { type: "array", items: { type: "string" } },
          best_overall_for: {
            type: "array",
            items: {
              type: "object",
              additionalProperties: false,
              required: ["use_case", "carrier"],
              properties: {
                use_case: { type: "string" },
                carrier: { type: "string" }
              }
            }
          }
        }
      },
      red_flags: { type: "array", items: { type: "string" } }
    }
  },
  strict: true
} as const;

export const POLICY_WORDING_SCHEMA = {
  $schema: "http://json-schema.org/draft-07/schema#",
  title: "PolicyWording",
  type: "object",
  additionalProperties: false,
  properties: {
    policy: {
      type: "object",
      additionalProperties: false,
      properties: {
        carrier:       { type: ["string","null"] },
        product:       { type: ["string","null"] },
        form_number:   { type: ["string","null"] },
        version:       { type: ["string","null"] },
        edition_date:  { type: ["string","null"] },
        effective_date:{ type: ["string","null"] },
        expiry_date:   { type: ["string","null"] },
        territory:     { type: ["string","null"] },
        jurisdiction:  { type: ["string","null"] }
      }
    },

    structure: {
      type: "object",
      additionalProperties: false,
      properties: {
        claims_basis: {
          type: "object",
          additionalProperties: false,
          properties: {
            occurrence:  { type: ["boolean","null"] },
            claims_made: { type: ["boolean","null"] },
            retro_date:  { type: ["string","null"] }
          }
        },
        limits: {
          type: "array",
          items: {
            type: "object",
            additionalProperties: false,
            properties: {
              name:     { type: ["string","null"] },
              amount:   { type: ["string","number","null"] },
              per:      { type: ["string","null"] },
              aggregate:{ type: ["string","null"] }
            }
          }
        },
        sublimits: {
          type: "array",
          items: {
            type: "object",
            additionalProperties: false,
            properties: {
              name:   { type: ["string","null"] },
              amount: { type: ["string","number","null"] }
            }
          }
        },
        deductibles: {
          type: "array",
          items: {
            type: "object",
            additionalProperties: false,
            properties: {
              name:   { type: ["string","null"] },
              amount: { type: ["string","number","null"] }
            }
          }
        },
        coverage_triggers: { type: "array", items: { type: "string" } }
      }
    },

    terms: {
      type: "object",
      additionalProperties: false,
      properties: {
        exclusions:     { type: "array", items: { type: "string" } },
        endorsements:   { type: "array", items: { type: "string" } },
        conditions:     { type: "array", items: { type: "string" } },
        warranties:     { type: "array", items: { type: "string" } },
        notable_terms:  { type: "array", items: { type: "string" } }
      }
    },

    definitions: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          term:       { type: ["string","null"] },
          definition: { type: ["string","null"] }
        }
      }
    },

    citations: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          section: { type: ["string","null"] },
          page:    { type: ["integer","string","null"] },
          quote:   { type: ["string","null"] }
        }
      }
    },

    coverage_features: {
      type: "object",
      additionalProperties: false,
      properties: {
        feature_ai_affirmative_covered: { 
          type: ["boolean","null"],
          description: "AI/ML liability coverage (affirmative artificial intelligence, machine learning, algorithm, decision engine liability)"
        },
        feature_contractual_liability: { 
          type: ["boolean","null"],
          description: "Full contractual breach coverage (beyond professional negligence)"
        },
        feature_inefficacy_covered: { 
          type: ["boolean","null"],
          description: "Inefficacy coverage (inability to perform, failure of product)"
        },
        feature_separate_indemnity_towers: { 
          type: ["boolean","null"],
          description: "Separate limit towers / non-eroding limits / dedicated sub-limits"
        },
        feature_proactive_services: { 
          type: ["boolean","null"],
          description: "Proactive services included (risk management, cyber-attack prevention, risk platform)"
        },
        scope_geographic_coverage: { 
          type: ["string","null"],
          description: "Geographic scope (e.g., 'Worldwide excluding US/CA', 'EU only', 'Worldwide')"
        },
        deductible_data_special: { 
          type: ["string","null"],
          description: "Special excess for personal data claims/regulatory investigations (Currency or 'N/A')"
        },
        limit_crisis_response: { 
          type: ["string","null"],
          description: "Crisis response limit (crisis containment, PR costs) - separate sub-limit (Currency or 'N/A')"
        },
        feature_reasoning: {
          type: "object",
          additionalProperties: false,
          properties: {
            ai_affirmative_reasoning: { type: ["string","null"] },
            contractual_liability_reasoning: { type: ["string","null"] },
            inefficacy_reasoning: { type: ["string","null"] },
            separate_towers_reasoning: { type: ["string","null"] },
            proactive_services_reasoning: { type: ["string","null"] },
            geographic_scope_reasoning: { type: ["string","null"] },
            data_special_reasoning: { type: ["string","null"] },
            crisis_response_reasoning: { type: ["string","null"] }
          }
        }
      }
    }
  }
};

export async function callOpenAIResponses(key: string, body: unknown): Promise<{ result: any; raw: any; usage?: any }> {
  const r = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: { 
      Authorization: `Bearer ${key}`, 
      "Content-Type": "application/json" 
    },
    body: JSON.stringify(body),
  });
  
  const txt = await r.text();
  if (!r.ok) {
    console.error('[OpenAI] Error response:', txt.slice(0, 400));
    throw new Error(`OpenAI ${r.status}: ${txt.slice(0, 400)}`);
  }
  
  // Parse Chat Completions API response
  const j = JSON.parse(txt);
  const jsonText = j?.choices?.[0]?.message?.content;
  
  const result = typeof jsonText === "string" ? JSON.parse(jsonText) : jsonText;
  return { result, raw: j, usage: j?.usage };
}
