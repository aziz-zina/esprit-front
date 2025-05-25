import { CommonModule } from '@angular/common';
import { Component, inject, Input, OnInit, NgZone, Output, EventEmitter } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatDialog } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSelectModule } from '@angular/material/select';
import { MatTabsModule } from '@angular/material/tabs';
import FS from '@isomorphic-git/lightning-fs';
import * as git from 'isomorphic-git';
import http from 'isomorphic-git/http/web';
import { ConflictResolverComponent } from '../conflict-resolver/conflict-resolver.component';

// Git status codes (from isomorphic-git documentation/source)
const GIT_STATUS = {
    ABSENT: 0, // Represents the absence of the file path.
    ADDED: 1, // Represents the addition of the file path.
    DELETED: 2, // Represents the deletion of the file path.
    MODIFIED: 3, // Represents the modification of the file path.
} as const;

// Helper type for status codes if needed, derived from GIT_STATUS values
type GitStatusCode = (typeof GIT_STATUS)[keyof typeof GIT_STATUS];

export interface MergeRequestData {
    sourceBranch: string;
    targetBranch: string;
    title: string;
    description?: string;
    fs: FS;
    dir: string;
}

export interface MergeConflict {
    file: string;
    content: string;
    conflictMarkers: {
        start: number;
        separator: number;
        end: number;
    }[];
}

@Component({
    selector: 'app-merge-request',
    standalone: true,
    imports: [
        CommonModule,
        FormsModule,
        MatButtonModule,
        MatCardModule,
        MatFormFieldModule,
        MatIconModule,
        MatInputModule,
        MatProgressSpinnerModule,
        MatSelectModule,
        MatTabsModule,
    ],
    templateUrl: './merge-request.component.html',
    styleUrls: ['./merge-request.component.scss'],
})
export class MergeRequestComponent implements OnInit {
    private readonly matDialog = inject(MatDialog);
    private readonly _ngZone = inject(NgZone);

    @Input() repository!: any; // RepositoryInfo from parent
    @Input() fs!: FS;
    @Input() githubToken!: string;
    @Input() corsProxy!: string;
    
    // Outputs to communicate with parent
    @Output() statusUpdate = new EventEmitter<string>();
    @Output() mergeCompleted = new EventEmitter<any>();

    // Properties computed from inputs
    get dir(): string {
        return this.repository?.localPath || '';
    }    // Local state
    localBranches: string[] = [];
    remoteBranches: string[] = [];
    currentBranch: string | null = null;

    // Merge Request form data
    sourceBranch = '';
    targetBranch = 'main';
    title = '';
    description = '';

    // Merge state
    isProcessing = false;
    mergeResult: 'success' | 'conflict' | 'error' | null = null;
    mergeMessage = '';
    conflicts: MergeConflict[] = [];
    
    // UI state
    selectedTabIndex = 0;
    canMerge = false;    ngOnInit(): void {
        this.loadBranchData();
    }    async loadBranchData(): Promise<void> {
        if (!this.fs || !this.dir) {
            return;
        }

        try {
            this.statusUpdate.emit('Loading branch information...');
            
            // First try to fetch from remote to get latest branch info
            if (this.githubToken) {
                try {
                    const auth = { username: 'oauth2', password: this.githubToken };
                    await git.fetch({
                        fs: this.fs,
                        http: http,
                        dir: this.dir,
                        onAuth: () => auth,
                        corsProxy: this.corsProxy,
                        singleBranch: false, // Fetch all branches
                        tags: false,
                    });
                    this.statusUpdate.emit('Fetched latest branch information from remote');
                } catch (fetchError: any) {
                    console.warn('Could not fetch from remote:', fetchError);
                    this.statusUpdate.emit(`Warning: Could not fetch from remote: ${fetchError.message || fetchError}`);
                }
            }

            // Load local and remote branches
            const [localBranches, remoteBranchesList, currentBranch] = await Promise.all([
                git.listBranches({ fs: this.fs, dir: this.dir }).catch(() => []),
                git.listBranches({ 
                    fs: this.fs, 
                    dir: this.dir, 
                    remote: 'origin' 
                }).catch(() => {
                    this.statusUpdate.emit('Could not list remote branches');
                    return [];
                }),
                git.currentBranch({ fs: this.fs, dir: this.dir, fullname: false }).catch(() => null)
            ]);

            // Improved remote branch filtering to handle origin/HEAD and other symbolic refs
            const remoteFilteredAndPrefixed = remoteBranchesList
                .filter(b => b && b !== 'HEAD' && !b.endsWith('/HEAD')) // Filter out HEAD and origin/HEAD
                .map(b => b.startsWith('origin/') ? b : `origin/${b}`); // Ensure prefix

            const remoteNamesOnly = remoteFilteredAndPrefixed
                .map(b => b.substring('origin/'.length)) // Get just the name like 'main', 'dd'
                .sort();

            this._ngZone.run(() => {
                this.localBranches = localBranches.sort();
                this.remoteBranches = remoteNamesOnly; // This will be ['dd', 'main'], etc.
                this.currentBranch = currentBranch;
                
                // Set source branch to current branch if available
                if (this.currentBranch) {
                    this.sourceBranch = this.currentBranch;
                }

                // Dynamic default target branch selection
                if (this.remoteBranches.includes('main')) {
                    this.targetBranch = 'origin/main';
                } else if (this.remoteBranches.includes('master')) {
                    this.targetBranch = 'origin/master';
                } else if (this.remoteBranches.length > 0) {
                    this.targetBranch = `origin/${this.remoteBranches[0]}`;
                } else if (this.localBranches.length > 0) {
                    // Avoid setting target same as current source if possible
                    const firstLocalNotCurrent = this.localBranches.find(b => b !== this.currentBranch);
                    this.targetBranch = firstLocalNotCurrent || this.localBranches[0] || '';
                } else {
                    this.targetBranch = ''; // Fallback
                }

                // If currentBranch is set, use it as default source
                if (this.currentBranch) {
                    this.sourceBranch = this.currentBranch; // This is already done, which is good
                } else if (this.localBranches.length > 0) {
                    this.sourceBranch = this.localBranches[0];
                }
                
                // If no local branches but have remote branches, suggest checking out a branch
                if (localBranches.length === 0 && remoteNamesOnly.length > 0) {
                    this.statusUpdate.emit(`Found ${remoteNamesOnly.length} remote branches but no local branches. Consider checking out a branch first.`);
                }
                
                this.updateCanMerge();
            });

            const totalBranches = localBranches.length + remoteNamesOnly.length;
            this.statusUpdate.emit(`Loaded ${localBranches.length} local and ${remoteNamesOnly.length} remote branches. Current: ${currentBranch || 'none'}`);
        } catch (error: any) {
            this.statusUpdate.emit(`Error loading branch data: ${error.message || error}`);
        }
    }    updateCanMerge(): void {
        this.canMerge = !!(
            this.sourceBranch &&
            this.targetBranch &&
            this.sourceBranch !== this.targetBranch &&
            this.title.trim() &&
            !this.isProcessing
        );
    }

