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
                base: { type: "number" },
                taxes_fees: { type: "number", default: 0 },
                total: { type: "number" }
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
  name: "policy_wording_analysis",
  schema: {
    $schema: "https://json-schema.org/draft/2020-12/schema",
    title: "PolicyWordingAnalysis",
    type: "object",
    additionalProperties: false,
    required: ["structure", "key_terms", "exclusions", "endorsements", "notable_issues", "citations"],
    properties: {
      structure: {
        type: "object",
        additionalProperties: false,
        required: ["insuring_clause", "definitions", "conditions", "warranties", "limits", "sublimits", "deductibles", "territory", "jurisdiction", "claims_basis"],
        properties: {
          insuring_clause: { type: "string" },
          definitions: {
            type: "array",
            items: {
              type: "object",
              additionalProperties: false,
              required: ["term", "definition"],
              properties: {
                term: { type: "string" },
                definition: { type: "string" }
              }
            }
          },
          conditions: { type: "array", items: { type: "string" } },
          warranties: { type: "array", items: { type: "string" } },
          limits: { type: "array", items: { type: "string" } },
          sublimits: { type: "array", items: { type: "string" } },
          deductibles: { type: "array", items: { type: "string" } },
          territory: { type: "string" },
          jurisdiction: { type: "string" },
          claims_basis: {
            type: "object",
            additionalProperties: false,
            required: ["type", "retro_date", "notice_requirements"],
            properties: {
              type: { type: "string", enum: ["claims-made", "occurrence", "unknown"] },
              retro_date: { type: "string" },
              notice_requirements: { type: "string" }
            }
          }
        }
      },
      key_terms: { type: "array", items: { type: "string" } },
      exclusions: { type: "array", items: { type: "string" } },
      endorsements: { type: "array", items: { type: "string" } },
      notable_issues: {
        type: "object",
        additionalProperties: false,
        required: ["ambiguous_language", "coverage_gaps", "broker_actions"],
        properties: {
          ambiguous_language: { type: "array", items: { type: "string" } },
          coverage_gaps: { type: "array", items: { type: "string" } },
          broker_actions: { type: "array", items: { type: "string" } }
        }
      },
      citations: {
        type: "array",
        items: {
          type: "object",
          additionalProperties: false,
          required: ["section", "page", "snippet"],
          properties: {
            section: { type: "string" },
            page: { type: "integer", minimum: 1 },
            snippet: { type: "string" }
          }
        }
      }
    }
  },
  strict: true
} as const;

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
