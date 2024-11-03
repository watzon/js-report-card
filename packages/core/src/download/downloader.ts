import { BaseProjectSource, DownloadResult, IProjectDownloader } from '../types';
import { DownloaderError, DownloaderErrorCodes } from '../errors';

/**
 * Main downloader service that orchestrates different download strategies
 * 
 * The ProjectDownloader manages a collection of IProjectDownloader implementations
 * and automatically selects the appropriate downloader for each source type.
 * 
 * Built-in downloaders include:
 * - GitDownloader: Clone git repositories
 * - NpmDownloader: Download and extract npm packages
 * - ZipDownloader: Download and extract zip archives
 * - LocalDownloader: Copy local directories
 * 
 * @example
 * ```typescript
 * const downloader = new ProjectDownloader();
 * 
 * // Register built-in downloaders
 * downloader.registerDownloader('git', new GitDownloader());
 * downloader.registerDownloader('npm', new NpmDownloader());
 * 
 * // Download a project
 * const result = await downloader.download({
 *   type: ProjectSourceType.GIT,
 *   url: 'https://github.com/user/repo.git'
 * });
 * 
 * try {
 *   // Use the downloaded project
 *   console.log(`Project downloaded to: ${result.path}`);
 * } finally {
 *   // Clean up temporary files
 *   await result.cleanup();
 * }
 * ```
 */
export class ProjectDownloader {
  private downloaders: Map<string, IProjectDownloader> = new Map();

  /**
   * Register a new downloader implementation
   * @param id Unique identifier for this downloader
   * @param downloader The downloader implementation
   */
  registerDownloader(id: string, downloader: IProjectDownloader): void {
    this.downloaders.set(id, downloader);
  }

  /**
   * Download a project using the appropriate downloader
   * @param source Configuration for where and how to download the project
   * @returns Promise resolving to the download result
   * @throws DownloaderError if no compatible downloader is found or download fails
   */
  async download(source: BaseProjectSource): Promise<DownloadResult> {
    // Handle null/undefined source
    if (!source) {
      throw new DownloaderError(
        'Invalid source: source cannot be null or undefined',
        DownloaderErrorCodes.INVALID_SOURCE,
        'unknown'
      );
    }

    // Handle invalid source type
    if (!source.type) {
      throw new DownloaderError(
        'Invalid source: missing source type',
        DownloaderErrorCodes.INVALID_SOURCE,
        'unknown'
      );
    }

    // Find compatible downloader
    for (const [, downloader] of this.downloaders) {
      if (downloader.canHandle(source)) {
        try {
          return await downloader.download(source);
        } catch (error) {
          // Wrap non-Error throws in a DownloaderError
          if (!(error instanceof Error)) {
            throw new DownloaderError(
              'Download failed with non-Error object',
              DownloaderErrorCodes.DOWNLOAD_FAILED,
              source.type,
              error
            );
          }
          throw error;
        }
      }
    }

    // No compatible downloader found
    throw new DownloaderError(
      'No compatible downloader found',
      DownloaderErrorCodes.DOWNLOADER_NOT_FOUND,
      source.type
    );
  }
} 