import { simpleGit, SimpleGit } from 'simple-git';
import { rm } from 'fs/promises';
import { join } from 'path';
import { tmpdir } from 'os';

import { GitDownloader } from '../../download/git-downloader';
import { ProjectSourceType, GitProjectSource, LocalProjectSource } from '../../types';
import { DownloaderError, DownloaderErrorCodes } from '../../errors';

// Mock simple-git
jest.mock('simple-git');
jest.mock('fs/promises');
jest.mock('path');
jest.mock('os');

describe('GitDownloader', () => {
  let downloader: GitDownloader;
  let mockGit: jest.Mocked<SimpleGit>;

  beforeEach(() => {
    // Reset all mocks
    jest.clearAllMocks();
    
    // Setup mocks
    mockGit = {
      clone: jest.fn(),
      cwd: jest.fn().mockReturnThis(),
      checkout: jest.fn(),
    } as unknown as jest.Mocked<SimpleGit>;
    
    (simpleGit as jest.Mock).mockReturnValue(mockGit);
    (tmpdir as jest.Mock).mockReturnValue('/tmp');
    (join as jest.Mock).mockImplementation((...args) => args.join('/'));
    
    downloader = new GitDownloader();
  });

  describe('canHandle', () => {
    it('should return true for git sources', () => {
      const source: GitProjectSource = {
        type: ProjectSourceType.GIT,
        url: 'https://github.com/user/repo.git'
      };
      
      expect(downloader.canHandle(source)).toBe(true);
    });

    it('should return false for non-git sources', () => {
      const source: LocalProjectSource = {
        type: ProjectSourceType.LOCAL,
        path: '/some/path'
      };
      
      expect(downloader.canHandle(source)).toBe(false);
    });
  });

  describe('download', () => {
    it('should successfully clone a repository', async () => {
      // Arrange
      const source: GitProjectSource = {
        type: ProjectSourceType.GIT,
        url: 'https://github.com/user/repo.git'
      };

      // Act
      const result = await downloader.download(source);

      // Assert
      expect(mockGit.clone).toHaveBeenCalledWith(
        source.url,
        expect.stringContaining('/tmp/js-report-card'),
        { '--depth': 1 }
      );
      expect(result.path).toContain('/tmp/js-report-card');
      expect(result.cleanup).toBeInstanceOf(Function);
    });

    it('should handle authentication with token', async () => {
      // Arrange
      const source: GitProjectSource = {
        type: ProjectSourceType.GIT,
        url: 'https://github.com/user/repo.git',
        auth: {
          token: 'secret-token'
        }
      };

      // Act
      await downloader.download(source);

      // Assert
      expect(mockGit.clone).toHaveBeenCalledWith(
        expect.stringContaining('secret-token@github.com'),
        expect.any(String),
        expect.any(Object)
      );
    });

    it('should checkout specific ref when provided', async () => {
      // Arrange
      const source: GitProjectSource = {
        type: ProjectSourceType.GIT,
        url: 'https://github.com/user/repo.git',
        ref: 'develop'
      };

      // Act
      await downloader.download(source);

      // Assert
      expect(mockGit.checkout).toHaveBeenCalledWith('develop');
    });

    it('should respect custom clone depth', async () => {
      // Arrange
      const source: GitProjectSource = {
        type: ProjectSourceType.GIT,
        url: 'https://github.com/user/repo.git',
        depth: 5
      };

      // Act
      await downloader.download(source);

      // Assert
      expect(mockGit.clone).toHaveBeenCalledWith(
        source.url,
        expect.any(String),
        { '--depth': 5 }
      );
    });

    it('should throw DownloaderError on clone failure', async () => {
      // Arrange
      const source: GitProjectSource = {
        type: ProjectSourceType.GIT,
        url: 'https://github.com/user/repo.git'
      };
      
      mockGit.clone.mockRejectedValue(new Error('Network error'));

      // Act & Assert
      await expect(downloader.download(source))
        .rejects
        .toThrow(DownloaderError);
    });

    it('should cleanup directory on failure', async () => {
      // Arrange
      const source: GitProjectSource = {
        type: ProjectSourceType.GIT,
        url: 'https://github.com/user/repo.git'
      };
      
      mockGit.clone.mockRejectedValue(new Error('Clone failed'));

      // Act
      try {
        await downloader.download(source);
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
      } catch (error) {
      }

      // Assert
      expect(rm).toHaveBeenCalledWith(
        expect.stringContaining('/tmp/js-report-card'),
        expect.objectContaining({ recursive: true, force: true })
      );
    });

    it('should handle username and token authentication', async () => {
      const source: GitProjectSource = {
        type: ProjectSourceType.GIT,
        url: 'https://github.com/user/repo.git',
        auth: {
          username: 'user',
          token: 'secret-token'
        }
      };

      await downloader.download(source);

      expect(mockGit.clone).toHaveBeenCalledWith(
        'https://user:secret-token@github.com/user/repo.git',
        expect.any(String),
        expect.any(Object)
      );
    });

    it('should handle checkout failures', async () => {
      const source: GitProjectSource = {
        type: ProjectSourceType.GIT,
        url: 'https://github.com/user/repo.git',
        ref: 'develop'
      };

      mockGit.checkout.mockRejectedValue(new Error('Checkout failed'));

      await expect(downloader.download(source))
        .rejects
        .toThrow(DownloaderError);
    });

    it('should handle invalid URLs', async () => {
      const source: GitProjectSource = {
        type: ProjectSourceType.GIT,
        url: 'invalid-url'
      };

      await expect(downloader.download(source))
        .rejects
        .toThrow(DownloaderError);
    });
  });

  describe('cleanup', () => {
    it('should successfully cleanup downloaded repository', async () => {
      // Arrange
      const source: GitProjectSource = {
        type: ProjectSourceType.GIT,
        url: 'https://github.com/user/repo.git'
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
      const source: GitProjectSource = {
        type: ProjectSourceType.GIT,
        url: 'https://github.com/user/repo.git'
      };
      
      (rm as jest.Mock).mockRejectedValue(new Error('Cleanup failed'));
      
      const result = await downloader.download(source);

      // Act & Assert
      await expect(result.cleanup())
        .rejects
        .toThrow('Cleanup failed');
    });
  });

  describe('error handling', () => {
    // Test for console.error during cleanup failure
    it('should log cleanup errors during failed clone', async () => {
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
      const source: GitProjectSource = {
        type: ProjectSourceType.GIT,
        url: 'https://github.com/user/repo.git'
      };
      
      mockGit.clone.mockRejectedValue(new Error('Clone failed'));
      (rm as jest.Mock).mockRejectedValue(new Error('Cleanup failed'));

      await expect(downloader.download(source)).rejects.toThrow();
      expect(consoleSpy).toHaveBeenCalledWith(
        'Failed to cleanup after failed clone:',
        expect.any(Error)
      );
      
      consoleSpy.mockRestore();
    });

    // Test for invalid URL in addAuthToUrl
    it('should throw on invalid URL when adding auth', async () => {
      const source: GitProjectSource = {
        type: ProjectSourceType.GIT,
        url: 'invalid-url',
        auth: { token: 'token' }
      };

      await expect(downloader.download(source))
        .rejects
        .toThrow(DownloaderError);
    });

    it('should throw DownloaderError with correct code for invalid URL in auth handling', async () => {
      const source: GitProjectSource = {
        type: ProjectSourceType.GIT,
        url: 'git@github.com:user/repo.git', // SSH URL that will fail URL parsing
        auth: {
          token: 'token'
        }
      };

      await expect(downloader.download(source))
        .rejects
        .toMatchObject({
          message: 'Invalid Git URL',
          code: DownloaderErrorCodes.INVALID_SOURCE,
          sourceType: ProjectSourceType.GIT
        });
    });
  });

  describe('getCacheKey', () => {
    it('should generate cache key with commit hash', async () => {
      const source: GitProjectSource = {
        type: ProjectSourceType.GIT,
        url: 'https://github.com/user/repo.git',
        ref: 'main'
      };

      mockGit.revparse = jest.fn().mockResolvedValue('abcd1234');

      const key = await downloader.getCacheKey(source);
      expect(key).toBe('git:https://github.com/user/repo.git:main:abcd1234');
    });

    it('should handle failed hash lookup', async () => {
      const source: GitProjectSource = {
        type: ProjectSourceType.GIT,
        url: 'https://github.com/user/repo.git'
      };

      mockGit.revparse = jest.fn().mockRejectedValue(new Error('Hash lookup failed'));
      const dateSpy = jest.spyOn(Date, 'now').mockReturnValue(12345);

      const key = await downloader.getCacheKey(source);
      expect(key).toBe('git:https://github.com/user/repo.git:12345');

      dateSpy.mockRestore();
    });
  });
}); 