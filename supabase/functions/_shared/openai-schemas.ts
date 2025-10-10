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
              required: ["base"],
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
            required: ["type"],
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

export async function callOpenAIResponses(apiKey: string, body: unknown) {
  const res = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  const txt = await res.text();
  if (!res.ok) {
    console.error(`OpenAI ${res.status}: ${txt.slice(0, 200)}`);
    throw new Error(`OpenAI ${res.status}: ${txt}`);
  }
  
  const json = JSON.parse(txt);

  // Responses API returns content blocks; normalize defensively
  const parsed =
    json?.output?.[0]?.content?.[0]?.text
    ?? json?.content?.[0]?.text
    ?? json?.output_text
    ?? json?.choices?.[0]?.message?.content;

  let result;
  try {
    result = typeof parsed === "string" ? JSON.parse(parsed) : parsed;
  } catch (parseError) {
    console.error("Failed to parse OpenAI response:", parseError);
    console.error("Raw response:", txt.slice(0, 500));
    throw new Error("Failed to parse AI response as JSON");
  }

  return { result, raw: json, usage: json.usage, model: json.model };
}