    async createMergeRequest(): Promise<void> {
        if (!this.canMerge || !this.githubToken || !this.repository) {
            this.statusUpdate.emit('Cannot create pull request: requirements not met');
            return;
        }

        // Defensive check for origin/HEAD at the start of createMergeRequest
        if (this.sourceBranch.endsWith('/HEAD') || this.targetBranch.endsWith('/HEAD')) {
            this.statusUpdate.emit('Creating PR from/to origin/HEAD is not supported. Please select a specific branch.');
            this._ngZone.run(() => {
                this.isProcessing = false;
                this.mergeResult = 'error';
                this.mergeMessage = 'Creating PR from/to origin/HEAD is not supported. Select a specific branch.';
                this.selectedTabIndex = 1;
            });
            return;
        }

        this._ngZone.run(() => {
            this.isProcessing = true;
            this.mergeResult = null;
            this.mergeMessage = '';
            this.conflicts = [];
        });

        try {
            // Extract owner and repo from repository info
            const repoFullName = this.repository.fullName; // e.g., "owner/repo"
            const [owner, repo] = repoFullName.split('/');
            
            if (!owner || !repo) {
                throw new Error(`Invalid repository format: ${repoFullName}`);
            }

            // Clean branch names (remove origin/ prefix if present)
            const sourceBranchName = this.sourceBranch.startsWith('origin/') 
                ? this.sourceBranch.substring('origin/'.length) 
                : this.sourceBranch;
            
            const targetBranchName = this.targetBranch.startsWith('origin/') 
                ? this.targetBranch.substring('origin/'.length) 
                : this.targetBranch;

            this.statusUpdate.emit(`Creating pull request: ${sourceBranchName} → ${targetBranchName}`);

            // Create pull request via GitHub API
            const response = await fetch(`https://api.github.com/repos/${owner}/${repo}/pulls`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${this.githubToken}`,
                    'Accept': 'application/vnd.github+json',
                    'X-GitHub-Api-Version': '2022-11-28',
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    title: this.title,
                    body: this.description || '',
                    head: sourceBranchName,
                    base: targetBranchName,
                    draft: false
                })
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(`GitHub API Error (${response.status}): ${errorData.message || JSON.stringify(errorData)}`);
            }

            const pullRequest = await response.json();
            
            this._ngZone.run(() => {
                this.mergeResult = 'success';
                this.mergeMessage = `Pull Request created successfully! PR #${pullRequest.number}: ${pullRequest.html_url}`;
                this.selectedTabIndex = 1;
            });
            
            this.statusUpdate.emit(this.mergeMessage);
            this.mergeCompleted.emit({
                success: true,
                pullRequestNumber: pullRequest.number,
                pullRequestUrl: pullRequest.html_url,
                message: this.mergeMessage,
                pushed: false // No local merge/push happened
            });

        } catch (error: any) {
            console.error('Pull request creation error:', error);
            const errorMessage = `Failed to create pull request: ${error.message || error}`;
            this.statusUpdate.emit(errorMessage);
            
            this._ngZone.run(() => {
                this.mergeResult = 'error';
                this.mergeMessage = errorMessage;
                this.selectedTabIndex = 1;
            });
            
            this.mergeCompleted.emit({
                success: false,
                message: errorMessage,
                pushed: false
            });
        } finally {
            this._ngZone.run(() => {
                this.isProcessing = false;
            });
        }
    }

    resetMergeRequest(): void {        this._ngZone.run(() => {
            this.mergeResult = null;
            this.mergeMessage = '';
            this.conflicts = [];
            this.selectedTabIndex = 0;
            this.title = '';
            this.description = '';
        });
    }
}
