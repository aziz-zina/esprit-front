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
import { AcademicYearService } from '../../academic-years/academic-years.service';
import { ClassroomService } from '../classrooms.service';
import { AddClassroomRequest } from '../classrooms.types';
import { catchError, of } from 'rxjs';
// import { endYearAfterStartYearValidator } from './end-year-validator';

@Component({
    selector: 'app-add-classroom',
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
    templateUrl: './add-classroom.component.html',
    changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AddClassroomComponent {
    // -----------------------------------------------------------------------------------------------------
    // @ Dependencies
    // -----------------------------------------------------------------------------------------------------

    private readonly _classroomService = inject(ClassroomService);
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
    readonly academicYears = signal([]);
    readonly updateMode = signal(!!this.DIALOG_DATA?.classroom);

    addForm = this._formBuilder.group({
        name: ['', [Validators.required]],
        academicYearId: ['', [Validators.required]],
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
    ngOnInit(): void {
        this._academicYearService.getAcademicYears().subscribe((years) => {
            this.academicYears.set(years);
        });
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
        // const payload: UpdateClassroomRequest = {
        //     id: this.DIALOG_DATA.classroom.id,
        //     startYear: this.addForm.value.startYear,
        //     endYear: this.addForm.value.endYear,
        // };
        // this._classroomService
        //     .updateClassroom(payload)
        //     .pipe(
        //         this.toastService.observe({
        //             loading: this._translocoService.translate('toast.loading'),
        //             success: () => {
        //                 this._dialogRef.close('success');
        //                 return this._translocoService.translate(
        //                     'add-classroom.update-success'
        //                 );
        //             },
        //             error: () => {
        //                 this.addForm.enable();
        //                 return this._translocoService.translate(
        //                     'add-classroom.update-error'
        //                 );
        //             },
        //         }),
        //         catchError((error: unknown) => {
        //             return of(error);
        //         })
        //     )
        //     .subscribe();
    }

    create() {
        const payload: AddClassroomRequest = {
            name: this.addForm.value.name,
            academicYearId: this.addForm.value.academicYearId,
        };
        this._classroomService
            .createClassroom(payload)
            .pipe(
                this.toastService.observe({
                    loading: this._translocoService.translate('toast.loading'),
                    success: () => {
                        this.addForm.enable();
                        this._dialogRef.close('success');
                        return this._translocoService.translate(
                            'add-classroom.add-success'
                        );
                    },
                    error: () => {
                        this.addForm.enable();
                        return this._translocoService.translate(
                            'add-classroom.add-error'
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
