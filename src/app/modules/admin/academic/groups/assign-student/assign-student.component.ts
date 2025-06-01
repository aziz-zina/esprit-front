import { CommonModule } from '@angular/common';
import { Component, computed, inject, OnInit, signal } from '@angular/core';
import {
    AbstractControl,
    FormBuilder,
    FormControl,
    ReactiveFormsModule,
    ValidationErrors,
    Validators,
} from '@angular/forms';
import {
    MatAutocompleteModule,
    MatAutocompleteSelectedEvent,
} from '@angular/material/autocomplete';
import { MatButtonModule } from '@angular/material/button';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { RouterModule } from '@angular/router';
import { UserService } from '@core/user/user.service';
import { User } from '@core/user/user.types';
import { TranslocoModule, TranslocoService } from '@jsverse/transloco';
import { HotToastService } from '@ngxpert/hot-toast';
import { catchError, of } from 'rxjs';
import { GroupService } from '../groups.service';

@Component({
    selector: 'app-assign-student',
    imports: [
        CommonModule,
        MatIconModule,
        ReactiveFormsModule,
        RouterModule,
        MatAutocompleteModule,
        MatFormFieldModule,
        MatInputModule,
        MatSelectModule,
        MatButtonModule,
        TranslocoModule,
    ],
    templateUrl: './assign-student.component.html',
})
export class AssignStudentComponent implements OnInit {
    // -----------------------------------------------------------------------------------------------------
    // @ Dependencies
    // -----------------------------------------------------------------------------------------------------
    private readonly _fb = inject(FormBuilder);
    private readonly _userService = inject(UserService);
    private readonly _groupService = inject(GroupService);
    private readonly _transloco = inject(TranslocoService);
    private readonly _toastService = inject(HotToastService);
    private readonly _dialogRef = inject(MatDialogRef);
    private readonly DIALOG_DATA = inject(MAT_DIALOG_DATA);

    // -----------------------------------------------------------------------------------------------------
    // @ Observables and signals
    // -----------------------------------------------------------------------------------------------------
    readonly users = signal<User[]>([]);
    readonly loggedInUser = signal<User | null>(null); // Initialize as null
    // Changed `userSearch` to `_userSearchInput` and made it private,
    // as it's primarily for internal filtering logic.
    private readonly _userSearchInput = signal<string>('');

    readonly filteredUsers = computed(() => {
        const term = this._userSearchInput().toLowerCase(); // Use the internal signal for filtering
        return (this.users() || []).filter((user) =>
            user?.fullName.toLowerCase().includes(term)
        );
    });

    form = this._fb.group({
        // The userId form control will now hold a User object or null.
        // It uses Validators.required AND a custom validator to ensure a valid User object is selected.
        userId: new FormControl<User | null>(null, [
            Validators.required,
            this._requireUserMatch(), // Custom validator added here
        ]),
    });

    ngOnInit(): void {
        console.log(this.DIALOG_DATA);
        this._userService.getAllUsersByRole('student').subscribe((data) => {
            console.log(data);
            this.users.set(data);
        });

        // Subscribe to valueChanges of the form control to update the internal search signal.
        // This is crucial because the control's value can be a string (user typing) or a User object (user selected).
        this.form.get('userId')?.valueChanges.subscribe((value) => {
            if (typeof value === 'string') {
                this._userSearchInput.set(value); // If it's a string, update the search input
            } else if (value === null) {
                this._userSearchInput.set(''); // If null, clear the search input
            }
            // If value is a User object, we don't update _userSearchInput here; it's handled by onUserSelected
        });
    }

    /**
     * Custom validator to ensure the selected value is an actual User object.
     * If the control's value is a string (meaning something was typed but not selected),
     * it will mark the control as invalid.
     */
    private _requireUserMatch(): (
        control: AbstractControl
    ) => ValidationErrors | null {
        return (control: AbstractControl): ValidationErrors | null => {
            const selection: User | null = control.value;

            // If the control's value is an object and has 'id' and 'name' properties,
            // it's considered a valid User object selected from the list.
            if (
                selection &&
                typeof selection === 'object' &&
                'id' in selection &&
                'name' in selection
            ) {
                return null; // Valid: it's a selected User object
            }

            // If it's a non-empty string, it means the user typed something but didn't select
            if (typeof selection === 'string') {
                if ((selection as string).length > 0) {
                    return { userMatch: true }; // Invalid: typed string, not a valid object selection
                }
            }

            // For other cases (null, empty string), let other validators (like `required`) handle it.
            return null;
        };
    }

    /**
     * Function to display the user name in the input field.
     * It now accepts a User object or null.
     */
    displayUserName = (user: User | null): string => {
        return user ? user.fullName : '';
    };

    /**
     * Handler for when an option is explicitly selected from the autocomplete dropdown.
     * Sets the full User object to the form control.
     */
    onUserSelected(event: MatAutocompleteSelectedEvent): void {
        const selectedUser: User = event.option.value; // The [value]="user" on mat-option passes the whole User object
        const userIdControl = this.form.get('userId');
        if (userIdControl) {
            userIdControl.setValue(selectedUser); // Set the control's value to the actual User object
            this._userSearchInput.set(selectedUser.fullName); // Update internal search signal to reflect displayed name
            userIdControl.markAsDirty(); // Mark dirty and touched to trigger validation update
            userIdControl.markAsTouched();
        }
    }

    /**
     * Handler for the blur event on the input field.
     * This is crucial to handle cases where the user types but does not select an option.
     */
    onInputBlur(): void {
        const control = this.form.get('userId');
        if (control) {
            // If the control's value is currently a string (meaning user typed but didn't select)
            if (
                typeof control.value === 'string' &&
                (control.value as string).length > 0
            ) {
                const typedName: string = control.value as string;
                // Try to find an exact match by name in the full list of users
                const matchedUser = this.users().find(
                    (user) =>
                        user.fullName.toLowerCase() === typedName.toLowerCase()
                );

                if (matchedUser) {
                    // If an exact name match is found, set the control's value to the actual user object
                    control.setValue(matchedUser);
                } else {
                    // If no exact match, clear the input and set value to null, making it invalid.
                    control.setValue(null);
                    this._userSearchInput.set(''); // Clear internal search state
                }
            } else if (control.value === null) {
                // If the input was already cleared (e.g., by backspace), ensure search state is also cleared
                this._userSearchInput.set('');
            }
            // Always update validity and mark as touched after blur to ensure error messages appear
            control.updateValueAndValidity();
            control.markAsTouched();
        }
    }

    submit(): void {
        // Mark all controls as touched to display validation errors immediately on submit
        this.form.markAllAsTouched();

        if (this.form.valid) {
            const selectedUser: User | null = this.form.get('userId')?.value; // Now it's a User object
            if (selectedUser) {
                // Ensure a user was actually selected
                this._groupService
                    .assignStudent(this.DIALOG_DATA.id, selectedUser.id) // Pass the ID from the selected User object
                    .pipe(
                        this._toastService.observe({
                            loading: 'Loading',
                            success: () => {
                                this.form.enable();
                                this.close('success');
                                return 'Success';
                            },
                            error: () => {
                                this.form.enable();
                                this.close('success');
                                return 'Error';
                            },
                        }),
                        catchError((error: unknown) => {
                            this.close('success');
                            return of(error);
                        })
                    )
                    .subscribe();
            }
        } else {
            console.warn(
                'Form is invalid. Cannot submit.',
                this.form.errors,
                this.form.get('userId')?.errors
            );
        }
    }

    close(response: 'cancel' | 'success') {
        this._dialogRef.close(response);
    }
}
