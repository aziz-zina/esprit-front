import { CommonModule } from '@angular/common';
import {
    ChangeDetectorRef,
    Component,
    NgZone,
    OnInit,
    OnDestroy, // Import OnDestroy
    inject,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Subscription } from 'rxjs'; // Import Subscription

// --- Codemirror ---
import { CodemirrorModule } from '@ctrl/ngx-codemirror'; // Import Codemirror wrapper module
import * as CodeMirror from 'codemirror'; // Import core Codemirror object if needed for types/config

// --- Buffer Polyfill ---
import { Buffer } from 'buffer';

// Isomorphic Git and related imports
import FS from '@isomorphic-git/lightning-fs';
import * as git from 'isomorphic-git';
import http from 'isomorphic-git/http/web';
import { ExampleService, GithubApiRepo } from './example.service'; // Import service and interface

// --- Interfaces ---
interface TreeNode {
    name: string;
    path: string;
    isDirectory: boolean;
    children?: TreeNode[];
    expanded?: boolean;
}

interface SelectedFile {
    path: string;            // Relative path in repo
    content: string | null;  // Current content in editor
    originalContent: string | null; // Content when file was opened (to check dirty state)
    isDirty: boolean;        // Flag if content has changed
    isLoading: boolean;
    error?: string;
}

// Interface for locally managed repo info
interface RepositoryInfo {
    id: number; // Use GitHub repo ID for uniqueness
    name: string; // e.g., 'isomorphic-git'
    fullName: string; // e.g., 'isomorphic-git/isomorphic-git'
    url: string; // Clone URL
    localPath: string; // Path in virtual FS, e.g., /repo/12345
}

@Component({
    selector: 'example',
    standalone: true,
    imports: [
        FormsModule,
        CommonModule,
        CodemirrorModule // *** ADD CodemirrorModule HERE ***
    ],
    templateUrl: './example.component.html',
})
export class ExampleComponent implements OnInit, OnDestroy { // Implement OnDestroy
    private readonly exampleService = inject(ExampleService); // Corrected service injection name
    private _cdRef = inject(ChangeDetectorRef);
    private _ngZone = inject(NgZone);
    private tokenSubscription: Subscription | null = null; // To manage subscription
    private githubApiSubscription: Subscription | null = null;

    // --- Authentication State ---
    githubAccessToken: string | null = null;

    // --- Repo Management State ---
    githubRepoList: GithubApiRepo[] | null = null; // Repos from GitHub API
    managedRepositories: RepositoryInfo[] = []; // Repos managed locally
    activeRepository: RepositoryInfo | null = null; // Currently selected managed repo
    isFetchingRepos = false;
    readonly localStorageManagedReposKey = 'gitBrowser_managedRepos';

    // --- Git & FS State ---
    fs!: FS;
    dir: string = ''; // ** DYNAMIC: Set when activeRepository changes **
    corsProxy = 'https://cors.isomorphic-git.org';
    output: string[] = [];
    isLoading = false; // General Git op loading
    isProcessingTree = false; // Tree building/reading loading
    cloneDone = false; // Is the active repo cloned?
    repositoryTree: TreeNode[] = []; // File tree for active repo

    // --- Editor State ---
    selectedFile: SelectedFile | null = null;
    isSavingFile = false;
    cmOptions: CodeMirror.EditorConfiguration = {
        lineNumbers: true,
        theme: 'material',
        mode: 'javascript',
        readOnly: false
    };

    /**
     * Constructor
     */
    constructor() {
        console.log('ExampleComponent: Constructor started.');
        this._injectBufferPolyfill();
        this._loadManagedRepos();
        this._initializeFilesystem();
        this.fetchGithubAccessToken();
        console.log('ExampleComponent: Constructor finished.');
    }

    /**
     * ngOnInit Lifecycle Hook
     */
    ngOnInit(): void {
        console.log('ExampleComponent: ngOnInit started.');
        if (this.fs && this.activeRepository) {
            this.checkIfRepoExists();
        } else if (!this.fs) {
            console.warn('ExampleComponent: FS not initialized.');
        }
        console.log('ExampleComponent: ngOnInit finished.');
    }

    /**
     * ngOnDestroy Lifecycle Hook
     */
    ngOnDestroy(): void {
         console.log('ExampleComponent: ngOnDestroy.');
         this.tokenSubscription?.unsubscribe();
         this.githubApiSubscription?.unsubscribe();
    }


    // --- Initialization & State Loading ---
    private _injectBufferPolyfill(): void {
        if (typeof (window as any).Buffer === 'undefined') {
            (window as any).Buffer = Buffer;
            console.log('[Polyfill] Injected Buffer.');
        }
    }

    private _initializeFilesystem(): void {
        try {
            this.fs = new FS('my-git-fs');
            this.addOutput('Filesystem initialized.');
            console.log('ExampleComponent: Filesystem initialized.');
        } catch (fsError: any) {
            console.error('ExampleComponent: Failed to initialize Filesystem!', fsError);
            this.addOutput(`FATAL: Failed to initialize Filesystem: ${fsError.message || fsError}`, 'error');
        }
    }

