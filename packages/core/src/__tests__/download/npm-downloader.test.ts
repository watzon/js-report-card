import { rm, mkdir } from 'fs/promises';
import { join } from 'path';
import { tmpdir } from 'os';
import { exec } from 'child_process';

import { NpmDownloader } from '../../download/npm-downloader';
import { ProjectSourceType, NpmProjectSource, GitProjectSource } from '../../types';
import { DownloaderError } from '../../errors';

// Mock dependencies
jest.mock('fs/promises');
jest.mock('path');
jest.mock('os');
jest.mock('child_process');

describe('NpmDownloader', () => {
  let downloader: NpmDownloader;

  beforeEach(() => {
    jest.clearAllMocks();
    
    (tmpdir as jest.Mock).mockReturnValue('/tmp');
    (join as jest.Mock).mockImplementation((...args) => args.join('/'));
    (rm as jest.Mock).mockResolvedValue(undefined);
    (mkdir as jest.Mock).mockResolvedValue(undefined);
    (exec as unknown as jest.Mock).mockImplementation((cmd, callback) => {
      if (cmd.startsWith('npm pack')) {
        callback(null, { stdout: 'package-1.0.0.tgz\n' });
      } else {
        callback(null, { stdout: '' });
      }
    });
    
    downloader = new NpmDownloader();
  });

  describe('canHandle', () => {
    it('should return true for npm sources', () => {
      const source: NpmProjectSource = {
        type: ProjectSourceType.NPM,
        packageName: 'example-package'
      };
      
      expect(downloader.canHandle(source)).toBe(true);
    });

    it('should return false for non-npm sources', () => {
      const source: GitProjectSource = {
        type: ProjectSourceType.GIT,
        url: 'https://github.com/user/repo.git'
      };
      
      expect(downloader.canHandle(source)).toBe(false);
    });
  });

  describe('download', () => {
    it('should successfully download and extract an npm package', async () => {
      // Arrange
      const source: NpmProjectSource = {
        type: ProjectSourceType.NPM,
        packageName: 'example-package'
      };

      // Act
      const result = await downloader.download(source);

      // Assert
      expect(exec).toHaveBeenCalledWith(
        expect.stringContaining('npm pack example-package'),
        expect.any(Function)
      );
      expect(exec).toHaveBeenCalledWith(
        expect.stringContaining('tar -xzf'),
        expect.any(Function)
      );
      expect(result.path).toContain('/tmp/js-report-card');
      expect(result.cleanup).toBeInstanceOf(Function);
    });

    it('should handle specific package versions', async () => {
      // Arrange
      const source: NpmProjectSource = {
        type: ProjectSourceType.NPM,
        packageName: 'example-package',
        version: '1.2.3'
      };

      // Act
      await downloader.download(source);

      // Assert
      expect(exec).toHaveBeenCalledWith(
        expect.stringContaining('npm pack example-package@1.2.3'),
        expect.any(Function)
      );
    });

    it('should throw DownloaderError on download failure', async () => {
      // Arrange
      const source: NpmProjectSource = {
        type: ProjectSourceType.NPM,
        packageName: 'example-package'
      };
      
      (exec as unknown as jest.Mock).mockImplementation((cmd, callback) => {
        callback(new Error('Download failed'));
      });

      // Act & Assert
      await expect(downloader.download(source))
        .rejects
        .toThrow(DownloaderError);
    });

    it('should cleanup directory on failure', async () => {
      // Arrange
      const source: NpmProjectSource = {
        type: ProjectSourceType.NPM,
        packageName: 'example-package'
      };
      
      (exec as unknown as jest.Mock).mockImplementation((cmd, callback) => {
        callback(new Error('Download failed'));
      });

      // Act
      try {
        await downloader.download(source);
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
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
    it('should successfully cleanup downloaded package', async () => {
      // Arrange
      const source: NpmProjectSource = {
        type: ProjectSourceType.NPM,
        packageName: 'example-package'
      };
      
      const result = await downloader.download(source);

      // Act
      await result.cleanup();

      // Assert
      expect(rm).toHaveBeenCalledWith(
        expect.stringContaining('/tmp/js-report-card'),
        expect.objectContaining({ recursive: true, force: true })
      );
    });
  });
}); 