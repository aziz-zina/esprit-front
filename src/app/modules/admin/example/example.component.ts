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
import http from 'isomorphic-git/http/web'; // http is still needed
import { ExampleService, GithubApiRepo } from './example.service'; // Import service and interface

// --- Interfaces ---
interface TreeNode { name: string; path: string; isDirectory: boolean; children?: TreeNode[]; expanded?: boolean; }
interface SelectedFile { path: string; content: string | null; originalContent: string | null; isDirty: boolean; isLoading: boolean; error?: string; }
interface RepositoryInfo { id: number; name: string; fullName: string; url: string; // Original HTTPS URL
    localPath: string; }

// Define constants for Git status codes based on isomorphic-git's statusMatrix
// [filepath, headStatus, workdirStatus, stageStatus]
const headStatus = 1;
const workdirStatus = 2;
const stageStatus = 3;
// Codes: 0 = absent, 1 = added, 2 = deleted, 3 = modified
const GIT_STATUS = {
    ABSENT: 0,
    ADDED: 1,
    DELETED: 2,
    MODIFIED: 3,
};


@Component({
    selector: 'example',
    standalone: true,
    imports: [ FormsModule, CommonModule, CodemirrorModule ],
    templateUrl: './example.component.html',
})
export class ExampleComponent implements OnInit, OnDestroy {
    private readonly exampleService = inject(ExampleService);
    private _cdRef = inject(ChangeDetectorRef);
    private _ngZone = inject(NgZone);
    private tokenSubscription: Subscription | null = null;
    private githubApiSubscription: Subscription | null = null;

    // --- Authentication State ---
    githubAccessToken: string | null = null;

    // --- Repo Management State ---
    githubRepoList: GithubApiRepo[] | null = null;
    managedRepositories: RepositoryInfo[] = [];
    activeRepository: RepositoryInfo | null = null;
    isFetchingRepos = false;
    readonly localStorageManagedReposKey = 'gitBrowser_managedRepos';

    // --- Git & FS State ---
    fs!: FS;
    dir: string = '';
    corsProxy = 'https://cors.isomorphic-git.org'; // *** CORS PROXY IS REQUIRED ***
    output: string[] = [];
    isLoading = false;
    isProcessingTree = false;
    cloneDone = false;
    repositoryTree: TreeNode[] = [];

    // --- Editor State ---
    selectedFile: SelectedFile | null = null;
    isSavingFile = false;
    cmOptions: CodeMirror.EditorConfiguration = { lineNumbers: true, theme: 'material', mode: 'javascript', readOnly: false };

    constructor() { /* ... constructor code remains the same ... */
        console.log('ExampleComponent: Constructor started.');
        this._injectBufferPolyfill();
        this._loadManagedRepos();
        this._initializeFilesystem();
        this.fetchGithubAccessToken();
        console.log('ExampleComponent: Constructor finished.');
    }
    ngOnInit(): void { /* ... ngOnInit code remains the same ... */
        console.log('ExampleComponent: ngOnInit started.');
        if (this.fs && this.activeRepository) {
            this.checkIfRepoExists();
        } else if (!this.fs) {
            console.warn('ExampleComponent: FS not initialized.');
        }
        console.log('ExampleComponent: ngOnInit finished.');
    }
    ngOnDestroy(): void { /* ... ngOnDestroy code remains the same ... */
         console.log('ExampleComponent: ngOnDestroy.');
         this.tokenSubscription?.unsubscribe();
         this.githubApiSubscription?.unsubscribe();
    }