    private _loadManagedRepos(): void {
        try {
            const storedRepos = localStorage.getItem(this.localStorageManagedReposKey);
            if (storedRepos) {
                this.managedRepositories = JSON.parse(storedRepos);
                this.addOutput(`Loaded ${this.managedRepositories.length} managed repositories from localStorage.`);
            }
        } catch (e) {
            console.error('Failed to load managed repositories from localStorage:', e);
            this.addOutput('Error loading managed repositories from storage.', 'error');
            localStorage.removeItem(this.localStorageManagedReposKey);
            this.managedRepositories = [];
        }
    }

    private _saveManagedRepos(): void {
        try {
            localStorage.setItem(this.localStorageManagedReposKey, JSON.stringify(this.managedRepositories));
        } catch (e) {
            console.error('Failed to save managed repositories to localStorage:', e);
            this.addOutput('Error saving managed repositories to storage.', 'error');
        }
    }

    // --- Authentication ---
    fetchGithubAccessToken(): void {
        this.addOutput('Attempting to fetch GitHub access token...');
        this.isLoading = true;
        this.tokenSubscription = this.exampleService.getGithubAccessToken().subscribe({
            next: (token) => {
                if (token) {
                    this.githubAccessToken = token;
                    this.addOutput('GitHub access token obtained successfully.');
                } else {
                    this.githubAccessToken = null;
                    this.addOutput('Could not retrieve GitHub access token. Check Keycloak session and configuration.', 'warn');
                }
                this.isLoading = false;
                this._cdRef.detectChanges();
            },
            error: (error) => {
                this.githubAccessToken = null;
                this.addOutput('Failed to fetch GitHub access token.', 'error');
                this.isLoading = false;
                this._cdRef.detectChanges();
            },
        });
    }

    // --- GitHub Repo Fetching ---
    fetchGithubRepos(): void {
        if (!this.githubAccessToken) {
            this.addOutput('Cannot fetch repos: GitHub access token is missing.', 'error');
            this.fetchGithubAccessToken();
            return;
        }
        if (this.isFetchingRepos) return;

        this.addOutput('Fetching your repositories from GitHub...');
        this.isFetchingRepos = true;
        this.githubRepoList = null;

        this.githubApiSubscription = this.exampleService.fetchGithubRepositories(this.githubAccessToken).subscribe({
            next: (repos) => {
                this.githubRepoList = repos;
                this.addOutput(`Fetched ${repos.length} repositories from GitHub.`);
                this.isFetchingRepos = false;
                this._cdRef.detectChanges();
            },
            error: (err) => {
                this.addOutput('Failed to fetch repositories from GitHub.', 'error');
                this.isFetchingRepos = false;
                this.githubRepoList = [];
                this._cdRef.detectChanges();
            }
        });
    }

    // --- Managed Repositories Logic ---
    addRepoToManaged(repo: GithubApiRepo): void {
        if (this.managedRepositories.some(r => r.id === repo.id)) {
            this.addOutput(`Repository "${repo.full_name}" is already managed.`, 'warn');
            return;
        }
        const localPath = `/repo/${repo.id}`;
        const newRepoInfo: RepositoryInfo = {
            id: repo.id, name: repo.name, fullName: repo.full_name,
            url: repo.clone_url, localPath: localPath,
        };
        this.managedRepositories.push(newRepoInfo);
        this._saveManagedRepos();
        this.addOutput(`Added "${repo.full_name}" to managed list. Select it to clone.`, 'log');
    }

    async removeManagedRepo(repoToRemove: RepositoryInfo): Promise<void> {
        const confirmation = confirm(`Are you sure you want to remove the local copy of "${repoToRemove.fullName}"? This cannot be undone.`);
        if (!confirmation) return;

        this.addOutput(`Removing local copy of "${repoToRemove.fullName}"...`);
        this.isLoading = true;

        try {
            try {
                 await this.fs.promises.stat(repoToRemove.localPath);
                 await this.fs.promises.rmdir(repoToRemove.localPath, { recursive: true } as any);
                 this.addOutput(`Successfully removed directory: ${repoToRemove.localPath}`);
            } catch (e:any) {
                if (e.code === 'ENOENT') {
                     this.addOutput(`Directory ${repoToRemove.localPath} not found, removing from list only.`, 'warn');
                } else { throw e; }
            }
            this.managedRepositories = this.managedRepositories.filter(r => r.id !== repoToRemove.id);
            this._saveManagedRepos();
            this.addOutput(`"${repoToRemove.fullName}" removed from managed list.`);
            if (this.activeRepository?.id === repoToRemove.id) {
                this.setActiveRepository(null); // Use the method to clear state properly
            }
        } catch (error: any) {
            this.addOutput(`Error removing repository directory ${repoToRemove.localPath}: ${error.message || error}`, 'error');
            console.error("Remove Repo Error:", error);
        } finally {
            this.isLoading = false;
            this._cdRef.detectChanges();
        }
    }

