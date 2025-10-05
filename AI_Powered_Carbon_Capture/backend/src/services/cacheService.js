/**
 * Cache Service for Performance Optimization
 * Provides in-memory and Redis caching with TTL support
 */

const Redis = require('ioredis');

class CacheService {
  constructor() {
    this.memoryCache = new Map();
    this.redis = null;
    this.isRedisAvailable = false;

    // Initialize Redis if configured
    if (process.env.REDIS_URL) {
      this.initializeRedis();
    }
  }

  /**
   * Initialize Redis connection
   */
  async initializeRedis() {
    try {
      this.redis = new Redis(process.env.REDIS_URL, {
        retryDelayOnFailover: 100,
        enableReadyCheck: false,
        maxRetriesPerRequest: 3,
        lazyConnect: true
      });

      this.redis.on('connect', () => {
        console.log('Redis cache connected');
        this.isRedisAvailable = true;
      });

      this.redis.on('error', (error) => {
        console.warn('Redis cache error:', error.message);
        this.isRedisAvailable = false;
      });

      this.redis.on('close', () => {
        console.log('Redis cache connection closed');
        this.isRedisAvailable = false;
      });

      await this.redis.connect();
    } catch (error) {
      console.warn('Failed to initialize Redis cache:', error.message);
      this.isRedisAvailable = false;
    }
  }

  /**
   * Generate cache key
   * @param {string} namespace - Cache namespace
   * @param {string} key - Cache key
   * @param {Object} params - Additional parameters
   * @returns {string} Generated cache key
   */
  generateKey(namespace, key, params = {}) {
    const paramString = Object.keys(params)
      .sort()
      .map(k => `${k}:${params[k]}`)
      .join('|');

    return paramString ? `${namespace}:${key}:${paramString}` : `${namespace}:${key}`;
  }

  /**
   * Set cache value
   * @param {string} key - Cache key
   * @param {any} value - Value to cache
   * @param {number} ttl - Time to live in seconds
   * @returns {Promise<boolean>} Success status
   */
  async set(key, value, ttl = 300) { // Default 5 minutes TTL
    try {
      const serializedValue = JSON.stringify({
        data: value,
        timestamp: Date.now(),
        ttl
      });

      // Set in memory cache
      this.memoryCache.set(key, {
        data: value,
        timestamp: Date.now(),
        ttl
      });

      // Set in Redis if available
      if (this.isRedisAvailable && this.redis) {
        await this.redis.setex(key, ttl, serializedValue);
      }

      return true;
    } catch (error) {
      console.error('Cache set error:', error);
      return false;
    }
  }

  /**
   * Get cache value
   * @param {string} key - Cache key
   * @returns {Promise<any>} Cached value or null
   */
  async get(key) {
    try {
      let cached = null;
      let fromRedis = false;

      // Try Redis first if available
      if (this.isRedisAvailable && this.redis) {
        const redisValue = await this.redis.get(key);
        if (redisValue) {
          cached = JSON.parse(redisValue);
          fromRedis = true;
        }
      }

      // Fallback to memory cache
      if (!cached) {
        cached = this.memoryCache.get(key);
      }

      // Check if cache is expired
      if (cached && this.isExpired(cached)) {
        await this.delete(key);
        return null;
      }

      return cached ? cached.data : null;
    } catch (error) {
      console.error('Cache get error:', error);
      return null;
    }
  }

  /**
   * Delete cache key
   * @param {string} key - Cache key
   * @returns {Promise<boolean>} Success status
   */
  async delete(key) {
    try {
      // Delete from memory cache
      this.memoryCache.delete(key);

      // Delete from Redis if available
      if (this.isRedisAvailable && this.redis) {
        await this.redis.del(key);
      }

      return true;
    } catch (error) {
      console.error('Cache delete error:', error);
      return false;
    }
  }

  /**
   * Clear all cache
   * @param {string} pattern - Key pattern to clear (optional)
   * @returns {Promise<boolean>} Success status
   */
  async clear(pattern = null) {
    try {
      if (pattern) {
        // Clear pattern from memory cache
        for (const [key] of this.memoryCache) {
          if (key.includes(pattern)) {
            this.memoryCache.delete(key);
          }
        }

        // Clear pattern from Redis
        if (this.isRedisAvailable && this.redis) {
          const keys = await this.redis.keys(`*${pattern}*`);
          if (keys.length > 0) {
            await this.redis.del(keys);
          }
        }
      } else {
        // Clear all
        this.memoryCache.clear();

        if (this.isRedisAvailable && this.redis) {
          await this.redis.flushall();
        }
      }

      return true;
    } catch (error) {
      console.error('Cache clear error:', error);
      return false;
    }
  }

  /**
   * Check if cache entry is expired
   * @param {Object} cached - Cached entry
   * @returns {boolean} Whether entry is expired
   */
  isExpired(cached) {
    if (!cached.timestamp || !cached.ttl) return false;

    const age = (Date.now() - cached.timestamp) / 1000; // Age in seconds
    return age > cached.ttl;
  }

