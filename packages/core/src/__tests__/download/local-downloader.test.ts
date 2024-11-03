import { cp, rm } from 'fs/promises';
import { join } from 'path';
import { tmpdir } from 'os';

import { LocalDownloader } from '../../download/local-downloader';
import { ProjectSourceType, LocalProjectSource, GitProjectSource } from '../../types';
import { DownloaderError } from '../../errors';

// Mock fs/promises
jest.mock('fs/promises');
jest.mock('path');
jest.mock('os');

describe('LocalDownloader', () => {
  let downloader: LocalDownloader;

  beforeEach(() => {
    jest.clearAllMocks();
    
    (tmpdir as jest.Mock).mockReturnValue('/tmp');
    (join as jest.Mock).mockImplementation((...args) => args.join('/'));
    (rm as jest.Mock).mockResolvedValue(undefined);
    (cp as jest.Mock).mockResolvedValue(undefined);
    
    downloader = new LocalDownloader();
  });

  describe('canHandle', () => {
    it('should return true for local sources', () => {
      const source: LocalProjectSource = {
        type: ProjectSourceType.LOCAL,
        path: '/path/to/project'
      };
      
      expect(downloader.canHandle(source)).toBe(true);
    });

    it('should return false for non-local sources', () => {
      const source: GitProjectSource = {
        type: ProjectSourceType.GIT,
        url: 'https://github.com/user/repo.git'
      };
      
      expect(downloader.canHandle(source)).toBe(false);
    });
  });

  describe('download', () => {
    it('should successfully copy a local directory', async () => {
      // Arrange
      const source: LocalProjectSource = {
        type: ProjectSourceType.LOCAL,
        path: '/path/to/project'
      };

      // Act
      const result = await downloader.download(source);

      // Assert
      expect(cp).toHaveBeenCalledWith(
        source.path,
        expect.stringContaining('/tmp/js-report-card'),
        { recursive: true }
      );
      expect(result.path).toContain('/tmp/js-report-card');
      expect(result.cleanup).toBeInstanceOf(Function);
    });

    it('should throw DownloaderError on copy failure', async () => {
      // Arrange
      const source: LocalProjectSource = {
        type: ProjectSourceType.LOCAL,
        path: '/path/to/project'
      };
      
      (cp as jest.Mock).mockRejectedValueOnce(new Error('Copy failed'));

      // Act & Assert
      await expect(downloader.download(source))
        .rejects
        .toThrow(DownloaderError);
    });

    it('should cleanup directory on failure', async () => {
      // Arrange
      const source: LocalProjectSource = {
        type: ProjectSourceType.LOCAL,
        path: '/path/to/project'
      };
      
      (cp as jest.Mock).mockRejectedValueOnce(new Error('Copy failed'));

      // Act
      try {
        await downloader.download(source);
      } catch (error) {
        // Ignore error
      }

      // Assert
      expect(rm).toHaveBeenCalledWith(
        expect.stringContaining('/tmp/js-report-card'),
        expect.objectContaining({ recursive: true, force: true })
      );
    });
  });

  describe('cleanup', () => {
    it('should successfully cleanup copied directory', async () => {
      // Arrange
      const source: LocalProjectSource = {
        type: ProjectSourceType.LOCAL,
        path: '/path/to/project'
      };
      
      const result = await downloader.download(source);

      // Act
      await result.cleanup();

      // Assert
      expect(rm).toHaveBeenCalledWith(
        result.path,
        expect.objectContaining({ recursive: true, force: true })
      );
    });

    it('should handle cleanup failures gracefully', async () => {
      // Arrange
      const source: LocalProjectSource = {
        type: ProjectSourceType.LOCAL,
        path: '/path/to/project'
      };
      
      const result = await downloader.download(source);
      (rm as jest.Mock).mockRejectedValueOnce(new Error('Cleanup failed'));

      // Act & Assert
      await expect(result.cleanup())
        .rejects
        .toThrow('Cleanup failed');
    });
  });
}); 