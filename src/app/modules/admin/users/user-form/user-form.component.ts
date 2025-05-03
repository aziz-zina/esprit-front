import { ChangeDetectionStrategy, Component, inject, OnInit, signal } from '@angular/core';
import { FormBuilder, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatStepperModule } from '@angular/material/stepper';
import { UserService } from '@core/user/user.service';
import { AddUserRequest, User } from '@core/user/user.types';
import { TranslocoModule, TranslocoService } from '@jsverse/transloco';
import { HotToastService } from '@ngxpert/hot-toast';
import { catchError, of } from 'rxjs';
import { UpdateUserRequest } from '../../../../core/user/user.types';
import { emailExistsValidator } from './email-exists';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';

@Component({
    selector: 'app-add-admins',
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
        MatProgressSpinnerModule
    ],
    templateUrl: './user-form.component.html',
    changeDetection: ChangeDetectionStrategy.OnPush,
})
export class UserFormComponent implements OnInit {
    // -----------------------------------------------------------------------------------------------------
    // @ Dependencies
    // -----------------------------------------------------------------------------------------------------

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
    readonly updateMode = signal(!!this.DIALOG_DATA.user);

    addUserForm = this._formBuilder.group({
        email: ['', [Validators.required, Validators.email], [emailExistsValidator(this._userService)]],
        firstName: ['', [Validators.required, Validators.minLength(2)]],
        lastName: ['', [Validators.required, Validators.minLength(2)]],
        address: ['', [Validators.required, Validators.minLength(2)]],
        phoneNumber: ['', [Validators.required, Validators.pattern('^[0-9]{8}$')]],
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
        if (this.DIALOG_DATA.user) {
            this.addUserForm.patchValue({
                email: this.DIALOG_DATA.user.email,
                firstName: this.DIALOG_DATA.user.firstName,
                lastName: this.DIALOG_DATA.user.lastName,
                address: this.DIALOG_DATA.user.address,
                phoneNumber: this.DIALOG_DATA.user.phoneNumber,
            });
            this.addUserForm.controls.email.disable();
        }
    }

    // -----------------------------------------------------------------------------------------------------
    // @ Public methods
    // -----------------------------------------------------------------------------------------------------

    // Submit the form
    submitForm() {
        this.addUserForm.disable();
        this.updateMode() ? this.updateUser() : this.createUser();
    }

    updateUser() {
        const payload: UpdateUserRequest = {
            id: this.DIALOG_DATA.user.id,
            firstName: this.addUserForm.value.firstName,
            lastName: this.addUserForm.value.lastName,
            // email: this.addUserForm.value.email,
            phoneNumber: this.addUserForm.value.phoneNumber,
            address: this.addUserForm.value.address,
        };

        this._userService
            .updateUser(payload)
            .pipe(
                this.toastService.observe({
                    loading: this._translocoService.translate('toast.loading'),
                    success: () => {
                        this._dialogRef.close('success');
                        return this._translocoService.translate('add-user.update-success');
                    },
                    error: () => {
                        this.addUserForm.enable();
                        return this._translocoService.translate('add-user.update-error');
                    },
                }),
                catchError((error: unknown) => {
                    return of(error);
                })
            )
            .subscribe();
    }

    createUser() {
        const payload: AddUserRequest = {
            firstName: this.addUserForm.value.firstName,
            lastName: this.addUserForm.value.lastName,
            email: this.addUserForm.value.email,
            phoneNumber: this.addUserForm.value.phoneNumber,
            address: this.addUserForm.value.address,
            roles: [this.DIALOG_DATA.role],
        };

        this._userService
            .createUser(payload)
            .pipe(
                this.toastService.observe({
                    loading: this._translocoService.translate('toast.loading'),
                    success: (res: User) => {
                        this.createdUser.set(res);
                        this.addUserForm.enable();
                        return this._translocoService.translate('add-user.add-success');
                    },
                    error: () => {
                        this.addUserForm.enable();
                        return this._translocoService.translate('add-user.add-error');
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
