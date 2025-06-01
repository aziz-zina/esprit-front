import {
    ChangeDetectionStrategy,
    Component,
    DestroyRef,
    inject,
    signal,
    ViewEncapsulation,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormControl, FormsModule, ReactiveFormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatDialog } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatPaginatorModule, PageEvent } from '@angular/material/paginator';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSidenavModule } from '@angular/material/sidenav';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { MatSortModule, Sort } from '@angular/material/sort';
import { MatTableModule } from '@angular/material/table';
import { MatTooltipModule } from '@angular/material/tooltip';
import { Router, RouterModule } from '@angular/router';
import { User } from '@core/user/user.types';
import { FuseConfirmationService } from '@fuse/services/confirmation';
import { TranslocoModule, TranslocoService } from '@jsverse/transloco';
import { MtxGridColumn, MtxGridModule } from '@ng-matero/extensions/grid';
import { HotToastService } from '@ngxpert/hot-toast';
import { SortDirectionEnum } from 'app/models/enums';
import { PageRequest } from 'app/models/pagination/pageRequest';
import {
    debounceTime,
    distinctUntilChanged,
    filter,
    finalize,
    switchMap,
} from 'rxjs';
import { AddGroupComponent } from './add-group/add-group.component';
import { AssignStudentComponent } from './assign-student/assign-student.component';
import { GroupService } from './groups.service';
import { Group } from './groups.types';
import { StudentsDetailsComponent } from './students-details/students-details.component';

@Component({
    selector: 'app-groups',
    imports: [
        MatSidenavModule,
        MatTableModule,
        FormsModule,
        ReactiveFormsModule,
        MatInputModule,
        MatFormFieldModule,
        MatButtonModule,
        MatIconModule,
        MatTooltipModule,
        MatSortModule,
        MatPaginatorModule,
        MatProgressBarModule,
        MatProgressSpinnerModule,
        TranslocoModule,
        MatSlideToggleModule,
        MatTooltipModule,
        MtxGridModule,
        RouterModule,
    ],
    templateUrl: './groups.component.html',
    styleUrl: './groups.component.scss',
    changeDetection: ChangeDetectionStrategy.OnPush,
    encapsulation: ViewEncapsulation.None,
})
export class GroupsComponent {
    // -----------------------------------------------------------------------------------------------------
    // @ Dependencies
    // -----------------------------------------------------------------------------------------------------

    private readonly _destroyRef = inject(DestroyRef);
    private readonly _academicYearService = inject(GroupService);
    private readonly _translocoService = inject(TranslocoService);
    private readonly _fuseConfirmationService = inject(FuseConfirmationService);
    private readonly _toastService = inject(HotToastService);
    private readonly _matDialog = inject(MatDialog);
    private readonly _router = inject(Router);

    // -----------------------------------------------------------------------------------------------------
    // @ Observables and signals
    readonly columns = signal<MtxGridColumn[]>([]);
    readonly groups = signal<Group[]>([]);
    readonly totalElements = signal(0);
    readonly pageSizeOptions = signal([5, 10, 25, 50]);
    readonly isLoading = signal(false);
    readonly isDisabled = signal(false);
    searchInputControl = new FormControl('');
    readonly pageRequest = signal<PageRequest>({
        page: 0,
        size: 10,
        sort: 'createdAt',
        search: '',
        sortDirection: SortDirectionEnum.DESC,
    });

    // -----------------------------------------------------------------------------------------------------
    // @ Lifecycle hooks
    // -----------------------------------------------------------------------------------------------------

