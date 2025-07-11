import {
    ChangeDetectionStrategy,
    Component,
    DestroyRef,
    inject,
    signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
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
import { RouterModule } from '@angular/router';
import { FuseConfirmationService } from '@fuse/services/confirmation';
import { TranslocoModule, TranslocoService } from '@jsverse/transloco';
import { MtxGridColumn, MtxGridModule } from '@ng-matero/extensions/grid';
import { HotToastService } from '@ngxpert/hot-toast';
import { SortDirectionEnum } from 'app/models/enums';
import { PageRequest } from 'app/models/pagination/pageRequest';
import { filter, finalize, switchMap } from 'rxjs';
import { AcademicYearService } from './academic-years.service';
import { AcademicYear } from './academic-years.types';
import { AddAcademicYearComponent } from './add-academic-year/add-academic-year.component';

@Component({
    selector: 'app-academic-years',
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
    templateUrl: './academic-years.component.html',
    changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AcademicYearsComponent {
    // -----------------------------------------------------------------------------------------------------
    // @ Dependencies
    // -----------------------------------------------------------------------------------------------------

    private readonly _destroyRef = inject(DestroyRef);
    private readonly _academicYearService = inject(AcademicYearService);
    private readonly _translocoService = inject(TranslocoService);
    private readonly _fuseConfirmationService = inject(FuseConfirmationService);
    private readonly _toastService = inject(HotToastService);
    private readonly _matDialog = inject(MatDialog);

    // -----------------------------------------------------------------------------------------------------
    // @ Observables and signals
    readonly columns = signal<MtxGridColumn[]>([]);
    readonly academicYears = signal<AcademicYear[]>([]);
    readonly totalElements = signal(0);
    readonly pageSizeOptions = signal([5, 10, 25, 50]);
    readonly isLoading = signal(false);
    readonly isDisabled = signal(false);
    readonly pageRequest = signal<PageRequest>({
        page: 0,
        size: 10,
        sort: 'createdAt',
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
                    header: 'Year',
                    field: 'name',
                    sortable: true,
                    formatter: (rowData: any) =>
                        `${rowData.startYear} - ${rowData.endYear}`,
                },

                {
                    header: 'createdAt',
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
    }

    // -----------------------------------------------------------------------------------------------------
    // @ Public methods
    // -----------------------------------------------------------------------------------------------------

    fetchPage() {
        this._academicYearService
            .getAcademicYearsPage(this.pageRequest())
            .subscribe((data) => {
                this.academicYears.set(data.content);
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
        const dialogRef = this._matDialog.open(AddAcademicYearComponent);
        dialogRef.afterClosed().subscribe((result) => {
            if (result === 'success') {
                this.fetchPage();
            }
        });
    }

    openConfirmationDialog(data: AcademicYear): void {
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
                    this._academicYearService
                        .deleteAcademicYearById(data.id)
                        .pipe(
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
