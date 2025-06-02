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
import { TranslocoModule, TranslocoService } from '@jsverse/transloco';
import { HotToastService } from '@ngxpert/hot-toast';
import { catchError, of } from 'rxjs';
import { GroupService } from '../groups.service';
import { Group, GroupMarkDto } from '../groups.types';

@Component({
    selector: 'app-add-mark',
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
    templateUrl: './add-mark.component.html',
    changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AddMarkComponent {
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

    markForm = this._formBuilder.group({
        mark: [
            this.group()?.mark || 0,
            [Validators.required, Validators.min(0), Validators.max(20)],
        ],
        comment: [this.group()?.comment || ''],
    });

    // -----------------------------------------------------------------------------------------------------
    // @ Accessors
    // -----------------------------------------------------------------------------------------------------

    get activeLang() {
        return this._translocoService.getActiveLang();
    }

    // -----------------------------------------------------------------------------------------------------
    // @ Public methods
    // -----------------------------------------------------------------------------------------------------

    // Submit the form
    submitForm() {
        this.markForm.disable();
        this.addMark();
    }

    addMark() {
        const payload: GroupMarkDto = {
            mark: this.markForm.value.mark,
            comment: this.markForm.value.comment || '',
        };

        this._groupService
            .addMarkToGroup(this.group().id, payload)
            .pipe(
                this.toastService.observe({
                    loading: this._translocoService.translate('toast.loading'),
                    success: () => {
                        this.markForm.enable();
                        this._dialogRef.close('success');
                        return this._translocoService.translate(
                            'add-mark.add-success'
                        );
                    },
                    error: () => {
                        this.markForm.enable();
                        return this._translocoService.translate(
                            'add-mark.add-error'
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
