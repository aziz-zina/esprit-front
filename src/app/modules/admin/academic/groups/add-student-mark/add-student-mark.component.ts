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
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { User } from '@core/user/user.types';
import { TranslocoModule, TranslocoService } from '@jsverse/transloco';
import { HotToastService } from '@ngxpert/hot-toast';
import { catchError, of } from 'rxjs';
import { GroupService } from '../groups.service';
import { Group, StudentMarkDto } from '../groups.types';

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
export class AddStudentMarkComponent {
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
    readonly currentMark = signal<number | undefined>(
        this.DIALOG_DATA?.currentMark
    );
    readonly currentComment = signal<string | undefined>(
        this.DIALOG_DATA?.currentComment
    );

    markForm = this._formBuilder.group({
        mark: [
            this.currentMark() || 0,
            [Validators.required, Validators.min(0), Validators.max(20)],
        ],
        comment: [this.currentComment() || ''],
    });

    // -----------------------------------------------------------------------------------------------------
    // @ Accessors
    // -----------------------------------------------------------------------------------------------------

    get activeLang() {
        return this._translocoService.getActiveLang();
    }

    ngOnInit(): void {
        //Called after the constructor, initializing input properties, and the first call to ngOnChanges.
        //Add 'implements OnInit' to the class.
        console.log(this.student());
    }

    // -----------------------------------------------------------------------------------------------------
    // @ Public methods
    // -----------------------------------------------------------------------------------------------------

    // Submit the form
    submitForm() {
        this.markForm.disable();
        this.addStudentMark();
    }

    addStudentMark() {
        const payload: StudentMarkDto = {
            mark: this.markForm.value.mark,
            comment: this.markForm.value.comment || '',
        };

        this._groupService
            .addMarkToStudent(this.group().id, this.student().id, payload)
            .pipe(
                this.toastService.observe({
                    loading: this._translocoService.translate('toast.loading'),
                    success: () => {
                        this.markForm.enable();
                        this._dialogRef.close('success');
                        return this._translocoService.translate(
                            'add-student-mark.add-success'
                        );
                    },
                    error: () => {
                        this.markForm.enable();
                        return this._translocoService.translate(
                            'add-student-mark.add-error'
                        );
                    },
                }),
                catchError((error: unknown) => {
                    return of(error);
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

    close(response: 'cancel' | 'success') {
        this._dialogRef.close(response);
    }
}
