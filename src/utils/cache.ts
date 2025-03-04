/**
 * Simple in-memory cache implementation
 * Used to reduce database calls for frequently accessed data
 */

type CacheItem<T> = {
  value: T;
  expiry: number; // Timestamp when this cache item expires
};

/**
 * Cache class with support for TTL (Time To Live)
 */
class Cache {
  private cache: Map<string, CacheItem<unknown>>;
  private defaultTTL: number;

  constructor(defaultTTLSeconds = 300) { // Default 5 minutes TTL
    this.cache = new Map();
    this.defaultTTL = defaultTTLSeconds;
  }

  /**
   * Set a value in the cache with optional expiry
   * 
   * @param key - The cache key
   * @param value - The value to store
   * @param ttlSeconds - Optional TTL in seconds
   */
  set(key: string, value: unknown, ttlSeconds = this.defaultTTL): void {
    const expiry = Date.now() + (ttlSeconds * 1000);
    this.cache.set(key, { value, expiry });
  }

  /**
   * Get a value from the cache
   * 
   * @param key - The cache key
   * @returns The cached value or undefined if not found or expired
   */
  get<T>(key: string): T | undefined {
    const item = this.cache.get(key);
    
    // If item doesn't exist or has expired
    if (!item || item.expiry < Date.now()) {
      if (item) this.delete(key); // Clean up expired item
      return undefined;
    }
    
    return item.value as T;
  }

  /**
   * Delete a value from the cache
   * 
   * @param key - The cache key
   */
  delete(key: string): void {
    this.cache.delete(key);
  }

  /**
   * Clear all items from the cache
   */
  clear(): void {
    this.cache.clear();
  }

  /**
   * Get the number of items in the cache
   */
  get size(): number {
    return this.cache.size;
  }

  /**
   * Clean up expired items
   * Could be called periodically to free up memory
   */
  cleanExpired(): void {
    const now = Date.now();
    
    for (const [key, item] of this.cache.entries()) {
      if (item.expiry < now) {
        this.cache.delete(key);
      }
    }
  }
}

// Create instance for query results
export const queryCache = new Cache();

// Create instance for other generic caching needs
export const appCache = new Cache(60); // 60 second TTL for app cache

// Start periodic cleanup every 5 minutes
if (typeof window !== 'undefined') {
  setInterval(() => {
    queryCache.cleanExpired();
    appCache.cleanExpired();
  }, 5 * 60 * 1000);
} 