    setActiveRepository(repoInfo: RepositoryInfo | null): void {
         // *** ADDED LOGGING ***
         console.log('[setActiveRepository] Called with:', repoInfo);
         if (this.isLoading || this.isProcessingTree) {
            this.addOutput('Please wait for the current operation to finish before switching repositories.', 'warn');
             console.log('[setActiveRepository] Blocked: Operation in progress.');
            return;
         }
        if (this.activeRepository?.id === repoInfo?.id) {
             if (repoInfo !== null) {
                 console.log('[setActiveRepository] Blocked: Repository already active.');
                 return; // Already active
             }
        }

        this.addOutput(repoInfo ? `Activating repository: "${repoInfo.fullName}"...` : 'Deactivating repository.');
        this.activeRepository = repoInfo;
        // *** ADDED LOGGING ***
        this.dir = repoInfo ? repoInfo.localPath : '';
        console.log(`[setActiveRepository] Set this.activeRepository to:`, this.activeRepository);
        console.log(`[setActiveRepository] Set this.dir to: ${this.dir}`);

        // Reset state for the view
        this.repositoryTree = [];
        this.selectedFile = null;
        this.cloneDone = false;

        if (repoInfo && this.fs) {
             console.log('[setActiveRepository] Calling checkIfRepoExists...');
            this.checkIfRepoExists();
        } else {
            console.log('[setActiveRepository] No repo selected or FS missing, detecting changes.');
             this._cdRef.detectChanges();
        }
    }

    isRepoManaged(repoId: number): boolean {
        return this.managedRepositories.some(r => r.id === repoId);
    }

    // --- Git Operations (Adapted for Active Repo & Auth) ---

    async checkIfRepoExists(): Promise<void> {
        if (!this.activeRepository || !this.fs) {
             // *** ADDED LOGGING ***
             console.warn('[checkIfRepoExists] Aborted: No active repository or FS not ready.');
             this.setProcessingTree(false); // Ensure loading state is cleared
             return;
        }
         // *** ADDED LOGGING ***
         console.log(`[checkIfRepoExists] Checking for .git in directory: ${this.dir}`);
        this.addOutput(`Checking for existing repository in ${this.dir}...`);
        this.setProcessingTree(true);
        this.cloneDone = false;

        try {
            await this.fs.promises.stat(`${this.dir}/.git`);
            // *** ADDED LOGGING ***
            console.log(`[checkIfRepoExists] .git directory found in ${this.dir}.`);
            this.addOutput(`Repository found in ${this.dir}. Building file tree...`);
            this._ngZone.run(() => { this.cloneDone = true; });
            await this.buildAndDisplayFileTree();
        } catch (e: any) {
            // *** ADDED LOGGING ***
            console.log(`[checkIfRepoExists] Error checking for .git:`, e);
            if (e.code === 'ENOENT') {
                this.addOutput(`No existing repository found in ${this.dir}. Ready to clone.`);
                 console.log(`[checkIfRepoExists] Repo not found locally (ENOENT).`);
            } else {
                this.addOutput(`Error checking for repository: ${e.message || e}`, 'error');
                 console.error(`[checkIfRepoExists] Unexpected error:`, e);
            }
            this._ngZone.run(() => { this.repositoryTree = []; });
        } finally {
            this.setProcessingTree(false);
            this._cdRef.detectChanges();
        }
    }

