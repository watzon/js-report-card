import { AnalyzerManager } from '../../analyzer/analyzer-manager';
import { IAnalyzer, AnalysisContext } from '../../types';
import { AnalyzerError } from '../../errors';

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
  });
}); 