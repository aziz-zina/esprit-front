import { CommonModule } from '@angular/common';
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
import { SubjectService } from '../../subjects/subjects.service';
import { Subject } from '../../subjects/subjects.types';
import { GroupService } from '../groups.service';
import { AddGroupRequest } from '../groups.types';

@Component({
    selector: 'app-add-group',
    imports: [
        CommonModule,
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
    templateUrl: './add-group.component.html',
    changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AddGroupComponent {
    // -----------------------------------------------------------------------------------------------------
    // @ Dependencies
    // -----------------------------------------------------------------------------------------------------

    private readonly _groupService = inject(GroupService);
    private readonly _subjectService = inject(SubjectService);
    private readonly _translocoService = inject(TranslocoService);
    private readonly _formBuilder = inject(FormBuilder);
    private readonly toastService = inject(HotToastService);
    private readonly _dialogRef = inject(MatDialogRef);
    private readonly DIALOG_DATA = inject(MAT_DIALOG_DATA);

    // -----------------------------------------------------------------------------------------------------
    // @ Public properties
    // -----------------------------------------------------------------------------------------------------

    readonly createdUser = signal(null);
    readonly subjects = signal<Subject[]>([]);
    readonly updateMode = signal(!!this.DIALOG_DATA?.group);

    addForm = this._formBuilder.group({
        name: ['', [Validators.required]],
        subjectId: ['', [Validators.required]],
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
        this._subjectService.getSubjects().subscribe((subject) => {
            console.log(subject);
            this.subjects.set(subject);
        });
    }

    // -----------------------------------------------------------------------------------------------------
    // @ Public methods
    // -----------------------------------------------------------------------------------------------------

    // Submit the form
    submitForm() {
        this.addForm.disable();
        this.create();
    }

    create() {
        const payload: AddGroupRequest = {
            name: this.addForm.value.name,
            subjectId: this.addForm.value.subjectId,
        };
        this._groupService
            .createGroup(payload)
            .pipe(
                this.toastService.observe({
                    loading: this._translocoService.translate('toast.loading'),
                    success: () => {
                        this.addForm.enable();
                        this._dialogRef.close('success');
                        return this._translocoService.translate(
                            'add-group.add-success'
                        );
                    },
                    error: () => {
                        this.addForm.enable();
                        return this._translocoService.translate(
                            'add-group.add-error'
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
