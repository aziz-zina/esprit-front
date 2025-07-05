import {
    ChangeDetectionStrategy,
    Component,
    inject,
    OnInit,
    signal,
} from '@angular/core';
import { FormBuilder, FormsModule, ReactiveFormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { User } from '@core/user/user.types';
import { TranslocoModule, TranslocoService } from '@jsverse/transloco';
import { HotToastService } from '@ngxpert/hot-toast';
import { catchError, finalize, of } from 'rxjs';
import { GroupService } from '../groups.service';
import { Group, GroupStudent, StudentMarkDto } from '../groups.types';

@Component({
    selector: 'app-add-student-mark',
    imports: [
        MatIconModule,
        FormsModule,
        ReactiveFormsModule,
        MatFormFieldModule,
        MatInputModule,
        MatButtonModule,
        TranslocoModule,
        MatProgressSpinnerModule,
    ],
    templateUrl: './add-student-mark.component.html',
    changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AddStudentMarkComponent implements OnInit {
    // -----------------------------------------------------------------------------------------------------
    // @ Dependencies
    // -----------------------------------------------------------------------------------------------------

    private readonly _groupService = inject(GroupService);
    private readonly _translocoService = inject(TranslocoService);
    private readonly _formBuilder = inject(FormBuilder);
    private readonly toastService = inject(HotToastService);
    private readonly _dialogRef = inject(MatDialogRef);
    private readonly DIALOG_DATA = inject(MAT_DIALOG_DATA);

    // -----------------------------------------------------------------------------------------------------
    // @ Public properties
    // -----------------------------------------------------------------------------------------------------

    readonly group = signal<Group>(this.DIALOG_DATA?.group);
    readonly student = signal<User>(this.DIALOG_DATA?.student);
    readonly groupStudent = signal<GroupStudent>(
        this.DIALOG_DATA?.groupStudent
    );

    readonly isCalculating = signal<boolean>(false);
    readonly isSaving = signal<boolean>(false);
    readonly initialMarkExists = signal<boolean>(
        this.DIALOG_DATA?.groupStudent?.individualMark != null
    );

    markForm = this._formBuilder.group({
        comment: [''],
    });

    // -----------------------------------------------------------------------------------------------------
    // @ Lifecycle hooks
    // -----------------------------------------------------------------------------------------------------

    ngOnInit(): void {
        // Initialize form with existing comment if available
        if (this.groupStudent()?.individualComment) {
            this.markForm.patchValue({
                comment: this.groupStudent().individualComment,
            });
        }
    }

    // -----------------------------------------------------------------------------------------------------
    // @ Public methods
    // -----------------------------------------------------------------------------------------------------

    /**
     * Calls the service to calculate the student's individual mark based on their tasks.
     */
    calculateMark(): void {
        this.isCalculating.set(true);
        this._groupService
            .calculateIndividualMark(this.groupStudent().id)
            .pipe(
                this.toastService.observe({
                    loading: 'Calculating mark...',
                    success: 'Mark calculated successfully!',
                    error: 'Failed to calculate mark.',
                }),
                finalize(() => this.isCalculating.set(false)),
                catchError((error) => of(error))
            )
            .subscribe((updatedGroupStudent: GroupStudent) => {
                // Update the signal with the new data containing the calculated mark
                this.groupStudent.set(updatedGroupStudent);
            });
    }

    /**
     * Saves the calculated mark and comment.
     */
    saveMark(): void {
        const currentMark = this.groupStudent()?.individualMark;
        if (currentMark === null || currentMark === undefined) {
            this.toastService.error('Please calculate a mark before saving.');
            return;
        }

        this.isSaving.set(true);
        this.markForm.disable();

        const payload: StudentMarkDto = {
            mark: currentMark,
            comment: this.markForm.value.comment || '',
        };

        this._groupService
            .addMarkToStudent(this.group().id, this.student().id, payload)
            .pipe(
                this.toastService.observe({
                    loading: this._translocoService.translate('toast.loading'),
                    success: () => {
                        this._dialogRef.close('success');
                        return this._translocoService.translate(
                            this.initialMarkExists()
                                ? 'add-student-mark.update-success'
                                : 'add-student-mark.add-success'
                        );
                    },
                    error: () =>
                        this._translocoService.translate(
                            'add-student-mark.add-error'
                        ),
                }),
                catchError((error) => of(error)),
                finalize(() => {
                    this.isSaving.set(false);
                    this.markForm.enable();
                })
            )
            .subscribe();
    }

    getStudentFullName(): string {
        const student = this.student();
        if (student.firstName && student.lastName) {
            return `${student.firstName} ${student.lastName}`;
        }
        return student.username || 'Unknown Student';
    }

    close(response: 'cancel' | 'success'): void {
        this._dialogRef.close(response);
    }
}
