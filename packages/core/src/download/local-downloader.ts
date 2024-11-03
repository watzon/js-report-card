import { cp, access } from 'fs/promises';
import { tmpdir } from 'os';
import { join } from 'path';
import { v4 as uuidv4 } from 'uuid';
import { rm } from 'fs/promises';
import { stat } from 'fs/promises';

import { 
  IProjectDownloader, 
  ProjectSourceType,
  DownloadResult,
  LocalProjectSource,
  BaseProjectSource
} from '../types';
import { DownloaderError, DownloaderErrorCodes } from '../errors';

/**
 * Handles local filesystem projects by copying them to a temporary directory
 * 
 * This downloader is useful for:
 * - Local development and testing
 * - CI/CD environments where code is already checked out
 * - Processing already downloaded projects
 * 
 * @example
 * const downloader = new LocalDownloader();
 * const result = await downloader.download({
 *   type: ProjectSourceType.LOCAL,
 *   path: '/path/to/project'
 * });
 */
export class LocalDownloader implements IProjectDownloader {
  canHandle(source: BaseProjectSource): source is LocalProjectSource {
    return source.type === ProjectSourceType.LOCAL;
  }

  async download(source: LocalProjectSource): Promise<DownloadResult> {
    // Validate path
    if (!source.path?.trim()) {
      throw new DownloaderError(
        'Invalid path: Path cannot be empty',
        DownloaderErrorCodes.INVALID_SOURCE,
        source.type
      );
    }

    // Check if path exists
    try {
      await access(source.path);
    } catch (error) {
      throw new DownloaderError(
        `Path does not exist or is not accessible: ${source.path}`,
        DownloaderErrorCodes.INVALID_SOURCE,
        source.type,
        error
      );
    }

    const targetDir = join(tmpdir(), 'js-report-card', uuidv4());

    try {
      // Copy the directory
      await cp(source.path, targetDir, { recursive: true });

      return {
        path: targetDir,
        cleanup: async () => {
          await rm(targetDir, { recursive: true, force: true });
        },
      };
    } catch (error) {
      // Cleanup on failure
      try {
        await rm(targetDir, { recursive: true, force: true });
      } catch (cleanupError) {
        console.error('Failed to cleanup after failed copy:', cleanupError);
      }
      
      throw new DownloaderError(
        `Local copy failed: ${(error as Error).message}`,
        DownloaderErrorCodes.LOCAL_COPY_FAILED,
        source.type,
        error
      );
    }
  }

  async getCacheKey(source: LocalProjectSource): Promise<string> {
    try {
      const stats = await stat(source.path);
      return `local:${source.path}:${stats.mtime.getTime()}`;
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
    } catch (error) {
      return `local:${source.path}:${Date.now()}`;
      // TODO: log error
    }
  }
} 