    // --- Initialization & State Loading ---
    private _injectBufferPolyfill(): void { /* ... code remains the same ... */
        if (typeof (window as any).Buffer === 'undefined') {
            (window as any).Buffer = Buffer;
            console.log('[Polyfill] Injected Buffer.');
        }
    }
    private _initializeFilesystem(): void { /* ... code remains the same ... */
        try {
            this.fs = new FS('my-git-fs');
            this.addOutput('Filesystem initialized.');
            console.log('ExampleComponent: Filesystem initialized.');
        } catch (fsError: any) {
            console.error('ExampleComponent: Failed to initialize Filesystem!', fsError);
            this.addOutput(`FATAL: Failed to initialize Filesystem: ${fsError.message || fsError}`, 'error');
        }
    }
    private _loadManagedRepos(): void { /* ... code remains the same ... */
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
    private _saveManagedRepos(): void { /* ... code remains the same ... */
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
                    // *** TEMPORARY LOGGING - REMOVE BEFORE PRODUCTION ***
                    console.warn(`[DEBUG] Fetched Token (REMOVE THIS LOG): ${token}`);
                    // *****************************************************
                    console.log(`[fetchGithubAccessToken] Token retrieved. Starts with: ${token.substring(0, 6)}..., Length: ${token.length}`);
                    this.addOutput('GitHub access token obtained successfully.');
                } else {
                    this.githubAccessToken = null;
                    console.warn('[fetchGithubAccessToken] Token received from service was null or empty.');
                    this.addOutput('Could not retrieve GitHub access token. Check Keycloak session and configuration.', 'warn');
                }
                this.isLoading = false;
                this._cdRef.detectChanges();
            },
            error: (error) => {
                this.githubAccessToken = null;
                this.addOutput('Failed to fetch GitHub access token.', 'error');
                 console.error('[fetchGithubAccessToken] Error subscription:', error);
                this.isLoading = false;
                this._cdRef.detectChanges();
            },
        });
    }

    // --- GitHub Repo Fetching ---
    fetchGithubRepos(): void { /* ... code remains the same ... */
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
                this.addOutput('Failed to fetch repositories from GitHub API.', 'error');
                 console.error('[fetchGithubRepos] API Error:', err);
                this.isFetchingRepos = false;
                this.githubRepoList = [];
                this._cdRef.detectChanges();
            }
        });
    }

    // --- Managed Repositories Logic ---
    addRepoToManaged(repo: GithubApiRepo): void { /* ... code remains the same ... */
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
        this.addOutput(`Added "${repo.full_name}" to managed list. Select it to clone or manage.`, 'log');
    }
    async removeManagedRepo(repoToRemove: RepositoryInfo): Promise<void> { /* ... code remains the same (uses recursive delete) ... */
        const confirmation = confirm(`DELETE LOCAL COPY?\n\nAre you sure you want to remove the local copy of "${repoToRemove.fullName}"?\n\nThis will delete all local data for this repository from your browser, including any unsaved changes. This cannot be undone.`);
        if (!confirmation) return;

        this.addOutput(`Removing local copy of "${repoToRemove.fullName}"...`);
        this.setLoading(true, `Remove Local (${repoToRemove.name})`);

        try {
            const pathExists = await this.fs.promises.stat(repoToRemove.localPath).then(() => true).catch(e => {
                if (e.code === 'ENOENT') return false;
                throw e;
            });

            if (pathExists) {
                console.log(`[removeManagedRepo] Directory ${repoToRemove.localPath} exists. Attempting recursive delete.`);
                await this.deleteDirectoryRecursive(repoToRemove.localPath);
                this.addOutput(`Successfully removed directory: ${repoToRemove.localPath}`);
            } else {
                 this.addOutput(`Directory ${repoToRemove.localPath} not found locally, removing from list only.`, 'warn');
            }

            this.managedRepositories = this.managedRepositories.filter(r => r.id !== repoToRemove.id);
            this._saveManagedRepos();
            this.addOutput(`"${repoToRemove.fullName}" removed from managed list.`);

            if (this.activeRepository?.id === repoToRemove.id) {
                this.setActiveRepository(null);
            }
        } catch (error: any) {
            this.addOutput(`Error removing repository directory ${repoToRemove.localPath}: ${error.message || error}`, 'error');
            console.error("Remove Repo Error:", error);
        } finally {
            this.setLoading(false, `Remove Local (${repoToRemove.name})`);
        }
    }
    private async deleteDirectoryRecursive(dirPath: string): Promise<void> { /* ... code remains the same ... */
        console.log(`[deleteDirectoryRecursive] Deleting path: ${dirPath}`);
        try {
            const entries = await this.fs.promises.readdir(dirPath);
            console.log(`[deleteDirectoryRecursive] Found ${entries.length} entries in ${dirPath}`);
            for (const entry of entries) {
                const fullPath = `${dirPath}/${entry}`;
                const stats = await this.fs.promises.lstat(fullPath);
                if (stats.isDirectory()) {
                    console.log(`[deleteDirectoryRecursive] Recursing into directory: ${fullPath}`);
                    await this.deleteDirectoryRecursive(fullPath);
                } else {
                    console.log(`[deleteDirectoryRecursive] Deleting file: ${fullPath}`);
                    await this.fs.promises.unlink(fullPath);
                }
            }
            console.log(`[deleteDirectoryRecursive] Removing now-empty directory: ${dirPath}`);
            await this.fs.promises.rmdir(dirPath);
        } catch (error: any) {
             console.error(`[deleteDirectoryRecursive] Error during deletion of ${dirPath}:`, error);
             this.addOutput(`Failed to fully delete ${dirPath}: ${error.message}`, 'error');
             throw error;
        }
    }
    setActiveRepository(repoInfo: RepositoryInfo | null): void { /* ... code remains the same ... */
         console.log('[setActiveRepository] Called with:', repoInfo ? repoInfo.fullName : 'null');
         if (this.isLoading || this.isProcessingTree) {
            this.addOutput('Please wait for the current operation to finish before switching repositories.', 'warn');
            return;
         }
        if (this.activeRepository?.id === repoInfo?.id) {
             if (repoInfo !== null) {
                 console.log('[setActiveRepository] Repository already active.');
                 return;
             }
        }

        this.addOutput(repoInfo ? `Activating repository: "${repoInfo.fullName}"...` : 'Deactivating repository.');
        this.activeRepository = repoInfo;
        this.dir = repoInfo ? repoInfo.localPath : '';
        console.log(`[setActiveRepository] Set this.dir to: ${this.dir}`);

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
    isRepoManaged(repoId: number): boolean { /* ... code remains the same ... */
        return this.managedRepositories.some(r => r.id === repoId);
    }

    // --- Git Operations ---
    async checkIfRepoExists(): Promise<void> { /* ... code remains the same ... */
        if (!this.activeRepository || !this.fs) { return; }
        console.log(`[checkIfRepoExists] Checking for .git in directory: ${this.dir}`);
        this.addOutput(`Checking for existing repository in ${this.dir}...`);
        this.setProcessingTree(true);
        this.cloneDone = false;

        try {
            await this.fs.promises.stat(`${this.dir}/.git`);
            console.log(`[checkIfRepoExists] .git directory found in ${this.dir}.`);
            this.addOutput(`Repository found in ${this.dir}. Building file tree...`);
            this._ngZone.run(() => { this.cloneDone = true; });
            await this.buildAndDisplayFileTree();
        } catch (e: any) {
            console.log(`[checkIfRepoExists] Error checking for .git:`, e);
            if (e.code === 'ENOENT') {
                this.addOutput(`No existing repository found in ${this.dir}. Ready to clone.`);
            } else {
                this.addOutput(`Error checking for repository: ${e.message || e}`, 'error');
            }
            this._ngZone.run(() => { this.repositoryTree = []; });
        } finally {
            this.setProcessingTree(false);
        }
    }

    // ==========================================================
    // *** CLONE REPO - URL Auth + CORS Proxy Reinstated ***
    // ==========================================================
    async cloneRepo(): Promise<void> {
        console.log('--- [cloneRepo] Initiated (URL Auth + CORS Proxy) ---');
        console.log('[cloneRepo] Current activeRepository:', JSON.stringify(this.activeRepository));
        console.log('[cloneRepo] Current this.dir:', this.dir);
        console.log('[cloneRepo] Is githubAccessToken present?', !!this.githubAccessToken);

        if (!this.activeRepository) { this.addOutput('Error: No active repository selected.', 'error'); console.error('[cloneRepo] ABORTED: activeRepository is null.'); return; }
        if (!this.githubAccessToken) { this.addOutput('Error: GitHub Access Token required for cloning.', 'error'); console.error('[cloneRepo] ABORTED: githubAccessToken is missing.'); this.fetchGithubAccessToken(); return; }
        if (this.isLoading) { this.addOutput('Operation already in progress.', 'warn'); console.warn('[cloneRepo] ABORTED: isLoading is true.'); return; }

        this.setLoading(true, `Clone (${this.activeRepository.name})`);
        this._ngZone.run(() => { this.repositoryTree = []; this.selectedFile = null; this.cloneDone = false; });

        // *** USE ORIGINAL URL for the 'url' parameter when using corsProxy ***
        const cloneUrl = this.activeRepository.url;
        // *** Construct AUTHENTICATION INFO for the onAuth callback ***
        const auth = {
             username: 'oauth2', // Use 'oauth2' as username for token auth
             password: this.githubAccessToken
        };
        // *** --------------------------------------------------- ***

        const cloneDir = this.dir;
        this.addOutput(`Attempting to clone ${cloneUrl} into ${this.dir}...`);

        console.log(`[cloneRepo] Parameters for git.clone: dir=${cloneDir}, url=${cloneUrl}, corsProxy=${this.corsProxy}, auth=PRESENT`);

        try {
            // Directory management (remains the same)
            this.addOutput("Cleaning/creating target directory...");
            console.log(`[cloneRepo] Cleaning/creating directory: ${cloneDir}`);
            try { await this.fs.promises.rmdir(cloneDir, { recursive: true } as any); } catch (e: any) { if (e.code !== 'ENOENT') console.warn(`[cloneRepo] Note: rmdir failed (not ENOENT): ${e.message}`); else console.log(`[cloneRepo] rmdir skipped (ENOENT) for ${cloneDir}`); }
            try { await this.fs.promises.mkdir(cloneDir); console.log(`[cloneRepo] mkdir successful for ${cloneDir}`); } catch (mkdirErr: any) { if (mkdirErr.code !== 'EEXIST') { console.error(`[cloneRepo] mkdir failed:`, mkdirErr); throw mkdirErr; } else console.log(`[cloneRepo] mkdir skipped (EEXIST) for ${cloneDir}`); }

            // *** The Core git.clone Call (using onAuth + CORS Proxy) ***
            this.addOutput("Starting git clone operation...");
            console.log("[cloneRepo] >>> Calling git.clone (onAuth + CORS Proxy) <<<");
            await git.clone({
                fs: this.fs,
                http: http,
                dir: cloneDir,
                url: cloneUrl, // Use the ORIGINAL URL
                corsProxy: this.corsProxy, // *** REINSTATE CORS PROXY ***
                onAuth: () => auth,      // *** PROVIDE AUTH VIA CALLBACK ***
                singleBranch: true,
                depth: 10,
                // *** NO headers needed when using onAuth ***
                onProgress: (progress) => { console.log('[cloneRepo] Progress:', progress.phase, progress.loaded, '/', progress.total); },
                onMessage: (message) => { const msg = message.trim(); this.addOutput(`Remote: ${msg}`); console.log(`[cloneRepo] Remote message: ${msg}`); }
            });
            console.log("[cloneRepo] >>> git.clone Successful <<<");
            this.addOutput('Clone successful!', 'log');
            this._ngZone.run(() => { this.cloneDone = true; });
            await this.buildAndDisplayFileTree();

        } catch (error: any) {
            console.error("[cloneRepo] >>> git.clone FAILED <<<");
            this.addOutput(`Clone failed: ${error.message || error}`, 'error');
             const statusCode = error.data?.statusCode || error.http?.statusCode;
             console.log(`[cloneRepo] Error status code (if available): ${statusCode}`);
             if (statusCode === 401 || error.message?.includes('401')) {
                 this.addOutput('Authentication failed (401). Token might be invalid, expired, or lack repo access scope.', 'error');
                 console.error("[cloneRepo] Auth Error (401): Token invalid/expired/wrong scope?");
                 this.githubAccessToken = null;
             } else if (statusCode === 403) {
                 this.addOutput('Authorization failed (403). Token might lack sufficient permissions.', 'error');
                 console.error("[cloneRepo] Auth Error (403): Permissions issue?");
             } else if (statusCode === 404) {
                 this.addOutput('Repository not found (404).', 'error');
                 console.error("[cloneRepo] Not Found Error (404): Bad URL?");
             } else if (error.name === 'CorsError' || error.message?.includes('CORS') || error.message?.includes('fetch')) {
                  // This *shouldn't* happen with the proxy, but catch just in case
                 this.addOutput('CORS error detected despite proxy. Check proxy status/reachability.', 'error');
                 console.error("[cloneRepo] CORS Error (Unexpected):", error);
             }
            console.error("[cloneRepo] Full Clone Error Details:", error);
            this._ngZone.run(() => { this.cloneDone = false; });
        } finally {
            this.setLoading(false, `Clone (${this.activeRepository?.name})`);
            console.log('--- [cloneRepo] Finished ---');
        }
    }
    // ===============================================
    // *** END CLONE REPO - onAuth + CORS Proxy ***
    // ===============================================


    async buildAndDisplayFileTree(): Promise<void> { /* ... code remains the same ... */
        if (!this.activeRepository || !this.cloneDone || !this.fs) return;
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
        } catch (error: any) {
            this.addOutput(`Failed to build file tree: ${error.message || error}`, 'error');
            console.error(`[buildAndDisplayFileTree] Error for ${this.dir}:`, error);
            this._ngZone.run(() => { this.repositoryTree = []; });
        } finally {
            this.setProcessingTree(false);
        }
    }

    // ======================================================
    // *** PULL CHANGES - URL Auth + CORS Proxy Reinstated ***
    // ======================================================
    async pullChanges(): Promise<void> {
        if (!this.activeRepository || !this.cloneDone || this.isLoading || !this.fs) return;
        if (!this.githubAccessToken) { this.addOutput('Error: GitHub Access Token required for pull.', 'error'); return; }

        this.setLoading(true, `Pull (${this.activeRepository.name})`);
        const pullUrl = this.activeRepository.url; // Use original URL
        const auth = { username: 'oauth2', password: this.githubAccessToken }; // Auth object

        console.log(`--- [pullChanges] Initiated for dir: ${this.dir} ---`);
        try {
            this.addOutput('Step 1: Fetching from remote...');
            console.log(`[pullChanges] Calling git.fetch with url: ${pullUrl}, onAuth=PRESENT, corsProxy=${this.corsProxy}`);
            const fetchResult = await git.fetch({
                fs: this.fs,
                http: http,
                dir: this.dir,
                url: pullUrl, // *** USE ORIGINAL URL ***
                onAuth: () => auth, // *** USE onAuth ***
                corsProxy: this.corsProxy, // *** REINSTATE CORS PROXY ***
                singleBranch: true,
            });
            this.addOutput(`Fetch result: ${JSON.stringify(fetchResult)}`);
            console.log(`[pullChanges] git.fetch result:`, fetchResult);

            if(fetchResult?.fetchHead) {
                // Merge logic remains the same
                this.addOutput(`Fetched remote commit: ${fetchResult.fetchHead}`);
                this.addOutput('Step 2: Merging fetched changes (fast-forward only)...');
                const mergeResult = await git.merge({
                    fs: this.fs, dir: this.dir, ours: 'HEAD', theirs: fetchResult.fetchHead, fastForwardOnly: true,
                    author: { name: 'Browser User', email: 'user@browser.com' }
                });
                this.addOutput(`Merge result: ${JSON.stringify(mergeResult)}`);
                this.addOutput(mergeResult.oid ? `Pull successful (merged). New HEAD: ${mergeResult.oid}` : 'Pull successful (fast-forward or already up-to-date).');
                await this.buildAndDisplayFileTree();
            } else { this.addOutput('Fetch did not return a head.', 'warn'); }
        } catch (error: any) {
             this.addOutput(`Pull failed: ${error.message || error}`, 'error');
             console.error("[pullChanges] >>> FAILED <<<", error);
             const statusCode = error.data?.statusCode || error.http?.statusCode;
              if (statusCode === 401) { this.addOutput('Authentication failed (401).', 'error'); this.githubAccessToken = null; }
              else if (error.code === 'FastForwardError') { this.addOutput('Pull failed: Local branch has diverged.', 'error'); }
             console.error("Pull Error Full Details:", error);
        } finally {
            this.setLoading(false, `Pull (${this.activeRepository?.name})`);
        }
    }
     // ===============================================
    // *** END PULL CHANGES - onAuth + CORS Proxy ***
    // ===============================================

    // ======================================================
    // *** PUSH CHANGES - URL Auth + CORS Proxy Reinstated ***
    // ======================================================
    async pushChanges(): Promise<void> {
        if (!this.activeRepository || !this.cloneDone || this.isLoading || !this.fs) return;
        if (!this.githubAccessToken) { this.addOutput('Error: GitHub Access Token required for push.', 'error'); return; }

        this.setLoading(true, `Push (${this.activeRepository.name})`);
        const pushUrl = this.activeRepository.url; // Use original URL
        const auth = { username: 'oauth2', password: this.githubAccessToken }; // Auth object

        console.log(`--- [pushChanges] Initiated for dir: ${this.dir} ---`);
        this.addOutput('Attempting to push changes...');
        try {
             console.log(`[pushChanges] Calling git.push with url: ${pushUrl}, onAuth=PRESENT, corsProxy=${this.corsProxy}`);
             const result = await git.push({
                fs: this.fs,
                http: http,
                dir: this.dir,
                url: pushUrl, // *** USE ORIGINAL URL ***
                onAuth: () => auth, // *** USE onAuth ***
                corsProxy: this.corsProxy, // *** REINSTATE CORS PROXY ***
            });
            this.addOutput(`Push raw result: ${JSON.stringify(result)}`, 'log');
            console.log(`[pushChanges] git.push result:`, result);

            if (result?.ok && !result.error) { this.addOutput('Push successful.', 'log'); }
            else { this.addOutput(`Push failed or encountered errors. Error: ${result?.error || 'Check console.'}`, 'error'); console.warn("[pushChanges] Push Result Details:", result); }
        } catch (error: any) {
             this.addOutput(`Push failed with exception: ${error.message || error}`, 'error');
             console.error("[pushChanges] >>> FAILED (Exception) <<<", error);
             const statusCode = error.data?.statusCode || error.http?.statusCode;
             if (statusCode === 401) { this.addOutput('Authentication failed (401).', 'error'); this.githubAccessToken = null; }
             else if (statusCode === 403) { this.addOutput('Authorization failed (403). Insufficient permissions?', 'error'); }
             console.error("Push Exception Full Details:", error);
        } finally {
            this.setLoading(false, `Push (${this.activeRepository?.name})`);
        }
    }
    // ===============================================
    // *** END PUSH CHANGES - onAuth + CORS Proxy ***
    // ===============================================

    // ===============================================
    // *** GET STATUS WITH CORRECTED TYPE CHECK ***
    // ===============================================
    async getStatus(): Promise<void> {
        if (!this.activeRepository || !this.cloneDone || this.isLoading || !this.fs) return;
        this.setLoading(true, `Status (${this.activeRepository.name})`);
        console.log(`--- [getStatus] Initiated for dir: ${this.dir} ---`);
        try {
           const statusMatrix = await git.statusMatrix({ fs: this.fs, dir: this.dir });
           this.addOutput('Status Matrix: [File, HEAD, WorkDir, Stage]');
           console.log(`[getStatus] Raw status matrix:`, statusMatrix);
           if (statusMatrix.length === 0) { this.addOutput('  (Working directory clean)'); }
           else {
                statusMatrix.forEach(row => {
                    const filepath = row[0];
                    const headCode = row[headStatus];
                    const workdirCode = row[workdirStatus];
                    const stageCode = row[stageStatus];
                    let fileStatus = '  ';

                    if (stageCode === GIT_STATUS.ADDED) fileStatus = 'A ';
                    else if (stageCode === GIT_STATUS.DELETED) fileStatus = 'D ';
                    else if (stageCode === GIT_STATUS.MODIFIED) fileStatus = 'M ';
                    else if (workdirCode === GIT_STATUS.ADDED && headCode === GIT_STATUS.ABSENT) fileStatus = '??';
                    else if (workdirCode === GIT_STATUS.DELETED && headCode !== GIT_STATUS.ABSENT) fileStatus = ' D';
                    // Use the constant for modified check
                    else if (workdirCode === GIT_STATUS.MODIFIED) fileStatus = ' M';

                    this.addOutput(`  ${fileStatus} ${filepath}`);
                });
            }
        } catch (error: any) {
             this.addOutput(`Failed to get status: ${error.message || error}`, 'error');
             console.error(`[getStatus] >>> FAILED <<<`, error);
        } finally {
             this.setLoading(false, `Status (${this.activeRepository?.name})`);
        }
    }
    // ===============================================
    // *** END GET STATUS ***
    // ===============================================

    // --- File Tree & Viewing Logic ---
    async viewFileContent(node: TreeNode): Promise<void> { /* ... code remains the same ... */
        if (node.isDirectory || this.isProcessingTree || !this.activeRepository) { return; }
        if (this.selectedFile?.isDirty) {
             const confirmDiscard = confirm("You have unsaved changes. Discard and open another file?");
             if (!confirmDiscard) return;
        }

        this.addOutput(`Reading content for: ${node.path}`);
        console.log(`--- [viewFileContent] Reading: ${this.dir}/${node.path} ---`);
        this.setProcessingTree(true);
        this._ngZone.run(() => {
            this.selectedFile = { path: node.path, content: null, originalContent: null, isDirty: false, isLoading: true };
        });

        try {
            const fsPath = `${this.dir}/${node.path}`;
            const contentBuffer = await this.fs.promises.readFile(fsPath);
            const content = Buffer.from(contentBuffer).toString('utf8');
            console.log(`[viewFileContent] Read ${content.length} chars from ${fsPath}`);

            const extension = node.name.split('.').pop()?.toLowerCase();
            let mode = 'text/plain';
            if (['js', 'mjs', 'cjs'].includes(extension)) mode = 'javascript';
            else if (extension === 'ts') mode = 'text/typescript';
            else if (extension === 'json') mode = 'application/json';
            else if (['html', 'htm', 'xml'].includes(extension)) mode = 'xml';
            else if (extension === 'css') mode = 'css';
            else if (extension === 'scss') mode = 'text/x-scss';
            else if (extension === 'md') mode = 'markdown';
            else if (extension === 'java') mode = 'text/x-java';
            else if (extension === 'py') mode = 'python';
            else if (extension === 'sh') mode = 'text/x-sh';
            console.log(`[viewFileContent] Determined mode: ${mode}`);

            this.cmOptions = { ...this.cmOptions, mode: mode };

            this._ngZone.run(() => {
                if (this.selectedFile?.path === node.path) {
                    this.selectedFile.content = content;
                    this.selectedFile.originalContent = content;
                    this.selectedFile.isLoading = false;
                    this.selectedFile.isDirty = false;
                    this.selectedFile.error = undefined;
                } else {
                     console.warn(`[viewFileContent] Selection changed while loading ${node.path}`);
                }
            });
            this.addOutput(`Successfully read content for: ${node.path}`);

        } catch (error: any) {
            let errorMessage = `Failed to read file content: ${error.message || error}`;
             console.error(`[viewFileContent] Error reading ${this.dir}/${node.path}:`, error);
            if (error instanceof Error && (error.message.includes('invalid byte sequence') || error.message.includes('malformed UTF-8'))) {
                 errorMessage = 'Cannot display content: File appears to be binary or uses unsupported encoding.';
            }
            this.addOutput(`Error reading ${node.path}: ${errorMessage}`, 'error');
            this._ngZone.run(() => {
                if (this.selectedFile?.path === node.path) {
                     this.selectedFile.content = null; this.selectedFile.originalContent = null;
                     this.selectedFile.isLoading = false; this.selectedFile.isDirty = false;
                     this.selectedFile.error = errorMessage;
                }
            });
        } finally {
            this.setProcessingTree(false);
        }
    }

    // --- Editing & Committing Logic ---
    onCodeMirrorChange(newContent: string): void { /* ... code remains the same ... */
        if (this.selectedFile && !this.selectedFile.isLoading) {
            const wasDirty = this.selectedFile.isDirty;
            this.selectedFile.isDirty = (newContent !== this.selectedFile.originalContent);
            if (wasDirty !== this.selectedFile.isDirty) {
                 console.log(`[onCodeMirrorChange] File ${this.selectedFile.path} isDirty changed to: ${this.selectedFile.isDirty}`);
            }
        }
    }
    async saveFileChanges(): Promise<void> { /* ... code remains the same ... */
         if (!this.selectedFile || !this.selectedFile.isDirty || this.isSavingFile || !this.activeRepository || !this.fs) { return; }

         const filePath = this.selectedFile.path;
         this.addOutput(`Saving changes to ${filePath}...`);
         console.log(`--- [saveFileChanges] Saving: ${this.dir}/${filePath} ---`);
         this.setIsSavingFile(true);
         const fsPath = `${this.dir}/${filePath}`;
         const contentToSave = this.selectedFile.content ?? '';

         try {
              console.log(`[saveFileChanges] Calling fs.promises.writeFile for ${fsPath}`);
             await this.fs.promises.writeFile(fsPath, contentToSave, { encoding: 'utf8', mode: 0o666 });
             this.addOutput(`File ${filePath} saved successfully.`);
             console.log(`[saveFileChanges] writeFile successful.`);

             this.addOutput(`Staging ${filePath}...`);
              console.log(`[saveFileChanges] Calling git.add for ${filePath}`);
             await git.add({ fs: this.fs, dir: this.dir, filepath: filePath });
             this.addOutput(`${filePath} staged successfully.`);
              console.log(`[saveFileChanges] git.add successful.`);

             this._ngZone.run(() => {
                 this.selectedFile!.originalContent = contentToSave;
                 this.selectedFile!.isDirty = false;
                  console.log(`[saveFileChanges] State updated: isDirty=false`);
             });

         } catch (error: any) {
             this.addOutput(`Error saving or staging file ${filePath}: ${error.message || error}`, 'error');
             console.error(`[saveFileChanges] >>> FAILED <<<`, error);
         } finally {
              this.setIsSavingFile(false);
               console.log(`--- [saveFileChanges] Finished: ${this.dir}/${filePath} ---`);
         }
    }
    async commitChanges(): Promise<void> { /* ... code remains the same ... */
        if (!this.activeRepository || this.isLoading || !this.fs) return;

        const commitMessage = prompt("Enter commit message:");
        if (!commitMessage) { this.addOutput('Commit cancelled.', 'warn'); return; }

        const authorInfo = { name: 'Web User', email: 'user@browser.com' };

        this.addOutput(`Committing changes with message: "${commitMessage}"...`);
        console.log(`--- [commitChanges] Committing in dir: ${this.dir} ---`);
        this.setLoading(true, `Commit (${this.activeRepository.name})`);

        try {
            console.log(`[commitChanges] Calling git.commit with message: "${commitMessage}"`);
            const sha = await git.commit({
                fs: this.fs, dir: this.dir, message: commitMessage, author: authorInfo
            });
            this.addOutput(`Commit successful! SHA: ${sha}`, 'log');
            console.log(`[commitChanges] Commit successful, SHA: ${sha}`);

        } catch (error: any) {
            this.addOutput(`Commit failed: ${error.message || error}`, 'error');
            console.error(`[commitChanges] >>> FAILED <<<`, error);
             if (error.code === 'EmptyCommitError') {
                  this.addOutput('Commit failed: No changes added to commit.', 'warn');
             }
            console.error("Commit Error Full Details:", error);
        } finally {
            this.setLoading(false, `Commit (${this.activeRepository.name})`);
             console.log(`--- [commitChanges] Finished for dir: ${this.dir} ---`);
        }
    }

    // --- Helper Methods ---
    addOutput(message: string, level: 'log' | 'warn' | 'error' = 'log'): void { /* ... code remains the same ... */
        const timestamp = new Date().toLocaleTimeString();
        const logMessage = `[${timestamp}] ${message}`;
        console[level](logMessage);

        this._ngZone.run(() => {
            this.output.push(logMessage);
            if (this.output.length > 200) { this.output.shift(); }
        });
    }
    clearOutput(): void { /* ... code remains the same ... */
        this._ngZone.run(() => { this.output = ['Log cleared.']; });
         console.clear();
         console.log("ExampleComponent: Console and UI Log cleared.");
    }
    setLoading(loading: boolean, operation?: string): void { /* ... code remains the same ... */
        this._ngZone.run(() => {
            if (this.isLoading === loading) return;
            this.isLoading = loading;
            const status = loading ? 'started' : 'finished';
            if (operation) {
                 const logMsg = `Operation ${status}: ${operation}.`;
                 this.addOutput(logMsg);
                 console.log(`[SetLoading:${loading}] ${logMsg}`);
            }
            this._cdRef.detectChanges();
        });
    }
    setProcessingTree(processing: boolean): void { /* ... code remains the same ... */
         this._ngZone.run(() => {
            if (this.isProcessingTree === processing) return;
            this.isProcessingTree = processing;
             console.log(`[SetProcessingTree:${processing}]`);
            this._cdRef.detectChanges();
         });
    }
    setIsSavingFile(saving: boolean): void { /* ... code remains the same ... */
         this._ngZone.run(() => {
            if (this.isSavingFile === saving) return;
            this.isSavingFile = saving;
             console.log(`[SetIsSavingFile:${saving}]`);
            this._cdRef.detectChanges();
         });
    }
    buildTreeFromPaths(paths: string[]): TreeNode[] { /* ... code remains the same ... */
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
    toggleNodeExpansion(node: TreeNode): void { /* ... code remains the same ... */
        if (node.isDirectory) {
            node.expanded = !node.expanded;
        }
        this._cdRef.detectChanges();
    }

} // End of component class