import {
    ChangeDetectionStrategy,
    Component,
    inject,
    signal,
} from '@angular/core';
import {
    FormBuilder,
    FormsModule,
    ReactiveFormsModule,
    Validators,
} from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSelectModule } from '@angular/material/select';
import { MatStepperModule } from '@angular/material/stepper';
import { TranslocoModule, TranslocoService } from '@jsverse/transloco';
import { HotToastService } from '@ngxpert/hot-toast';
import { catchError, of } from 'rxjs';
import { AcademicYearService } from '../academic-years.service';
import {
    AddAcademicYearRequest,
    UpdateAcademicYearRequest,
} from '../academic-years.types';
import { endYearAfterStartYearValidator } from './end-year-validator';

@Component({
    selector: 'app-add-academic-year',
    imports: [
        MatIconModule,
        FormsModule,
        ReactiveFormsModule,
        MatFormFieldModule,
        MatInputModule,
        MatSelectModule,
        MatButtonModule,
        MatDatepickerModule,
        TranslocoModule,
        MatStepperModule,
        MatProgressSpinnerModule,
    ],
    templateUrl: './add-academic-year.component.html',
    changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AddAcademicYearComponent {
    // -----------------------------------------------------------------------------------------------------
    // @ Dependencies
    // -----------------------------------------------------------------------------------------------------

    private readonly _academicYearService = inject(AcademicYearService);
    private readonly _translocoService = inject(TranslocoService);
    private readonly _formBuilder = inject(FormBuilder);
    private readonly toastService = inject(HotToastService);
    private readonly _dialogRef = inject(MatDialogRef);
    private readonly DIALOG_DATA = inject(MAT_DIALOG_DATA);

    // -----------------------------------------------------------------------------------------------------
    // @ Public properties
    // -----------------------------------------------------------------------------------------------------

    readonly createdUser = signal(null);
    readonly updateMode = signal(!!this.DIALOG_DATA?.academicYear);

    addForm = this._formBuilder.group(
        {
            startYear: [0, [Validators.required, Validators.minLength(4)]],
            endYear: [0, [Validators.required, Validators.minLength(4)]],
        },
        {
            validators: endYearAfterStartYearValidator,
        }
    );

    // -----------------------------------------------------------------------------------------------------
    // @ Accessors
    // -----------------------------------------------------------------------------------------------------

    get activeLang() {
        return this._translocoService.getActiveLang();
    }

    // -----------------------------------------------------------------------------------------------------
    // @ Lifecycle hooks
    // -----------------------------------------------------------------------------------------------------
    ngOnInit(): void {
        if (this.DIALOG_DATA?.academicYear) {
            console.log(this.DIALOG_DATA.academicYear);
            this.addForm.patchValue({
                endYear: this.DIALOG_DATA.academicYear.endYear,
                startYear: this.DIALOG_DATA.academicYear.startYear,
            });
        }
    }

    // -----------------------------------------------------------------------------------------------------
    // @ Public methods
    // -----------------------------------------------------------------------------------------------------

    // Submit the form
    submitForm() {
        this.addForm.disable();
        this.updateMode() ? this.update() : this.create();
    }

    update() {
        const payload: UpdateAcademicYearRequest = {
            id: this.DIALOG_DATA.academicYear.id,
            startYear: this.addForm.value.startYear,
            endYear: this.addForm.value.endYear,
        };

        this._academicYearService
            .updateAcademicYear(payload)
            .pipe(
                this.toastService.observe({
                    loading: this._translocoService.translate('toast.loading'),
                    success: () => {
                        this._dialogRef.close('success');
                        return this._translocoService.translate(
                            'add-academicYear.update-success'
                        );
                    },
                    error: () => {
                        this.addForm.enable();
                        return this._translocoService.translate(
                            'add-academicYear.update-error'
                        );
                    },
                }),
                catchError((error: unknown) => {
                    return of(error);
                })
            )
            .subscribe();
    }

    create() {
        const payload: AddAcademicYearRequest = {
            startYear: this.addForm.value.startYear,
            endYear: this.addForm.value.endYear,
        };

        this._academicYearService
            .createAcademicYear(payload)
            .pipe(
                this.toastService.observe({
                    loading: this._translocoService.translate('toast.loading'),
                    success: () => {
                        this.addForm.enable();
                        this._dialogRef.close('success');
                        return this._translocoService.translate(
                            'add-academicYear.add-success'
                        );
                    },
                    error: () => {
                        this.addForm.enable();
                        return this._translocoService.translate(
                            'add-academicYear.add-error'
                        );
                    },
                }),
                catchError((error: unknown) => {
                    return of(error);
                })
            )
            .subscribe();
    }

    close(response: 'cancel' | 'success') {
        this._dialogRef.close(response);
    }
}
