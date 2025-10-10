export function normalizeStrictJsonSchema<T>(schema: T): T {
  function walk(node: any) {
    if (!node || typeof node !== "object") return;

    // For objects: required must list ALL property keys
    if (node.type === "object" && node.properties && typeof node.properties === "object") {
      const keys = Object.keys(node.properties);
      node.required = keys;
      if (node.additionalProperties === undefined) {
        node.additionalProperties = false;
      }
      for (const k of keys) walk(node.properties[k]);
    }

    // For arrays: normalize the item schema
    if (node.type === "array" && node.items) {
      walk(node.items);
    }

    // Handle composed schemas
    for (const key of ["anyOf", "oneOf", "allOf"]) {
      if (Array.isArray(node[key])) node[key].forEach(walk);
    }

    // Definitions / $defs
    if (node.definitions && typeof node.definitions === "object") {
      for (const k of Object.keys(node.definitions)) walk(node.definitions[k]);
    }
    if (node.$defs && typeof node.$defs === "object") {
      for (const k of Object.keys(node.$defs)) walk(node.$defs[k]);
    }
  }

  walk(schema);
  return schema;
}

/** Returns first path where required !== property keys (or null if good). */
export function findFirstRequiredMismatch(schema: any): string | null {
  function walk(node: any, path: string): string | null {
    if (!node || typeof node !== "object") return null;

    if (node.type === "object" && node.properties && typeof node.properties === "object") {
      const keys = Object.keys(node.properties);
      const required = Array.isArray(node.required) ? node.required : [];
      const missing = keys.filter(k => !required.includes(k));
      const extra   = required.filter((k: string) => !keys.includes(k));
      if (missing.length || extra.length) {
        return `${path} — missing in required: [${missing.join(", ")}]  extra in required: [${extra.join(", ")}]`;
      }
      for (const k of keys) {
        const res = walk(node.properties[k], `${path}.properties.${k}`);
        if (res) return res;
      }
    }

    if (node.type === "array" && node.items) {
      const res = walk(node.items, `${path}.items`);
      if (res) return res;
    }

    for (const k of ["anyOf", "oneOf", "allOf"]) {
      if (Array.isArray(node[k])) {
        for (let i = 0; i < node[k].length; i++) {
          const res = walk(node[k][i], `${path}.${k}[${i}]`);
          if (res) return res;
        }
      }
    }

    for (const d of ["definitions","$defs"]) {
      if (node[d] && typeof node[d] === "object") {
        for (const [name, def] of Object.entries(node[d])) {
          const res = walk(def, `${path}.${d}.${name}`);
          if (res) return res;
        }
      }
    }
    return null;
  }
  return walk(schema, "$");
}

export function assertObjectSchema(name: string, s: any) {
  if (!s || typeof s !== "object" || s.type !== "object") {
    throw new Error(`${name} must be a JSON Schema with type: "object"`);
  }
}