    // ===============================================
    // *** CLONE REPO WITH ENHANCED LOGGING ***
    // ===============================================
    async cloneRepo(): Promise<void> {
        // --- Start Clone Logging ---
        console.log('--- [cloneRepo] Initiated ---');
        console.log('[cloneRepo] Current activeRepository:', JSON.stringify(this.activeRepository)); // Log the whole object
        console.log('[cloneRepo] Current this.dir:', this.dir);
        console.log('[cloneRepo] Is githubAccessToken present?', !!this.githubAccessToken);
        // Uncomment below ONLY for temporary local debugging - NEVER COMMIT/SHARE REAL TOKENS
        // console.log('[cloneRepo] Token Value (DEBUG ONLY):', this.githubAccessToken);
        console.log('[cloneRepo] Is loading?', this.isLoading);
        // --- End Initial Clone Logging ---

        if (!this.activeRepository) {
            this.addOutput('Error: No active repository selected.', 'error');
            console.error('[cloneRepo] ABORTED: activeRepository is null.');
            return;
        }
        if (!this.githubAccessToken) {
            this.addOutput('Error: GitHub Access Token required for cloning.', 'error');
            console.error('[cloneRepo] ABORTED: githubAccessToken is missing.');
            this.fetchGithubAccessToken(); // Try to get token
            return;
        }
        if (this.isLoading) {
            this.addOutput('Operation already in progress.', 'warn');
            console.warn('[cloneRepo] ABORTED: isLoading is true.');
            return;
        }

        // Set loading state and clear UI specific to this repo
        this.setLoading(true, `Clone (${this.activeRepository.name})`);
        this._ngZone.run(() => {
            this.repositoryTree = [];
            this.selectedFile = null;
            this.cloneDone = false;
        });
        this.addOutput(`Attempting to clone ${this.activeRepository.url} into ${this.dir}...`);
        console.log(`[cloneRepo] UI reset for directory: ${this.dir}`);

        // Prepare clone parameters
        const cloneUrl = this.activeRepository.url;
        const cloneDir = this.dir;
        const cloneHeaders = { 'Authorization': `Bearer ${this.githubAccessToken}` };

        // Log parameters right before the call
        console.log(`[cloneRepo] Parameters for git.clone:`);
        console.log(`  >> fs:`, this.fs ? 'FS Instance OK' : 'FS MISSING!'); // Check if FS exists
        console.log(`  >> http:`, http ? 'HTTP Instance OK' : 'HTTP MISSING!'); // Check if http exists
        console.log(`  >> dir: ${cloneDir}`);
        console.log(`  >> url: ${cloneUrl}`);
        console.log(`  >> headers:`, cloneHeaders); // Log headers (token is masked by Bearer)
        console.log(`  >> singleBranch: true`);
        console.log(`  >> depth: 10`);

        try {
            // Directory management
            this.addOutput("Cleaning/creating target directory...");
            console.log(`[cloneRepo] Cleaning/creating directory: ${cloneDir}`);
            try {
                await this.fs.promises.rmdir(cloneDir, { recursive: true } as any);
                console.log(`[cloneRepo] rmdir successful for ${cloneDir}`);
            } catch (e: any) {
                if (e.code !== 'ENOENT') { console.warn(`[cloneRepo] Note: rmdir failed (not ENOENT): ${e.message}`); }
                else { console.log(`[cloneRepo] rmdir skipped (ENOENT) for ${cloneDir}`); }
            }
            try {
                await this.fs.promises.mkdir(cloneDir);
                console.log(`[cloneRepo] mkdir successful for ${cloneDir}`);
            } catch (mkdirErr: any) {
                if (mkdirErr.code !== 'EEXIST') {
                    console.error(`[cloneRepo] mkdir failed (not EEXIST):`, mkdirErr);
                    throw new Error(`Failed to create directory ${cloneDir}: ${mkdirErr.message || mkdirErr}`);
                } else {
                    console.log(`[cloneRepo] mkdir skipped (EEXIST) for ${cloneDir}`);
                }
            }

            // *** The Core git.clone Call ***
            this.addOutput("Starting git clone operation...");
            console.log("[cloneRepo] >>> Calling git.clone <<<");
            await git.clone({
                fs: this.fs,
                http: http,
                dir: cloneDir, // Variable from the function scope
                url: cloneUrl, // Variable from the function scope
                singleBranch: true,
                depth: 10,
                // *** INCLUDE BOTH headers AND corsProxy ***
               // headers: cloneHeaders, // Variable from the function scope
                corsProxy: this.corsProxy, // <<< ADD THIS BACK
                // *** ------------------------------ ***
                onProgress: (progress) => { console.log('[cloneRepo] Progress:', progress.phase, progress.loaded, '/', progress.total); },
                onMessage: (message) => {
                     const msg = message.trim();
                     this.addOutput(`Remote: ${msg}`);
                     console.log(`[cloneRepo] Remote message: ${msg}`);
                }
            });
            // *** Clone Success ***
            console.log("[cloneRepo] >>> git.clone Successful <<<");
            this.addOutput('Clone successful!', 'log');
            this._ngZone.run(() => { this.cloneDone = true; });
            await this.buildAndDisplayFileTree();

        } catch (error: any) {
            // *** Clone Failure ***
            console.error("[cloneRepo] >>> git.clone FAILED <<<");
            this.addOutput(`Clone failed: ${error.message || error}`, 'error');
             if (error.data?.statusCode === 401 || error.message?.includes('401')) {
                 this.addOutput('Authentication failed. Token might be invalid or expired.', 'error');
                  console.error("[cloneRepo] Auth Error (401): Token invalid/expired?");
                 this.githubAccessToken = null; // Clear potentially bad token
             } else if (error.data?.statusCode === 403 || error.message?.includes('403')) {
                 this.addOutput('Authorization failed. Token might lack permissions or repo access restricted.', 'error');
                  console.error("[cloneRepo] Auth Error (403): Permissions issue?");
             } else if (error.data?.statusCode === 404 || error.message?.includes('404')) {
                 this.addOutput('Repository not found at the specified URL.', 'error');
                  console.error("[cloneRepo] Not Found Error (404): Bad URL?");
             }
            console.error("[cloneRepo] Full Clone Error Details:", error); // Log the complete error object
            this._ngZone.run(() => { this.cloneDone = false; });
        } finally {
            this.setLoading(false, `Clone (${this.activeRepository?.name})`);
             console.log('--- [cloneRepo] Finished ---');
        }
    }
    // ===============================================
    // *** END CLONE REPO WITH ENHANCED LOGGING ***
    // ===============================================


