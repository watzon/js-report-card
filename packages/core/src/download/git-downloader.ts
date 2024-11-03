import { simpleGit } from 'simple-git';
import { tmpdir } from 'os';
import { join } from 'path';
import { v4 as uuidv4 } from 'uuid';
import { rm } from 'fs/promises';

import { 
  IProjectDownloader, 
  ProjectSourceType,
  DownloadResult,
  GitProjectSource,
  BaseProjectSource
} from '../types';
import { DownloaderError, DownloaderErrorCodes } from '../errors';

/**
 * Downloads projects from Git repositories
 * 
 * Supports:
 * - HTTPS and SSH URLs
 * - Authentication via token or username
 * - Shallow cloning
 * - Specific branch/tag/commit checkout
 * 
 * @example
 * const downloader = new GitDownloader();
 * const result = await downloader.download({
 *   type: ProjectSourceType.GIT,
 *   url: 'https://github.com/user/repo.git',
 *   depth: 1,
 *   ref: 'main',
 *   auth: { token: 'github_pat_...' }
 * });
 */
export class GitDownloader implements IProjectDownloader {
  canHandle(source: BaseProjectSource): source is GitProjectSource {
    return source.type === ProjectSourceType.GIT;
  }

  async download(source: GitProjectSource): Promise<DownloadResult> {
    if (!this.isValidGitUrl(source.url)) {
      throw new DownloaderError(
        'Invalid Git URL',
        DownloaderErrorCodes.INVALID_SOURCE,
        source.type
      );
    }

    const targetDir = join(tmpdir(), 'js-report-card', uuidv4());
    const git = simpleGit();

    try {
      const cloneOptions = {
        '--depth': source.depth || 1,
      };

      let cloneUrl = source.url;
      if (source.auth) {
        cloneUrl = this.addAuthToUrl(source.url, source.auth);
      }

      await git.clone(cloneUrl, targetDir, cloneOptions);

      if (source.ref) {
        await git.cwd(targetDir).checkout(source.ref);
      }

      return {
        path: targetDir,
        cleanup: async () => {
          await rm(targetDir, { recursive: true, force: true });
        },
      };
    } catch (error) {
      // Ensure cleanup happens before throwing the error
      try {
        await rm(targetDir, { recursive: true, force: true });
      } catch (cleanupError) {
        console.error('Failed to cleanup after failed clone:', cleanupError);
      }
      
      throw new DownloaderError(
        `Git clone failed: ${(error as Error).message}`,
        DownloaderErrorCodes.GIT_CLONE_FAILED,
        source.type,
        error
      );
    }
  }

  private isValidGitUrl(url: string): boolean {
    try {
      const parsed = new URL(url);
      return parsed.protocol === 'https:' || parsed.protocol === 'git:' || parsed.protocol === 'ssh:';
    } catch {
      return false;
    }
  }

  private addAuthToUrl(url: string, auth: { username?: string; token?: string }): string {
    try {
      const parsed = new URL(url);
      if (auth.username && auth.token) {
        parsed.username = auth.username;
        parsed.password = auth.token;
      } else if (auth.token) {
        parsed.username = auth.token;
      }
      return parsed.toString();
    } catch {
      throw new DownloaderError(
        'Invalid Git URL',
        DownloaderErrorCodes.INVALID_SOURCE,
        ProjectSourceType.GIT
      );
    }
  }

  async getCacheKey(source: GitProjectSource): Promise<string> {
    const git = simpleGit();
    let key = `git:${source.url}`;

    if (source.ref) {
      key += `:${source.ref}`;
    }

    try {
      // Get the commit hash for the current ref
      const hash = await git.revparse(['HEAD']);
      key += `:${hash.trim()}`;
    } catch (error) {
      // If we can't get the hash, use a timestamp
      key += `:${Date.now()}`;
    }

    return key;
  }
} 