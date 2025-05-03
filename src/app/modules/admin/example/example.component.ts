import { Component, ChangeDetectorRef, NgZone, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common'; // Import CommonModule for *ngIf, *ngFor etc.

// --- Buffer Polyfill ---
import { Buffer } from 'buffer';

// Isomorphic Git and related imports
import * as git from 'isomorphic-git';
import http from 'isomorphic-git/http/web';
import FS from '@isomorphic-git/lightning-fs';

// --- Interfaces for Tree Structure ---
interface TreeNode {
    name: string;           // File or folder name
    path: string;           // Full path within the repo
    isDirectory: boolean;
    children?: TreeNode[];  // Nested nodes for directories
    expanded?: boolean;     // State for UI expansion
    // content?: string;    // Optionally store content later (might use too much memory)
}

interface SelectedFile {
    path: string;
    content: string | null; // Store content or null if not loaded/binary
    error?: string;         // Error message if reading fails
    isLoading: boolean;
}

@Component({
    selector     : 'example',
    standalone   : true,
    // *** IMPORT CommonModule FOR NGIF/NGFOR ***
    imports      : [FormsModule, CommonModule],
    templateUrl  : './example.component.html',
    // Add styles for tree indentation if needed, or rely on Tailwind utility classes
    // styles: [`
    //     .tree-node { padding-left: 1.5rem; } // Basic indentation example
    // `]
})
export class ExampleComponent implements OnInit {

    // --- Buffer Polyfill Injection ---
    private _injectBufferPolyfill(): void {
        if (typeof (window as any).Buffer === 'undefined') {
            console.log('[Polyfill] Injecting Buffer into window scope...');
            (window as any).Buffer = Buffer;
        } else {
             console.log('[Polyfill] Buffer already defined.');
        }
    }

    // --- Component State ---
    fs!: FS;
    dir = '/repo';
    repoUrl = 'https://github.com/isomorphic-git/isomorphic-git.git'; // Default
    corsProxy = 'https://cors.isomorphic-git.org';
    output: string[] = [];
    isLoading = false;          // General loading for clone/pull etc.
    isProcessingTree = false;   // Specific loading for tree building/file reading
    cloneDone = false;
    repositoryTree: TreeNode[] = []; // Root nodes of the file tree
    selectedFile: SelectedFile | null = null; // Holds info about the currently viewed file
    readonly localStorageUrlKey = 'gitBrowser_lastRepoUrl'; // Key for localStorage

    /**
     * Constructor
     */
    constructor(private _cdRef: ChangeDetectorRef, private _ngZone: NgZone)
    {
        console.log("ExampleComponent: Constructor started.");
        this._injectBufferPolyfill();
        try {
            // Load last used URL from localStorage
            const savedUrl = localStorage.getItem(this.localStorageUrlKey);
            if (savedUrl) {
                this.repoUrl = savedUrl;
                console.log(`Loaded repo URL from localStorage: ${this.repoUrl}`);
            }

            this.fs = new FS('my-git-fs'); // Initialize FS *after* potential Buffer polyfill
            this.addOutput('Filesystem initialized.');
            console.log("ExampleComponent: Filesystem initialized.");
        } catch (fsError: any) {
            console.error("ExampleComponent: Failed to initialize Filesystem!", fsError);
            this.addOutput(`FATAL: Failed to initialize Filesystem: ${fsError.message || fsError}`, 'error');
        }
         console.log("ExampleComponent: Constructor finished.");
    }

    /**
     * ngOnInit Lifecycle Hook
     */
    ngOnInit(): void {
        console.log("ExampleComponent: ngOnInit started.");
        if (this.fs) {
             this.checkIfRepoExists(); // Check repo and build tree if exists
        } else {
             console.warn("ExampleComponent: ngOnInit skipped repo check as FS failed to initialize.");
        }
        console.log("ExampleComponent: ngOnInit finished.");
    }

    // --- Helper Methods ---
    addOutput(message: string, level: 'log' | 'warn' | 'error' = 'log'): void {
        const timestamp = new Date().toLocaleTimeString();
        const logMessage = `[${timestamp}] ${message}`;
        console[level](logMessage); // Log to browser console too

        this._ngZone.run(() => {
            this.output.push(logMessage);
            if (this.output.length > 150) { this.output.shift(); } // Keep log size reasonable
        });
    }

    clearOutput(): void {
        this._ngZone.run(() => {
            this.output = ['Log cleared.'];
            this.repositoryTree = [];
            this.selectedFile = null;
        });
    }

    setLoading(loading: boolean, operation?: string): void {
        this._ngZone.run(() => {
            this.isLoading = loading;
            const status = loading ? 'started' : 'finished';
            if (operation) {
                this.addOutput(`Operation ${status}: ${operation}.`);
            }
        });
    }

     setProcessingTree(processing: boolean): void {
         this._ngZone.run(() => {
            this.isProcessingTree = processing;
         });
    }

    // --- Git Operations ---
    async checkIfRepoExists(): Promise<void> {
        this.addOutput("Checking for existing repository...");
        this.setProcessingTree(true); // Show loading while checking/building tree
        try {
            const stat = await this.fs.promises.stat(`${this.dir}/.git`);
            if (stat.isDirectory()) {
                 this.addOutput(`Repository found in ${this.dir}. Building file tree...`);
                 this._ngZone.run(() => { this.cloneDone = true; });
                 await this.buildAndDisplayFileTree(); // Build tree if repo exists
            }
        } catch (e: any) {
            if (e.code === 'ENOENT') {
                this.addOutput(`No existing repository found in ${this.dir}. Ready to clone.`);
            } else {
                this.addOutput(`Error checking for repository: ${e.message || e}`, 'error');
            }
             this._ngZone.run(() => { this.cloneDone = false; this.repositoryTree = []; });
        } finally {
            this.setProcessingTree(false);
            this._ngZone.run(() => this._cdRef.detectChanges()); // Ensure UI update
        }
    }

    async cloneRepo(): Promise<void> {
        if (!this.repoUrl || !this.repoUrl.startsWith('https://')) {
            this.addOutput('Error: A valid public HTTPS Repository URL is required.', 'error'); return;
        }
        if (this.isLoading) { this.addOutput('Operation already in progress.', 'warn'); return; }

        // Save the URL to localStorage before starting clone
        try {
            localStorage.setItem(this.localStorageUrlKey, this.repoUrl);
            console.log(`Saved repo URL to localStorage: ${this.repoUrl}`);
        } catch (storageError) {
            this.addOutput('Warning: Could not save repository URL to local storage.', 'warn');
            console.warn('LocalStorage save error:', storageError);
        }


        this.setLoading(true, 'Clone');
        this.clearOutput(); // Clear previous logs and tree
        this.addOutput(`Attempting to clone ${this.repoUrl} into ${this.dir}...`);
        this._ngZone.run(() => { this.cloneDone = false; this.repositoryTree = []; this.selectedFile = null; }); // Reset state

        try {
            // ... (Directory cleaning and creation logic - unchanged) ...
            this.addOutput("Attempting to clean target directory...");
            try { await this.fs.promises.rmdir(this.dir); this.addOutput(`Cleaned directory ${this.dir}.`); }
            catch (e: any) { if (e.code !== 'ENOENT') { this.addOutput(`Note: Could not automatically clean ${this.dir}. ${e.message}`, 'warn'); } }
            this.addOutput("Creating target directory...");
            try { await this.fs.promises.mkdir(this.dir); this.addOutput(`Created directory ${this.dir}.`); }
            catch (mkdirErr: any) { if (mkdirErr.code !== 'EEXIST') { throw new Error(`Failed to create directory ${this.dir}: ${mkdirErr.message || mkdirErr}`); } }


            this.addOutput("Starting git clone operation...");
            await git.clone({
                fs: this.fs, http, dir: this.dir, url: this.repoUrl, corsProxy: this.corsProxy,
                singleBranch: true, depth: 10, // Keep clone fast
                onProgress: (progress) => { /* ... progress logging ... */ },
                onMessage: (message) => { this.addOutput(`Remote: ${message.trim()}`); }
            });
            this.addOutput('Clone successful!', 'log');
            this._ngZone.run(() => { this.cloneDone = true; });

            await this.buildAndDisplayFileTree(); // Build tree after successful clone

        } catch (error: any) {
            this.addOutput(`Clone failed: ${error.message || error}`, 'error');
            console.error("Clone Error Details:", error);
             this._ngZone.run(() => { this.cloneDone = false; });
        } finally {
            this.setLoading(false, 'Clone');
        }
    }

    // --- File Tree Logic ---
    async buildAndDisplayFileTree(): Promise<void> {
        if (!this.cloneDone) return;
        this.addOutput('Building file tree from HEAD...');
        this.setProcessingTree(true);
        this._ngZone.run(() => { this.repositoryTree = []; this.selectedFile = null; }); // Clear existing

        try {
            const paths = await git.listFiles({ fs: this.fs, dir: this.dir });
            this.addOutput(`Found ${paths.length} file paths in HEAD.`);

            // Build the hierarchical tree structure from the flat path list
            const tree = this.buildTreeFromPaths(paths);
            this._ngZone.run(() => { this.repositoryTree = tree; });
            this.addOutput('File tree built successfully.');

        } catch (error: any) {
            this.addOutput(`Failed to build file tree: ${error.message || error}`, 'error');
            console.error("Build Tree Error:", error);
            this._ngZone.run(() => { this.repositoryTree = []; });
        } finally {
            this.setProcessingTree(false);
        }
    }

    buildTreeFromPaths(paths: string[]): TreeNode[] {
        const root: TreeNode = { name: '', path: '', isDirectory: true, children: [] };

        paths.forEach(path => {
            let currentNode = root;
            const parts = path.split('/');

            parts.forEach((part, index) => {
                if (!currentNode.children) {
                    currentNode.children = []; // Should not happen for root, but safety check
                }

                let childNode = currentNode.children.find(child => child.name === part);

                const isLastPart = index === parts.length - 1;

                if (!childNode) {
                    // Node doesn't exist, create it
                    const newPath = parts.slice(0, index + 1).join('/');
                    childNode = {
                        name: part,
                        path: newPath,
                        isDirectory: !isLastPart, // It's a directory if it's not the last part
                        children: isLastPart ? undefined : [], // Only directories have children arrays initially
                        expanded: false // Start collapsed
                    };
                    currentNode.children.push(childNode);
                } else {
                     // Node exists, ensure its type is correct (might be listed as dir then file)
                     if (!isLastPart && !childNode.isDirectory) {
                         // If it was previously marked as a file but now has children, make it a directory
                         childNode.isDirectory = true;
                         childNode.children = childNode.children || [];
                     }
                }

                // Sort children alphabetically by name, directories first
                 currentNode.children.sort((a, b) => {
                     if (a.isDirectory !== b.isDirectory) {
                         return a.isDirectory ? -1 : 1; // Directories first
                     }
                     return a.name.localeCompare(b.name); // Then alphabetical
                 });


                // Move to the next level
                currentNode = childNode;
            });
        });

        return root.children || []; // Return children of the dummy root
    }

    toggleNodeExpansion(node: TreeNode): void {
        if (node.isDirectory) {
            node.expanded = !node.expanded;
        }
    }

    // --- File Viewing Logic ---
    async viewFileContent(node: TreeNode): Promise<void> {
        if (node.isDirectory || this.isProcessingTree) {
            return; // Don't view directories or if busy
        }

        this.addOutput(`Reading content for: ${node.path}`);
        this.setProcessingTree(true);
        this._ngZone.run(() => {
            this.selectedFile = { path: node.path, content: null, isLoading: true };
        });

        try {
            // Construct the full path within the virtual filesystem
            const fsPath = `${this.dir}/${node.path}`;
            console.log(`Attempting to read from FS path: ${fsPath}`);

            // Read file content as UTF-8 text. Handle potential errors.
            const content = await this.fs.promises.readFile(fsPath, { encoding: 'utf8' });

            // Limit content size displayed to prevent browser slowdown
            const maxDisplaySize = 50 * 1024; // 50 KB limit for display
            let displayedContent = content;
            if (content.length > maxDisplaySize) {
                displayedContent = content.substring(0, maxDisplaySize) + '\n\n... (Content truncated for display)';
                this.addOutput(`File content truncated for display (>${maxDisplaySize / 1024} KB).`, 'warn');
            }

            this._ngZone.run(() => {
                if (this.selectedFile?.path === node.path) { // Check if selection hasn't changed
                     this.selectedFile.content = displayedContent;
                     this.selectedFile.isLoading = false;
                     this.selectedFile.error = undefined;
                }
            });
            this.addOutput(`Successfully read content for: ${node.path}`);

        } catch (error: any) {
            let errorMessage = `Failed to read file content: ${error.message || error}`;
             // Try to detect binary files (very basic check)
             if (error instanceof Error && (error.message.includes('invalid byte sequence') || error.message.includes('malformed UTF-8'))) {
                 errorMessage = 'Cannot display content: File appears to be binary or uses unsupported encoding.';
                 this.addOutput(`Cannot display content for ${node.path}: Binary or unsupported encoding.`, 'warn');
             } else {
                 this.addOutput(`Error reading ${node.path}: ${errorMessage}`, 'error');
                 console.error(`File Read Error (${node.path}):`, error);
             }

            this._ngZone.run(() => {
                if (this.selectedFile?.path === node.path) {
                     this.selectedFile.content = null; // Clear content on error
                     this.selectedFile.isLoading = false;
                     this.selectedFile.error = errorMessage;
                }
            });
        } finally {
            this.setProcessingTree(false);
        }
    }


    // --- Other Git methods (pull, push, status) - Largely unchanged, but ensure tree is rebuilt on pull ---

    async pullChanges(): Promise<void> {
        if (!this.cloneDone || this.isLoading) return;
        this.setLoading(true, 'Pull');
        try {
             this.addOutput('Step 1: Fetching from remote...');
             const fetchResult = await git.fetch({ fs: this.fs, http, dir: this.dir, corsProxy: this.corsProxy, singleBranch: true });
             this.addOutput(`Fetch result: ${JSON.stringify(fetchResult)}`);

             if(fetchResult?.fetchHead) {
                this.addOutput(`Fetched remote commit: ${fetchResult.fetchHead}`);
                this.addOutput('Step 2: Merging fetched changes (fast-forward only)...');
                 const mergeResult = await git.merge({ fs: this.fs, dir: this.dir, ours: 'HEAD', theirs: fetchResult.fetchHead, fastForwardOnly: true, author: { name: 'Browser User', email: 'user@browser.com' } });
                 this.addOutput(`Merge result: ${JSON.stringify(mergeResult)}`);
                 this.addOutput(mergeResult.oid ? `Pull successful (merged). New HEAD: ${mergeResult.oid}` : 'Pull successful (fast-forward or already up-to-date).');

                 // *** REBUILD TREE AFTER PULL ***
                 await this.buildAndDisplayFileTree();

             } else { this.addOutput('Fetch did not return a head.', 'warn'); }
        } catch (error: any) { /* ... error handling ... */ }
        finally { this.setLoading(false, 'Pull'); }
    }

    // Push and Status methods remain the same as the previous version
    async pushChanges(): Promise<void> {
        if (!this.cloneDone || this.isLoading) return;
        this.setLoading(true, 'Push');
        this.addOutput('Attempting to push changes... (NOTE: Likely to fail without auth/write access)', 'warn');
        try {
            const result = await git.push({ fs: this.fs, http, dir: this.dir, corsProxy: this.corsProxy });
            this.addOutput(`Push raw result: ${JSON.stringify(result)}`, 'log');
            if (result?.ok && Array.isArray(result.ok) && result.ok.some(s => s?.includes('ok')) && !result.error) {
                 this.addOutput('Push successful.', 'log');
            } else {
                 this.addOutput(`Push failed or encountered errors. Error: ${result?.error || 'N/A'}`, 'error');
                 console.warn("Push Result Details:", result);
            }
        } catch (error: any) { this.addOutput(`Push failed with exception: ${error.message || error}`, 'error'); console.error("Push Exception:", error); }
        finally { this.setLoading(false, 'Push'); }
    }

    async getStatus(): Promise<void> {
        if (!this.cloneDone || this.isLoading) return;
        this.setLoading(true, 'Status');
        try {
            const status = await git.statusMatrix({ fs: this.fs, dir: this.dir });
            this.addOutput('Status Matrix: [File, HEAD, WorkDir, Stage]');
            if (status.length === 0) { this.addOutput('  (Working directory clean)'); }
            else {
                status.forEach(row => {
                    const mapStatus = (code: number): string => ['?', 'A', 'D', 'M', 'U'][code] ?? '?'; // Shorter codes
                    this.addOutput(`  '${row[0]}': ${mapStatus(row[1])}, ${mapStatus(row[2])}, ${mapStatus(row[3])}`);
                });
             }
        } catch (error: any) { this.addOutput(`Failed to get status: ${error.message || error}`, 'error'); console.error("Status Error:", error); }
        finally { this.setLoading(false, 'Status'); }
    }
}