    /**
     * On init
     */
    ngOnInit(): void {
        this._translocoService.langChanges$.subscribe(() => {
            this.columns.set([
                {
                    header: this._translocoService.translate(
                        'table.headers.name'
                    ),
                    field: 'name',
                    sortable: true,
                },
                {
                    header: 'Subject',
                    field: 'subject.name',
                    sortable: true,
                },
                {
                    header: 'Teacher',
                    field: 'subject.teacher.fullName',
                    sortable: true,
                },
                {
                    header: 'Number of memebers',
                    field: 'numberStudents',
                    sortable: true,
                    formatter: (rowData: any) => rowData.students.length,
                },

                {
                    header: this._translocoService.translate(
                        'table.headers.createdAt'
                    ),
                    field: 'createdAt',
                    type: 'date',
                    sortable: true,
                },

                {
                    header: this._translocoService.translate(
                        'table.headers.operation'
                    ),
                    field: 'operation',
                    pinned: 'right',
                    type: 'button',
                    buttons: [
                        {
                            type: 'icon',
                            text: 'assign student',
                            svgIcon: 'feather:user-plus',
                            tooltip: 'assign student',
                            color: 'accent',
                            click: (rowData) => this.openAssignDialog(rowData),
                        },
                        {
                            type: 'icon',
                            text: 'group info',
                            svgIcon: 'feather:info',
                            tooltip: 'Group Info',
                            color: 'accent',
                            click: (rowData) =>
                                this.openGroupMembersDetails(rowData.students),
                        },
                        {
                            type: 'icon',
                            text: 'Repositories',
                            svgIcon: 'feather:git-pull-request',
                            tooltip: 'Repositories',
                            color: 'accent',
                            click: (rowData) =>
                                this.navigateToRepositories(rowData.id),
                        },
                        {
                            type: 'icon',
                            text: 'delete',
                            svgIcon: 'feather:trash-2',
                            tooltip: this._translocoService.translate(
                                'table.buttons.delete'
                            ),
                            color: 'warn',
                            click: (rowData) =>
                                this.openConfirmationDialog(rowData),
                        },
                    ],
                },
            ]);
        });

        this.isLoading.set(true);
        this.fetchPage();
        this.searchInputControl.valueChanges
            .pipe(
                debounceTime(300),
                distinctUntilChanged(),
                takeUntilDestroyed(this._destroyRef),
                finalize(() => this.isLoading.set(false))
            )
            .subscribe((query) => {
                this.isLoading.set(true);
                this.pageRequest().search = query;
                this.pageRequest().page = 0;
                this.fetchPage();
            });
    }

    // -----------------------------------------------------------------------------------------------------
    // @ Public methods
    // -----------------------------------------------------------------------------------------------------

    fetchPage() {
        this._academicYearService
            .getGroupsPage(this.pageRequest())
            .subscribe((data) => {
                console.log(data);
                this.groups.set(data.content);
                this.totalElements.set(data.totalElements);
                this.isLoading.set(false);
            });
    }

    onSortChange(sort: Sort) {
        this.pageRequest().sort = sort.active;
        this.pageRequest().sortDirection =
            sort.direction === 'asc'
                ? SortDirectionEnum.ASC
                : SortDirectionEnum.DESC;
        this.fetchPage();
    }

    onPageEvent(event: PageEvent) {
        this.pageRequest().page = event.pageIndex;
        this.pageRequest().size = event.pageSize;

        this.fetchPage();
    }

    openAddDialog(): void {
        const dialogRef = this._matDialog.open(AddGroupComponent);
        dialogRef.afterClosed().subscribe((result) => {
            if (result === 'success') {
                this.fetchPage();
            }
        });
    }

    openAssignDialog(group: Group): void {
        const dialogRef = this._matDialog.open(AssignStudentComponent, {
            data: group,
        });
        dialogRef.afterClosed().subscribe((result) => {
            if (result === 'success') {
                this.fetchPage();
            }
        });
    }

    openGroupMembersDetails(students: User[]): void {
        const dialogRef = this._matDialog.open(StudentsDetailsComponent, {
            data: students,
        });
        dialogRef.afterClosed().subscribe((result) => {
            if (result === 'success') {
                this.fetchPage();
            }
        });
    }

    navigateToRepositories(id: string): void {
        this._router.navigate(['/dashboards/project', id]);
    }

    openConfirmationDialog(data: Group): void {
        const dialogRef = this._fuseConfirmationService.open({
            title: this._translocoService.translate(
                'table.confirmationDialog.title'
            ),
            message: this._translocoService.translate(
                'table.confirmationDialog.delete'
            ),
            actions: {
                confirm: {
                    label: this._translocoService.translate('buttons.delete'),
                },
                cancel: {
                    label: this._translocoService.translate('buttons.cancel'),
                },
            },
            dismissible: true,
        });
        dialogRef
            .afterClosed()
            .pipe(
                filter((result) => result === 'confirmed'),
                switchMap(() =>
                    this._academicYearService.deleteGroupById(data.id).pipe(
                        this._toastService.observe({
                            loading:
                                this._translocoService.translate(
                                    'toast.loading'
                                ),
                            success: () => {
                                this.fetchPage();
                                return this._translocoService.translate(
                                    'toast.success.delete'
                                );
                            },
                        }),
                        takeUntilDestroyed(this._destroyRef)
                    )
                ),
                finalize(() => {
                    this.isDisabled.set(false);
                })
            )
            .subscribe();
    }
}
