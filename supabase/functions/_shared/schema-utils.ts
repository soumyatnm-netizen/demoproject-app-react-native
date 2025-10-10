export function normalizeStrictJsonSchema<T extends any>(schema: T): T {
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

export function assertObjectSchema(name: string, s: any) {
  if (!s || typeof s !== "object" || s.type !== "object") {
    throw new Error(`${name} must be a JSON Schema with type: "object"`);
  }
}
