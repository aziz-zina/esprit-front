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
const headStatus = 1;
const workdirStatus = 2;
const stageStatus = 3;
const GIT_STATUS = { ABSENT: 0, ADDED: 1, DELETED: 2, MODIFIED: 3 };

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
    output: string[] = [];
    isLoading = false;
    isProcessingTree = false;
    cloneDone = false;
    repositoryTree: TreeNode[] = [];
    selectedFile: SelectedFile | null = null;
    isSavingFile = false;
    cmOptions: CodeMirror.EditorConfiguration = { lineNumbers: true, theme: 'material', mode: 'javascript', readOnly: false };

    constructor() {
        this._injectBufferPolyfill();
        this._loadManagedRepos();
        this._initializeFilesystem();
        this.fetchGithubAccessToken();
    }

    ngOnInit(): void {
        if (this.fs && this.activeRepository) {
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
            this.addOutput('Error loading managed repositories from storage.', 'error');
            localStorage.removeItem(this.localStorageManagedReposKey);
            this.managedRepositories = [];
        }
    }

    private _saveManagedRepos(): void {
        try {
            localStorage.setItem(this.localStorageManagedReposKey, JSON.stringify(this.managedRepositories));
        } catch (e) {
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
                this.addOutput('Failed to fetch repositories from GitHub API.', 'error');
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
        this.addOutput(`Added "${repo.full_name}" to managed list. Select it to clone or manage.`, 'log');
    }

    async removeManagedRepo(repoToRemove: RepositoryInfo): Promise<void> {
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
        } finally {
            this.setLoading(false, `Remove Local (${repoToRemove.name})`);
        }
    }

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
             this.addOutput(`Failed to fully delete ${dirPath}: ${error.message}`, 'error');
             throw error;
        }
    }

    setActiveRepository(repoInfo: RepositoryInfo | null): void {
         if (this.isLoading || this.isProcessingTree) {
            this.addOutput('Please wait for the current operation to finish before switching repositories.', 'warn');
            return;
         }
        if (this.activeRepository?.id === repoInfo?.id) {
             if (repoInfo !== null) return; // Already active
        }

        this.addOutput(repoInfo ? `Activating repository: "${repoInfo.fullName}"...` : 'Deactivating repository.');
        this.activeRepository = repoInfo;
        this.dir = repoInfo ? repoInfo.localPath : '';

        this.repositoryTree = [];
        this.selectedFile = null;
        this.cloneDone = false;

        if (repoInfo && this.fs) {
            this.checkIfRepoExists();
        } else {
             this._cdRef.detectChanges();
        }
    }

    isRepoManaged(repoId: number): boolean {
        return this.managedRepositories.some(r => r.id === repoId);
    }

    // --- Git Operations ---
    async checkIfRepoExists(): Promise<void> {
        if (!this.activeRepository || !this.fs) { return; }
        this.addOutput(`Checking for existing repository in ${this.dir}...`);
        this.setProcessingTree(true);
        this.cloneDone = false;

        try {
            await this.fs.promises.stat(`${this.dir}/.git`);
            this.addOutput(`Repository found in ${this.dir}. Building file tree...`);
            this._ngZone.run(() => { this.cloneDone = true; });
            await this.buildAndDisplayFileTree();
        } catch (e: any) {
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

    async cloneRepo(): Promise<void> {
        if (!this.activeRepository) { this.addOutput('Error: No active repository selected.', 'error'); return; }
        if (!this.githubAccessToken) { this.addOutput('Error: GitHub Access Token required for cloning.', 'error'); this.fetchGithubAccessToken(); return; }
        if (this.isLoading) { this.addOutput('Operation already in progress.', 'warn'); return; }

        this.setLoading(true, `Clone (${this.activeRepository.name})`);
        this._ngZone.run(() => { this.repositoryTree = []; this.selectedFile = null; this.cloneDone = false; });

        const cloneUrl = this.activeRepository.url;
        const auth = { username: 'oauth2', password: this.githubAccessToken };
        const cloneDir = this.dir;
        this.addOutput(`Attempting to clone ${cloneUrl} into ${this.dir}...`);

        try {
            // Directory management
            try { await this.fs.promises.rmdir(cloneDir, { recursive: true } as any); } catch (e: any) { if (e.code !== 'ENOENT') { /* ignore */ } }
            try { await this.fs.promises.mkdir(cloneDir); } catch (mkdirErr: any) { if (mkdirErr.code !== 'EEXIST') { throw mkdirErr; } }

            // Git clone call
            this.addOutput("Starting git clone operation...");
            await git.clone({
                fs: this.fs, http: http, dir: cloneDir, url: cloneUrl,
                corsProxy: this.corsProxy, onAuth: () => auth,
                singleBranch: true, depth: 10,
                onMessage: (message) => { this.addOutput(`Remote: ${message.trim()}`); }
            });
            this.addOutput('Clone successful!', 'log');
            this._ngZone.run(() => { this.cloneDone = true; });
            await this.buildAndDisplayFileTree();

        } catch (error: any) {
            this.addOutput(`Clone failed: ${error.message || error}`, 'error');
             const statusCode = error.data?.statusCode || error.http?.statusCode;
             if (statusCode === 401 || error.message?.includes('401')) {
                 this.addOutput('Authentication failed (401). Token might be invalid, expired, or lack repo access scope.', 'error');
                 this.githubAccessToken = null;
             } else if (statusCode === 403) {
                 this.addOutput('Authorization failed (403). Token might lack sufficient permissions.', 'error');
             } else if (statusCode === 404) {
                 this.addOutput('Repository not found (404).', 'error');
             } else if (error.name === 'CorsError' || error.message?.includes('CORS') || error.message?.includes('fetch')) {
                 this.addOutput('CORS error detected despite proxy. Check proxy status/reachability.', 'error');
             }
            this._ngZone.run(() => { this.cloneDone = false; });
        } finally {
            this.setLoading(false, `Clone (${this.activeRepository?.name})`);
        }
    }

    async buildAndDisplayFileTree(): Promise<void> {
        if (!this.activeRepository || !this.cloneDone || !this.fs) return;
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
            this._ngZone.run(() => { this.repositoryTree = []; });
        } finally {
            this.setProcessingTree(false);
        }
    }

    async pullChanges(): Promise<void> {
        if (!this.activeRepository || !this.cloneDone || this.isLoading || !this.fs) return;
        if (!this.githubAccessToken) { this.addOutput('Error: GitHub Access Token required for pull.', 'error'); return; }

        this.setLoading(true, `Pull (${this.activeRepository.name})`);
        const pullUrl = this.activeRepository.url;
        const auth = { username: 'oauth2', password: this.githubAccessToken };

        try {
            this.addOutput('Step 1: Fetching from remote...');
            const fetchResult = await git.fetch({
                fs: this.fs, http: http, dir: this.dir, url: pullUrl,
                onAuth: () => auth, corsProxy: this.corsProxy, singleBranch: true,
            });
            this.addOutput(`Fetch result: ${JSON.stringify(fetchResult)}`);

            if(fetchResult?.fetchHead) {
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
             const statusCode = error.data?.statusCode || error.http?.statusCode;
              if (statusCode === 401) { this.addOutput('Authentication failed (401).', 'error'); this.githubAccessToken = null; }
              else if (error.code === 'FastForwardError') { this.addOutput('Pull failed: Local branch has diverged.', 'error'); }
        } finally {
            this.setLoading(false, `Pull (${this.activeRepository?.name})`);
        }
    }

    async pushChanges(): Promise<void> {
        if (!this.activeRepository || !this.cloneDone || this.isLoading || !this.fs) return;
        if (!this.githubAccessToken) { this.addOutput('Error: GitHub Access Token required for push.', 'error'); return; }

        this.setLoading(true, `Push (${this.activeRepository.name})`);
        const pushUrl = this.activeRepository.url;
        const auth = { username: 'oauth2', password: this.githubAccessToken };

        this.addOutput('Attempting to push changes...');
        try {
             const result = await git.push({
                fs: this.fs, http: http, dir: this.dir, url: pushUrl,
                onAuth: () => auth, corsProxy: this.corsProxy,
            });
            this.addOutput(`Push raw result: ${JSON.stringify(result)}`, 'log');
            if (result?.ok && !result.error) { this.addOutput('Push successful.', 'log'); }
            else { this.addOutput(`Push failed or encountered errors. Error: ${result?.error || 'Check logs.'}`, 'error'); }
        } catch (error: any) {
             this.addOutput(`Push failed with exception: ${error.message || error}`, 'error');
             const statusCode = error.data?.statusCode || error.http?.statusCode;
             if (statusCode === 401) { this.addOutput('Authentication failed (401).', 'error'); this.githubAccessToken = null; }
             else if (statusCode === 403) { this.addOutput('Authorization failed (403). Insufficient permissions?', 'error'); }
        } finally {
            this.setLoading(false, `Push (${this.activeRepository?.name})`);
        }
    }

    async getStatus(): Promise<void> {
        if (!this.activeRepository || !this.cloneDone || this.isLoading || !this.fs) return;
        this.setLoading(true, `Status (${this.activeRepository.name})`);
        try {
           const statusMatrix = await git.statusMatrix({ fs: this.fs, dir: this.dir });
           this.addOutput('Status Matrix: [File, HEAD, WorkDir, Stage]');
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
                    else if (workdirCode === GIT_STATUS.MODIFIED) fileStatus = ' M';

                    this.addOutput(`  ${fileStatus} ${filepath}`);
                });
            }
        } catch (error: any) {
             this.addOutput(`Failed to get status: ${error.message || error}`, 'error');
        } finally {
             this.setLoading(false, `Status (${this.activeRepository?.name})`);
        }
    }

    // --- File Tree & Viewing Logic ---
    async viewFileContent(node: TreeNode): Promise<void> {
        if (node.isDirectory || this.isProcessingTree || !this.activeRepository) { return; }
        if (this.selectedFile?.isDirty) {
             const confirmDiscard = confirm("You have unsaved changes. Discard and open another file?");
             if (!confirmDiscard) return;
        }

        this.addOutput(`Reading content for: ${node.path}`);
        this.setProcessingTree(true);
        this._ngZone.run(() => {
            this.selectedFile = { path: node.path, content: null, originalContent: null, isDirty: false, isLoading: true };
        });

        try {
            const fsPath = `${this.dir}/${node.path}`;
            const contentBuffer = await this.fs.promises.readFile(fsPath);
            const content = Buffer.from(contentBuffer).toString('utf8');

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

            this.cmOptions = { ...this.cmOptions, mode: mode };

            this._ngZone.run(() => {
                if (this.selectedFile?.path === node.path) {
                    this.selectedFile.content = content;
                    this.selectedFile.originalContent = content;
                    this.selectedFile.isLoading = false;
                    this.selectedFile.isDirty = false;
                    this.selectedFile.error = undefined;
                }
            });
            this.addOutput(`Successfully read content for: ${node.path}`);

        } catch (error: any) {
            let errorMessage = `Failed to read file content: ${error.message || error}`;
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
    onCodeMirrorChange(newContent: string): void {
        if (this.selectedFile && !this.selectedFile.isLoading) {
            this.selectedFile.isDirty = (newContent !== this.selectedFile.originalContent);
        }
    }

    async saveFileChanges(): Promise<void> {
         if (!this.selectedFile || !this.selectedFile.isDirty || this.isSavingFile || !this.activeRepository || !this.fs) { return; }

         const filePath = this.selectedFile.path;
         this.addOutput(`Saving changes to ${filePath}...`);
         this.setIsSavingFile(true);
         const fsPath = `${this.dir}/${filePath}`;
         const contentToSave = this.selectedFile.content ?? '';

         try {
             await this.fs.promises.writeFile(fsPath, contentToSave, { encoding: 'utf8', mode: 0o666 });
             this.addOutput(`File ${filePath} saved successfully.`);

             this.addOutput(`Staging ${filePath}...`);
             await git.add({ fs: this.fs, dir: this.dir, filepath: filePath });
             this.addOutput(`${filePath} staged successfully.`);

             this._ngZone.run(() => {
                 this.selectedFile!.originalContent = contentToSave;
                 this.selectedFile!.isDirty = false;
             });

         } catch (error: any) {
             this.addOutput(`Error saving or staging file ${filePath}: ${error.message || error}`, 'error');
         } finally {
              this.setIsSavingFile(false);
         }
    }

    async commitChanges(): Promise<void> {
        if (!this.activeRepository || this.isLoading || !this.fs) return;

        const commitMessage = prompt("Enter commit message:");
        if (!commitMessage) { this.addOutput('Commit cancelled.', 'warn'); return; }

        const authorInfo = { name: 'Web User', email: 'user@browser.com' };

        this.addOutput(`Committing changes with message: "${commitMessage}"...`);
        this.setLoading(true, `Commit (${this.activeRepository.name})`);

        try {
            const sha = await git.commit({
                fs: this.fs, dir: this.dir, message: commitMessage, author: authorInfo
            });
            this.addOutput(`Commit successful! SHA: ${sha}`, 'log');

        } catch (error: any) {
            this.addOutput(`Commit failed: ${error.message || error}`, 'error');
             if (error.code === 'EmptyCommitError') {
                  this.addOutput('Commit failed: No changes added to commit.', 'warn');
             }
        } finally {
            this.setLoading(false, `Commit (${this.activeRepository.name})`);
        }
    }

    // --- Helper Methods ---
    addOutput(message: string, level: 'log' | 'warn' | 'error' = 'log'): void {
        const timestamp = new Date().toLocaleTimeString();
        const logMessage = `[${timestamp}] ${message}`;
        // console[level](logMessage); // Keep commented out

        this._ngZone.run(() => {
            this.output.push(logMessage);
            if (this.output.length > 200) { this.output.shift(); }
        });
    }

    clearOutput(): void {
        this._ngZone.run(() => { this.output = ['Log cleared.']; });
    }

    setLoading(loading: boolean, operation?: string): void {
        this._ngZone.run(() => {
            if (this.isLoading === loading) return;
            this.isLoading = loading;
            const status = loading ? 'started' : 'finished';
            if (operation) {
                 const logMsg = `Operation ${status}: ${operation}.`;
                 this.addOutput(logMsg);
            }
            this._cdRef.detectChanges();
        });
    }

    setProcessingTree(processing: boolean): void {
         this._ngZone.run(() => {
            if (this.isProcessingTree === processing) return;
            this.isProcessingTree = processing;
            this._cdRef.detectChanges();
         });
    }

    setIsSavingFile(saving: boolean): void {
         this._ngZone.run(() => {
            if (this.isSavingFile === saving) return;
            this.isSavingFile = saving;
            this._cdRef.detectChanges();
         });
    }

    buildTreeFromPaths(paths: string[]): TreeNode[] {
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
        }
        this._cdRef.detectChanges();
    }

} // End of component class