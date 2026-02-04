/**
 * @fileoverview Data transformation utilities for GraphQL response handling
 * These utilities help normalize GraphQL aggregation responses.
 *
 * @module patterns/data-utils
 */

/**
 * Extracts count value from GraphQL aggregation response item.
 * 
 * GraphQL responses return `countOfColumnUnique` as an object like:
 * ```json
 * { "countOfColumnUnique": { "review_id": 4 } }
 * ```
 * 
 * This function safely extracts the numeric value from such objects.
 * 
 * @param item - The aggregation item from GraphQL response
 * @returns The extracted count as a number, or 0 if not found
 * 
 * @example
 * ```tsx
 * // Inside transformation logic:
 * const chartData = aggData.map(item => ({
 *   name: String(item.groupBy?.category || "Unknown"),
 *   value: extractCount(item)
 * }));
 * 
 * // For reduce operations:
 * const total = aggData.reduce((sum, item) => sum + extractCount(item), 0);
 * ```
 */
export const extractCount = (item: Record<string, unknown> | null | undefined): number => {
  if (!item) return 0;
  
  const unique = item.countOfColumnUnique;
  
  // Handle object form: { "review_id": 4 } -> 4
  if (typeof unique === 'object' && unique !== null) {
    const values = Object.values(unique as Record<string, unknown>);
    if (values.length > 0) {
      const firstValue = values[0];
      return typeof firstValue === 'number' ? firstValue : Number(firstValue) || 0;
    }
  }
  
  // Handle direct number form or fallback to count
  if (typeof unique === 'number') return unique;
  if (typeof item.count === 'number') return item.count;
  
  return 0;
};

/**
 * Normalizes a value that might be an object with a single numeric value.
 * Useful for handling GraphQL aggregation fields that return objects.
 * 
 * @param value - The value to normalize (object, number, or unknown)
 * @returns The extracted number, or 0 if not extractable
 * 
 * @example
 * ```tsx
 * // Handles both forms:
 * normalizeNumericValue({ "field_name": 42 }) // -> 42
 * normalizeNumericValue(42) // -> 42
 * normalizeNumericValue(undefined) // -> 0
 * ```
 */
export const normalizeNumericValue = (value: unknown): number => {
  if (value === null || value === undefined) return 0;
  if (typeof value === 'number') return value;
  
  if (typeof value === 'object') {
    const values = Object.values(value as Record<string, unknown>);
    if (values.length > 0) {
      const firstValue = values[0];
      return typeof firstValue === 'number' ? firstValue : Number(firstValue) || 0;
    }
  }
  
  return Number(value) || 0;
};
