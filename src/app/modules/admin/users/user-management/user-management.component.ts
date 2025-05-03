import { NgOptimizedImage } from '@angular/common';
import {
    ChangeDetectionStrategy,
    Component,
    DestroyRef,
    inject,
    input,
    OnInit,
    signal,
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
import { MatSelectModule } from '@angular/material/select';
import { MatSidenavModule } from '@angular/material/sidenav';
import {
    MatSlideToggleChange,
    MatSlideToggleModule,
} from '@angular/material/slide-toggle';
import { MatSortModule, Sort } from '@angular/material/sort';
import { MatTableModule } from '@angular/material/table';
import { MatTooltipModule } from '@angular/material/tooltip';
import { RouterModule } from '@angular/router';
import { UserService } from '@core/user/user.service';
import { User } from '@core/user/user.types';
import { FuseConfirmationService } from '@fuse/services/confirmation';
import { TranslocoModule, TranslocoService } from '@jsverse/transloco';
import { MtxGridColumn, MtxGridModule } from '@ng-matero/extensions/grid';
import { HotToastService } from '@ngxpert/hot-toast';
import { Role, RoleEnum, SortDirectionEnum } from 'app/models/enums';
import { PageRequest } from 'app/models/pagination/pageRequest';
import {
    debounceTime,
    distinctUntilChanged,
    filter,
    finalize,
    switchMap,
    tap,
} from 'rxjs';
import { UserFormComponent } from '../user-form/user-form.component';

@Component({
    selector: 'app-user-management',
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
        NgOptimizedImage,
        MatSlideToggleModule,
        MatTooltipModule,
        MtxGridModule,
        RouterModule,
        MatSelectModule,
    ],
    templateUrl: './user-management.component.html',
    changeDetection: ChangeDetectionStrategy.OnPush,
})
export class UserManagementComponent implements OnInit {
    // -----------------------------------------------------------------------------------------------------
    // @ Dependencies
    // -----------------------------------------------------------------------------------------------------

    private readonly _destroyRef = inject(DestroyRef);
    private readonly _userService = inject(UserService);
    private readonly _translocoService = inject(TranslocoService);
    private readonly _fuseConfirmationService = inject(FuseConfirmationService);
    private readonly _toastService = inject(HotToastService);
    private readonly _matDialog = inject(MatDialog);

    // -----------------------------------------------------------------------------------------------------
    // @ Observables and signals
    readonly columns = signal<MtxGridColumn[]>([]);
    readonly users = signal<User[]>([]);
    readonly totalElements = signal(0);
    readonly pageSizeOptions = signal([5, 10, 25, 50]);
    readonly isLoading = signal(false);
    readonly isDisabled = signal(false);

    readonly role = input.required<Role>();
    searchInputControl = new FormControl('');
    readonly pageRequest = signal<PageRequest>({
        page: 0,
        size: 10,
        sort: 'createdAt',
        search: '',
        sortDirection: SortDirectionEnum.DESC,
    });

    // -----------------------------------------------------------------------------------------------------
    // @ Accessors
    // -----------------------------------------------------------------------------------------------------

    get activeLang() {
        return this._translocoService.getActiveLang();
    }

    // -----------------------------------------------------------------------------------------------------
    // @ Lifecycle hooks
    // -----------------------------------------------------------------------------------------------------

    /**
     * On init
     */
    ngOnInit(): void {
        this.initializeColumns();

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
        this._userService
            .getUsersByRole(this.role(), this.pageRequest())
            .subscribe((data) => {
                this.users.set(data.content);
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

    check(event: MatSlideToggleChange, user: User) {
        if (event.checked) {
            this.toggle(event, user, 'enable');
        } else {
            this.toggle(event, user, 'disable');
        }
    }

    openAddDialog() {
        const dialogRef = this._matDialog.open(UserFormComponent, {
            data: {
                role: this.role(),
            },
        });
        dialogRef.afterClosed().subscribe((result) => {
            if (result === 'success') {
                this.fetchPage();
            }
        });
    }

    onUpdateUser(user: User) {
        const dialogRef = this._matDialog.open(UserFormComponent, {
            data: {
                user,
                role: this.role(),
            },
        });
        dialogRef.afterClosed().subscribe((result) => {
            if (result === 'success') {
                this.fetchPage();
            }
        });
    }

    openConfirmationDialog(data: User): void {
        const dialogRef = this._fuseConfirmationService.open({
            title: this._translocoService.translate(
                'table.confirmationDialog.title'
            ),
            message: this._translocoService.translate(
                'table.confirmationDialog.deleteUser'
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
                    this._userService.deleteById(data.id).pipe(
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

    toggle(event: MatSlideToggleChange, userToUpdate: User, status: string) {
        const dialogRef = this._fuseConfirmationService.open({
            title: this._translocoService.translate(
                'table.confirmationDialog.title'
            ),
            message: this._translocoService.translate(
                `table.confirmationDialog.toggle.${status}`
            ),
            actions: {
                confirm: {
                    label: this._translocoService.translate(
                        `table.confirmationDialog.confirm`
                    ),
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
                tap((result) => {
                    if (result !== 'confirmed') {
                        event.source.checked = !event.source.checked;
                    }
                }),
                filter((result) => result === 'confirmed'),
                switchMap(() =>
                    this._userService.toggleUserStatus(userToUpdate.id).pipe(
                        this._toastService.observe({
                            loading:
                                this._translocoService.translate('loading'),
                            success: (response) => {
                                if (!response) return;

                                this.users.update((users) => {
                                    return users.map((user) => {
                                        if (user.id === userToUpdate.id) {
                                            return {
                                                ...user,
                                                enabled: !user.enabled,
                                            };
                                        }
                                        return user;
                                    });
                                });

                                return this._translocoService.translate(
                                    `table.confirmationDialog.toggle.success.${status}`
                                );
                            },
                        })
                    )
                ),
                takeUntilDestroyed(this._destroyRef)
            )
            .subscribe();
    }

    protected getTitleKey(): string {
        switch (this.role()) {
            case RoleEnum.ADMIN:
                return 'table.titles.admins';
            case RoleEnum.TEACHER:
                return 'table.titles.teachers';
            case RoleEnum.STUDENT:
            default:
                return 'table.titles.students';
        }
    }

    // -----------------------------------------------------------------------------------------------------
    // @ Private methods
    // -----------------------------------------------------------------------------------------------------
    private initializeColumns(): void {
        this._translocoService.langChanges$.subscribe(() => {
            this.columns.set([
                {
                    header: this._translocoService.translate(
                        'table.headers.fullName'
                    ),
                    field: 'fullName',
                    sortable: true,
                },
                {
                    header: this._translocoService.translate(
                        'table.headers.email'
                    ),
                    field: 'email',
                    sortable: true,
                },
                {
                    header: this._translocoService.translate(
                        'table.headers.phoneNumber'
                    ),
                    field: 'phoneNumber',
                },
                {
                    header: this._translocoService.translate(
                        'table.headers.address'
                    ),
                    field: 'address',
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
                            text: 'edit',
                            svgIcon: 'feather:edit',
                            tooltip:
                                this._translocoService.translate(
                                    'table.buttons.edit'
                                ),
                            color: 'primary',
                            click: (rowData) => this.onUpdateUser(rowData),
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
    }
}