  /**
   * Get or set cache value (cache-aside pattern)
   * @param {string} key - Cache key
   * @param {Function} fetcher - Function to fetch data if not cached
   * @param {number} ttl - Time to live in seconds
   * @returns {Promise<any>} Cached or fetched value
   */
  async getOrSet(key, fetcher, ttl = 300) {
    let value = await this.get(key);

    if (value === null) {
      try {
        value = await fetcher();
        if (value !== null && value !== undefined) {
          await this.set(key, value, ttl);
        }
      } catch (error) {
        console.error('Cache fetcher error:', error);
        throw error;
      }
    }

    return value;
  }

  /**
   * Set multiple cache values
   * @param {Object} keyValuePairs - Object with keys and values
   * @param {number} ttl - Time to live in seconds
   * @returns {Promise<boolean>} Success status
   */
  async mset(keyValuePairs, ttl = 300) {
    try {
      const promises = Object.entries(keyValuePairs).map(([key, value]) =>
        this.set(key, value, ttl)
      );

      await Promise.all(promises);
      return true;
    } catch (error) {
      console.error('Cache mset error:', error);
      return false;
    }
  }

  /**
   * Get multiple cache values
   * @param {Array<string>} keys - Array of cache keys
   * @returns {Promise<Object>} Object with keys and values
   */
  async mget(keys) {
    try {
      const promises = keys.map(key => this.get(key));
      const values = await Promise.all(promises);

      const result = {};
      keys.forEach((key, index) => {
        result[key] = values[index];
      });

      return result;
    } catch (error) {
      console.error('Cache mget error:', error);
      return {};
    }
  }

  /**
   * Get cache statistics
   * @returns {Promise<Object>} Cache statistics
   */
  async getStats() {
    const stats = {
      memoryCache: {
        entries: this.memoryCache.size,
        keys: Array.from(this.memoryCache.keys())
      },
      redisCache: {
        available: this.isRedisAvailable,
        info: null
      }
    };

    // Get Redis info if available
    if (this.isRedisAvailable && this.redis) {
      try {
        const info = await this.redis.info();
        stats.redisCache.info = {
          connected_clients: info.match(/connected_clients:(\d+)/)?.[1],
          used_memory: info.match(/used_memory:(\d+)/)?.[1],
          total_keys: await this.redis.dbsize()
        };
      } catch (error) {
        console.error('Failed to get Redis stats:', error);
      }
    }

    return stats;
  }

  /**
   * Health check for cache service
   * @returns {Promise<Object>} Health status
   */
  async healthCheck() {
    const health = {
      status: 'healthy',
      memoryCache: 'healthy',
      redisCache: 'unavailable',
      errors: []
    };

    // Check memory cache
    try {
      await this.set('health_check', 'ok', 10);
      const value = await this.get('health_check');
      if (value !== 'ok') {
        throw new Error('Memory cache read/write failed');
      }
    } catch (error) {
      health.memoryCache = 'unhealthy';
      health.errors.push(`Memory cache: ${error.message}`);
    }

    // Check Redis cache
    if (this.isRedisAvailable && this.redis) {
      try {
        await this.redis.ping();
        health.redisCache = 'healthy';
      } catch (error) {
        health.redisCache = 'unhealthy';
        health.errors.push(`Redis cache: ${error.message}`);
      }
    }

    // Overall status
    if (health.memoryCache === 'unhealthy' && health.redisCache === 'unhealthy') {
      health.status = 'unhealthy';
    } else if (health.memoryCache === 'unhealthy' || health.redisCache === 'unhealthy') {
      health.status = 'degraded';
    }

    return health;
  }

  /**
   * Warm up cache with frequently accessed data
   * @param {Array<Object>} warmupData - Array of {key, fetcher, ttl} objects
   */
  async warmup(warmupData) {
    console.log(`Starting cache warmup with ${warmupData.length} entries...`);

    const promises = warmupData.map(async ({ key, fetcher, ttl = 300 }) => {
      try {
        const exists = await this.get(key);
        if (exists === null) {
          const value = await fetcher();
          if (value !== null && value !== undefined) {
            await this.set(key, value, ttl);
            return { key, status: 'warmed' };
          }
        }
        return { key, status: 'already_cached' };
      } catch (error) {
        console.error(`Cache warmup failed for ${key}:`, error);
        return { key, status: 'error', error: error.message };
      }
    });

    const results = await Promise.all(promises);
    const summary = {
      total: results.length,
      warmed: results.filter(r => r.status === 'warmed').length,
      alreadyCached: results.filter(r => r.status === 'already_cached').length,
      errors: results.filter(r => r.status === 'error').length
    };

    console.log('Cache warmup completed:', summary);
    return summary;
  }

  /**
   * Close Redis connection
   */
  async close() {
    if (this.redis) {
      await this.redis.quit();
    }
  }
}

module.exports = new CacheService();
