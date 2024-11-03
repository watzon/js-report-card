import { createWriteStream } from 'fs';
import { rm, mkdir } from 'fs/promises';
import { tmpdir } from 'os';
import { join } from 'path';
import { v4 as uuidv4 } from 'uuid';
import extract from 'extract-zip';
import { pipeline } from 'stream/promises';
import { ReadableStream } from 'node:stream/web';
import { Readable } from 'stream';

import { 
  IProjectDownloader, 
  ProjectSourceType,
  DownloadResult,
  ZipProjectSource,
  BaseProjectSource
} from '../types';
import { DownloaderError } from '../errors';

/**
 * Downloads and extracts ZIP archives
 * 
 * Supports:
 * - HTTP/HTTPS URLs
 * - Basic and token authentication
 * - Automatic cleanup
 * - Progress tracking
 * 
 * @example
 * const downloader = new ZipDownloader();
 * const result = await downloader.download({
 *   type: ProjectSourceType.ZIP,
 *   url: 'https://example.com/project.zip',
 *   auth: { token: 'access_token' }
 * });
 */
export class ZipDownloader implements IProjectDownloader {
  canHandle(source: BaseProjectSource): source is ZipProjectSource {
    return source.type === ProjectSourceType.ZIP;
  }

  async download(source: ZipProjectSource): Promise<DownloadResult> {
    const targetDir = join(tmpdir(), 'js-report-card', uuidv4());
    const zipPath = join(targetDir, 'download.zip');

    try {
      // Create target directory
      await rm(targetDir, { recursive: true, force: true }).catch(() => {});
      await mkdir(targetDir, { recursive: true });
      
      // Download the zip file
      const response = await this.fetchWithAuth(source);
      if (!response.ok) {
        throw new Error(`Failed to download: ${response.statusText}`);
      }
      
      if (!response.body) {
        throw new Error('No response body received');
      }

      // Convert Web ReadableStream to Node Readable
      const nodeReadable = Readable.fromWeb(response.body as ReadableStream);

      // Save the zip file
      await pipeline(
        nodeReadable,
        createWriteStream(zipPath)
      );

      // Extract the zip file
      await extract(zipPath, { dir: targetDir });
      
      // Remove the zip file
      await rm(zipPath);

      return {
        path: targetDir,
        cleanup: async () => {
          await rm(targetDir, { recursive: true, force: true });
        },
      };
    } catch (error) {
      try {
        await rm(targetDir, { recursive: true, force: true });
      } catch (cleanupError) {
        console.error('Failed to cleanup after failed zip extraction:', cleanupError);
      }
      
      throw new DownloaderError(
        `Zip download/extraction failed: ${(error as Error).message}`,
        'ZIP_DOWNLOAD_FAILED',
        source.type
      );
    }
  }

  private async fetchWithAuth(source: ZipProjectSource): Promise<Response> {
    const headers: Record<string, string> = {};
    
    if (source.auth) {
      if (source.auth.username && source.auth.token) {
        // If both username and token are provided, use Basic auth
        const auth = Buffer.from(
          `${source.auth.username}:${source.auth.token}`
        ).toString('base64');
        headers['Authorization'] = `Basic ${auth}`;
      } else if (source.auth.token) {
        // If only token is provided, use Bearer auth
        headers['Authorization'] = `Bearer ${source.auth.token}`;
      }
    }

    return fetch(source.url, { headers });
  }
} 