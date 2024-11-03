// Copyright (c) 2024 Christopher Watson
// 
// This software is released under the MIT License.
// https://opensource.org/licenses/MIT

import { 
    IAnalyzer, 
    AnalyzerConfig, 
    AnalysisContext,
    AnalyzerResult 
  } from '../types';
  import { AnalyzerError } from '../errors';
  import { ICache, CacheEntry } from '../cache';
  
  export interface AnalyzerManagerOptions {
    cache?: ICache;
    /** Maximum age of cache entries in milliseconds */
    maxCacheAge?: number;
  }

  /**
   * Manages the lifecycle and execution of code analyzers
   * 
   * The AnalyzerManager is responsible for:
   * - Registering and managing analyzer plugins
   * - Running analysis across multiple analyzers
   * - Managing analyzer configurations
   * - Handling analyzer cleanup
   * 
   * @example
   * ```typescript
   * const manager = new AnalyzerManager();
   * 
   * // Register analyzers
   * manager.registerAnalyzer(new ESLintAnalyzer());
   * manager.registerAnalyzer(new TypeScriptAnalyzer());
   * 
   * // Run analysis
   * const results = await manager.runAnalysis({
   *   projectRoot: '/path/to/project',
   *   files: ['src/**' + '/*.ts'] // split to avoid ending comment
   * }, {
   *   eslint: { enabled: true },
   *   typescript: { enabled: true }
   * });
   * ```
   */
  export class AnalyzerManager {
    /** Map of registered analyzers by ID */
    private analyzers: Map<string, IAnalyzer> = new Map();
    private cache?: ICache;
    private maxCacheAge: number;
  
    constructor(options: AnalyzerManagerOptions = {}) {
      this.cache = options.cache;
      this.maxCacheAge = options.maxCacheAge || 24 * 60 * 60 * 1000; // 24 hours default
    }
  
    /**
     * Register a new analyzer
     * @param analyzer The analyzer to register
     * @throws AnalyzerError if an analyzer with the same ID is already registered
     */
    registerAnalyzer(analyzer: IAnalyzer): void {
      if (this.analyzers.has(analyzer.id)) {
        throw new AnalyzerError(
          `Analyzer with ID "${analyzer.id}" is already registered`,
          analyzer.id,
          'DUPLICATE_ANALYZER'
        );
      }
      this.analyzers.set(analyzer.id, analyzer);
    }
  
    /**
     * Get an analyzer by ID
     * @param id The analyzer ID
     * @returns The analyzer instance, or undefined if not found
     */
    getAnalyzer(id: string): IAnalyzer | undefined {
      return this.analyzers.get(id);
    }
  
    /**
     * List all registered analyzers
     * @returns Array of registered analyzers
     */
    listAnalyzers(): IAnalyzer[] {
      return Array.from(this.analyzers.values());
    }
  
    /**
     * Run analysis using all enabled analyzers
     * 
     * @param context Base context for analysis (without config)
     * @param configs Configuration for each analyzer
     * @returns Array of analysis results
     * @throws AnalyzerError if any analyzer fails
     * 
     * @example
     * ```typescript
     * const results = await manager.runAnalysis({
     *   projectRoot: '/path/to/project',
     *   files: ['src/**' + '/*.ts'] // split to avoid ending comment
     * }, {
     *   eslint: { 
     *     enabled: true,
     *     rules: { 'no-console': 'error' }
     *   }
     * });
     * ```
     */
    async runAnalysis(
      context: Omit<AnalysisContext, 'config'>,
      configs: Record<string, AnalyzerConfig>
    ): Promise<AnalyzerResult[]> {
      // Try to get from cache if context includes download result
      if (this.cache && context.downloadResult?.metadata) {
        const cacheKey = context.downloadResult.metadata.version;
        const cached = await this.cache.get(cacheKey);

        if (cached && this.isCacheValid(cached)) {
          return cached.results;
        }
      }

      // Run analysis if not cached or cache invalid
      const results = await this.runAnalyzers(context, configs);

      // Cache the results if we have metadata
      if (this.cache && context.downloadResult?.metadata) {
        const cacheKey = context.downloadResult.metadata.version;
        await this.cache.set(cacheKey, {
          timestamp: Date.now(),
          source: context.downloadResult.metadata,
          results
        });
      }

      return results;
    }
  
    private isCacheValid(entry: CacheEntry): boolean {
      const age = Date.now() - entry.timestamp;
      return age < this.maxCacheAge;
    }
  
    /**
     * Clean up all registered analyzers
     * This should be called when analysis is complete to free up resources
     */
    async cleanup(): Promise<void> {
      const cleanupPromises = Array.from(this.analyzers.values()).map(
        analyzer => analyzer.cleanup?.() ?? Promise.resolve()
      );
      await Promise.all(cleanupPromises);
    }
  
    private async runAnalyzers(
      context: Omit<AnalysisContext, 'config'>,
      configs: Record<string, AnalyzerConfig>
    ): Promise<AnalyzerResult[]> {
      const results: AnalyzerResult[] = [];

      for (const [id, analyzer] of this.analyzers) {
        const config = configs[id] ?? { enabled: true };
        
        if (!config.enabled) continue;

        try {
          // Validate config if provided
          if (config.rules) {
            await analyzer.validateConfig(config.rules);
          }

          // Run analysis
          const result = await analyzer.analyze({
            ...context,
            config
          });

          results.push(result);
        } catch (error) {
          throw new AnalyzerError(
            `Analysis failed for analyzer "${id}": ${(error as Error).message}`,
            id,
            'ANALYSIS_FAILED'
          );
        }
      }

      return results;
    }
  }