// src/app/repo-tree/repo-tree.component.ts
import { CommonModule } from '@angular/common';
import {
    Component,
    inject,
    Input,
    OnChanges,
    OnInit,
    SimpleChanges,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSelectModule } from '@angular/material/select';
import { MatTooltipModule } from '@angular/material/tooltip';
import { ActivatedRoute, Router } from '@angular/router';
import { HighlightDirective } from '@shared/highlight.directive';
import { ProjectService } from '../project.service';
import { Branch, ContentType, RepositoryContent } from '../project.types';

@Component({
    selector: 'app-repo-tree',
    imports: [
        CommonModule,
        FormsModule,
        MatCardModule,
        MatSelectModule,
        MatIconModule,
        MatInputModule,
        MatFormFieldModule,
        MatProgressSpinnerModule,
        MatTooltipModule,
        HighlightDirective,
    ],
    templateUrl: './repo-tree.component.html',
})
export class RepoTreeComponent implements OnInit, OnChanges {
    @Input() repoName: string | null = null;

    private readonly _route = inject(ActivatedRoute);
    private readonly _router = inject(Router);
    private readonly _gitService = inject(ProjectService);

    selectedBranch: string | null = null;
    branches: Branch[] = [];
    repoContents: RepositoryContent[] = [];
    displayedContents: RepositoryContent[] = [];
    currentPath: string[] = [];

    isLoading = true;
    errorMessage: string | null = null;
    searchQuery: string = '';

    fileContentToDisplay: string | null = null;
    fileNameToDisplay: string | null = null;
    isContentBinaryOrUnreadable: boolean = false;
    currentFileExtension: string | null = null;

    ContentType = ContentType;

    constructor() {}

    ngOnInit(): void {
        if (this.repoName) {
            this._loadData(this.repoName);
        } else {
            this.errorMessage = 'Repository name not provided as input.';
        }
        this.isLoading = false;
    }

    ngOnChanges(changes: SimpleChanges): void {
        if (changes['repoName'] && !changes['repoName'].firstChange) {
            this.selectedBranch = null;
            this.currentPath = [];
            this.searchQuery = '';
            this.clearFileContentDisplay();
            this._loadData(this.repoName);
        }
    }

    /**
     * Centralized method to load branches and repository contents.
     * Called from ngOnInit (initial load) and ngOnChanges (when repoName input changes).
     * @param repoName The name of the repository.
     */
    private _loadData(repoName: string | null): void {
        if (!repoName) {
            this.errorMessage = 'Repository name is required to load data.';
            this.isLoading = false;
            return;
        }

        this.isLoading = true;
        this.errorMessage = null;
        this.clearFileContentDisplay();

        this._gitService.getBranches(repoName).subscribe({
            next: (branches) => {
                this.branches = branches;
                if (branches.length > 0) {
                    this.selectedBranch =
                        branches.find((b) => b.name === 'main')?.name ||
                        branches.find((b) => b.name === 'master')?.name ||
                        branches[0].name;
                    this.loadRepoContents();
                } else {
                    this.errorMessage =
                        'No branches found for this repository.';
                    this.isLoading = false;
                }
            },
            error: (err) => {
                console.error('Failed to load branches', err);
                this.errorMessage = err.message ?? 'Could not load branches.';
                this.isLoading = false;
            },
        });
    }

    loadRepoContents(): void {
        if (!this.repoName || !this.selectedBranch) {
            this.errorMessage = 'Repository or branch not selected.';
            this.isLoading = false;
            return;
        }

        this.isLoading = true;
        this.errorMessage = null;
        this.currentPath = [];
        this.searchQuery = '';
        this.clearFileContentDisplay();
        this._gitService
            .getBranchContents(this.repoName, this.selectedBranch)
            .subscribe({
                next: (contents) => {
                    this.repoContents = contents;
                    this.applyFilters(); // Apply both path and search filters
                    this.isLoading = false;
                },
                error: (err) => {
                    console.error('Failed to load repository contents', err);
                    this.errorMessage =
                        err.message || 'Could not load repository contents.';
                    this.isLoading = false;
                },
            });
    }

    onBranchChange(): void {
        if (this.repoName && this.selectedBranch) {
            this.clearFileContentDisplay(); // Clear file view on branch change
            this.loadRepoContents(); // Reload contents for the new branch
        }
    }