    async buildAndDisplayFileTree(): Promise<void> {
        if (!this.activeRepository || !this.cloneDone || !this.fs) return;
        // *** ADDED LOGGING ***
        console.log(`[buildAndDisplayFileTree] Building tree for dir: ${this.dir}`);
        this.addOutput('Building file tree from HEAD...');
        this.setProcessingTree(true);
        this._ngZone.run(() => { this.repositoryTree = []; this.selectedFile = null; });

        try {
            const paths = await git.listFiles({ fs: this.fs, dir: this.dir });
            this.addOutput(`Found ${paths.length} file paths in HEAD.`);
            const tree = this.buildTreeFromPaths(paths);
            this._ngZone.run(() => { this.repositoryTree = tree; });
            this.addOutput('File tree built successfully.');
            console.log(`[buildAndDisplayFileTree] Tree built successfully for ${this.dir}.`);
        } catch (error: any) {
            this.addOutput(`Failed to build file tree: ${error.message || error}`, 'error');
            console.error(`[buildAndDisplayFileTree] Error for ${this.dir}:`, error);
            this._ngZone.run(() => { this.repositoryTree = []; });
        } finally {
            this.setProcessingTree(false);
            this._cdRef.detectChanges();
        }
    }

    // (pullChanges, pushChanges, getStatus - logging can be added similarly if needed)
    async pullChanges(): Promise<void> {
        if (!this.activeRepository || !this.cloneDone || this.isLoading || !this.fs) return;
        if (!this.githubAccessToken) { this.addOutput('Error: GitHub Access Token required for pull.', 'error'); return; }

        this.setLoading(true, `Pull (${this.activeRepository.name})`);
        console.log(`--- [pullChanges] Initiated for dir: ${this.dir} ---`); // Added log
        try {
            this.addOutput('Step 1: Fetching from remote...');
            console.log(`[pullChanges] Calling git.fetch`); // Added log
            const fetchResult = await git.fetch({
                fs: this.fs,
                http: http,
                dir: this.dir,
                singleBranch: true,
                // *** INCLUDE BOTH headers AND corsProxy ***
                headers: { 'Authorization': `Bearer ${this.githubAccessToken}` },
                corsProxy: this.corsProxy, // <<< ADD THIS BACK
                // *** ------------------------------ ***
            });
            this.addOutput(`Fetch result: ${JSON.stringify(fetchResult)}`);
            console.log(`[pullChanges] git.fetch result:`, fetchResult); // Added log

            if(fetchResult?.fetchHead) {
                this.addOutput(`Fetched remote commit: ${fetchResult.fetchHead}`);
                this.addOutput('Step 2: Merging fetched changes (fast-forward only)...');
                 console.log(`[pullChanges] Calling git.merge with FETCH_HEAD: ${fetchResult.fetchHead}`); // Added log
                const mergeResult = await git.merge({
                    fs: this.fs, dir: this.dir, ours: 'HEAD', theirs: fetchResult.fetchHead, fastForwardOnly: true,
                    author: { name: 'Browser User', email: 'user@browser.com' }
                });
                this.addOutput(`Merge result: ${JSON.stringify(mergeResult)}`);
                 console.log(`[pullChanges] git.merge result:`, mergeResult); // Added log
                this.addOutput(mergeResult.oid ? `Pull successful (merged). New HEAD: ${mergeResult.oid}` : 'Pull successful (fast-forward or already up-to-date).');
                await this.buildAndDisplayFileTree();
            } else {
                this.addOutput('Fetch did not return a head. Repo might be empty or up-to-date.', 'warn');
                console.log(`[pullChanges] Fetch returned no fetchHead.`); // Added log
            }
        } catch (error: any) {
             this.addOutput(`Pull failed: ${error.message || error}`, 'error');
             console.error("[pullChanges] >>> FAILED <<<", error); // Added log
              if (error.data?.statusCode === 401 || error.message?.includes('401')) {
                 this.addOutput('Authentication failed. Token might be invalid or expired.', 'error');
                  this.githubAccessToken = null;
             } else if (error.code === 'FastForwardError') {
                  this.addOutput('Pull failed: Local branch has diverged. Manual merge needed (not implemented).', 'error');
             }
             console.error("Pull Error Full Details:", error);
        } finally {
            this.setLoading(false, `Pull (${this.activeRepository?.name})`);
            console.log(`--- [pullChanges] Finished for dir: ${this.dir} ---`); // Added log
        }
    }

