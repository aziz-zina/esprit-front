import { CommonModule } from '@angular/common';
import {
    ChangeDetectionStrategy,
    Component,
    computed,
    inject,
    type OnInit,
    signal,
    ViewEncapsulation,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatCheckboxModule } from '@angular/material/checkbox';
import {
    MAT_DIALOG_DATA,
    MatDialogModule,
    MatDialogRef,
} from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatTooltipModule } from '@angular/material/tooltip';
import { ProjectService } from 'app/modules/admin/dashboards/project/project.service';
import type { Repo } from 'app/modules/admin/dashboards/project/project.types';
import { of } from 'rxjs';
import { catchError, finalize } from 'rxjs/operators';

export interface DialogData {
    groupId: string;
    preselectedRepoIds?: string[];
}

@Component({
    selector: 'app-select-repositories',
    imports: [
        CommonModule,
        FormsModule,
        MatDialogModule,
        MatButtonModule,
        MatCheckboxModule,
        MatProgressSpinnerModule,
        MatIconModule,
        MatFormFieldModule,
        MatInputModule,
        MatTooltipModule,
    ],
    templateUrl: './select-repositories.component.html',
    styleUrls: ['./select-repositories.component.scss'],
    changeDetection: ChangeDetectionStrategy.OnPush,
    encapsulation: ViewEncapsulation.None,
})
export class SelectRepositoriesComponent implements OnInit {
    // Inject services and dialog data
    private readonly _projectService = inject(ProjectService);
    public readonly dialogRef = inject(
        MatDialogRef<SelectRepositoriesComponent>
    );
    public readonly data: DialogData = inject(MAT_DIALOG_DATA);

    // Reactive state management with signals
    readonly isLoading = signal(true);
    readonly repositories = signal<Repo[]>([]);
    readonly selectedRepositories = signal(new Map<string, Repo>());
    readonly error = signal<string | null>(null);
    readonly searchTerm = signal('');

    // Computed values
    readonly filteredRepositories = computed(() => {
        const repos = this.repositories();
        const term = this.searchTerm().toLowerCase().trim();

        if (!term) return repos;

        return repos.filter(
            (repo) =>
                repo.repositoryName.toLowerCase().includes(term) ||
                repo.repositoryPath.toLowerCase().includes(term)
        );
    });

    readonly isAllSelected = computed(() => {
        const filtered = this.filteredRepositories();
        const selected = this.selectedRepositories();
        return (
            filtered.length > 0 &&
            filtered.every((repo) => selected.has(repo.id))
        );
    });

    readonly isIndeterminate = computed(() => {
        const filtered = this.filteredRepositories();
        const selected = this.selectedRepositories();
        const selectedCount = filtered.filter((repo) =>
            selected.has(repo.id)
        ).length;
        return selectedCount > 0 && selectedCount < filtered.length;
    });

    ngOnInit(): void {
        this.loadRepositories();
    }

    /**
     * Loads repositories from the service with error handling
     */
    private loadRepositories(): void {
        this.isLoading.set(true);
        this.error.set(null);

        this._projectService
            .getByGroupId(this.data.groupId)
            .pipe(
                catchError((error) => {
                    console.error('Failed to load repositories:', error);
                    this.error.set(
                        'Unable to load repositories. Please try again.'
                    );
                    return of([]);
                }),
                finalize(() => this.isLoading.set(false))
            )
            .subscribe((repos) => {
                this.repositories.set(repos);
                this.preselectRepositories();
            });
    }

    /**
     * Preselects repositories if provided in dialog data
     */
    private preselectRepositories(): void {
        if (this.data.preselectedRepoIds?.length) {
            const selected = new Map<string, Repo>();
            const repos = this.repositories();

            this.data.preselectedRepoIds.forEach((id) => {
                const repo = repos.find((r) => r.id === id);
                if (repo) {
                    selected.set(id, repo);
                }
            });

            this.selectedRepositories.set(selected);
        }
    }

    /**
     * Handles repository selection changes
     */
    onSelectionChange(isSelected: boolean, repo: Repo): void {
        const currentSelected = new Map(this.selectedRepositories());

        if (isSelected) {
            currentSelected.set(repo.id, repo);
        } else {
            currentSelected.delete(repo.id);
        }

        this.selectedRepositories.set(currentSelected);
    }

    /**
     * Toggles selection of all filtered repositories
     */
    toggleSelectAll(selectAll: boolean): void {
        const currentSelected = new Map(this.selectedRepositories());
        const filtered = this.filteredRepositories();

        if (selectAll) {
            filtered.forEach((repo) => currentSelected.set(repo.id, repo));
        } else {
            filtered.forEach((repo) => currentSelected.delete(repo.id));
        }

        this.selectedRepositories.set(currentSelected);
    }

    /**
     * Handles search input changes
     */
    onSearchChange(event: Event): void {
        const target = event.target as HTMLInputElement;
        this.searchTerm.set(target.value);
    }

    /**
     * Clears the search term
     */
    clearSearch(): void {
        this.searchTerm.set('');
    }

    /**
     * Retries loading repositories
     */
    retryLoad(): void {
        this.loadRepositories();
    }

    /**
     * Closes dialog without saving
     */
    onCancel(): void {
        this.dialogRef.close();
    }

    /**
     * Saves selection and closes dialog
     */
    onSave(): void {
        const selectedRepos = Array.from(this.selectedRepositories().values());
        this.dialogRef.close(selectedRepos);
    }
}
