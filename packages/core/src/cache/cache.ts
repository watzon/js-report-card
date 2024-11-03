import { BaseProjectSource, ProjectSourceType } from "../types";

import { AnalyzerResult } from "../types";

/**
 * Interface for cache implementations
 * 
 * Provides a storage-agnostic way to cache analysis results.
 * Implementations can use any storage backend (Redis, SQLite, files, etc.)
 * 
 * @example
 * ```typescript
 * class RedisCache implements ICache {
 *   constructor(private redis: Redis) {}
 *   
 *   async get(key: string): Promise<CacheEntry | null> {
 *     const data = await this.redis.get(key);
 *     return data ? JSON.parse(data) : null;
 *   }
 *   
 *   async set(key: string, value: CacheEntry): Promise<void> {
 *     await this.redis.set(key, JSON.stringify(value));
 *   }
 * }
 * ```
 */
export interface ICache {
  get(key: string): Promise<CacheEntry | null>;
  set(key: string, value: CacheEntry): Promise<void>;
  invalidate?(key: string): Promise<void>;
  clear?(): Promise<void>;
}

/**
 * Cache entry containing analysis results and metadata
 */
export interface CacheEntry {
  /** Timestamp when the entry was created */
  timestamp: number;
  /** Source information used for cache invalidation */
  source: {
    type: string;
    /** Git commit hash, npm version, etc. */
    version: string;
    /** Additional source-specific metadata */
    metadata?: Record<string, unknown>;
  };
  /** The cached analysis results */
  results: AnalyzerResult[];
}

/**
 * Memory-based cache implementation for testing/development
 */
export class MemoryCache implements ICache {
  private cache: Map<string, CacheEntry> = new Map();

  async get(key: string): Promise<CacheEntry | null> {
    return this.cache.get(key) || null;
  }

  async set(key: string, value: CacheEntry): Promise<void> {
    this.cache.set(key, value);
  }

  async invalidate(key: string): Promise<void> {
    this.cache.delete(key);
  }

  async clear(): Promise<void> {
    this.cache.clear();
  }
} 