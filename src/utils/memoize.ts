/* eslint-disable @typescript-eslint/no-explicit-any */

/**
 * Utilities for function memoization to improve performance
 * Useful for expensive calculations or operations
 */

/**
 * Creates a memoized version of a function
 * Results are cached based on the arguments provided
 * 
 * @param fn - The function to memoize
 * @param keyFn - Optional function to generate a custom cache key
 * @returns A memoized version of the function
 */

export function memoize<T extends (...args: any[]) => any>(
  fn: T,
  keyFn?: (...args: Parameters<T>) => string
): T {
  const cache = new Map<string, ReturnType<T>>();
  
  const memoized = ((...args: Parameters<T>): ReturnType<T> => {
    // Generate cache key
    const key = keyFn 
      ? keyFn(...args) 
      : JSON.stringify(args);
    
    // Check if we have a cached result
    if (cache.has(key)) {
      return cache.get(key) as ReturnType<T>;
    }
    
    // Calculate the result and cache it
    const result = fn(...args);
    cache.set(key, result);
    return result;
  }) as T;
  
  // Attach a method to clear the cache
  (memoized as any).clearCache = () => {
    cache.clear();
  };
  
  return memoized;
}

/**
 * Creates a memoized version of an async function
 * Results are cached based on the arguments provided
 * 
 * @param fn - The async function to memoize
 * @param keyFn - Optional function to generate a custom cache key
 * @returns A memoized version of the async function
 */
export function memoizeAsync<T extends (...args: any[]) => Promise<any>>(
  fn: T,
  keyFn?: (...args: Parameters<T>) => string
): T {
  const cache = new Map<string, Promise<Awaited<ReturnType<T>>>>();
  
  const memoized = (async (...args: Parameters<T>): Promise<Awaited<ReturnType<T>>> => {
    // Generate cache key
    const key = keyFn 
      ? keyFn(...args) 
      : JSON.stringify(args);
    
    // Check if we have a cached result
    if (cache.has(key)) {
      return cache.get(key) as Promise<Awaited<ReturnType<T>>>;
    }
    
    // Calculate the result and cache it
    const resultPromise = fn(...args);
    cache.set(key, resultPromise);
    
    try {
      return await resultPromise;
    } catch (error) {
      // Remove failed promises from cache
      cache.delete(key);
      throw error;
    }
  }) as T;
  
  // Attach a method to clear the cache
  (memoized as any).clearCache = () => {
    cache.clear();
  };
  
  return memoized;
} 