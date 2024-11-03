import { ProjectDownloader } from '../../download/downloader';
import { 
  BaseProjectSource, 
  IProjectDownloader, 
  ProjectSourceType, 
  DownloadResult 
} from '../../types';
import { DownloaderError, DownloaderErrorCodes } from '../../errors';

describe('ProjectDownloader', () => {
  let downloader: ProjectDownloader;

  beforeEach(() => {
    downloader = new ProjectDownloader();
  });

  // Helper to create mock downloaders
  const createMockDownloader = (
    canHandleResult = true,
    shouldFail = false
  ): IProjectDownloader => ({
    canHandle: jest.fn().mockReturnValue(canHandleResult),
    download: jest.fn().mockImplementation(async () => {
      if (shouldFail) {
        throw new Error('Download failed');
      }
      return {
        path: '/mock/path',
        cleanup: jest.fn(),
        metadata: {
          version: 'test-version',
          type: ProjectSourceType.GIT
        }
      };
    }),
    validateSource: jest.fn(),
    getCacheKey: jest.fn(),
    cleanup: jest.fn()
  });

  describe('registerDownloader', () => {
    it('should successfully register a downloader', () => {
      const mockDownloader = createMockDownloader();
      downloader.registerDownloader('test', mockDownloader);
      
      // Test internal state using download method
      const source: BaseProjectSource = { type: ProjectSourceType.GIT };
      return expect(downloader.download(source)).resolves.toBeDefined();
    });

    it('should allow registering multiple downloaders', () => {
      const mockDownloader1 = createMockDownloader(true);
      const mockDownloader2 = createMockDownloader(false);

      downloader.registerDownloader('test1', mockDownloader1);
      downloader.registerDownloader('test2', mockDownloader2);

      const source: BaseProjectSource = { type: ProjectSourceType.GIT };
      return expect(downloader.download(source)).resolves.toBeDefined();
    });

    it('should allow overwriting existing downloaders', () => {
      const mockDownloader1 = createMockDownloader(false);
      const mockDownloader2 = createMockDownloader(true);

      downloader.registerDownloader('test', mockDownloader1);
      downloader.registerDownloader('test', mockDownloader2);

      const source: BaseProjectSource = { type: ProjectSourceType.GIT };
      return expect(downloader.download(source)).resolves.toBeDefined();
    });
  });

  describe('download', () => {
    it('should use the first compatible downloader', async () => {
      const mockDownloader1 = createMockDownloader(false);
      const mockDownloader2 = createMockDownloader(true);
      const mockDownloader3 = createMockDownloader(true);

      downloader.registerDownloader('test1', mockDownloader1);
      downloader.registerDownloader('test2', mockDownloader2);
      downloader.registerDownloader('test3', mockDownloader3);

      const source: BaseProjectSource = { type: ProjectSourceType.GIT };
      await downloader.download(source);

      expect(mockDownloader1.canHandle).toHaveBeenCalledWith(source);
      expect(mockDownloader2.canHandle).toHaveBeenCalledWith(source);
      expect(mockDownloader2.download).toHaveBeenCalledWith(source);
      expect(mockDownloader3.canHandle).not.toHaveBeenCalled();
    });

    it('should throw when no compatible downloader is found', async () => {
      const mockDownloader = createMockDownloader(false);
      downloader.registerDownloader('test', mockDownloader);

      const source: BaseProjectSource = { type: ProjectSourceType.GIT };
      
      await expect(downloader.download(source))
        .rejects
        .toThrow(DownloaderError);

      await expect(downloader.download(source))
        .rejects
        .toMatchObject({
          code: DownloaderErrorCodes.DOWNLOADER_NOT_FOUND,
          sourceType: ProjectSourceType.GIT
        });
    });

    it('should propagate download errors', async () => {
      const mockDownloader = createMockDownloader(true, true);
      downloader.registerDownloader('test', mockDownloader);

      const source: BaseProjectSource = { type: ProjectSourceType.GIT };
      
      await expect(downloader.download(source))
        .rejects
        .toThrow();
    });

    it('should handle different source types', async () => {
      const gitDownloader = createMockDownloader();
      const npmDownloader = createMockDownloader();

      downloader.registerDownloader('git', gitDownloader);
      downloader.registerDownloader('npm', npmDownloader);

      const gitSource: BaseProjectSource = { type: ProjectSourceType.GIT };
      const npmSource: BaseProjectSource = { type: ProjectSourceType.NPM };

      await expect(downloader.download(gitSource)).resolves.toBeDefined();
      await expect(downloader.download(npmSource)).resolves.toBeDefined();
    });
  });

  describe('error cases', () => {
    it('should handle undefined source', async () => {
      await expect(downloader.download(undefined as unknown as BaseProjectSource))
        .rejects
        .toThrow(DownloaderError);
    });

    it('should handle null source', async () => {
      await expect(downloader.download(null as unknown as BaseProjectSource))
        .rejects
        .toThrow(DownloaderError);
    });

    it('should handle invalid source type', async () => {
      const source = { type: 'invalid' as ProjectSourceType };
      await expect(downloader.download(source))
        .rejects
        .toThrow(DownloaderError);
    });

    it('should handle downloader throwing non-Error objects', async () => {
      const mockDownloader: IProjectDownloader = {
        canHandle: () => true,
        download: () => Promise.reject('string error')
      };

      downloader.registerDownloader('test', mockDownloader);
      
      await expect(downloader.download({ type: ProjectSourceType.GIT }))
        .rejects
        .toThrow();
    });

    it('should handle source without type property', async () => {
      const source = {} as BaseProjectSource;
      await expect(downloader.download(source))
        .rejects
        .toMatchObject({
          message: 'Invalid source: missing source type',
          code: DownloaderErrorCodes.INVALID_SOURCE,
          sourceType: 'unknown'
        });
    });
  });

  describe('download result handling', () => {
    it('should return valid download result', async () => {
      const expectedResult: DownloadResult = {
        path: '/test/path',
        cleanup: jest.fn(),
        metadata: {
          version: 'test-version',
          type: ProjectSourceType.GIT
        }
      };

      const mockDownloader: IProjectDownloader = {
        canHandle: () => true,
        download: jest.fn().mockResolvedValue(expectedResult)
      };

      downloader.registerDownloader('test', mockDownloader);

      const result = await downloader.download({ type: ProjectSourceType.GIT });
      expect(result).toEqual(expectedResult);
    });

    it('should handle download result without metadata', async () => {
      const expectedResult: DownloadResult = {
        path: '/test/path',
        cleanup: jest.fn()
      };

      const mockDownloader: IProjectDownloader = {
        canHandle: () => true,
        download: jest.fn().mockResolvedValue(expectedResult)
      };

      downloader.registerDownloader('test', mockDownloader);

      const result = await downloader.download({ type: ProjectSourceType.GIT });
      expect(result).toEqual(expectedResult);
    });

    it('should verify cleanup function is callable', async () => {
      const mockCleanup = jest.fn();
      const mockDownloader: IProjectDownloader = {
        canHandle: () => true,
        download: jest.fn().mockResolvedValue({
          path: '/test/path',
          cleanup: mockCleanup
        })
      };

      downloader.registerDownloader('test', mockDownloader);

      const result = await downloader.download({ type: ProjectSourceType.GIT });
      await result.cleanup();
      expect(mockCleanup).toHaveBeenCalled();
    });
  });

  describe('concurrent operations', () => {
    it('should handle multiple concurrent downloads', async () => {
      const mockDownloader = createMockDownloader();
      downloader.registerDownloader('test', mockDownloader);

      const sources = Array.from({ length: 5 }, () => ({ 
        type: ProjectSourceType.GIT 
      }));

      const results = await Promise.all(
        sources.map(source => downloader.download(source))
      );

      expect(results).toHaveLength(5);
      results.forEach(result => {
        expect(result.path).toBe('/mock/path');
      });
    });
  });
}); 