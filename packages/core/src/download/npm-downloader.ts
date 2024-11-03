import { tmpdir } from 'os';
import { join } from 'path';
import { v4 as uuidv4 } from 'uuid';
import { rm, mkdir } from 'fs/promises';
import { exec } from 'child_process';
import { promisify } from 'util';

import { 
  IProjectDownloader, 
  ProjectSourceType,
  DownloadResult,
  NpmProjectSource,
  BaseProjectSource
} from '../types';
import { DownloaderError } from '../errors';

const execAsync = promisify(exec);

/**
 * Downloads and extracts npm packages
 * 
 * Features:
 * - Downloads specific versions
 * - Uses npm pack for reliable downloads
 * - Handles scoped packages
 * - Extracts tarball automatically
 * 
 * @example
 * const downloader = new NpmDownloader();
 * const result = await downloader.download({
 *   type: ProjectSourceType.NPM,
 *   packageName: '@types/node',
 *   version: '18.0.0'
 * });
 */
export class NpmDownloader implements IProjectDownloader {
  canHandle(source: BaseProjectSource): source is NpmProjectSource {
    return source.type === ProjectSourceType.NPM;
  }

  async download(source: NpmProjectSource): Promise<DownloadResult> {
    const targetDir = join(tmpdir(), 'js-report-card', uuidv4());

    try {
      // Create target directory
      await rm(targetDir, { recursive: true, force: true }).catch(() => {});
      await mkdir(targetDir, { recursive: true });

      // Construct the package identifier
      const packageId = source.version 
        ? `${source.packageName}@${source.version}`
        : source.packageName;

      // Use npm pack to download the package
      const { stdout } = await execAsync(`npm pack ${packageId} --pack-destination "${targetDir}"`);
      const tarballName = stdout.trim();
      const tarballPath = join(targetDir, tarballName);

      // Extract the tarball
      await execAsync(`tar -xzf "${tarballPath}" -C "${targetDir}"`);
      
      // Remove the tarball
      await rm(tarballPath);

      // The extracted contents will be in a 'package' directory
      const extractedPath = join(targetDir, 'package');

      return {
        path: extractedPath,
        cleanup: async () => {
          await rm(targetDir, { recursive: true, force: true });
        },
      };
    } catch (error) {
      try {
        await rm(targetDir, { recursive: true, force: true });
      } catch (cleanupError) {
        console.error('Failed to cleanup after failed npm download:', cleanupError);
      }
      
      throw new DownloaderError(
        `NPM download failed: ${(error as Error).message}`,
        'NPM_DOWNLOAD_FAILED',
        source.type
      );
    }
  }

  async getCacheKey(source: NpmProjectSource): Promise<string> {
    try {
      // If no version specified, get the latest version
      if (!source.version) {
        const { stdout } = await execAsync(`npm view ${source.packageName} version`);
        source.version = stdout.trim();
      }
      
      return `npm:${source.packageName}:${source.version}`;
    } catch (error) {
      // If npm view fails, use package name and timestamp
      return `npm:${source.packageName}:${Date.now()}`;
    }
  }
} 