    // New method to apply all current filters (path and search)
    applyFilters(): void {
        this.clearFileContentDisplay(); // Clear file view on filter change to prevent stale content

        let contentsToFilter = this.repoContents;

        // 1. Filter by current path
        const currentPathPrefix =
            this.currentPath.length > 0 ? this.currentPath.join('/') + '/' : '';

        contentsToFilter = contentsToFilter.filter((content) => {
            const startsWithPrefix = content.path.startsWith(currentPathPrefix);
            const pathSegments = content.path.split('/');
            const currentPathSegmentsLength = this.currentPath.length;

            // A content item is a direct child if its path has exactly one more segment
            // than the current path, and it starts with the current path prefix.
            // Example: currentPath=['src'], content.path='src/app/component.ts' (not direct child)
            // Example: currentPath=['src'], content.path='src/app' (direct child)
            const isDirectChild =
                pathSegments.length === currentPathSegmentsLength + 1;

            return startsWithPrefix && isDirectChild;
        });

        // 2. Filter by search query
        if (this.searchQuery) {
            const lowerCaseQuery = this.searchQuery.toLowerCase();
            contentsToFilter = contentsToFilter.filter((content) =>
                content.name.toLowerCase().includes(lowerCaseQuery)
            );
        }

        // 3. Sort the results
        this.displayedContents = contentsToFilter.sort((a, b) => {
            // Directories first, then alphabetically
            if (a.type === ContentType.DIRECTORY && b.type === ContentType.FILE)
                return -1;
            if (a.type === ContentType.FILE && b.type === ContentType.DIRECTORY)
                return 1;
            return a.name.localeCompare(b.name);
        });
    }

    // Method called from the search input
    onSearchInputChange(event: Event): void {
        this.searchQuery = (event.target as HTMLInputElement).value;
        this.applyFilters(); // Re-apply all filters including the search
    }

    enterDirectory(directoryName: string): void {
        this.currentPath.push(directoryName);
        this.searchQuery = ''; // Clear search when entering directory
        this.clearFileContentDisplay(); // Clear file view on directory entry
        this.applyFilters();
    }

    goBack(): void {
        if (this.currentPath.length > 0) {
            this.currentPath.pop();
            this.searchQuery = ''; // Clear search when going back
            this.clearFileContentDisplay(); // Clear file view when going back
            this.applyFilters();
        }
    }

    navigateToPath(index: number): void {
        // Navigates to a specific path segment.
        // If index is -1, it means going back to the root.
        this.currentPath = this.currentPath.slice(0, index + 1);
        this.searchQuery = ''; // Clear search when navigating breadcrumbs
        this.clearFileContentDisplay(); // Clear file view on breadcrumb navigation
        this.applyFilters();
    }

    downloadFile(content: RepositoryContent): void {
        if (
            !this.repoName ||
            !this.selectedBranch ||
            content.type !== ContentType.FILE
        ) {
            return;
        }

        this._gitService
            .downloadFile(this.repoName, this.selectedBranch, content.path)
            .subscribe({
                next: (blob) => {
                    const url = window.URL.createObjectURL(blob);
                    const a = document.createElement('a');
                    a.href = url;
                    a.download = content.name; // Use the file's name for download
                    document.body.appendChild(a);
                    a.click();
                    window.URL.revokeObjectURL(url);
                    a.remove();
                },
                error: (err) => {
                    console.error('Failed to download file', err);
                    alert(
                        `Error downloading file: ${err.message || 'Unknown error'}`
                    );
                },
            });
    }

    // New method to clear the displayed file content
    clearFileContentDisplay(): void {
        this.fileContentToDisplay = null;
        this.fileNameToDisplay = null;
        this.isContentBinaryOrUnreadable = false;
        this.currentFileExtension = null; // <--- Clear the file extension too
    }

    // Helper to display file content in the component's HTML
    displayFileContent(content: RepositoryContent): void {
        if (content.type === ContentType.FILE && content.content) {
            this.fileNameToDisplay = content.name;
            this.isContentBinaryOrUnreadable = false; // Reset flag for new file
            // Extract file extension for highlight.js directive
            this.currentFileExtension =
                content.name.split('.').pop()?.toLowerCase() || null; // <--- Set file extension

            console.log(`Displaying extension: ${this.currentFileExtension}`);
            try {
                // Attempt to decode base64 if it's likely encoded
                const decodedContent = atob(content.content);
                // Basic check to see if it's primarily printable text characters + newlines
                const isText =
                    decodedContent.length > 0 &&
                    Array.from(decodedContent).every(
                        (char) =>
                            (char.charCodeAt(0) >= 32 &&
                                char.charCodeAt(0) <= 126) || // Printable ASCII
                            char.charCodeAt(0) === 9 || // Tab
                            char.charCodeAt(0) === 10 || // LF (Newline)
                            char.charCodeAt(0) === 13 // CR (Carriage Return)
                    );

                if (isText) {
                    this.fileContentToDisplay = decodedContent;
                } else {
                    this.fileContentToDisplay =
                        '(Binary or unreadable content)';
                    this.isContentBinaryOrUnreadable = true;
                    console.warn(
                        `File '${content.name}' content could not be displayed as text.`
                    );
                }
            } catch (e) {
                // If atob fails (not valid base64), display original content directly
                this.fileContentToDisplay = content.content; // Show raw content
                this.isContentBinaryOrUnreadable = true; // Mark as unreadable/binary if base64 decode failed
                if (e instanceof Error) {
                    console.warn(
                        `File '${content.name}' content is not base64 or could not be decoded. Displaying as-is. Error: ${e.message}`
                    );
                } else {
                    console.warn(
                        `File '${content.name}' content is not base64 or could not be decoded. Displaying as-is.`
                    );
                }
            }
        }
        // If it's not a file or has no content, clear any previously displayed content.
        else {
            this.clearFileContentDisplay();
        }
    }
}
