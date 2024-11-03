import { rm, mkdir } from 'fs/promises';
import { createWriteStream } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import { ReadableStream } from 'node:stream/web';
import { Writable } from 'stream';
import extract from 'extract-zip';
import { pipeline } from 'stream/promises';

import { ZipDownloader } from '../../download/zip-downloader';
import { ZipProjectSource, GitProjectSource, ProjectSourceType } from '../../types';
import { DownloaderError } from '../../errors';

// Mock dependencies
jest.mock('fs/promises');
jest.mock('fs', () => ({
  createWriteStream: jest.fn().mockReturnValue(new Writable({
    write(chunk, encoding, callback) {
      callback();
    }
  }))
}));
jest.mock('path');
jest.mock('os');
jest.mock('extract-zip');
jest.mock('stream/promises');

describe('ZipDownloader', () => {
  let downloader: ZipDownloader;
  
  const createMockResponse = () => ({
    ok: true,
    statusText: 'OK',
    body: new ReadableStream({
      start(controller) {
        controller.enqueue(Buffer.from('mock zip content'));
        controller.close();
      }
    }),
  });

  beforeEach(() => {
    jest.clearAllMocks();
    
    (tmpdir as jest.Mock).mockReturnValue('/tmp');
    (join as jest.Mock).mockImplementation((...args) => args.join('/'));
    (rm as jest.Mock).mockResolvedValue(undefined);
    (mkdir as jest.Mock).mockResolvedValue(undefined);
    (extract as jest.Mock).mockResolvedValue(undefined);
    (pipeline as jest.Mock).mockResolvedValue(undefined);
    
    // Mock global fetch
    global.fetch = jest.fn().mockImplementation(() => Promise.resolve(createMockResponse()));
    
    downloader = new ZipDownloader();
  });

  describe('canHandle', () => {
    it('should return true for zip sources', () => {
      const source: ZipProjectSource = {
        type: ProjectSourceType.ZIP,
        url: 'https://example.com/project.zip'
      };
      
      expect(downloader.canHandle(source)).toBe(true);
    });

    it('should return false for non-zip sources', () => {
      const source: GitProjectSource = {
        type: ProjectSourceType.GIT,
        url: 'https://github.com/user/repo.git'
      };
      
      expect(downloader.canHandle(source)).toBe(false);
    });
  });

  describe('download', () => {
    it('should successfully download and extract a zip file', async () => {
      // Arrange
      const source: ZipProjectSource = {
        type: ProjectSourceType.ZIP,
        url: 'https://example.com/project.zip'
      };

      // Act
      const result = await downloader.download(source);

      // Assert
      expect(global.fetch).toHaveBeenCalledWith(source.url, { headers: {} });
      expect(pipeline).toHaveBeenCalled();
      expect(extract).toHaveBeenCalledWith(
        expect.stringContaining('download.zip'),
        expect.any(Object)
      );
      expect(result.path).toContain('/tmp/js-report-card');
      expect(result.cleanup).toBeInstanceOf(Function);
    });

    it('should handle authentication with token', async () => {
      // Arrange
      const source: ZipProjectSource = {
        type: ProjectSourceType.ZIP,
        url: 'https://example.com/project.zip',
        auth: {
          token: 'secret-token'
        }
      };

      // Act
      await downloader.download(source);

      // Assert
      expect(global.fetch).toHaveBeenCalledWith(source.url, {
        headers: {
          'Authorization': 'Bearer secret-token'
        }
      });
    });

    it('should throw DownloaderError on download failure', async () => {
      // Arrange
      const source: ZipProjectSource = {
        type: ProjectSourceType.ZIP,
        url: 'https://example.com/project.zip'
      };
      
      global.fetch = jest.fn().mockResolvedValue({
        ...createMockResponse(),
        ok: false,
        statusText: 'Not Found'
      });

      // Act & Assert
      await expect(downloader.download(source))
        .rejects
        .toThrow(DownloaderError);
    });

    it('should cleanup directory on failure', async () => {
      // Arrange
      const source: ZipProjectSource = {
        type: ProjectSourceType.ZIP,
        url: 'https://example.com/project.zip'
      };
      
      (extract as jest.Mock).mockRejectedValue(new Error('Extract failed'));

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
    it('should successfully cleanup extracted directory', async () => {
      // Arrange
      const source: ZipProjectSource = {
        type: ProjectSourceType.ZIP,
        url: 'https://example.com/project.zip'
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
      const source: ZipProjectSource = {
        type: ProjectSourceType.ZIP,
        url: 'https://example.com/project.zip'
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