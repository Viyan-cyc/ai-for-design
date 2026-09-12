/**
 * Validate the dependency-free JSON Schema subset used by governed asset libraries.
 * 移植自 scripts/schema_tools.py（W3/D18），行为逐条对齐（含类型不符即短路返回）。
 */
export function schemaErrors(value, schema, path = 'config') {
  const errors = [];
  if ('anyOf' in schema && !schema.anyOf.some((candidate) => schemaErrors(value, candidate, path).length === 0)) {
    errors.push(`${path} does not match any permitted value type`);
  }
  if ('const' in schema && !deepEqual(value, schema.const)) {
    errors.push(`${path} must equal ${JSON.stringify(schema.const)}`);
  }
  if ('enum' in schema && !schema.enum.some((item) => deepEqual(value, item))) {
    errors.push(`${path} is not one of the allowed values`);
  }
  const expected = schema.type;
  const isBool = typeof value === 'boolean';
  const typeOk = {
    object: value !== null && typeof value === 'object' && !Array.isArray(value),
    array: Array.isArray(value),
    string: typeof value === 'string',
    // Python: isinstance(int) 且非 bool——JS number 需排除布尔且要求整数
    integer: typeof value === 'number' && !isBool && Number.isInteger(value),
    number: typeof value === 'number' && !isBool,
    boolean: isBool,
    null: value === null,
  }[expected] ?? true;
  if (expected && !typeOk) return [`${path} must be ${expected}`];
  if (value !== null && typeof value === 'object' && !Array.isArray(value)) {
    const required = schema.required ?? [];
    for (const key of required) {
      if (!(key in value)) errors.push(`${path}.${key} is required`);
    }
    const properties = schema.properties ?? {};
    for (const [key, item] of Object.entries(value)) {
      if (key in properties) {
        errors.push(...schemaErrors(item, properties[key], `${path}.${key}`));
      } else if (schema.additionalProperties === false) {
        errors.push(`${path}.${key} is not allowed`);
      }
    }
  }
  if (Array.isArray(value)) {
    if (value.length < (schema.minItems ?? 0)) errors.push(`${path} requires at least ${schema.minItems} items`);
    if ('maxItems' in schema && value.length > schema.maxItems) {
      errors.push(`${path} allows at most ${schema.maxItems} items`);
    }
    if (schema.uniqueItems) {
      const seen = new Set(value.map((item) => JSON.stringify(item)));
      if (seen.size !== value.length) errors.push(`${path} must contain unique items`);
    }
    const itemSchema = schema.items;
    if (itemSchema && typeof itemSchema === 'object') {
      value.forEach((item, index) => {
        errors.push(...schemaErrors(item, itemSchema, `${path}[${index}]`));
      });
    }
  }
  if (typeof value === 'string') {
    if (value.length < (schema.minLength ?? 0)) errors.push(`${path} is shorter than ${schema.minLength}`);
    const pattern = schema.pattern;
    if (pattern && !new RegExp(pattern).test(value)) {
      errors.push(`${path} does not match its required pattern`);
    }
  }
  if (typeof value === 'number' && !isBool) {
    if ('minimum' in schema && value < schema.minimum) errors.push(`${path} must be at least ${schema.minimum}`);
    if ('maximum' in schema && value > schema.maximum) errors.push(`${path} must be at most ${schema.maximum}`);
  }
  return errors;
}

/** Python == 的深相等（dict/list 递归；1 == 1.0 在 JS 与 Python 中同为真）。 */
function deepEqual(a, b) {
  if (a === b) return true;
  if (a === null || b === null || typeof a !== 'object' || typeof b !== 'object') {
    // Python 中 True == 1 为真；JSON 数据里不会出现布尔与数字混比，保持严格即可
    return false;
  }
  if (Array.isArray(a) !== Array.isArray(b)) return false;
  if (Array.isArray(a)) {
    return a.length === b.length && a.every((item, i) => deepEqual(item, b[i]));
  }
  const ka = Object.keys(a);
  const kb = Object.keys(b);
  return ka.length === kb.length && ka.every((k) => k in b && deepEqual(a[k], b[k]));
}
