import { MemoryCache, CacheEntry } from '../../cache/cache';
import { IssueSeverity, ProjectSourceType } from '../../types';

describe('MemoryCache', () => {
  let cache: MemoryCache;

  beforeEach(() => {
    cache = new MemoryCache();
  });

  const mockCacheEntry: CacheEntry = {
    timestamp: Date.now(),
    source: {
      type: ProjectSourceType.GIT,
      version: 'test-hash',
      metadata: {
        branch: 'main'
      }
    },
    results: [{
      analyzerId: 'test-analyzer',
      score: 100,
      issues: []
    }]
  };

  describe('set', () => {
    it('should store a cache entry', async () => {
      await cache.set('test-key', mockCacheEntry);
      const result = await cache.get('test-key');
      expect(result).toEqual(mockCacheEntry);
    });

    it('should overwrite existing entries', async () => {
      await cache.set('test-key', mockCacheEntry);
      
      const newEntry = {
        ...mockCacheEntry,
        timestamp: Date.now() + 1000
      };
      
      await cache.set('test-key', newEntry);
      const result = await cache.get('test-key');
      expect(result).toEqual(newEntry);
    });
  });

  describe('get', () => {
    it('should return null for non-existent keys', async () => {
      const result = await cache.get('non-existent');
      expect(result).toBeNull();
    });

    it('should return the exact stored entry', async () => {
      await cache.set('test-key', mockCacheEntry);
      const result = await cache.get('test-key');
      expect(result).toEqual(mockCacheEntry);
    });
  });

  describe('invalidate', () => {
    it('should remove a specific cache entry', async () => {
      await cache.set('key1', mockCacheEntry);
      await cache.set('key2', mockCacheEntry);

      await cache.invalidate('key1');

      expect(await cache.get('key1')).toBeNull();
      expect(await cache.get('key2')).toEqual(mockCacheEntry);
    });

    it('should not throw when invalidating non-existent key', async () => {
      await expect(cache.invalidate('non-existent'))
        .resolves
        .not.toThrow();
    });
  });

  describe('clear', () => {
    it('should remove all cache entries', async () => {
      await cache.set('key1', mockCacheEntry);
      await cache.set('key2', mockCacheEntry);

      await cache.clear();

      expect(await cache.get('key1')).toBeNull();
      expect(await cache.get('key2')).toBeNull();
    });

    it('should work on empty cache', async () => {
      await expect(cache.clear())
        .resolves
        .not.toThrow();
    });
  });

  describe('complex data handling', () => {
    it('should handle cache entries with nested objects', async () => {
      const complexEntry: CacheEntry = {
        timestamp: Date.now(),
        source: {
          type: ProjectSourceType.GIT,
          version: 'test-hash',
          metadata: {
            nested: {
              deeply: {
                value: 'test'
              }
            },
            array: [1, 2, 3]
          }
        },
        results: [{
          analyzerId: 'test',
          score: 100,
          issues: [{
            severity: IssueSeverity.CRITICAL,
            message: 'test',
            rule: 'test-rule',
            file: 'test.ts',
            line: 1,
            column: 1
          }]
        }]
      };

      await cache.set('complex', complexEntry);
      const result = await cache.get('complex');
      expect(result).toEqual(complexEntry);
    });

    it('should handle multiple concurrent operations', async () => {
      const operations = Array.from({ length: 100 }, (_, i) => ({
        key: `key${i}`,
        entry: { ...mockCacheEntry, timestamp: Date.now() + i }
      }));

      // Concurrent sets
      await Promise.all(
        operations.map(op => cache.set(op.key, op.entry))
      );

      // Concurrent gets
      const results = await Promise.all(
        operations.map(op => cache.get(op.key))
      );

      expect(results).toEqual(operations.map(op => op.entry));
    });
  });
}); 