    async pushChanges(): Promise<void> {
        if (!this.activeRepository || !this.cloneDone || this.isLoading || !this.fs) return;
        if (!this.githubAccessToken) { this.addOutput('Error: GitHub Access Token required for push.', 'error'); return; }

        this.setLoading(true, `Push (${this.activeRepository.name})`);
        console.log(`--- [pushChanges] Initiated for dir: ${this.dir} ---`); // Added log
        this.addOutput('Attempting to push changes...');
        try {
             console.log(`[pushChanges] Calling git.push`); // Added log
             const result = await git.push({
                fs: this.fs,
                http: http,
                dir: this.dir,
                 // *** INCLUDE BOTH headers AND corsProxy ***
                headers: { 'Authorization': `Bearer ${this.githubAccessToken}` },
                corsProxy: this.corsProxy, // <<< ADD THIS BACK
                 // *** ------------------------------ ***
            });
            this.addOutput(`Push raw result: ${JSON.stringify(result)}`, 'log');
            console.log(`[pushChanges] git.push result:`, result); // Added log

            if (result?.ok && !result.error) {
                 this.addOutput('Push successful.', 'log');
            } else {
                 this.addOutput(`Push failed or encountered errors. Error: ${result?.error || 'Check console.'}`, 'error');
                 console.warn("[pushChanges] Push Result Details (Failure or Errors):", result);
            }
        } catch (error: any) {
             this.addOutput(`Push failed with exception: ${error.message || error}`, 'error');
             console.error("[pushChanges] >>> FAILED (Exception) <<<", error); // Added log
             if (error.data?.statusCode === 401 || error.message?.includes('401')) {
                 this.addOutput('Authentication failed. Token might be invalid or expired.', 'error');
                  this.githubAccessToken = null;
             } else if (error.data?.statusCode === 403 || error.message?.includes('403')) {
                 this.addOutput('Authorization failed. Token might lack sufficient permissions (e.g., write access).', 'error');
             }
             console.error("Push Exception Full Details:", error);
        } finally {
            this.setLoading(false, `Push (${this.activeRepository?.name})`);
            console.log(`--- [pushChanges] Finished for dir: ${this.dir} ---`); // Added log
        }
    }

    async getStatus(): Promise<void> {
        if (!this.activeRepository || !this.cloneDone || this.isLoading || !this.fs) return;
        this.setLoading(true, `Status (${this.activeRepository.name})`);
         console.log(`--- [getStatus] Initiated for dir: ${this.dir} ---`); // Added log
        try {
           const status = await git.statusMatrix({ fs: this.fs, dir: this.dir });
           this.addOutput('Status Matrix: [File, HEAD, WorkDir, Stage]');
            console.log(`[getStatus] Raw status matrix:`, status); // Added log
           if (status.length === 0) { this.addOutput('  (Working directory clean)'); }
           else {
                status.forEach(row => {
                    const mapCode = (code:number) => ({0:'absent', 1:'new', 2:'deleted', 3:'modified', 4:'unmod'})[code] || '?';
                    const headStat = mapCode(row[1]);
                    const workdirStat = mapCode(row[2]);
                    const stageStat = mapCode(row[3]);
                    let fileStatus = '';
                    if (stageStat === 'new') fileStatus = 'A ';
                    else if (stageStat === 'deleted') fileStatus = 'D ';
                    else if (stageStat === 'modified') fileStatus = 'M ';
                    else if (workdirStat === 'new' && headStat === 'absent') fileStatus = '??';
                    else if (workdirStat === 'deleted' && headStat !== 'absent') fileStatus = ' D';
                    else if (workdirStat === 'modified') fileStatus = ' M';

                    this.addOutput(`  ${fileStatus || '  '} ${row[0]}`);
                });
            }
        } catch (error: any) {
             this.addOutput(`Failed to get status: ${error.message || error}`, 'error');
             console.error(`[getStatus] >>> FAILED <<<`, error); // Added log
        } finally {
             this.setLoading(false, `Status (${this.activeRepository?.name})`);
             console.log(`--- [getStatus] Finished for dir: ${this.dir} ---`); // Added log
        }
    }


    // --- File Tree & Viewing Logic (Adapted for Codemirror) ---

