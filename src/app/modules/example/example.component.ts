// =====================================
// src/app/modules/admin/example/example.component.ts
// =====================================
import { CommonModule, DatePipe } from '@angular/common';
import {
    ChangeDetectorRef,
    Component,
    inject,
    NgZone,
    OnDestroy,
    OnInit,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { lastValueFrom, map, Subscription } from 'rxjs';

// --- Codemirror ---
import { CodemirrorModule } from '@ctrl/ngx-codemirror';
import * as CodeMirror from 'codemirror';
// Required CodeMirror modes (Ensure necessary modes are imported if not done globally)
// Example: import 'codemirror/mode/javascript/javascript';
// Example: import 'codemirror/mode/markdown/markdown';
// ... add other modes as needed

// --- Buffer Polyfill ---
import { Buffer } from 'buffer';

// Isomorphic Git and related imports
import FS from '@isomorphic-git/lightning-fs';
import * as git from 'isomorphic-git';
// Import specific types for better clarity and type checking
import { MatDialog } from '@angular/material/dialog';
import { HighlightDirective } from '@shared/highlight.directive';
import type {
    CommitObject,
    PushResult,
    ReadObjectResult,
} from 'isomorphic-git';
import http from 'isomorphic-git/http/web';
import { ProjectService } from '../admin/dashboards/project/project.service';
import {
    CommitDialogComponent,
    CommitDialogData,
} from './commit-dialog/commit-dialog.component';
import { CommitDiffViewerComponent } from './commit-diff-viewer/commit-diff-viewer.component';
import {
    ExampleService,
    GenerateCommitResponse,
    GithubApiRepo,
} from './example.service';
import { MergeRequestComponent } from './merge-request/merge-request.component';
import { PickGroupComponent } from './pick-group/pick-group.component';

// --- Interfaces ---
interface TreeNode {
    name: string;
    path: string;
    isDirectory: boolean;
    children?: TreeNode[];
    expanded?: boolean;
}
interface SelectedFile {
    path: string;
    content: string | null;
    originalContent: string | null;
    isDirty: boolean;
    isLoading: boolean;
    error?: string;
}
interface RepositoryInfo {
    id: number;
    name: string;
    fullName: string;
    url: string;
    localPath: string;
}

interface GitLogEntry {
    oid: string;
    commit: CommitObject; // Use imported CommitObject type
    payload: string;
}

// --- Constants ---
// Status indices in the matrix row tuple returned by git.statusMatrix
const filepathIdx = 0;
const headStatusIdx = 1;
const workdirStatusIdx = 2;
const stageStatusIdx = 3;

// Git status codes (from isomorphic-git documentation/source)
const GIT_STATUS = {
    ABSENT: 0, // Represents the absence of the file path.
    ADDED: 1, // Represents the addition of the file path.
    DELETED: 2, // Represents the deletion of the file path.
    MODIFIED: 3, // Represents the modification of the file path.
} as const; // Use 'as const' for stricter typing

// Helper type for status codes if needed, derived from GIT_STATUS values
type GitStatusCode = (typeof GIT_STATUS)[keyof typeof GIT_STATUS];

@Component({
    selector: 'example',
    standalone: true,
    imports: [
        FormsModule,
        CommonModule,
        CodemirrorModule,
        DatePipe,
        MergeRequestComponent,
        CommitDiffViewerComponent
    ],
    templateUrl: './example.component.html',
    providers: [DatePipe],
})
export class ExampleComponent implements OnInit, OnDestroy {
    private readonly exampleService = inject(ExampleService);
    private readonly _repoService = inject(ProjectService);
    private readonly matDialog = inject(MatDialog);
    // *** CORRECTION: _cdRef might not be needed if we remove explicit calls, but keep for now if other uses exist ***
    private _cdRef = inject(ChangeDetectorRef);
    private _ngZone = inject(NgZone);
    private datePipe = inject(DatePipe);
    private tokenSubscription: Subscription | null = null;
    private githubApiSubscription: Subscription | null = null;

    // --- State Variables ---
    githubAccessToken: string | null = null;
    githubRepoList: GithubApiRepo[] | null = null;
    managedRepositories: RepositoryInfo[] = [];
    activeRepository: RepositoryInfo | null = null;
    isFetchingRepos = false;
    readonly localStorageManagedReposKey = 'gitBrowser_managedRepos';
    fs!: FS;
    dir: string = '';
    corsProxy = 'https://cors.isomorphic-git.org';
    localGitServerBaseUrl: string = 'http://localhost:8082';
    output: string[] = [];
    isLoading = false;
    isProcessingTree = false;
    cloneDone = false;
    repositoryTree: TreeNode[] = [];
    selectedFile: SelectedFile | null = null;
    isSavingFile = false;
    cmOptions: CodeMirror.EditorConfiguration = {
        lineNumbers: true,
        theme: 'material',
        mode: 'javascript',
        readOnly: false,
    };

    // --- Commit History State ---
    commitHistory: GitLogEntry[] = [];
    selectedCommit: GitLogEntry | null = null;
    isLoadingHistory: boolean = false;
    historyError: string | null = null;
    readonly historyDepth = 50; // --- Branch Management State ---
    localBranches: string[] = [];
    remoteBranches: string[] = [];
    currentBranch: string | null = null;
    newBranchName: string = '';
    isSwitchingBranch: boolean = false;
    isCreatingBranch: boolean = false;
    branchError: string | null = null;

    // --- Clone Branch Selection State ---
    availableRemoteBranches: string[] = [];
    selectedCloneBranch: string = '';
    isLoadingRemoteBranches: boolean = false;
    cloneBranchError: string | null = null;

    // --- Merge Request & Diff Viewer State ---
    showMergeRequest: boolean = false;
    showCommitDiff: boolean = false;

    constructor() {
        this._injectBufferPolyfill();
        this._loadManagedRepos();
        this._initializeFilesystem();
        // Fetch token *after* basic setup, potentially in ngOnInit if FS init is async
        // Or ensure setLoading doesn't call detectChanges during this initial call.
        this.fetchGithubAccessToken();
    }

    ngOnInit(): void {
        if (this.fs && this.activeRepository) {
            // Use NgZone run if checkIfRepoExists modifies state that needs immediate reflection
            // although it's likely okay as it's called from ngOnInit
            this.checkIfRepoExists();
        }
    }

    ngOnDestroy(): void {
        this.tokenSubscription?.unsubscribe();
        this.githubApiSubscription?.unsubscribe();
    }

    // --- Initialization & State Loading ---
    private _injectBufferPolyfill(): void {
        if (typeof (window as any).Buffer === 'undefined') {
            (window as any).Buffer = Buffer;
        }
    }

    private _initializeFilesystem(): void {
        try {
            this.fs = new FS('my-git-fs');
            this.addOutput('Filesystem initialized.');
        } catch (fsError: any) {
            this.addOutput(
                `FATAL: Failed to initialize Filesystem: ${fsError.message || fsError}`,
                'error'
            );
        }
    }

    private _loadManagedRepos(): void {
        try {
            const storedRepos = localStorage.getItem(
                this.localStorageManagedReposKey
            );
            if (storedRepos) {
                this.managedRepositories = JSON.parse(storedRepos);
                this.addOutput(
                    `Loaded ${this.managedRepositories.length} managed repositories from localStorage.`
                );
            }
        } catch (e) {
            this.addOutput(
                'Error loading managed repositories from storage.',
                'error'
            );
            localStorage.removeItem(this.localStorageManagedReposKey);
            this.managedRepositories = [];
        }
    }

    private _saveManagedRepos(): void {
        try {
            localStorage.setItem(
                this.localStorageManagedReposKey,
                JSON.stringify(this.managedRepositories)
            );
        } catch (e) {
            this.addOutput(
                'Error saving managed repositories to storage.',
                'error'
            );
        }
    }

    async pushChangesToLocal(): Promise<void> {
        // --- Pre-conditions (mostly remain the same) ---
        if (
            !this.activeRepository ||
            !this.cloneDone ||
            this.isLoading ||
            !this.fs
        ) {
            this.addOutput(
                'Push pre-conditions not met. Ensure a repository is active, cloned, and no operations are ongoing.',
                'warn'
            );
            return;
        }
        if (this.selectedCommit) {
            this.addOutput(
                'Cannot push while viewing history. Please switch back to the current branch.',
                'warn'
            );
            return;
        }
        if (this.selectedFile?.isDirty) {
            this.addOutput(
                'Cannot push: Unsaved changes exist. Please save or discard changes.',
                'warn'
            );
            return;
        }

        // --- Construct the Push URL for your local JGit server ---
        const repoName = this.activeRepository.name;
        if (!repoName) {
            this.addOutput(
                'Repository name is missing. Cannot construct push URL.',
                'error'
            );
            return;
        }

        const localPushUrl = `${this.localGitServerBaseUrl}/git/${repoName}.git`;
        this.addOutput(`Targeting local Git server at: ${localPushUrl}`);

        // --- Determine the correct corsProxy to use ---
        // Initialize with null to explicitly indicate no proxy by default.
        let effectiveCorsProxy: string | null = null;

        // Check if the URL is a local one (localhost or 127.0.0.1)
        const isLocalUrl =
            localPushUrl.includes('localhost') ||
            localPushUrl.includes('127.0.0.1');

        if (isLocalUrl) {
            // For local URLs, we want a direct connection.
            // `null` explicitly tells isomorphic-git NOT to use any proxy,
            // allowing the browser to attempt the direct cross-origin request.
            this.addOutput(
                `Directly connecting to local Git server (no public CORS proxy).`
            );
            effectiveCorsProxy = null; // Explicitly set to null
        } else {
            // For non-local URLs (e.g., external GitHub remotes), use the configured public proxy.
            // Assuming 'this.corsProxy' holds a value like 'https://cors.isomorphic-git.org'
            effectiveCorsProxy = this.corsProxy;
            this.addOutput(`Using public CORS proxy: ${effectiveCorsProxy}`);
        }

        this.setLoading(
            true,
            `Pushing to local server (${this.activeRepository.name})`
        );
        this.addOutput('Attempting to push changes to local JGit server...');

        try {
            const currentBranchName = await git.currentBranch({
                fs: this.fs,
                dir: this.dir,
            });
            if (!currentBranchName)
                throw new Error('Cannot push from detached HEAD state.');

            this.addOutput(
                `Pushing local branch '${currentBranchName}' to remote 'origin' (${localPushUrl})...`
            );

            // No authentication for basic JGit server setup, or configure as needed
            const auth = {};

            const pushOptions = {
                fs: this.fs,
                http: http, // Ensure 'http' is imported from 'isomorphic-git/http/web'
                dir: this.dir,
                url: localPushUrl,
                ref: currentBranchName,
                remote: 'origin',
                onAuth: () => auth,
                corsProxy: effectiveCorsProxy, // Use the determined value (null or proxy URL)
                onMessage: (m) =>
                    this._ngZone.run(() =>
                        this.addOutput(`Remote: ${m.trim()}`)
                    ),
            };

            const result: git.PushResult = await git.push(pushOptions);

            // --- Success Handling ---
            if (result.ok) {
                this.addOutput(`Successfully pushed changes to local server!`);
                this.openPickGroupDialog(repoName);
                // Additional success logic, e.g., refreshing status, updating UI
                // Assuming result.updates might contain information about pushed refs
                // The PushResult type does not have an 'updates' property.
                // Log the raw result for debugging or handle as needed.
                this.addOutput(`Push result: ${JSON.stringify(result)}`);
                // Trigger a refresh of the repository status after push
            } else {
                // Handle cases where push.ok is false but no error was thrown
                // (e.g., non-fast-forward push that isomorphic-git might not throw for by default)
                let errorMessage = 'Push operation completed with issues.';
                if (result.error) {
                    errorMessage += ` Error: ${result.error || result.error}`;
                }
                this.addOutput(errorMessage, 'error');
                console.error('Push result error:', result);
            }
        } catch (error: any) {
            // --- Error Handling ---
            this.addOutput(
                `Push operation to local server failed: ${error.message || error}`,
                'error'
            );
            console.error('Push error to local server:', error);
            // Provide more user-friendly messages for common errors
            if (error.message.includes('403')) {
                this.addOutput(
                    'Possible CORS issue or server authorization problem. Check your server logs and CORS configuration.',
                    'error'
                );
            } else if (error.message.includes('401')) {
                this.addOutput(
                    'Authentication required or failed for the Git server.',
                    'error'
                );
            } else if (error.message.includes('NetworkError')) {
                this.addOutput(
                    'Network connection issue or server is unreachable. Ensure the local Git server is running.',
                    'error'
                );
            }
        } finally {
            this.setLoading(false, `Push (${this.activeRepository?.name})`);
        }
    }

    // --- Authentication ---
    fetchGithubAccessToken(): void {
        // Avoid fetching if already loading *or* if token already exists (unless forced)
        if (this.isLoading || this.githubAccessToken) {
            if (this.isLoading)
                this.addOutput('Token fetch already in progress.');
            // If token exists, maybe don't fetch automatically? Or add a force option.
            // For now, allow re-fetching if not loading.
            if (this.githubAccessToken && !this.isLoading) {
                this.addOutput(
                    'Token already exists. Use "Fetch My GitHub Repos" if needed.'
                );
                // If repo list is empty, fetch it now
                if (!this.githubRepoList || this.githubRepoList.length === 0) {
                    this.fetchGithubRepos();
                }
                return;
            }
            if (this.isLoading) return; // Explicitly return if loading
        }

        this.addOutput('Attempting to fetch GitHub access token...');
        this.setLoading(true, 'Fetch Token'); // This call was problematic during construction
        this.tokenSubscription?.unsubscribe();

        this.tokenSubscription = this.exampleService
            .getGithubAccessToken()
            .subscribe({
                next: (token) => {
                    // Run state updates within NgZone
                    this._ngZone.run(() => {
                        this.githubAccessToken = token || null;
                        if (token) {
                            this.addOutput(
                                'GitHub access token obtained successfully.'
                            );
                            // Fetch repos only if token is newly obtained and list is empty/null
                            if (!this.githubRepoList) {
                                this.fetchGithubRepos(); // fetchGithubRepos handles its own loading state
                            }
                        } else {
                            this.addOutput(
                                'Could not retrieve GitHub access token.',
                                'warn'
                            );
                        }
                        this.setLoading(false, 'Fetch Token');
                    });
                },
                error: (error) => {
                    // Run state updates within NgZone
                    this._ngZone.run(() => {
                        this.githubAccessToken = null;
                        this.addOutput(
                            'Failed to fetch GitHub access token.',
                            'error'
                        );
                        console.error('Token fetch error:', error);
                        this.setLoading(false, 'Fetch Token');
                    });
                },
            });
    }

    getFileExtension(filename: string): string | null {
        if (!filename) {
            return null;
        }
        const lastDotIndex = filename.lastIndexOf('.');
        return lastDotIndex > -1 ? filename.substring(lastDotIndex + 1) : null;
    }

    // --- GitHub Repo Fetching ---
    fetchGithubRepos(): void {
        if (!this.githubAccessToken) {
            this.addOutput(
                'Cannot fetch repos: GitHub access token is missing.',
                'error'
            );
            // Don't automatically call fetch token here, let the user click the button
            // this.fetchGithubAccessToken();
            return;
        }
        if (this.isFetchingRepos) return;

        this.addOutput('Fetching your repositories from GitHub...');
        // Use NgZone for state updates triggered by the async operation
        this._ngZone.run(() => {
            this.isFetchingRepos = true;
            this.githubRepoList = null; // Clear previous list while fetching
        });
        this.githubApiSubscription?.unsubscribe();

        this.githubApiSubscription = this.exampleService
            .fetchGithubRepositories(this.githubAccessToken)
            .subscribe({
                next: (repos) => {
                    // Run state updates within NgZone
                    this._ngZone.run(() => {
                        this.githubRepoList = repos;
                        this.addOutput(
                            `Fetched ${repos.length} repositories from GitHub.`
                        );
                        this.isFetchingRepos = false;
                        // No need for detectChanges here, NgZone handles it
                    });
                },
                error: (err) => {
                    // Run state updates within NgZone
                    this._ngZone.run(() => {
                        this.addOutput(
                            'Failed to fetch repositories from GitHub API.',
                            'error'
                        );
                        console.error('Repo fetch error:', err);
                        if (err?.status === 401) {
                            this.addOutput(
                                'Authentication error (401) fetching repos. Token might be invalid.',
                                'error'
                            );
                            this.githubAccessToken = null; // Assume token is invalid
                        }
                        this.isFetchingRepos = false;
                        this.githubRepoList = []; // Reset or indicate error state
                        // No need for detectChanges here, NgZone handles it
                    });
                },
            });
    }

    // --- Managed Repositories Logic ---
    addRepoToManaged(repo: GithubApiRepo): void {
        if (this.managedRepositories.some((r) => r.id === repo.id)) {
            this.addOutput(
                `Repository "${repo.full_name}" is already managed.`,
                'warn'
            );
            return;
        }
        const localPath = `/repo/${repo.id}`; // Using ID for path uniqueness
        const newRepoInfo: RepositoryInfo = {
            id: repo.id,
            name: repo.name,
            fullName: repo.full_name,
            url: repo.clone_url, // Use clone_url for cloning
            localPath: localPath,
        };
        // Use NgZone if this action needs immediate UI update beyond simple logging
        this._ngZone.run(() => {
            this.managedRepositories.push(newRepoInfo);
            this._saveManagedRepos();
            this.addOutput(`Added "${repo.full_name}" to managed list.`, 'log');
        });
    }

    async removeManagedRepo(repoToRemove: RepositoryInfo): Promise<void> {
        if (this.isBusy) {
            this.addOutput(
                `Cannot remove repository while operation in progress.`,
                'warn'
            );
            return;
        }
        const confirmation = confirm(
            `Are you sure you want to remove the LOCAL COPY of "${repoToRemove.fullName}"? This will delete the directory ${repoToRemove.localPath} in the browser's filesystem and cannot be undone.`
        );
        if (!confirmation) return;

        this.addOutput(`Removing local copy of "${repoToRemove.fullName}"...`);
        this.setLoading(true, `Remove Local (${repoToRemove.name})`);

        try {
            const pathExists = await this.fs.promises
                .stat(repoToRemove.localPath)
                .then(() => true)
                .catch((e) => {
                    if (e.code === 'ENOENT') return false;
                    throw e;
                });

            if (pathExists) {
                await this.deleteDirectoryRecursive(repoToRemove.localPath);
                this.addOutput(
                    `Successfully removed directory: ${repoToRemove.localPath}`
                );
            } else {
                this.addOutput(
                    `Directory ${repoToRemove.localPath} not found locally. Removing from managed list only.`,
                    'warn'
                );
            }

            // Update managed list and save (within NgZone for UI update)
            this._ngZone.run(() => {
                this.managedRepositories = this.managedRepositories.filter(
                    (r) => r.id !== repoToRemove.id
                );
                this._saveManagedRepos();
                this.addOutput(
                    `"${repoToRemove.fullName}" removed from managed list.`
                );

                // If the removed repo was active, deactivate it
                if (this.activeRepository?.id === repoToRemove.id) {
                    this.setActiveRepository(null); // setActiveRepository handles its own UI updates
                }
            });
        } catch (error: any) {
            // Log error within NgZone if addOutput needs it, otherwise log directly
            this.addOutput(
                `Error removing repository directory ${repoToRemove.localPath}: ${error.message || error}`,
                'error'
            );
            console.error('Remove repo error:', error);
        } finally {
            // setLoading handles its own NgZone
            this.setLoading(false, `Remove Local (${repoToRemove.name})`);
        }
    }

    // Recursive directory deletion helper - No UI updates needed here directly
    private async deleteDirectoryRecursive(dirPath: string): Promise<void> {
        try {
            const entries = await this.fs.promises.readdir(dirPath);
            for (const entry of entries) {
                const fullPath = `${dirPath}/${entry}`;
                const stats = await this.fs.promises.lstat(fullPath);
                if (stats.isDirectory()) {
                    await this.deleteDirectoryRecursive(fullPath);
                } else {
                    await this.fs.promises.unlink(fullPath);
                }
            }
            await this.fs.promises.rmdir(dirPath);
        } catch (error: any) {
            if (error.code !== 'ENOENT') {
                this.addOutput(
                    `Warning: Could not fully delete ${dirPath}: ${error.message}`,
                    'warn'
                );
                console.warn('Deletion warning:', error);
            }
        }
    }

    setActiveRepository(repoInfo: RepositoryInfo | null): void {
        if (this.isBusy) {
            this.addOutput(
                'Cannot switch repository while an operation is in progress. Please wait.',
                'warn'
            );
            return;
        }
        if (this.activeRepository?.id === repoInfo?.id) {
            return;
        }

        // Run all state updates within NgZone to ensure UI reflects the change
        this._ngZone.run(() => {
            this.addOutput(
                repoInfo
                    ? `Activating repository: "${repoInfo.fullName}"...`
                    : 'Deactivating repository.'
            );
            this.activeRepository = repoInfo;
            this.dir = repoInfo ? repoInfo.localPath : '';

            // Reset state for the new context
            this.repositoryTree = [];
            this.selectedFile = null;
            this.cloneDone = false;
            this.commitHistory = [];
            this.selectedCommit = null;
            this.historyError = null;
            this.localBranches = [];
            this.remoteBranches = [];
            this.currentBranch = null;
            this.branchError = null;
            this.newBranchName = '';
            this.output = [
                `Switched context to ${repoInfo ? repoInfo.fullName : 'none'}.`,
            ]; // Reset logs

            if (repoInfo && this.fs) {
                // checkIfRepoExists handles its own async/zone logic
                this.checkIfRepoExists();
            }
            // No explicit detectChanges needed here, NgZone handles it
        });
    }

    isRepoManaged(repoId: number): boolean {
        return this.managedRepositories.some((r) => r.id === repoId);
    }

    // --- Git Operations ---
    async checkIfRepoExists(): Promise<void> {
        if (!this.activeRepository || !this.fs) {
            return;
        }

        this.addOutput(`Checking for existing repository in ${this.dir}...`);
        this.setProcessingTree(true); // Handles its own zone
        // Assume not cloned until verified - update within zone
        this._ngZone.run(() => {
            this.cloneDone = false;
        });

        try {
            await this.fs.promises.stat(`${this.dir}/.git`);
            this.addOutput(
                `Repository found locally at ${this.dir}. Loading state...`
            );
            this._ngZone.run(() => {
                this.cloneDone = true;
            });

            // These load methods should handle their own zone updates if needed
            await Promise.all([
                this.loadBranchData(),
                this.loadCommitHistory(),
                this.buildAndDisplayFileTree(),
            ]);
            this.addOutput(`Repository state loaded successfully.`);
        } catch (e: any) {
            if (e.code === 'ENOENT') {
                this.addOutput(
                    `No repository found in ${this.dir}. Ready to clone.`
                );
                this._ngZone.run(() => {
                    // Reset state within zone
                    this.repositoryTree = [];
                    this.commitHistory = [];
                    this.localBranches = [];
                    this.currentBranch = null;
                    this.selectedFile = null;
                    this.cloneDone = false; // Explicitly set cloneDone to false
                });
            } else {
                this.addOutput(
                    `Error checking repository state in ${this.dir}: ${e.message || e}`,
                    'error'
                );
                console.error('Repo check error:', e);
                this._ngZone.run(() => {
                    /* Reset relevant state if needed */
                    this.repositoryTree = [];
                    this.commitHistory = [];
                    this.localBranches = [];
                    this.currentBranch = null;
                    this.selectedFile = null;
                    this.cloneDone = false;
                });
            }
        } finally {
            this.setProcessingTree(false); // Handles its own zone
        }
    }

    async cloneRepo(): Promise<void> {
        if (!this.activeRepository || !this.githubAccessToken || this.isLoading)
            return;

        this.setLoading(true, `Clone (${this.activeRepository.name})`); // Handles zone
        // Reset state within zone before starting
        this._ngZone.run(() => {
            this.repositoryTree = [];
            this.selectedFile = null;
            this.cloneDone = false;
            this.commitHistory = [];
            this.selectedCommit = null;
            this.localBranches = [];
            this.currentBranch = null;
            this.output = [
                `Attempting to clone ${this.activeRepository.fullName}...`,
            ];
        });

        const cloneUrl = this.activeRepository.url;
        const auth = { username: 'oauth2', password: this.githubAccessToken };
        const cloneDir = this.dir;

        this.addOutput(`Cloning ${cloneUrl} into ${cloneDir}...`);

        try {
            // *** CORRECTION START ***
            // Removed the explicit parent and target directory creation.
            // deleteDirectoryRecursive ensures the path is clear.
            // git.clone should handle creating the 'cloneDir' itself.

            this.addOutput(
                `Cleaning target directory ${cloneDir} before clone...`
            );
            await this.deleteDirectoryRecursive(cloneDir); // FS op - Ensure path is clear

            // No need for: await this.fs.promises.mkdir(parentDir, { recursive: true });
            // No need for: await this.fs.promises.mkdir(cloneDir);
            // *** CORRECTION END ***            this.addOutput('Starting git clone operation...');

            // Determine clone parameters based on branch selection
            const cloneOptions: any = {
                fs: this.fs,
                http: http,
                dir: cloneDir,
                url: cloneUrl,
                corsProxy: this.corsProxy,
                onAuth: () => auth,
                depth: this.historyDepth,
                // Ensure onMessage runs inside NgZone to update the output log safely
                onMessage: (m) => {
                    this._ngZone.run(() =>
                        this.addOutput(`Remote: ${m.trim()}`)
                    );
                },
            };

            // Add branch-specific clone options
            if (this.selectedCloneBranch && this.selectedCloneBranch.trim()) {
                cloneOptions.ref = this.selectedCloneBranch.trim();
                cloneOptions.singleBranch = true;
                this.addOutput(
                    `Cloning specific branch: ${this.selectedCloneBranch}`
                );
            } else {
                cloneOptions.singleBranch = false; // Clone all branches
                this.addOutput('Cloning all branches...');
            }

            await git.clone(cloneOptions);

            this.addOutput('Clone successful!', 'log');
            // Update cloneDone state within zone
            this._ngZone.run(() => {
                this.cloneDone = true;
            });

            // Load initial state - these methods handle their own zone updates
            await Promise.all([
                this.loadBranchData(),
                this.loadCommitHistory(),
                this.buildAndDisplayFileTree(),
            ]);
            this.addOutput(`Initial repository state loaded after clone.`);
        } catch (error: any) {
            this.addOutput(`Clone failed: ${error.message || error}`, 'error');
            console.error('Clone error:', error);
            const statusCode = error.data?.statusCode || error.http?.statusCode;
            if (statusCode === 401) {
                this.addOutput(
                    'Authentication failed (401). Check token.',
                    'error'
                );
                this._ngZone.run(() => (this.githubAccessToken = null));
            } else if (statusCode === 403) {
                this.addOutput(
                    'Authorization failed (403). Check permissions.',
                    'error'
                );
            } else if (statusCode === 404) {
                this.addOutput('Repository not found (404).', 'error');
            } else if (
                error.name === 'CorsError' ||
                error.message.includes('CORS')
            ) {
                this.addOutput('A CORS error occurred.', 'error');
            }
            // Ensure cloneDone is false on error, within zone
            this._ngZone.run(() => {
                this.cloneDone = false;
            });
        } finally {
            this.setLoading(false, `Clone (${this.activeRepository?.name})`); // Handles zone
        }
    }

    async buildAndDisplayFileTree(ref: string = 'HEAD'): Promise<void> {
        if (!this.activeRepository || !this.cloneDone || !this.fs) return;

        const targetRef = this.selectedCommit ? this.selectedCommit.oid : ref;
        const refName = this.selectedCommit
            ? `commit ${targetRef.substring(0, 7)}`
            : ref;

        this.addOutput(`Building file tree from ${refName}...`);
        this.setProcessingTree(true); // Handles zone

        // Reset tree and selection within zone
        this._ngZone.run(() => {
            this.repositoryTree = [];
            // Only reset selected file if not viewing a specific commit that matches the target ref
            if (!this.selectedCommit || targetRef !== this.selectedCommit.oid) {
                this.selectedFile = null;
            }
        });

        try {
            const paths = await git.listFiles({
                fs: this.fs,
                dir: this.dir,
                ref: targetRef,
            });
            this.addOutput(`Found ${paths.length} file paths in ${refName}.`);
            const tree = this.buildTreeFromPaths(paths); // This is synchronous CPU work
            // Update tree within zone
            this._ngZone.run(() => {
                this.repositoryTree = tree;
            });
            this.addOutput(`File tree for ${refName} built successfully.`);
        } catch (error: any) {
            this.addOutput(
                `Failed to build file tree for ${refName}: ${error.message || error}`,
                'error'
            );
            console.error('File tree error:', error);
            // Reset tree within zone on error
            this._ngZone.run(() => {
                this.repositoryTree = [];
            });
        } finally {
            this.setProcessingTree(false); // Handles zone
        }
    }

    async pullChanges(): Promise<void> {
        if (
            !this.activeRepository ||
            !this.cloneDone ||
            this.isLoading ||
            !this.fs ||
            !this.githubAccessToken ||
            this.selectedCommit
        ) {
            this.addOutput('Pull pre-conditions not met.', 'warn');
            return;
        }
        if (this.selectedFile?.isDirty) {
            if (!confirm('Discard unsaved changes and pull?')) {
                this.addOutput(
                    'Pull cancelled due to unsaved changes.',
                    'warn'
                );
                return;
            }
            // Discard changes within zone
            this._ngZone.run(() => {
                if (this.selectedFile) {
                    this.selectedFile.content =
                        this.selectedFile.originalContent;
                    this.selectedFile.isDirty = false;
                }
            });
        }

        this.setLoading(true, `Pull (${this.activeRepository.name})`); // Handles zone
        const auth = { username: 'oauth2', password: this.githubAccessToken };

        try {
            this.addOutput('Step 1: Fetching changes...');
            const fetchResult = await git.fetch({
                fs: this.fs,
                http: http,
                dir: this.dir,
                onAuth: () => auth,
                corsProxy: this.corsProxy,
                singleBranch: true,
                depth: this.historyDepth,
                tags: false,
            });

            if (
                fetchResult?.fetchHead &&
                fetchResult?.fetchHead !== fetchResult?.fetchHeadDescription
            ) {
                this.addOutput(
                    `Fetched remote commit: ${fetchResult.fetchHead.substring(0, 7)}`
                );
                this.addOutput('Step 2: Attempting fast-forward merge...');
                const mergeResult = await git.merge({
                    fs: this.fs,
                    dir: this.dir,
                    ours: 'HEAD',
                    theirs: fetchResult.fetchHead,
                    fastForwardOnly: true,
                    // Provide dummy author, merge commit won't be created in fast-forward
                    author: { name: 'Browser User', email: 'user@browser.com' },
                });

                if (mergeResult.oid) {
                    // Success
                    this.addOutput(
                        `Pull successful. Local branch updated to ${mergeResult.oid.substring(0, 7)}`
                    );
                    // Refresh state - these handle their own zones
                    await this.buildAndDisplayFileTree();
                    await this.loadCommitHistory();
                    await this.loadBranchData();
                } else if (mergeResult.alreadyMerged) {
                    this.addOutput('Repository already up-to-date.');
                } else {
                    this.addOutput(
                        'Pull fetch completed, merge status unclear.',
                        'warn'
                    );
                    await this.buildAndDisplayFileTree();
                    await this.loadCommitHistory();
                    await this.loadBranchData();
                }
            } else if (
                fetchResult?.fetchHeadDescription?.includes(
                    'already up-to-date'
                )
            ) {
                this.addOutput('Repository already up-to-date.');
            } else {
                this.addOutput(
                    'Fetch completed, no new changes detected.',
                    'log'
                );
            }
        } catch (error: any) {
            this.addOutput(
                `Pull operation failed: ${error.message || error}`,
                'error'
            );
            console.error('Pull error:', error);
            const statusCode = error.data?.statusCode || error.http?.statusCode;
            if (statusCode === 401) {
                this.addOutput('Authentication failed (401).', 'error');
                this._ngZone.run(() => (this.githubAccessToken = null));
            } else if (
                error.code === 'FastForwardError' ||
                error.name === 'FastForwardError'
            ) {
                this.addOutput(
                    'Pull failed: Local branch has diverged. Cannot fast-forward.',
                    'error'
                );
            } else if (error.name === 'MergeConflictError') {
                this.addOutput(
                    'Pull failed: Merge conflict (unexpected with fast-forward only).',
                    'error'
                );
            }
        } finally {
            this.setLoading(false, `Pull (${this.activeRepository?.name})`); // Handles zone
        }
    }

    async pushChanges(): Promise<void> {
        if (
            !this.activeRepository ||
            !this.cloneDone ||
            this.isLoading ||
            !this.fs ||
            !this.githubAccessToken
        ) {
            this.addOutput('Push pre-conditions not met.', 'warn');
            return;
        }
        if (this.selectedCommit) {
            this.addOutput('Cannot push while viewing history.', 'warn');
            return;
        }
        if (this.selectedFile?.isDirty) {
            this.addOutput('Cannot push: Unsaved changes exist.', 'warn');
            return;
        }

        // Optional: Check if ahead of remote (async ops, no zone needed for internal logic)
        try {
            const currentBranchName = await git.currentBranch({
                fs: this.fs,
                dir: this.dir,
            });
            if (!currentBranchName) {
                this.addOutput('Cannot push: Detached HEAD state.', 'error');
                return;
            }
            const remoteRef = `refs/remotes/origin/${currentBranchName}`;
            const localRef = `refs/heads/${currentBranchName}`;
            const localOid = await git.resolveRef({
                fs: this.fs,
                dir: this.dir,
                ref: localRef,
            });
            let remoteOid = null;
            try {
                remoteOid = await git.resolveRef({
                    fs: this.fs,
                    dir: this.dir,
                    ref: remoteRef,
                });
            } catch (e: any) {
                if (e.code !== 'NotFoundError') throw e;
            }
            if (localOid === remoteOid) {
                this.addOutput('No changes to push.', 'log');
                return;
            }
            this.addOutput(
                `Local '${currentBranchName}' is ahead. Ready to push.`
            );
        } catch (statusError: any) {
            this.addOutput(
                `Could not determine push status: ${statusError.message}`,
                'warn'
            );
        }

        this.setLoading(true, `Push (${this.activeRepository.name})`); // Handles zone
        const pushUrl = this.activeRepository.url;
        const auth = { username: 'oauth2', password: this.githubAccessToken };
        this.addOutput('Attempting to push changes...');

        try {
            const currentBranchName = await git.currentBranch({
                fs: this.fs,
                dir: this.dir,
            });
            if (!currentBranchName)
                throw new Error('Cannot push from detached HEAD state.');

            this.addOutput(
                `Pushing local branch '${currentBranchName}' to remote 'origin'...`
            );
            const result: PushResult = await git.push({
                fs: this.fs,
                http: http,
                dir: this.dir,
                url: pushUrl,
                ref: currentBranchName,
                remote: 'origin',
                onAuth: () => auth,
                corsProxy: this.corsProxy,
                // Ensure onMessage runs inside NgZone
                onMessage: (m) =>
                    this._ngZone.run(() =>
                        this.addOutput(`Remote: ${m.trim()}`)
                    ),
            });

            this.addOutput(`Push raw result: ${JSON.stringify(result)}`, 'log');
            if (
                result?.ok &&
                Array.isArray(result.ok) &&
                result.ok.includes('ok') &&
                !result.error
            ) {
                this.addOutput(
                    `Push successful for branch '${currentBranchName}'.`,
                    'log'
                );
                // Refresh branch data (handles its own zone)
                await this.loadBranchData();
            } else if (result?.error) {
                this.addOutput(
                    `Push failed with remote error: ${result.error}`,
                    'error'
                );
                if (result.error.toLowerCase().includes('non-fast-forward')) {
                    this.addOutput(
                        'Push rejected: Remote has changes. Pull first.',
                        'error'
                    );
                } else if (
                    result.error.toLowerCase().includes('permission') ||
                    result.error.toLowerCase().includes('forbidden')
                ) {
                    this.addOutput(
                        'Push rejected: Permission denied (403/401).',
                        'error'
                    );
                } else {
                    this.addOutput(`Push failed: ${result.error}`, 'error');
                }
            } else {
                this.addOutput(
                    `Push status uncertain. Result: ${JSON.stringify(result)}.`,
                    'warn'
                );
            }
        } catch (error: any) {
            this.addOutput(
                `Push operation failed: ${error.message || error}`,
                'error'
            );
            console.error('Push error:', error);
            const statusCode = error.data?.statusCode || error.http?.statusCode;
            if (statusCode === 401) {
                this.addOutput('Auth failed (401).', 'error');
                this._ngZone.run(() => (this.githubAccessToken = null));
            } else if (statusCode === 403) {
                this.addOutput('Auth failed (403).', 'error');
            } else if (error.name === 'PushRejectedError') {
                this.addOutput(
                    `Push rejected: ${error.data?.reason || 'Check logs.'}`,
                    'error'
                );
            } else if (error.message.includes('detached HEAD')) {
                this.addOutput(error.message, 'error');
            }
        } finally {
            this.setLoading(false, `Push (${this.activeRepository?.name})`); // Handles zone
        }
    }

    async getStatus(): Promise<void> {
        if (
            !this.activeRepository ||
            !this.cloneDone ||
            this.isLoading ||
            !this.fs
        ) {
            this.addOutput('Status pre-conditions not met.', 'warn');
            return;
        }
        if (this.selectedCommit) {
            this.addOutput(
                'Status is against HEAD. Deselect commit view.',
                'warn'
            );
            return;
        }

        this.setLoading(true, `Status (${this.activeRepository.name})`); // Handles zone
        try {
            const statusMatrix: Awaited<ReturnType<typeof git.statusMatrix>> =
                await git.statusMatrix({ fs: this.fs, dir: this.dir });

            // Build status message string first
            let statusOutput = ['--- Git Status (Index/Workdir) ---'];
            if (statusMatrix.length === 0) {
                statusOutput.push('  (Working directory clean)');
            } else {
                statusOutput.push('  St M Path');
                statusOutput.push('  -- - ----');
                statusMatrix.forEach((row) => {
                    const filepath = row[filepathIdx];
                    const headStatus = row[headStatusIdx] as GitStatusCode;
                    const workdirStatus = row[
                        workdirStatusIdx
                    ] as GitStatusCode;
                    const stageStatus = row[stageStatusIdx] as GitStatusCode;
                    let stagedChar = ' ';
                    let workdirChar = ' ';

                    if (stageStatus === GIT_STATUS.ADDED) stagedChar = 'A';
                    else if (stageStatus === GIT_STATUS.DELETED)
                        stagedChar = 'D';
                    else if (stageStatus === GIT_STATUS.MODIFIED)
                        stagedChar = 'M';

                    // Determine workdir status relative to index
                    if (workdirStatus === GIT_STATUS.ADDED) {
                        // Untracked or Modified-then-readded?
                        if (stageStatus === GIT_STATUS.ABSENT) {
                            stagedChar = '?';
                            workdirChar = '?';
                        } // Untracked
                        else {
                            workdirChar = ' ';
                            stagedChar = 'A';
                        } // Staged as Added, workdir matches index
                    } else if (workdirStatus === GIT_STATUS.DELETED)
                        workdirChar = 'D'; // Deleted in workdir
                    else if (workdirStatus === GIT_STATUS.MODIFIED)
                        workdirChar = 'M'; // Modified in workdir

                    // Combine and filter - only show lines with changes
                    const statusString = `${stagedChar}${workdirChar}`;
                    if (statusString.trim() !== '' || stagedChar === '?') {
                        // Show untracked ('??') and changes
                        statusOutput.push(`  ${statusString} ${filepath}`);
                    }
                });
            }
            statusOutput.push('--- End Status ---');

            // Add all messages at once using NgZone if needed (addOutput handles zone)
            statusOutput.forEach((line) => this.addOutput(line));
        } catch (error: any) {
            this.addOutput(
                `Failed to get status: ${error.message || error}`,
                'error'
            );
            console.error('Status error:', error);
        } finally {
            this.setLoading(false, `Status (${this.activeRepository?.name})`); // Handles zone
        }
    }

    // --- File Tree & Viewing Logic ---
    async viewFileContent(node: TreeNode): Promise<void> {
        if (
            node.isDirectory ||
            this.isProcessingTree ||
            !this.activeRepository ||
            !this.fs
        ) {
            return;
        }

        if (!this.selectedCommit && this.selectedFile?.isDirty) {
            if (!confirm('Discard unsaved changes and view the new file?')) {
                this.addOutput('File view cancelled.', 'warn');
                return;
            }
            // Discard changes within zone
            this._ngZone.run(() => {
                if (this.selectedFile) {
                    this.selectedFile.content =
                        this.selectedFile.originalContent;
                    this.selectedFile.isDirty = false;
                }
            });
        }

        this.addOutput(`Reading content for: ${node.path}...`);
        this.setProcessingTree(true); // Handles zone

        // Set up selected file state within zone
        this._ngZone.run(() => {
            this.selectedFile = {
                path: node.path,
                content: null,
                originalContent: null,
                isDirty: false,
                isLoading: true,
                error: undefined,
            };
            this.cmOptions = {
                ...this.cmOptions,
                readOnly: !!this.selectedCommit,
            };
        });

        try {
            let content: string | null = null;
            let errorMessage: string | undefined = undefined;
            const extension = node.name.split('.').pop()?.toLowerCase() || '';
            const mode = this.getModeForExtension(extension);

            if (this.selectedCommit) {
                // --- Reading from history ---
                this.addOutput(
                    `Reading file from commit ${this.selectedCommit.oid.substring(0, 7)}...`
                );
                try {
                    const readResult: ReadObjectResult = await git.readObject({
                        fs: this.fs,
                        dir: this.dir,
                        oid: this.selectedCommit.oid,
                        filepath: node.path,
                    });
                    if (
                        readResult.type === 'blob' &&
                        readResult.object instanceof Uint8Array
                    ) {
                        try {
                            content = Buffer.from(readResult.object).toString(
                                'utf8'
                            );
                        } catch (decodeError: any) {
                            errorMessage = this.handleDecodeError(decodeError);
                            content = null;
                        }
                    } else {
                        errorMessage = `Object is not a file (type: ${readResult.type}).`;
                    }
                } catch (readError: any) {
                    errorMessage = this.handleReadError(readError, true);
                    console.error(`Hist read error: ${node.path}`, readError);
                }
            } else {
                // --- Reading from working directory ---
                const fsPath = `${this.dir}/${node.path}`;
                try {
                    const contentBuffer: Uint8Array =
                        await this.fs.promises.readFile(fsPath);
                    try {
                        content = Buffer.from(contentBuffer).toString('utf8');
                    } catch (decodeError: any) {
                        errorMessage = this.handleDecodeError(decodeError);
                        content = null;
                    }
                } catch (readError: any) {
                    errorMessage = this.handleReadError(readError, false);
                    console.error(`WD read error: ${fsPath}`, readError);
                }
            }

            // Update state with results within zone
            this._ngZone.run(() => {
                // Check if the selected file is still the one we intended to load
                if (this.selectedFile?.path === node.path) {
                    this.selectedFile.content = content;
                    this.selectedFile.originalContent = content;
                    this.selectedFile.isLoading = false;
                    this.selectedFile.isDirty = false;
                    this.selectedFile.error = errorMessage;
                    this.cmOptions = {
                        ...this.cmOptions,
                        mode: mode,
                        readOnly: !!this.selectedCommit,
                    };
                } else {
                    // If selection changed while loading, log it but don't update the (now wrong) selectedFile
                    this.addOutput(
                        `File selection changed while loading ${node.path}. Aborting update.`,
                        'warn'
                    );
                }
            });

            if (!errorMessage) {
                this.addOutput(
                    `Successfully read: ${node.path}${this.selectedCommit ? ' (historical)' : ''}`
                );
            } else {
                this.addOutput(
                    `Error reading ${node.path}: ${errorMessage}`,
                    'error'
                );
            }
        } catch (error: any) {
            this.addOutput(
                `Unexpected error viewing file ${node.path}: ${error.message || error}`,
                'error'
            );
            console.error('View file unexpected error:', error);
            // Update error state within zone
            this._ngZone.run(() => {
                if (this.selectedFile?.path === node.path) {
                    this.selectedFile.isLoading = false;
                    this.selectedFile.error = `Unexpected error: ${error.message || error}`;
                }
            });
        } finally {
            this.setProcessingTree(false); // Handles zone
        }
    }

    // Helper, no zone needed
    private handleDecodeError(decodeError: any): string {
        console.warn('Decoding error:', decodeError);
        if (
            decodeError instanceof Error &&
            (decodeError.message.includes('invalid byte sequence') ||
                decodeError.message.includes('malformed UTF-8'))
        ) {
            return 'Cannot display content: File appears to be binary or uses an unsupported text encoding.';
        }
        return `Error decoding file content: ${decodeError.message || decodeError}`;
    }
    // Helper, no zone needed
    private handleReadError(readError: any, isHistorical: boolean): string {
        const context = isHistorical ? 'in commit' : 'in working directory';
        if (
            readError.code === 'NotFoundError' ||
            readError.name === 'NotFoundError' ||
            readError.code === 'ENOENT'
        ) {
            return `File not found ${context}.`;
        }
        return `Error reading file ${context}: ${readError.message || readError}`;
    }

    // Helper, no zone needed
    private getModeForExtension(extension: string): string {
        switch (extension) {
            case 'js':
            case 'mjs':
            case 'cjs':
                return 'javascript';
            case 'ts':
                return 'text/typescript';
            case 'json':
                return 'application/json';
            case 'html':
            case 'htm':
                return 'xml';
            case 'xml':
                return 'xml';
            case 'css':
                return 'css';
            case 'scss':
            case 'sass':
                return 'text/x-scss';
            case 'less':
                return 'text/x-less';
            case 'md':
            case 'markdown':
                return 'markdown';
            case 'java':
            case 'cs':
            case 'c':
            case 'cpp':
            case 'h':
                return 'text/x-java';
            case 'py':
                return 'python';
            case 'sh':
            case 'bash':
            case 'zsh':
                return 'text/x-sh';
            case 'yaml':
            case 'yml':
                return 'yaml';
            case 'sql':
                return 'sql';
            case 'php':
                return 'php';
            case 'rb':
                return 'ruby';
            case 'go':
                return 'go';
            case 'rs':
                return 'rust';
            case 'pl':
                return 'perl';
            case 'lua':
                return 'lua';
            default:
                return 'text/plain';
        }
    }

    // --- Editing & Committing Logic ---
    onCodeMirrorChange(newContent: string): void {
        // This is triggered by user input, Angular's zone handles detection automatically
        // for the [(ngModel)] binding. We just need to update the isDirty flag.
        if (
            this.selectedFile &&
            !this.selectedFile.isLoading &&
            !this.selectedCommit
        ) {
            // No need for explicit NgZone.run here as it's part of the event binding chain
            if (this.selectedFile) {
                this.selectedFile.isDirty =
                    newContent !== this.selectedFile.originalContent;
            }
        }
    }

    async saveFileChanges(): Promise<void> {
        if (
            !this.selectedFile?.isDirty ||
            this.isSavingFile ||
            !this.activeRepository ||
            !this.fs
        ) {
            this.addOutput('Save condition not met.', 'warn');
            return;
        }
        if (this.selectedCommit) {
            this.addOutput('Cannot save while viewing history.', 'error');
            return;
        }

        const filePath = this.selectedFile.path;
        this.addOutput(`Saving changes to ${filePath}...`);
        this.setIsSavingFile(true); // Handles zone
        const fsPath = `${this.dir}/${filePath}`;
        const contentToSave = this.selectedFile.content ?? '';

        try {
            // FS ops don't need zone
            await this.fs.promises.writeFile(fsPath, contentToSave, {
                encoding: 'utf8',
                mode: 0o666,
            });
            this.addOutput(`File ${filePath} written to filesystem.`);

            this.addOutput(`Staging ${filePath}...`);
            await git.add({ fs: this.fs, dir: this.dir, filepath: filePath }); // Git op
            this.addOutput(`${filePath} successfully staged.`);

            // Update state within zone
            this._ngZone.run(() => {
                if (this.selectedFile?.path === filePath) {
                    // Check if still relevant
                    this.selectedFile!.originalContent = contentToSave;
                    this.selectedFile!.isDirty = false;
                    this.selectedFile!.error = undefined;
                }
            });
        } catch (error: any) {
            this.addOutput(
                `Error saving/staging ${filePath}: ${error.message || error}`,
                'error'
            );
            console.error('Save/stage error:', error);
        } finally {
            this.setIsSavingFile(false); // Handles zone
        }
    }
    async commitChanges(): Promise<void> {
        if (!this.activeRepository || this.isBusy || !this.fs) {
            /* ... preconditions ... */ return;
        }
        if (this.selectedCommit) {
            /* ... history view check ... */ return;
        }
        if (this.selectedFile?.isDirty) {
            /* ... unsaved check ... */ return;
        }

        // --- Check for staged changes ---
        let stagedChangesExist = false;
        try {
            const matrix = await git.statusMatrix({
                fs: this.fs,
                dir: this.dir,
            });
            stagedChangesExist = matrix.some(
                (row) =>
                    row[stageStatusIdx] !== GIT_STATUS.ABSENT &&
                    row[stageStatusIdx] !== GIT_STATUS.DELETED
            );
            if (!stagedChangesExist) {
                const hasUnstagedChanges = matrix.some(
                    (row) =>
                        row[workdirStatusIdx] !== GIT_STATUS.ABSENT &&
                        row[stageStatusIdx] === GIT_STATUS.ABSENT
                );
                if (hasUnstagedChanges) {
                    this.addOutput(
                        'No changes staged for commit. Use "Save File" to stage changes.',
                        'warn'
                    );
                } else {
                    this.addOutput('No changes detected to commit.', 'log');
                }
                return;
            }
        } catch (statusError: any) {
            this.addOutput(
                `Warning: Could not verify staged changes: ${statusError.message}`,
                'warn'
            );
            // Proceed cautiously
        }

        // --- Prepare Suggestion Function for Dialog ---
        // This function will be passed to the dialog and called when the user clicks "Generate"
        const generateSuggestionFn = async (): Promise<string> => {
            this.addOutput('Preparing suggestion generation...', 'log');

            // 1. Get the diff string
            const diff = await this.getDiffForCommit(); // Use your helper method
            if (diff === null) {
                /* ... error handling ... */ throw new Error(
                    'Diff calculation failed.'
                );
            }
            if (diff.trim() === '') {
                /* ... handle empty diff ... */ return 'chore: no changes detected';
            } // Or throw

            this.addOutput('Sending diff to backend for suggestion...', 'log');

            // 2. Define the expected response structure

            // 3. Call the service and extract the message property
            try {
                // Assume exampleService.generateCommitMessage returns Observable<GenerateCommitResponse>
                const suggestionObservable = this.exampleService
                    .generateCommitMessage(diff)
                    .pipe(
                        map((response: GenerateCommitResponse) => {
                            // Expect the object
                            if (
                                !response ||
                                typeof response.commitMessage !== 'string'
                            ) {
                                // Handle unexpected response format
                                console.error(
                                    'Invalid response format from backend:',
                                    response
                                );
                                throw new Error(
                                    'Received invalid suggestion format from backend.'
                                );
                            }
                            return response.commitMessage; // Extract the string value
                        })
                    );

                // Use lastValueFrom to get the extracted string as a promise
                const suggestedMessage =
                    await lastValueFrom(suggestionObservable);

                this.addOutput(
                    `Suggestion received: ${suggestedMessage}`,
                    'log'
                );
                return suggestedMessage.trim(); // Return the primitive string
            } catch (error: any) {
                const errorMsg = `Suggestion generation failed: ${error?.message || 'Backend Error'}`;
                this.addOutput(errorMsg, 'error');
                console.error('Suggestion service call error:', error);
                throw new Error(errorMsg);
            }
        };

        // --- Open Dialog ---
        this.addOutput('Opening commit dialog...');
        const dialogRef = this.matDialog.open<
            CommitDialogComponent,
            CommitDialogData,
            string
        >(CommitDialogComponent, {
            data: {
                title: 'Commit Changes',
                messageLabel: 'Enter commit message or generate a suggestion:',
                generateSuggestion: generateSuggestionFn, // Pass the function
                // initialMessage: 'Optional prefill' // Optionally add initial message
            },
            width: '450px',
            disableClose: true,
        });

        // --- Handle Dialog Close ---
        dialogRef
            .afterClosed()
            .subscribe(async (commitMessage: string | undefined) => {
                if (!commitMessage) {
                    // Handles undefined, null, empty string after trim in dialog
                    this.addOutput('Commit cancelled.', 'warn');
                    return;
                }

                // --- Proceed with Commit ---
                const authorInfo = {
                    name: 'Browser User',
                    email: 'user@browser.com',
                };
                this.addOutput(`Attempting to commit: "${commitMessage}"...`);
                this.setLoading(
                    true,
                    `Commit (${this.activeRepository?.name})`
                );

                try {
                    const sha = await git.commit({
                        /* ... commit options ... */ message: commitMessage,
                        author: authorInfo,
                        fs: this.fs!,
                        dir: this.dir!,
                    });
                    this.addOutput(
                        `Commit successful! SHA: ${sha.substring(0, 7)}`,
                        'log'
                    );
                    await Promise.all([
                        this.loadCommitHistory(),
                        this.buildAndDisplayFileTree(),
                    ]);
                } catch (error: any) {
                    this.addOutput(
                        `Commit failed: ${error.message || error}`,
                        'error'
                    );
                    console.error('Commit error:', error);
                    if (
                        error.code === 'EmptyCommitError' ||
                        error.name === 'EmptyCommitError'
                    ) {
                        this.addOutput(
                            'Commit failed: No staged changes or changes match HEAD.',
                            'warn'
                        );
                    }
                } finally {
                    this.setLoading(
                        false,
                        `Commit (${this.activeRepository?.name})`
                    );
                }
            });
    }

    // --- Helper Method: Get Diff for Commit (Simplified List Format) ---
    private async getDiffForCommit(): Promise<string | null> {
        this.addOutput(
            'Calculating simplified diff (staged file list)...',
            'log'
        );
        if (!this.activeRepository || !this.fs) {
            this.addOutput(
                'Cannot calculate diff: Repository or filesystem not initialized.',
                'error'
            );
            return null;
        }

        try {
            const statusMatrix = await git.statusMatrix({
                fs: this.fs,
                dir: this.dir,
            });

            // Filter for Added/Modified staged changes and map them
            const stagedAddedModified = statusMatrix
                .filter(
                    (
                        row // row is available in filter scope
                    ) =>
                        row[stageStatusIdx] === GIT_STATUS.ADDED ||
                        row[stageStatusIdx] === GIT_STATUS.MODIFIED
                )
                .map((row) => {
                    // map receives the filtered row
                    const filepath = row[filepathIdx];
                    const stageStatus = row[stageStatusIdx];
                    let statusChar = '';
                    if (stageStatus === GIT_STATUS.ADDED) statusChar = 'A';
                    else if (stageStatus === GIT_STATUS.MODIFIED)
                        statusChar = 'M';
                    return `${statusChar}\t${filepath}`; // Format: A<tab>path or M<tab>path
                });

            // Filter for Deleted staged changes and map them
            const stagedDeleted = statusMatrix
                .filter((row) => row[stageStatusIdx] === GIT_STATUS.DELETED) // filter receives the row
                .map((row) => {
                    // map receives the filtered row
                    const filepath = row[filepathIdx];
                    return `D\t${filepath}`; // Format: D<tab>path
                });

            // Combine all staged changes
            const allStagedChanges = [...stagedAddedModified, ...stagedDeleted];

            if (allStagedChanges.length === 0) {
                this.addOutput('No staged changes found to diff.', 'log');
                return ''; // Return empty string if no changes are staged
            }

            // Join the list into a single string with newlines
            const diff = allStagedChanges.join('\n');
            this.addOutput('Simplified diff (staged file list) calculated.');
            // console.log("Simplified Diff:\n", diff); // Optional debug log
            return diff;
        } catch (error: any) {
            this.addOutput(
                `Failed to calculate diff: ${error.message || error}`,
                'error'
            );
            console.error('Diff calculation error:', error);
            return null; // Return null on error
        }
    }
    // --- Commit History Logic ---
    async loadCommitHistory(): Promise<void> {
        if (
            !this.activeRepository ||
            !this.cloneDone ||
            !this.fs ||
            this.isLoadingHistory
        ) {
            return;
        }
        this.addOutput(
            `Loading commit history (depth: ${this.historyDepth})...`
        );
        // Update loading state within zone
        this._ngZone.run(() => {
            this.isLoadingHistory = true;
            this.historyError = null;
            this.commitHistory = [];
        });

        try {
            const logs: GitLogEntry[] = await git.log({
                fs: this.fs,
                dir: this.dir,
                depth: this.historyDepth,
                ref: 'HEAD',
            });
            // Update history within zone
            this._ngZone.run(() => {
                this.commitHistory = logs;
            });
            this.addOutput(`Loaded ${logs.length} commit entries.`);
        } catch (error: any) {
            this.addOutput(
                `Failed history load: ${error.message || error}`,
                'error'
            );
            console.error('History load error:', error);
            // Update error state within zone
            this._ngZone.run(() => {
                this.historyError = `Failed: ${error.message || error}`;
                this.commitHistory = [];
            });
        } finally {
            // Update loading state within zone
            this._ngZone.run(() => {
                this.isLoadingHistory = false;
            });
            // No explicit detectChanges needed
        }
    }

    async selectCommit(commit: GitLogEntry | null): Promise<void> {
        if (this.isBusy) {
            this.addOutput('Wait for current operation.', 'warn');
            return;
        }
        if (commit !== null && this.selectedFile?.isDirty) {
            if (!confirm('Discard unsaved changes and view commit?')) {
                this.addOutput('Commit selection cancelled.', 'warn');
                return;
            }
            // Discard changes within zone
            this._ngZone.run(() => {
                if (this.selectedFile) {
                    this.selectedFile.content =
                        this.selectedFile.originalContent;
                    this.selectedFile.isDirty = false;
                }
            });
        }

        // Update selected commit state within zone
        this._ngZone.run(() => {
            this.selectedCommit = commit;
            if (commit) {
                this.addOutput(
                    `Selected commit: ${commit.oid.substring(0, 7)} - "${commit.commit.message.split('\n')[0]}"`
                );
                this.cmOptions = { ...this.cmOptions, readOnly: true };
                this.selectedFile = null; // Reset file selection when changing context
            } else {
                // Switching back to HEAD
                this.addOutput('Switched view back to HEAD.');
                this.cmOptions = { ...this.cmOptions, readOnly: false };
                this.selectedFile = null; // Reset file selection
            }
        });

        // Rebuild tree for the new context (commit or HEAD) - handles its own zone
        await this.buildAndDisplayFileTree(commit ? commit.oid : 'HEAD');
        // No explicit detectChanges needed
    }

    viewHead(): void {
        this.selectCommit(null);
    } // selectCommit handles async/zone
    formatTimestamp(timestamp: number): string {
        return (
            this.datePipe.transform(timestamp * 1000, 'medium') ||
            'Invalid Date'
        );
    } // --- Branch Management Logic ---
    async loadBranchData(): Promise<void> {
        if (
            !this.activeRepository ||
            !this.cloneDone ||
            !this.fs ||
            this.isLoading
        ) {
            return;
        }
        this.addOutput('Loading branch info...');
        // Reset error within zone
        this._ngZone.run(() => {
            this.branchError = null;
        });

        try {
            // First try to fetch from remote to get latest branch info
            if (this.githubAccessToken) {
                try {
                    this.addOutput(
                        'Fetching latest branch information from remote...'
                    );
                    const auth = {
                        username: 'oauth2',
                        password: this.githubAccessToken,
                    };
                    await git.fetch({
                        fs: this.fs,
                        http: http,
                        dir: this.dir,
                        onAuth: () => auth,
                        corsProxy: this.corsProxy,
                        singleBranch: false, // Fetch all branches
                        tags: false,
                    });
                    this.addOutput(
                        'Fetched latest branch information from remote'
                    );
                } catch (fetchError: any) {
                    console.warn('Could not fetch from remote:', fetchError);
                    this.addOutput(
                        `Warning: Could not fetch from remote: ${fetchError.message || fetchError}`,
                        'warn'
                    );
                }
            }
            const [localBranchesList, remoteBranchesList, currentBranchName] =
                await Promise.all([
                    git
                        .listBranches({ fs: this.fs, dir: this.dir })
                        .catch(() => {
                            this.addOutput(
                                'Could not list local branches.',
                                'warn'
                            );
                            return [];
                        }),
                    git
                        .listBranches({
                            fs: this.fs,
                            dir: this.dir,
                            remote: 'origin',
                        })
                        .catch(() => {
                            this.addOutput(
                                'Could not list remote branches.',
                                'warn'
                            );
                            return [];
                        }),
                    git
                        .currentBranch({
                            fs: this.fs,
                            dir: this.dir,
                            fullname: false,
                        })
                        .catch((err) => {
                            if (err.code === 'DetachedHeadError') {
                                this.addOutput('Detached HEAD state.', 'warn');
                                return null;
                            }
                            throw err;
                        }),
                ]);
            const remoteFiltered = remoteBranchesList
                .filter((b) => b !== 'origin/HEAD')
                .map((b) =>
                    b.startsWith('origin/') ? b.substring('origin/'.length) : b
                )
                .sort();
            // Update state within zone
            this._ngZone.run(() => {
                this.localBranches = localBranchesList.sort();
                this.remoteBranches = remoteFiltered;
                this.currentBranch = currentBranchName || null;
            });
            this.addOutput(
                `Branches loaded. Current: ${this.currentBranch || 'Detached HEAD'}.`
            );
        } catch (error: any) {
            this.addOutput(
                `Branch load failed: ${error.message || error}`,
                'error'
            );
            console.error('Branch load error:', error);
            // Update error state within zone
            this._ngZone.run(() => {
                this.branchError = `Failed: ${error.message || error}`;
                this.localBranches = [];
                this.remoteBranches = [];
                this.currentBranch = null;
            });
        } finally {
            // No explicit detectChanges needed
        }
    }

    async switchBranch(branchName: string): Promise<void> {
        if (
            !this.activeRepository ||
            !this.cloneDone ||
            !this.fs ||
            this.isBusy ||
            branchName === this.currentBranch ||
            !branchName
        ) {
            this.addOutput('Switch branch pre-conditions not met.', 'warn');
            return;
        }
        if (this.selectedCommit) {
            this.addOutput(
                'Cannot switch branch while viewing history.',
                'warn'
            );
            return;
        }
        if (this.selectedFile?.isDirty) {
            if (
                !confirm(
                    `Discard unsaved changes and switch to '${branchName}'?`
                )
            ) {
                this.addOutput('Switch cancelled.', 'warn');
                return;
            }
            // Discard changes within zone
            this._ngZone.run(() => {
                if (this.selectedFile) {
                    this.selectedFile.content =
                        this.selectedFile.originalContent;
                    this.selectedFile.isDirty = false;
                }
            });
        }

        // Auto-discard uncommitted changes before switching
        try {
            const matrix = await git.statusMatrix({
                fs: this.fs,
                dir: this.dir,
            });
            const hasUncommitted = matrix.some(
                (row) =>
                    row[workdirStatusIdx] !== GIT_STATUS.ABSENT ||
                    row[stageStatusIdx] !== GIT_STATUS.ABSENT
            );
            if (hasUncommitted) {
                this.addOutput(
                    'Discarding uncommitted changes before branch switch.',
                    'warn'
                );
                // Reset working directory to HEAD
                await git.checkout({
                    fs: this.fs,
                    dir: this.dir,
                    ref: 'HEAD',
                    force: true,
                });
            }
        } catch (statusError: any) {
            this.addOutput(
                `Warning: Could not auto-discard changes before switch: ${statusError.message}`,
                'warn'
            );
        }

        this.addOutput(`Switching to branch '${branchName}'...`);
        // Update loading state within zone
        this._ngZone.run(() => {
            this.isSwitchingBranch = true;
            this.branchError = null;
        });
        this.setLoading(true, `Switch Branch (${branchName})`); // Handles zone

        try {
            // Clear commit history immediately so user doesn't see previous branch history
            this._ngZone.run(() => {
                this.commitHistory = [];
                this.selectedCommit = null;
                this.selectedFile = null;
                this.cmOptions = { ...this.cmOptions, readOnly: false };
            }); // Handle remote branches by creating local tracking branches
            if (branchName.startsWith('origin/')) {
                const localBranchName = branchName.substring('origin/'.length);
                this.addOutput(
                    `Creating local tracking branch '${localBranchName}' for '${branchName}'...`
                );

                try {
                    // Check if local branch already exists
                    const existingBranches = await git.listBranches({
                        fs: this.fs,
                        dir: this.dir,
                    });

                    if (!existingBranches.includes(localBranchName)) {
                        // Create the local branch pointing to the remote branch
                        await git.branch({
                            fs: this.fs,
                            dir: this.dir,
                            ref: localBranchName,
                            object: branchName,
                        });
                        this.addOutput(
                            `Created local branch '${localBranchName}' tracking '${branchName}'.`
                        );
                    } else {
                        this.addOutput(
                            `Local branch '${localBranchName}' already exists.`
                        );
                    }

                    // Checkout the local branch
                    await git.checkout({
                        fs: this.fs,
                        dir: this.dir,
                        ref: localBranchName,
                        force: true,
                    });
                    this.addOutput(
                        `Switched to local branch '${localBranchName}'.`
                    );

                    // Set up tracking relationship
                    try {
                        await git.addRemote({
                            fs: this.fs,
                            dir: this.dir,
                            remote: 'origin',
                            url: this.activeRepository.url,
                        });
                    } catch (remoteError) {
                        // Remote might already exist, that's fine
                    }
                } catch (branchError: any) {
                    this.addOutput(
                        `Failed to handle remote branch: ${branchError.message}`,
                        'error'
                    );
                    throw branchError;
                }
            } else {
                // Regular local branch checkout
                await git.checkout({
                    fs: this.fs,
                    dir: this.dir,
                    ref: branchName,
                    force: true,
                });
                this.addOutput(`Switched to branch '${branchName}'.`);
            }

            // Reload data - these handle their own zones
            await this.loadBranchData();
            await this.loadCommitHistory();
            await this.buildAndDisplayFileTree();
        } catch (error: any) {
            this.addOutput(`Switch failed: ${error.message || error}`, 'error');
            console.error('Switch branch error:', error);
            // Update error state within zone
            this._ngZone.run(() => {
                this.branchError = `Checkout failed: ${error.message || error}`;
            });
            if (error.code === 'CheckoutConflictError') {
                this.addOutput('Conflict: Commit/stash changes.', 'error');
            } else if (error.code === 'NotFoundError') {
                this.addOutput(`Branch '${branchName}' not found.`, 'error');
            }
            await this.loadBranchData(); // Reload data even on failure
        } finally {
            // Update loading state within zone
            this._ngZone.run(() => {
                this.isSwitchingBranch = false;
            });
            this.setLoading(false, `Switch Branch (${branchName})`); // Handles zone
            // No explicit detectChanges needed
        }
    }

    async createBranch(): Promise<void> {
        if (
            !this.activeRepository ||
            !this.cloneDone ||
            !this.fs ||
            this.isBusy ||
            !this.newBranchName.trim()
        ) {
            this.addOutput('Create branch pre-conditions not met.', 'warn');
            return;
        }
        if (this.selectedCommit) {
            this.addOutput(
                'Cannot create branch while viewing history.',
                'warn'
            );
            return;
        }
        const branchToCreate = this.newBranchName.trim();
        if (
            !/^[^\s~^:?*[\\^@{}]+$/.test(branchToCreate) ||
            branchToCreate.includes('..') ||
            branchToCreate.includes('/.') ||
            branchToCreate.startsWith('/') ||
            branchToCreate.endsWith('/') ||
            branchToCreate.endsWith('.lock')
        ) {
            this.addOutput(
                `Invalid branch name: "${branchToCreate}".`,
                'error'
            );
            this._ngZone.run(() => (this.branchError = 'Invalid name.'));
            return;
        }
        if (
            this.localBranches.includes(branchToCreate) ||
            this.remoteBranches.includes(branchToCreate)
        ) {
            this.addOutput(
                `Branch "${branchToCreate}" already exists.`,
                'error'
            );
            this._ngZone.run(() => (this.branchError = 'Already exists.'));
            return;
        }

        this.addOutput(`Creating & checking out '${branchToCreate}'...`);
        // Update loading state within zone
        this._ngZone.run(() => {
            this.isCreatingBranch = true;
            this.branchError = null;
        });
        this.setLoading(true, `Create Branch (${branchToCreate})`); // Handles zone

        try {
            await git.branch({
                fs: this.fs,
                dir: this.dir,
                ref: branchToCreate,
                checkout: true,
            });
            this.addOutput(`Created & switched to '${branchToCreate}'.`);
            // Reset state within zone
            this._ngZone.run(() => {
                this.newBranchName = '';
                this.selectedCommit = null;
                this.selectedFile = null;
                this.cmOptions = { ...this.cmOptions, readOnly: false };
            });
            // Reload data - these handle their own zones
            await this.loadBranchData();
            await this.loadCommitHistory();
            await this.buildAndDisplayFileTree();
        } catch (error: any) {
            this.addOutput(
                `Create branch failed: ${error.message || error}`,
                'error'
            );
            console.error('Create branch error:', error);
            // Update error state within zone
            this._ngZone.run(() => {
                this.branchError = `Create failed: ${error.message || error}`;
            });
            await this.loadBranchData(); // Reload data even on failure
        } finally {
            // Update loading state within zone
            this._ngZone.run(() => {
                this.isCreatingBranch = false;
            });
            this.setLoading(false, `Create Branch (${branchToCreate})`); // Handles zone
            // No explicit detectChanges needed
        }
    }

    // --- Remote Branch Fetching for Clone ---
    async fetchRemoteBranchesForClone(): Promise<void> {
        if (
            !this.activeRepository ||
            !this.githubAccessToken ||
            this.isLoadingRemoteBranches
        ) {
            return;
        }

        this._ngZone.run(() => {
            this.isLoadingRemoteBranches = true;
            this.cloneBranchError = null;
            this.availableRemoteBranches = [];
            this.selectedCloneBranch = '';
        });

        try {
            this.addOutput(
                `Fetching remote branches for ${this.activeRepository.fullName}...`
            );

            // Use GitHub API to get branches
            const response = await fetch(
                `https://api.github.com/repos/${this.activeRepository.fullName}/branches`,
                {
                    headers: {
                        Authorization: `Bearer ${this.githubAccessToken}`,
                        Accept: 'application/vnd.github.v3+json',
                    },
                }
            );

            if (!response.ok) {
                throw new Error(
                    `GitHub API error: ${response.status} ${response.statusText}`
                );
            }

            const branches = await response.json();
            const branchNames = branches
                .map((branch: any) => branch.name)
                .sort();

            this._ngZone.run(() => {
                this.availableRemoteBranches = branchNames;
                // Default to 'main' or 'master' if available, otherwise first branch
                const defaultBranch =
                    branchNames.find(
                        (name: string) => name === 'main' || name === 'master'
                    ) ||
                    branchNames[0] ||
                    '';
                this.selectedCloneBranch = defaultBranch;
            });

            this.addOutput(`Found ${branchNames.length} remote branches.`);
        } catch (error: any) {
            this.addOutput(
                `Failed to fetch remote branches: ${error.message}`,
                'error'
            );
            this._ngZone.run(() => {
                this.cloneBranchError = error.message;
            });
        } finally {
            this._ngZone.run(() => {
                this.isLoadingRemoteBranches = false;
            });
        }
    }

    // --- Helper Methods ---
    addOutput(message: string, level: 'log' | 'warn' | 'error' = 'log'): void {
        const timestamp = new Date().toLocaleTimeString();
        const logMessage = `[${timestamp}] ${message}`;
        // Run the array push within NgZone so the template updates
        this._ngZone.run(() => {
            this.output.push(logMessage);
            // Limit log size
            if (this.output.length > 200) {
                this.output.shift();
            }
            // No explicit detectChanges needed here
        });
        if (level === 'error') console.error(logMessage);
        else if (level === 'warn') console.warn(logMessage);
        // else console.log(logMessage); // Optional: log normal messages too
    }

    clearOutput(): void {
        // Run within NgZone to update the template
        this._ngZone.run(() => {
            this.output = ['Log cleared.'];
            // *** CORRECTION: Removed explicit detectChanges ***
            // this._cdRef.detectChanges();
        });
    }

    setLoading(loading: boolean, operation?: string): void {
        // Avoid unnecessary updates if state is already correct
        if (this.isLoading === loading) return;

        // Run state updates within NgZone
        this._ngZone.run(() => {
            this.isLoading = loading;
            if (operation) {
                const status = loading ? 'started' : 'finished';
                // Use setTimeout to log 'finished' slightly after state update,
                // ensuring it doesn't interfere if called rapidly.
                // AddOutput handles its own zone logic.
                if (!loading) {
                    setTimeout(
                        () =>
                            this.addOutput(
                                `Operation ${status}: ${operation}.`
                            ),
                        0
                    );
                } else {
                    this.addOutput(`Operation ${status}: ${operation}.`);
                }
            }
            // *** CORRECTION: Removed explicit detectChanges ***
            // This was the likely cause of the "ASSERTION ERROR" when called during init.
            // NgZone.run() is sufficient to schedule change detection.
            // this._cdRef.detectChanges();
        });
    }

    setProcessingTree(processing: boolean): void {
        if (this.isProcessingTree === processing) return;
        // Run within NgZone
        this._ngZone.run(() => {
            this.isProcessingTree = processing;
            // *** CORRECTION: Removed explicit detectChanges ***
            // this._cdRef.detectChanges();
        });
    }

    setIsSavingFile(saving: boolean): void {
        if (this.isSavingFile === saving) return;
        // Run within NgZone
        this._ngZone.run(() => {
            this.isSavingFile = saving;
            // *** CORRECTION: Removed explicit detectChanges ***
            // this._cdRef.detectChanges();
        });
    }

    // Synchronous helper, no zone needed
    buildTreeFromPaths(paths: string[]): TreeNode[] {
        const root: TreeNode = {
            name: '__root__',
            path: '',
            isDirectory: true,
            children: [],
            expanded: true,
        };
        paths.forEach((path) => {
            let currentNode = root;
            const parts = path.split('/');
            parts.forEach((part, index) => {
                if (!part) return; // Handle potential empty parts from leading/trailing/double slashes
                if (!currentNode.children) currentNode.children = [];
                let childNode = currentNode.children.find(
                    (child) => child.name === part
                );
                const isLastPart = index === parts.length - 1;
                const isDirectory = !isLastPart;
                const currentPath = parts.slice(0, index + 1).join('/');
                if (!childNode) {
                    childNode = {
                        name: part,
                        path: currentPath,
                        isDirectory: isDirectory,
                        children: isDirectory ? [] : undefined,
                        expanded: false,
                    };
                    currentNode.children.push(childNode);
                    // Sort children: directories first, then alphabetically
                    currentNode.children.sort((a, b) =>
                        a.isDirectory === b.isDirectory
                            ? a.name.localeCompare(b.name)
                            : a.isDirectory
                              ? -1
                              : 1
                    );
                } else {
                    // If an existing node is found but the current path indicates it should be a directory, update it.
                    if (isDirectory && !childNode.isDirectory) {
                        this.addOutput(
                            `Tree build warn: Path '${currentPath}' implies directory, but node '${part}' was previously marked as file. Updating.`,
                            'warn'
                        );
                        childNode.isDirectory = true;
                        childNode.children = childNode.children || []; // Ensure children array exists
                    }
                }
                // Descend only if it's a directory
                if (childNode.isDirectory) {
                    currentNode = childNode;
                } else if (!isLastPart) {
                    // This case should ideally not happen with `git listFiles` but handle defensively
                    this.addOutput(
                        `Tree build error: Attempted to traverse into file path '${childNode.path}' while processing '${path}'.`,
                        'error'
                    );
                    // Stop processing this path further down this branch
                    return;
                }
            });
        });
        return root.children || [];
    }

    toggleNodeExpansion(node: TreeNode): void {
        if (node.isDirectory) {
            // Run within NgZone as it's a direct UI interaction changing state
            this._ngZone.run(() => {
                node.expanded = !node.expanded;
                // *** CORRECTION: Removed explicit detectChanges ***
                // this._cdRef.detectChanges();
            });
        }
    } // --- Getter for Template ---
    get isBusy(): boolean {
        // Combine all relevant loading flags
        return (
            this.isLoading ||
            this.isProcessingTree ||
            this.isSavingFile ||
            this.isLoadingHistory ||
            this.isSwitchingBranch ||
            this.isCreatingBranch ||
            this.isFetchingRepos
        );
    }

    // --- Merge Request Methods ---
    openMergeRequest(): void {
        this.showMergeRequest = true;
    }

    closeMergeRequest(): void {
        this.showMergeRequest = false;
    }
    onMergeCompleted(event: any): void {
        // Handle merge completion
        console.log('Merge completed:', event);

        // Refresh the repository state after merge
        if (this.activeRepository) {
            this.loadCommitHistory();
            this.buildAndDisplayFileTree();
            this.loadBranchData(); // Reload branch data to reflect changes
        }

        // Show success message
        this.addOutput('Merge completed successfully!', 'log');

        // Don't auto-close the merge request - let user see the result
        // Only close if explicitly requested or if there was an error
        if (event && !event.success) {
            this.closeMergeRequest();
        }
    }

    // --- Commit Diff Viewer Methods ---
    openCommitDiff(): void {
        this.showCommitDiff = true;
    }

    closeCommitDiff(): void {
        this.showCommitDiff = false;
    }

    openPickGroupDialog(repoName: string): void {
        const dialogRef = this.matDialog.open(PickGroupComponent, {
            data: repoName,
        });
        // dialogRef.afterClosed().subscribe((result) => {
        //     if (result === 'success') {
        //         this.fetchPage();
        //     }
        // });
    }
} // End of component class
