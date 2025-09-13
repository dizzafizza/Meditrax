/**
 * React Key Helper - Utilities for generating unique React keys
 */

import { generateId } from './helpers';

// Track used keys to prevent duplicates in the same render cycle
const usedKeys = new Set<string>();

/**
 * Generate a guaranteed unique React key
 */
export function generateUniqueKey(prefix: string = 'item', context?: string | number): string {
  let attempts = 0;
  let key: string;
  
  do {
    const id = generateId();
    const contextSuffix = context !== undefined ? `-${context}` : '';
    const attemptSuffix = attempts > 0 ? `-retry${attempts}` : '';
    key = `${prefix}-${id}${contextSuffix}${attemptSuffix}`;
    attempts++;
  } while (usedKeys.has(key) && attempts < 10);
  
  usedKeys.add(key);
  
  // Clear old keys periodically to prevent memory leaks
  if (usedKeys.size > 1000) {
    usedKeys.clear();
  }
  
  return key;
}

/**
 * Generate a key for list items based on stable properties
 */
export function generateListItemKey(item: { id?: string; [key: string]: any }, index: number, prefix: string = 'item'): string {
  // Prefer stable ID if available
  if (item.id) {
    return `${prefix}-${item.id}-${index}`;
  }
  
  // Fallback to generating a unique key
  return generateUniqueKey(prefix, index);
}

/**
 * Clear all tracked keys (useful for testing or memory management)
 */
export function clearKeyCache(): void {
  usedKeys.clear();
}