    async viewFileContent(node: TreeNode): Promise<void> {
        if (node.isDirectory || this.isProcessingTree || !this.activeRepository) { return; }
        if (this.selectedFile?.isDirty) {
             const confirmDiscard = confirm("You have unsaved changes. Are you sure you want to discard them and open another file?");
             if (!confirmDiscard) return;
        }

        this.addOutput(`Reading content for: ${node.path}`);
         console.log(`--- [viewFileContent] Reading: ${this.dir}/${node.path} ---`);// Added log
        this.setProcessingTree(true);
        this._ngZone.run(() => {
            this.selectedFile = { path: node.path, content: null, originalContent: null, isDirty: false, isLoading: true };
        });

        try {
            const fsPath = `${this.dir}/${node.path}`;
            const contentBuffer = await this.fs.promises.readFile(fsPath);
            const content = Buffer.from(contentBuffer).toString('utf8');
             console.log(`[viewFileContent] Read ${content.length} chars from ${fsPath}`);// Added log

            const extension = node.name.split('.').pop()?.toLowerCase();
            let mode = 'text/plain';
            if (extension === 'js' || extension === 'mjs' || extension === 'cjs') mode = 'javascript';
            else if (extension === 'ts') mode = 'text/typescript';
            else if (extension === 'json') mode = 'application/json';
            else if (extension === 'html' || extension === 'htm') mode = 'xml';
            else if (extension === 'css') mode = 'css';
            else if (extension === 'md') mode = 'markdown';
            else if (extension === 'java') mode = 'text/x-java';
            else if (extension === 'py') mode = 'python';
            else if (extension === 'scss') mode = 'text/x-scss';
            else if (extension === 'sh') mode = 'text/x-sh';
             console.log(`[viewFileContent] Determined mode: ${mode}`);// Added log


            this.cmOptions = { ...this.cmOptions, mode: mode };

            this._ngZone.run(() => {
                if (this.selectedFile?.path === node.path) {
                    this.selectedFile.content = content;
                    this.selectedFile.originalContent = content;
                    this.selectedFile.isLoading = false;
                    this.selectedFile.isDirty = false;
                    this.selectedFile.error = undefined;
                } else {
                     console.warn(`[viewFileContent] Selection changed while loading ${node.path}`);// Added log
                }
            });
            this.addOutput(`Successfully read content for: ${node.path}`);

        } catch (error: any) {
            let errorMessage = `Failed to read file content: ${error.message || error}`;
             console.error(`[viewFileContent] Error reading ${this.dir}/${node.path}:`, error);// Added log
            if (error instanceof Error && (error.message.includes('invalid byte sequence') || error.message.includes('malformed UTF-8'))) {
                 errorMessage = 'Cannot display content: File appears to be binary or uses unsupported encoding.';
                 this.addOutput(`Cannot display content for ${node.path}: Binary or unsupported encoding.`, 'warn');
            } else {
                 this.addOutput(`Error reading ${node.path}: ${errorMessage}`, 'error');
                 console.error(`File Read Error (${node.path}):`, error);
            }
            this._ngZone.run(() => {
                if (this.selectedFile?.path === node.path) {
                     this.selectedFile.content = null; this.selectedFile.originalContent = null;
                     this.selectedFile.isLoading = false; this.selectedFile.isDirty = false;
                     this.selectedFile.error = errorMessage;
                }
            });
        } finally {
            this.setProcessingTree(false);
            this._cdRef.detectChanges();
             console.log(`--- [viewFileContent] Finished: ${this.dir}/${node.path} ---`);// Added log
        }
    }

    // --- Editing & Committing Logic ---

    onCodeMirrorChange(newContent: string): void {
        if (this.selectedFile && !this.selectedFile.isLoading) {
            const wasDirty = this.selectedFile.isDirty;
            this.selectedFile.isDirty = (newContent !== this.selectedFile.originalContent);
            // Log only when dirty state changes
            if (wasDirty !== this.selectedFile.isDirty) {
                 console.log(`[onCodeMirrorChange] File ${this.selectedFile.path} isDirty changed to: ${this.selectedFile.isDirty}`);
            }
        }
    }

    async saveFileChanges(): Promise<void> {
         if (!this.selectedFile || !this.selectedFile.isDirty || this.isSavingFile || !this.activeRepository || !this.fs) { return; }

         const filePath = this.selectedFile.path; // Capture for logging
         this.addOutput(`Saving changes to ${filePath}...`);
         console.log(`--- [saveFileChanges] Saving: ${this.dir}/${filePath} ---`);// Added log
         this.setIsSavingFile(true);
         const fsPath = `${this.dir}/${filePath}`;
         const contentToSave = this.selectedFile.content ?? '';

         try {
             // 1. Write file
              console.log(`[saveFileChanges] Calling fs.promises.writeFile for ${fsPath}`);// Added log
             await this.fs.promises.writeFile(fsPath, contentToSave, {
                 encoding: 'utf8',
                 mode: 0o666
             });
             this.addOutput(`File ${filePath} saved successfully.`);
             console.log(`[saveFileChanges] writeFile successful.`);// Added log

             // 2. Stage the change
             this.addOutput(`Staging ${filePath}...`);
              console.log(`[saveFileChanges] Calling git.add for ${filePath}`);// Added log
             await git.add({ fs: this.fs, dir: this.dir, filepath: filePath });
             this.addOutput(`${filePath} staged successfully.`);
              console.log(`[saveFileChanges] git.add successful.`);// Added log

             // 3. Update state
             this._ngZone.run(() => {
                 this.selectedFile!.originalContent = contentToSave;
                 this.selectedFile!.isDirty = false;
                  console.log(`[saveFileChanges] State updated: isDirty=false`);// Added log
             });

         } catch (error: any) {
             this.addOutput(`Error saving or staging file ${filePath}: ${error.message || error}`, 'error');
             console.error(`[saveFileChanges] >>> FAILED <<<`, error); // Added log
         } finally {
              this.setIsSavingFile(false);
               console.log(`--- [saveFileChanges] Finished: ${this.dir}/${filePath} ---`);// Added log
         }
    }

