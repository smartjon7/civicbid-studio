/**
 * Small validator for the JSON Schema subset in ./types.
 *
 * Supports type, enum, required, additionalProperties: false, minimum,
 * maximum, minLength, maxLength, pattern, minItems, maxItems, uniqueItems,
 * items, nested object properties, and defaults. It rejects non-object input,
 * unknown properties, and wrong types, and returns a plain message that names
 * the offending property.
 */
import type { JsonSchema } from './types';

export type ValidationResult =
  | { ok: true; value: Record<string, unknown> }
  | { ok: false; message: string };

type Check = { ok: true; value: unknown } | { ok: false; message: string };

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function describe(schema: JsonSchema): string {
  switch (schema.type) {
    case 'object':
      return 'an object';
    case 'array':
      return 'an array';
    case 'string':
      return 'a string';
    case 'integer':
      return 'an integer';
    case 'number':
      return 'a number';
    case 'boolean':
      return 'true or false';
    default:
      return 'a value';
  }
}

function formatEnum(values: Array<string | number | boolean>): string {
  return values.map((v) => (typeof v === 'string' ? v : String(v))).join(', ');
}

function cloneDefault(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(cloneDefault);
  if (isPlainObject(value)) {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value)) out[k] = cloneDefault(v);
    return out;
  }
  return value;
}

function check(schema: JsonSchema, value: unknown, path: string): Check {
  if (schema.enum && !schema.enum.some((allowed) => allowed === value)) {
    return { ok: false, message: `${path} must be one of: ${formatEnum(schema.enum)}.` };
  }

  switch (schema.type) {
    case 'object': {
      if (!isPlainObject(value)) return { ok: false, message: `${path} must be ${describe(schema)}.` };
      const properties = schema.properties ?? {};
      const out: Record<string, unknown> = {};
      for (const key of Object.keys(value)) {
        if (!(key in properties)) {
          if (schema.additionalProperties === false) {
            return { ok: false, message: `${path === 'input' ? '' : `${path}.`}${key} is not a recognised property. Allowed: ${Object.keys(properties).join(', ') || 'none'}.` };
          }
          out[key] = value[key];
        }
      }
      for (const key of schema.required ?? []) {
        if (value[key] === undefined) return { ok: false, message: `${path === 'input' ? '' : `${path}.`}${key} is required.` };
      }
      for (const [key, property] of Object.entries(properties)) {
        const childPath = path === 'input' ? key : `${path}.${key}`;
        const raw = value[key];
        if (raw === undefined) {
          if (property.default !== undefined) out[key] = cloneDefault(property.default);
          continue;
        }
        const result = check(property, raw, childPath);
        if (!result.ok) return result;
        out[key] = result.value;
      }
      return { ok: true, value: out };
    }

    case 'array': {
      if (!Array.isArray(value)) return { ok: false, message: `${path} must be ${describe(schema)}.` };
      if (schema.minItems !== undefined && value.length < schema.minItems) {
        return { ok: false, message: `${path} must contain at least ${schema.minItems} item${schema.minItems === 1 ? '' : 's'}.` };
      }
      if (schema.maxItems !== undefined && value.length > schema.maxItems) {
        return { ok: false, message: `${path} must contain at most ${schema.maxItems} item${schema.maxItems === 1 ? '' : 's'}.` };
      }
      const items: unknown[] = [];
      for (let index = 0; index < value.length; index += 1) {
        if (schema.items) {
          const result = check(schema.items, value[index], `${path}[${index}]`);
          if (!result.ok) return result;
          items.push(result.value);
        } else {
          items.push(value[index]);
        }
      }
      if (schema.uniqueItems) {
        const seen = new Set<string>();
        for (const item of items) {
          const key = JSON.stringify(item);
          if (seen.has(key)) return { ok: false, message: `${path} must not contain duplicates (${typeof item === 'string' ? item : key} appears more than once).` };
          seen.add(key);
        }
      }
      return { ok: true, value: items };
    }

    case 'string': {
      if (typeof value !== 'string') return { ok: false, message: `${path} must be ${describe(schema)}.` };
      if (schema.minLength !== undefined && value.length < schema.minLength) {
        return { ok: false, message: `${path} must be at least ${schema.minLength} character${schema.minLength === 1 ? '' : 's'} long.` };
      }
      if (schema.maxLength !== undefined && value.length > schema.maxLength) {
        return { ok: false, message: `${path} must be at most ${schema.maxLength} characters long.` };
      }
      if (schema.pattern !== undefined && !new RegExp(schema.pattern).test(value)) {
        return { ok: false, message: `${path} does not match the required pattern ${schema.pattern}.` };
      }
      return { ok: true, value };
    }

    case 'integer':
    case 'number': {
      if (typeof value !== 'number' || !Number.isFinite(value)) return { ok: false, message: `${path} must be ${describe(schema)}.` };
      if (schema.type === 'integer' && !Number.isInteger(value)) return { ok: false, message: `${path} must be a whole number.` };
      if (schema.minimum !== undefined && value < schema.minimum) return { ok: false, message: `${path} must be at least ${schema.minimum}.` };
      if (schema.maximum !== undefined && value > schema.maximum) return { ok: false, message: `${path} must be at most ${schema.maximum}.` };
      return { ok: true, value };
    }

    case 'boolean': {
      if (typeof value !== 'boolean') return { ok: false, message: `${path} must be ${describe(schema)}.` };
      return { ok: true, value };
    }

    default:
      return { ok: true, value };
  }
}

/** Validates a tool input against its schema. The top level must be an object. */
export function validateInput(schema: JsonSchema, input: unknown): ValidationResult {
  if (!isPlainObject(input)) {
    return { ok: false, message: 'Tool input must be a JSON object.' };
  }
  const result = check({ ...schema, type: 'object' }, input, 'input');
  if (!result.ok) return result;
  return { ok: true, value: result.value as Record<string, unknown> };
}
