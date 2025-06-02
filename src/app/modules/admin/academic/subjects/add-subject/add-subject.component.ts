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
import { UserService } from '@core/user/user.service';
import { TranslocoModule, TranslocoService } from '@jsverse/transloco';
import { HotToastService } from '@ngxpert/hot-toast';
import { catchError, of } from 'rxjs';
import { ClassroomService } from '../../classrooms/classrooms.service';
import { SubjectService } from '../subjects.service';
import { AddSubjectRequest } from '../subjects.types';

@Component({
    selector: 'app-add-subject',
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
    templateUrl: './add-subject.component.html',
    changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AddSubjectComponent {
    // -----------------------------------------------------------------------------------------------------
    // @ Dependencies
    // -----------------------------------------------------------------------------------------------------

    private readonly _subjectService = inject(SubjectService);
    private readonly _classroomService = inject(ClassroomService);
    private readonly _userService = inject(UserService);
    private readonly _translocoService = inject(TranslocoService);
    private readonly _formBuilder = inject(FormBuilder);
    private readonly toastService = inject(HotToastService);
    private readonly _dialogRef = inject(MatDialogRef);
    private readonly DIALOG_DATA = inject(MAT_DIALOG_DATA);

    // -----------------------------------------------------------------------------------------------------
    // @ Public properties
    // -----------------------------------------------------------------------------------------------------

    readonly createdUser = signal(null);
    readonly classrooms = signal([]);
    readonly teachers = signal([]);
    readonly updateMode = signal(!!this.DIALOG_DATA?.subject);
    addForm = this._formBuilder.group({
        name: ['', [Validators.required]],
        classroomId: ['', [Validators.required]],
        teacherId: ['', [Validators.required]],
        groupMarkPercentage: [
            0,
            [Validators.required, Validators.min(0), Validators.max(100)],
        ],
        individualMarkPercentage: [
            0,
            [Validators.required, Validators.min(0), Validators.max(100)],
        ],
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
        this._classroomService.getClassrooms().subscribe((classrooms) => {
            console.log(classrooms);
            this.classrooms.set(classrooms);
        });
        this._userService.getAllUsersByRole('teacher').subscribe((teachers) => {
            console.log(teachers);
            this.teachers.set(teachers);
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
        // const payload: UpdateSubjectRequest = {
        //     id: this.DIALOG_DATA.subject.id,
        //     startYear: this.addForm.value.startYear,
        //     endYear: this.addForm.value.endYear,
        // };
        // this._subjectService
        //     .updateSubject(payload)
        //     .pipe(
        //         this.toastService.observe({
        //             loading: this._translocoService.translate('toast.loading'),
        //             success: () => {
        //                 this._dialogRef.close('success');
        //                 return this._translocoService.translate(
        //                     'add-subject.update-success'
        //                 );
        //             },
        //             error: () => {
        //                 this.addForm.enable();
        //                 return this._translocoService.translate(
        //                     'add-subject.update-error'
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
        const payload: AddSubjectRequest = {
            name: this.addForm.value.name,
            classroomId: this.addForm.value.classroomId,
            teacherId: this.addForm.value.teacherId,
            groupMarkPercentage: this.addForm.value.groupMarkPercentage,
            individualMarkPercentage:
                this.addForm.value.individualMarkPercentage,
        };
        this._subjectService
            .createSubject(payload)
            .pipe(
                this.toastService.observe({
                    loading: this._translocoService.translate('toast.loading'),
                    success: () => {
                        this.addForm.enable();
                        this._dialogRef.close('success');
                        return this._translocoService.translate(
                            'add-subject.add-success'
                        );
                    },
                    error: () => {
                        this.addForm.enable();
                        return this._translocoService.translate(
                            'add-subject.add-error'
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