    async commitChanges(): Promise<void> {
        if (!this.activeRepository || this.isLoading || !this.fs) return;

        const commitMessage = prompt("Enter commit message:");
        if (!commitMessage) { this.addOutput('Commit cancelled.', 'warn'); return; }

        const authorInfo = { name: 'Web User', email: 'user@example.com' };

        this.addOutput(`Committing changes with message: "${commitMessage}"...`);
        console.log(`--- [commitChanges] Committing in dir: ${this.dir} ---`);// Added log
        this.setLoading(true, `Commit (${this.activeRepository.name})`);

        try {
            console.log(`[commitChanges] Calling git.commit with message: "${commitMessage}"`);// Added log
            const sha = await git.commit({
                fs: this.fs, dir: this.dir, message: commitMessage, author: authorInfo
            });
            this.addOutput(`Commit successful! SHA: ${sha}`, 'log');
            console.log(`[commitChanges] Commit successful, SHA: ${sha}`);// Added log

        } catch (error: any) {
            this.addOutput(`Commit failed: ${error.message || error}`, 'error');
            console.error(`[commitChanges] >>> FAILED <<<`, error); // Added log
             if (error.code === 'EmptyCommitError') {
                  this.addOutput('Commit failed: No changes added to commit.', 'warn');
             }
            console.error("Commit Error Full Details:", error);
        } finally {
            this.setLoading(false, `Commit (${this.activeRepository.name})`);
             console.log(`--- [commitChanges] Finished for dir: ${this.dir} ---`);// Added log
        }
    }

    // --- Helper Methods ---
    addOutput(message: string, level: 'log' | 'warn' | 'error' = 'log'): void {
        const timestamp = new Date().toLocaleTimeString();
        const logMessage = `[${timestamp}] ${message}`;
        // Keep console log for immediate feedback during dev
        // console[level](logMessage); // Comment this out if the UI log is sufficient

        this._ngZone.run(() => {
            this.output.push(logMessage);
            if (this.output.length > 200) { this.output.shift(); }
        });
    }

    clearOutput(): void {
        this._ngZone.run(() => { this.output = ['Log cleared.']; });
         console.clear(); // Also clear browser console for easier debugging
         console.log("ExampleComponent: Console and UI Log cleared.");
    }

    setLoading(loading: boolean, operation?: string): void {
        this._ngZone.run(() => {
            if (this.isLoading === loading) return;
            this.isLoading = loading;
            const status = loading ? 'started' : 'finished';
            // Add log only when state changes and operation is provided
            if (operation) {
                 const logMsg = `Operation ${status}: ${operation}.`;
                 this.addOutput(logMsg);
                 console.log(`[SetLoading:${loading}] ${logMsg}`);
            }
            this._cdRef.detectChanges();
        });
    }

    setProcessingTree(processing: boolean): void {
         this._ngZone.run(() => {
            if (this.isProcessingTree === processing) return;
            this.isProcessingTree = processing;
             console.log(`[SetProcessingTree:${processing}]`);
            this._cdRef.detectChanges();
         });
    }

    setIsSavingFile(saving: boolean): void {
         this._ngZone.run(() => {
            if (this.isSavingFile === saving) return;
            this.isSavingFile = saving;
             console.log(`[SetIsSavingFile:${saving}]`);
            this._cdRef.detectChanges();
         });
    }

    buildTreeFromPaths(paths: string[]): TreeNode[] {
       // This function is purely data transformation, logging usually not needed unless debugging the tree itself
       const root: TreeNode = { name: '', path: '', isDirectory: true, children: [] };
       paths.forEach((path) => {
           let currentNode = root;
           const parts = path.split('/');
           parts.forEach((part, index) => {
               if (!currentNode.children) { currentNode.children = []; }
               let childNode = currentNode.children.find((child) => child.name === part);
               const isLastPart = index === parts.length - 1;
               if (!childNode) {
                   const newPath = parts.slice(0, index + 1).join('/');
                   childNode = { name: part, path: newPath, isDirectory: !isLastPart,
                       children: isLastPart ? undefined : [], expanded: false };
                   currentNode.children.push(childNode);
               } else {
                   if (!isLastPart && !childNode.isDirectory) {
                       childNode.isDirectory = true;
                       childNode.children = childNode.children || [];
                   }
               }
               currentNode.children.sort((a, b) => {
                   if (a.isDirectory !== b.isDirectory) { return a.isDirectory ? -1 : 1; }
                   return a.name.localeCompare(b.name);
               });
               currentNode = childNode;
           });
       });
       return root.children || [];
    }

    toggleNodeExpansion(node: TreeNode): void {
        if (node.isDirectory) {
            node.expanded = !node.expanded;
            console.log(`[toggleNodeExpansion] Node ${node.path} expanded: ${node.expanded}`); // Added log
        }
        this._cdRef.detectChanges();
    }

}