import type { ApiErrorBody } from '../types/api';

/**
 * Parse a FastAPI error response into a flat {fieldName: message} map.
 *
 * FastAPI 422 errors look like:
 *   { detail: [{ loc: ["body", "food_name"], msg: "field required" }] }
 *
 * A plain string detail (401/403/404 etc.) is returned under the "_" key:
 *   { _: "Invalid email or password" }
 */
export function parseApiErrors(data: ApiErrorBody | null | undefined): Record<string, string> {
  if (!data) return {};

  if (Array.isArray(data.detail)) {
    const errs: Record<string, string> = {};
    for (const e of data.detail) {
      const field = Array.isArray(e.loc) ? e.loc[e.loc.length - 1] : '_';
      errs[String(field)] = e.msg || 'Invalid value';
    }
    return errs;
  }

  if (typeof data.detail === 'string') return { _: data.detail };
  if (typeof data.message === 'string') return { _: data.message };
  return {};
}

/** Return the first general (non-field) error string, or '' if none. */
export function generalError(fieldErrors: Record<string, string>): string {
  return fieldErrors._ || '';
}
