import { AnalyzerManager } from '../../analyzer/analyzer-manager';
import { IAnalyzer, AnalysisContext, ProjectSourceType } from '../../types';
import { AnalyzerError } from '../../errors';
import { MemoryCache } from '../../cache';

describe('AnalyzerManager', () => {
  let manager: AnalyzerManager;

  beforeEach(() => {
    manager = new AnalyzerManager();
  });

  const createMockAnalyzer = (id: string): IAnalyzer => ({
    id,
    name: `Mock Analyzer ${id}`,
    description: 'A mock analyzer for testing',
    analyze: jest.fn().mockResolvedValue({
      analyzerId: id,
      score: 100,
      issues: []
    }),
    validateConfig: jest.fn().mockResolvedValue(undefined),
    cleanup: jest.fn().mockResolvedValue(undefined)
  });

  describe('registerAnalyzer', () => {
    it('should successfully register an analyzer', () => {
      const analyzer = createMockAnalyzer('test');
      manager.registerAnalyzer(analyzer);
      expect(manager.getAnalyzer('test')).toBe(analyzer);
    });

    it('should throw error when registering duplicate analyzer', () => {
      const analyzer = createMockAnalyzer('test');
      manager.registerAnalyzer(analyzer);

      expect(() => manager.registerAnalyzer(analyzer))
        .toThrow(AnalyzerError);
    });
  });

  describe('runAnalysis', () => {
    it('should run analysis with all enabled analyzers', async () => {
      const analyzer1 = createMockAnalyzer('test1');
      const analyzer2 = createMockAnalyzer('test2');

      manager.registerAnalyzer(analyzer1);
      manager.registerAnalyzer(analyzer2);

      const context: Omit<AnalysisContext, 'config'> = {
        projectRoot: '/test',
        files: ['file1.ts', 'file2.ts']
      };

      const results = await manager.runAnalysis(context, {
        test1: { enabled: true },
        test2: { enabled: true }
      });

      expect(results).toHaveLength(2);
      expect(analyzer1.analyze).toHaveBeenCalled();
      expect(analyzer2.analyze).toHaveBeenCalled();
    });

    it('should skip disabled analyzers', async () => {
      const analyzer = createMockAnalyzer('test');
      manager.registerAnalyzer(analyzer);

      const context: Omit<AnalysisContext, 'config'> = {
        projectRoot: '/test',
        files: ['file1.ts']
      };

      const results = await manager.runAnalysis(context, {
        test: { enabled: false }
      });

      expect(results).toHaveLength(0);
      expect(analyzer.analyze).not.toHaveBeenCalled();
    });
  });

  describe('cleanup', () => {
    it('should cleanup all analyzers', async () => {
      const analyzer1 = createMockAnalyzer('test1');
      const analyzer2 = createMockAnalyzer('test2');

      manager.registerAnalyzer(analyzer1);
      manager.registerAnalyzer(analyzer2);

      await manager.cleanup();

      expect(analyzer1.cleanup).toHaveBeenCalled();
      expect(analyzer2.cleanup).toHaveBeenCalled();
    });

    it('should handle analyzer without cleanup method', async () => {
      const analyzer = createMockAnalyzer('test');
      // @ts-expect-error - Remove cleanup method
      delete analyzer.cleanup; // Remove cleanup method

      manager.registerAnalyzer(analyzer);
      await expect(manager.cleanup()).resolves.not.toThrow();
    });

    it('should handle missing analyzer config', async () => {
      const analyzer = createMockAnalyzer('test');
      manager.registerAnalyzer(analyzer);

      const context: Omit<AnalysisContext, 'config'> = {
        projectRoot: '/test',
        files: ['file1.ts']
      };

      // Don't provide config for 'test' analyzer
      const results = await manager.runAnalysis(context, {});

      expect(results).toHaveLength(1);
      expect(analyzer.analyze).toHaveBeenCalledWith({
        ...context,
        config: { enabled: true }
      });
    });

    it('should skip cache when no download metadata', async () => {
      const cache = new MemoryCache();
      const manager = new AnalyzerManager({ cache });
      const analyzer = createMockAnalyzer('test');
      manager.registerAnalyzer(analyzer);

      const context: Omit<AnalysisContext, 'config'> = {
        projectRoot: '/test',
        files: ['file1.ts'],
        // No downloadResult provided
      };

      // Run twice to verify no caching
      await manager.runAnalysis(context, { test: { enabled: true } });
      await manager.runAnalysis(context, { test: { enabled: true } });

      expect(analyzer.analyze).toHaveBeenCalledTimes(2);
    });

    it('should handle missing cache implementation', async () => {
      const manager = new AnalyzerManager(); // No cache provided
      const analyzer = createMockAnalyzer('test');
      manager.registerAnalyzer(analyzer);

      const context: Omit<AnalysisContext, 'config'> = {
        projectRoot: '/test',
        files: ['file1.ts'],
        downloadResult: {
          path: '/test',
          cleanup: jest.fn(),
          metadata: {
            version: 'test-version',
            type: ProjectSourceType.GIT
          }
        }
      };

      // Run twice to verify no caching
      await manager.runAnalysis(context, { test: { enabled: true } });
      await manager.runAnalysis(context, { test: { enabled: true } });

      expect(analyzer.analyze).toHaveBeenCalledTimes(2);
    });
  });

  describe('caching behavior', () => {
    let cache: MemoryCache;
    let manager: AnalyzerManager;

    beforeEach(() => {
      cache = new MemoryCache();
      manager = new AnalyzerManager({
        cache,
        maxCacheAge: 1000 // 1 second for testing
      });
    });

    it('should return cached results when valid', async () => {
      const analyzer = createMockAnalyzer('test');
      manager.registerAnalyzer(analyzer);

      const context: Omit<AnalysisContext, 'config'> = {
        projectRoot: '/test',
        files: ['file1.ts'],
        downloadResult: {
          path: '/test',
          cleanup: jest.fn(),
          metadata: {
            version: 'test-version',
            type: ProjectSourceType.GIT
          }
        }
      };

      // First run should cache
      await manager.runAnalysis(context, {
        test: { enabled: true }
      });

      // Second run should use cache
      const secondRun = await manager.runAnalysis(context, {
        test: { enabled: true }
      });

      expect(analyzer.analyze).toHaveBeenCalledTimes(1);
      expect(secondRun).toBeDefined();
    });

    it('should ignore cache when expired', async () => {
      const analyzer = createMockAnalyzer('test');
      manager.registerAnalyzer(analyzer);

      const context: Omit<AnalysisContext, 'config'> = {
        projectRoot: '/test',
        files: ['file1.ts'],
        downloadResult: {
          path: '/test',
          cleanup: jest.fn(),
          metadata: {
            version: 'test-version',
            type: ProjectSourceType.GIT
          }
        }
      };

      // First run
      await manager.runAnalysis(context, {
        test: { enabled: true }
      });

      // Wait for cache to expire
      await new Promise(resolve => setTimeout(resolve, 1100));

      // Second run should not use cache
      await manager.runAnalysis(context, {
        test: { enabled: true }
      });

      expect(analyzer.analyze).toHaveBeenCalledTimes(2);
    });
  });

  describe('error handling', () => {
    it('should throw when analyzer validation fails', async () => {
      const analyzer = createMockAnalyzer('test');
      const validationError = new Error('Invalid config');
      analyzer.validateConfig = jest.fn().mockRejectedValue(validationError);

      manager.registerAnalyzer(analyzer);

      const context: Omit<AnalysisContext, 'config'> = {
        projectRoot: '/test',
        files: ['file1.ts']
      };

      await expect(manager.runAnalysis(context, {
        test: {
          enabled: true,
          rules: { someRule: true }
        }
      })).rejects.toThrow(AnalyzerError);
    });

    it('should throw when analyzer execution fails', async () => {
      const analyzer = createMockAnalyzer('test');
      const analysisError = new Error('Analysis failed');
      analyzer.analyze = jest.fn().mockRejectedValue(analysisError);

      manager.registerAnalyzer(analyzer);

      const context: Omit<AnalysisContext, 'config'> = {
        projectRoot: '/test',
        files: ['file1.ts']
      };

      await expect(manager.runAnalysis(context, {
        test: { enabled: true }
      })).rejects.toThrow(AnalyzerError);
    });
  });

  describe('listAnalyzers', () => {
    it('should return all registered analyzers', () => {
      const analyzer1 = createMockAnalyzer('test1');
      const analyzer2 = createMockAnalyzer('test2');

      manager.registerAnalyzer(analyzer1);
      manager.registerAnalyzer(analyzer2);

      const analyzers = manager.listAnalyzers();
      expect(analyzers).toHaveLength(2);
      expect(analyzers).toContain(analyzer1);
      expect(analyzers).toContain(analyzer2);
    });
  });
});
