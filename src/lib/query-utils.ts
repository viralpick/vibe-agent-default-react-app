/**
 * @fileoverview Utilities for GraphQL query manipulation
 * @module lib/query-utils
 */

/**
 * Convert a camelCase variable name to kebab-case query ID
 * Expands 'Agg' or 'agg' to 'aggregation'
 *
 * @example
 * toQueryId('orderStatusAggQuery') // returns 'order-status-aggregation-query'
 * toQueryId('someAggQuery') // returns 'some-aggregation-query'
 * toQueryId('userDataQuery') // returns 'user-data-query'
 *
 * @param varName - The camelCase variable name
 * @returns The kebab-case query ID
 */
export const toQueryId = (varName: string): string => {
  return varName
    .replace(/Agg/g, 'aggregation')
    .replace(/agg/g, 'aggregation')
    .replace(/([A-Z])/g, '-$1')
    .toLowerCase()
    .replace(/^-/, '');
};