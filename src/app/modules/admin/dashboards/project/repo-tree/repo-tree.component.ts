// src/app/repo-tree/repo-tree.component.ts
import { CommonModule } from '@angular/common';
import {
    ChangeDetectionStrategy,
    Component,
    computed,
    effect,
    inject,
    Injector,
    Input,
    OnChanges,
    OnInit,
    signal,
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
    changeDetection: ChangeDetectionStrategy.OnPush,
})
export class RepoTreeComponent implements OnInit, OnChanges {
    @Input() repoName: string | null = null;
    @Input() branchName: string | null = null;

    private readonly _route = inject(ActivatedRoute);
    private readonly _router = inject(Router);
    private readonly _gitService = inject(ProjectService);
    private readonly _injector = inject(Injector);

    // --- Signal-based State ---
    selectedBranch = signal<string | null>(null);
    repoContents = signal<RepositoryContent[]>([]);
    currentPath = signal<string[]>([]);
    searchQuery = signal<string>('');

    // --- Computed Signal for Displayed Contents ---
    displayedContents = computed(() => {
        const contents = this.repoContents();
        const path = this.currentPath();
        const query = this.searchQuery().toLowerCase();

        // 1. Filter by current path
        const currentPathPrefix = path.length > 0 ? path.join('/') + '/' : '';
        let filteredContents = contents.filter((content) => {
            const startsWithPrefix = content.path.startsWith(currentPathPrefix);
            const pathSegments = content.path.split('/');
            const isDirectChild = pathSegments.length === path.length + 1;
            return startsWithPrefix && isDirectChild;
        });

        // 2. Filter by search query
        if (query) {
            filteredContents = filteredContents.filter((content) =>
                content.name.toLowerCase().includes(query)
            );
        }

        // 3. Sort the results
        return filteredContents.sort((a, b) => {
            if (a.type === ContentType.DIRECTORY && b.type === ContentType.FILE)
                return -1;
            if (a.type === ContentType.FILE && b.type === ContentType.DIRECTORY)
                return 1;
            return a.name.localeCompare(b.name);
        });
    });

    branches: Branch[] = [];
    isLoading = true;
    errorMessage: string | null = null;

    fileContentToDisplay: string | null = null;
    fileNameToDisplay: string | null = null;
    isContentBinaryOrUnreadable: boolean = false;
    currentFileExtension: string | null = null;

    ContentType = ContentType;

    constructor() {
        effect(
            () => {
                const branch = this.selectedBranch();
                if (this.repoName && branch) {
                    this.loadRepoContents();
                }
            },
            { injector: this._injector }
        );
    }

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
            this.selectedBranch.set(null);
            this.currentPath.set([]);
            this.searchQuery.set('');
            this.clearFileContentDisplay();
            this._loadData(this.repoName);
        }
    }

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
                    if (this.branchName) {
                        this.selectedBranch.set(this.branchName);
                    } else {
                        const defaultBranch =
                            branches.find((b) => b.name === 'main')?.name ||
                            branches.find((b) => b.name === 'master')?.name ||
                            branches[0].name;
                        this.selectedBranch.set(defaultBranch);
                    }
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
        const branch = this.selectedBranch();
        if (!this.repoName || !branch) {
            this.errorMessage = 'Repository or branch not selected.';
            this.isLoading = false;
            return;
        }

        this.isLoading = true;
        this.errorMessage = null;
        this.currentPath.set([]);
        this.searchQuery.set('');
        this.clearFileContentDisplay();

        this._gitService.getBranchContents(this.repoName, branch).subscribe({
            next: (contents) => {
                this.repoContents.set(contents); // Set the signal value
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

    // This method now only handles the side-effect of clearing the file view.
    // The actual filtering is handled by the `computed` signal.
    onSearchInputChange(): void {
        this.clearFileContentDisplay();
    }

    enterDirectory(directoryName: string): void {
        this.currentPath.update((path) => [...path, directoryName]);
        this.searchQuery.set('');
        this.clearFileContentDisplay();
    }

    goBack(): void {
        if (this.currentPath().length > 0) {
            this.currentPath.update((path) => path.slice(0, -1));
            this.searchQuery.set('');
            this.clearFileContentDisplay();
        }
    }

    navigateToPath(index: number): void {
        this.currentPath.update((path) => path.slice(0, index + 1));
        this.searchQuery.set('');
        this.clearFileContentDisplay();
    }

    downloadFile(content: RepositoryContent): void {
        const branch = this.selectedBranch();
        if (!this.repoName || !branch || content.type !== ContentType.FILE) {
            return;
        }

        this._gitService
            .downloadFile(this.repoName, branch, content.path)
            .subscribe({
                next: (blob) => {
                    const url = window.URL.createObjectURL(blob);
                    const a = document.createElement('a');
                    a.href = url;
                    a.download = content.name;
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

    clearFileContentDisplay(): void {
        this.fileContentToDisplay = null;
        this.fileNameToDisplay = null;
        this.isContentBinaryOrUnreadable = false;
        this.currentFileExtension = null;
    }

    displayFileContent(content: RepositoryContent): void {
        if (content.type === ContentType.FILE && content.content) {
            this.fileNameToDisplay = content.name;
            this.isContentBinaryOrUnreadable = false;
            this.currentFileExtension =
                content.name.split('.').pop()?.toLowerCase() || null;

            console.log(`Displaying extension: ${this.currentFileExtension}`);
            try {
                const decodedContent = atob(content.content);
                const isText =
                    decodedContent.length > 0 &&
                    Array.from(decodedContent).every(
                        (char) =>
                            (char.charCodeAt(0) >= 32 &&
                                char.charCodeAt(0) <= 126) ||
                            char.charCodeAt(0) === 9 ||
                            char.charCodeAt(0) === 10 ||
                            char.charCodeAt(0) === 13
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
                this.fileContentToDisplay = content.content;
                this.isContentBinaryOrUnreadable = true;
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
        } else {
            this.clearFileContentDisplay();
        }
    }
}
