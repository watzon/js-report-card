// Copyright (c) 2024 Christopher Watson
// 
// This software is released under the MIT License.
// https://opensource.org/licenses/MIT

// Project Source Types
export enum ProjectSourceType {
    GIT = 'git',
    LOCAL = 'local',
    ZIP = 'zip',
    NPM = 'npm',
}

export interface BaseProjectSource {
    type: ProjectSourceType;
    cacheEnabled?: boolean;
}

export interface GitProjectSource extends BaseProjectSource {
    type: ProjectSourceType.GIT;
    url: string;
    ref?: string;
    depth?: number;
    auth?: {
        username?: string;
        token?: string;
    };
}

export interface LocalProjectSource extends BaseProjectSource {
    type: ProjectSourceType.LOCAL;
    path: string;
}

export interface ZipProjectSource extends BaseProjectSource {
    type: ProjectSourceType.ZIP;
    url: string;
    auth?: {
        username?: string;
        token?: string;
    };
}

export interface NpmProjectSource extends BaseProjectSource {
    type: ProjectSourceType.NPM;
    packageName: string;
    version?: string;
}

export interface DownloadResult {
    path: string;
    cleanup: () => Promise<void>;
    /** Metadata for caching (e.g. git commit hash, npm version) */
    metadata?: {
        version: string;
        additionalInfo?: Record<string, unknown>;
        type: ProjectSourceType;
    };
}

/**
 * Interface for project downloaders
 * 
 * Downloaders are responsible for retrieving project source code from various locations
 * and making it available locally for analysis. Each downloader handles a specific
 * source type (git, npm, zip, local filesystem, etc).
 * 
 * @example
 * ```typescript
 * class GitDownloader implements IProjectDownloader {
 *   canHandle(source: BaseProjectSource): source is GitProjectSource {
 *     return source.type === ProjectSourceType.GIT;
 *   }
 *   
 *   async download(source: GitProjectSource): Promise<DownloadResult> {
 *     // Download implementation
 *   }
 * }
 * ```
 */
export interface IProjectDownloader {
    /**
     * Checks if this downloader can handle the given source type
     * @param source The project source configuration to check
     * @returns Type guard indicating if this downloader can handle the source
     */
    canHandle(source: BaseProjectSource): boolean;

    /**
     * Downloads the project from the source
     * @param source Configuration for where and how to download the project
     * @returns Promise resolving to the download result containing path and cleanup function
     * @throws DownloaderError if download fails
     */
    download(source: BaseProjectSource): Promise<DownloadResult>;

    /**
     * Validates the source configuration before attempting download
     * @param source The source configuration to validate
     * @throws DownloaderError if configuration is invalid
     */
    validateSource?(source: BaseProjectSource): Promise<void>;

    /**
     * Generates a unique cache key for the source
     * Used to determine if a project needs to be re-downloaded
     * @param source The source to generate a key for
     * @returns A string that uniquely identifies this version of the source
     */
    getCacheKey?(source: BaseProjectSource): Promise<string>;

    /**
     * Cleans up any resources used by the downloader
     * Called when the downloader is no longer needed
     */
    cleanup?(): Promise<void>;
}

// Analysis Types
/**
 * Severity levels for analysis issues
 */
export enum IssueSeverity {
    /** Critical problems that must be fixed */
    ERROR = 'error',
    /** Potential problems or code smells */
    WARNING = 'warning',
    /** Suggestions for improvement */
    INFO = 'info',
}

/**
 * Represents a single issue found during analysis
 */
export interface AnalysisIssue {
    /** The severity level of the issue */
    severity: IssueSeverity;
    /** Human-readable description of the issue */
    message: string;
    /** The rule that triggered this issue */
    rule: string;
    /** Path to the file containing the issue */
    file: string;
    /** Line number where the issue was found (1-based) */
    line: number;
    /** Column number where the issue was found (1-based) */
    column: number;
    /** Optional source code snippet showing the issue */
    source?: string;
    /** Optional suggestion for fixing the issue */
    suggestion?: string;
}

/**
 * Configuration options for an analyzer
 */
export interface AnalyzerConfig {
    /** Whether the analyzer is enabled */
    enabled: boolean;
    /** Optional rule-specific configuration */
    rules?: Record<string, unknown>;
    /** Glob patterns for files to include */
    include?: string[];
    /** Glob patterns for files to exclude */
    exclude?: string[];
}

/**
 * Result of running an analyzer
 */
export interface AnalyzerResult {
    /** ID of the analyzer that produced this result */
    analyzerId: string;
    /** Overall score (0-100) */
    score: number;
    /** List of issues found */
    issues: AnalysisIssue[];
    /** Optional additional data from the analysis */
    metadata?: Record<string, unknown>;
}

/**
 * Context provided to analyzers during analysis
 */
export interface AnalysisContext {
    /** Root directory of the project being analyzed */
    projectRoot: string;
    /** List of files to analyze */
    files: string[];
    /** Configuration for this analyzer */
    config: AnalyzerConfig;
    /** Optional cache for analyzer results */
    cache?: AnalysisCache;
    /** Download result for the project */
    downloadResult?: DownloadResult;
}

/**
 * Interface that all analyzers must implement
 */
export interface IAnalyzer {
    /** Unique identifier for this analyzer */
    readonly id: string;
    /** Human-readable name */
    readonly name: string;
    /** Description of what this analyzer does */
    readonly description: string;
    
    /**
     * Analyze the project and return results
     * @param context Analysis context including project info and configuration
     * @returns Analysis results including score and issues
     * @throws AnalyzerError if analysis fails
     */
    analyze(context: AnalysisContext): Promise<AnalyzerResult>;

    /**
     * Validate analyzer-specific configuration
     * @param config Configuration object to validate
     * @throws AnalyzerError if configuration is invalid
     */
    validateConfig(config: unknown): Promise<void>;

    /**
     * Clean up any resources used by the analyzer
     */
    cleanup(): Promise<void>;
}

export interface AnalysisCache {
    get(key: string): Promise<unknown | null>;
    set(key: string, value: unknown): Promise<void>;
    invalidate(key: string): Promise<void>;
}

export interface ProjectAnalysisResult {
    projectId: string;
    grade: string;
    score: number;
    analyzers: AnalyzerResult[];
    timestamp: string;
    duration: number;
}

// Error Types
export class AnalyzerError extends Error {
    constructor(
        message: string,
        public readonly analyzerId: string,
        public readonly code: string,
    ) {
        super(message);
        this.name = 'AnalyzerError';
    }
}