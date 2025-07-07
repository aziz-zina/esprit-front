import { CommonModule } from '@angular/common';
import { Component, computed, inject, OnInit, signal } from '@angular/core';
import {
    AbstractControl,
    FormBuilder, // Import ValidationErrors for custom validator
    FormControl,
    ReactiveFormsModule, // Import AbstractControl for custom validator
    ValidationErrors,
    Validators,
} from '@angular/forms';
import {
    MatAutocompleteModule,
    MatAutocompleteSelectedEvent,
} from '@angular/material/autocomplete'; // Import MatAutocompleteSelectedEvent
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
import { GroupService } from 'app/modules/admin/academic/groups/groups.service';
import { ProjectService } from 'app/modules/admin/dashboards/project/project.service';
import { catchError, finalize, of, switchMap, tap } from 'rxjs';
import { Group } from '../../admin/academic/groups/groups.types'; // Ensure Group interface is correctly imported

@Component({
    selector: 'app-pick-group',
    // Assuming this component is standalone, if not, adjust `standalone` and `imports`
    standalone: true,
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
    templateUrl: './pick-group.component.html',
})
export class PickGroupComponent implements OnInit {
    // -----------------------------------------------------------------------------------------------------
    // @ Dependencies
    // -----------------------------------------------------------------------------------------------------
    private readonly _fb = inject(FormBuilder);
    private readonly _groupService = inject(GroupService);
    private readonly _repositoryService = inject(ProjectService);
    private readonly _userService = inject(UserService);
    private readonly _transloco = inject(TranslocoService);
    private readonly _toastService = inject(HotToastService);
    private readonly _dialogRef = inject(MatDialogRef);
    private readonly DIALOG_DATA = inject(MAT_DIALOG_DATA);

    // -----------------------------------------------------------------------------------------------------
    // @ Observables and signals
    // -----------------------------------------------------------------------------------------------------
    readonly groups = signal<Group[]>([]);
    readonly loggedInUser = signal<User | null>(null); // Initialize as null
    // Changed `groupSearch` to `_groupSearchInput` and made it private,
    // as it's primarily for internal filtering logic.
    private readonly _groupSearchInput = signal<string>('');

    readonly filteredGroups = computed(() => {
        const term = this._groupSearchInput().toLowerCase(); // Use the internal signal for filtering
        return (this.groups() || []).filter((group) =>
            group?.name.toLowerCase().includes(term)
        );
    });

    form = this._fb.group({
        // The groupId form control will now hold a Group object or null.
        // It uses Validators.required AND a custom validator to ensure a valid Group object is selected.
        groupId: new FormControl<Group | null>(null, [
            Validators.required,
            this._requireGroupMatch(), // Custom validator added here
        ]),
    });

    ngOnInit(): void {
        console.log(this.DIALOG_DATA);
        this._userService
            .get()
            .pipe(
                tap((user: User) => {
                    console.log('User data received from service:', user);
                    this.loggedInUser.set(user);
                    console.log(
                        'loggedInUser signal (now set):',
                        this.loggedInUser()
                    );
                }),
                switchMap((user: User | null) => {
                    if (user && user.id) {
                        console.log('Fetching groups for user ID:', user.id);
                        return this._groupService
                            .getGroupsByStudentId(user.id)
                            .pipe(
                                catchError((groupError) => {
                                    console.error(
                                        'Error fetching groups:',
                                        groupError
                                    );
                                    return of([]);
                                })
                            );
                    } else {
                        console.warn(
                            'User data is invalid or null. Cannot fetch groups.'
                        );
                        this.loggedInUser.set(null);
                        return of([]);
                    }
                }),
                catchError((userError) => {
                    console.error('Error fetching user:', userError);
                    this.loggedInUser.set(null);
                    return of([]);
                }),
                finalize(() => {
                    console.log('Data fetching process completed.');
                })
            )
            .subscribe((groupsData: Group[]) => {
                console.log('User groups received:', groupsData);
                this.groups.set(groupsData);
            });

        // Subscribe to valueChanges of the form control to update the internal search signal.
        // This is crucial because the control's value can be a string (user typing) or a Group object (user selected).
        this.form.get('groupId')?.valueChanges.subscribe((value) => {
            if (typeof value === 'string') {
                this._groupSearchInput.set(value); // If it's a string, update the search input
            } else if (value === null) {
                this._groupSearchInput.set(''); // If null, clear the search input
            }
            // If value is a Group object, we don't update _groupSearchInput here; it's handled by onGroupSelected
        });
    }

    /**
     * Custom validator to ensure the selected value is an actual Group object.
     * If the control's value is a string (meaning something was typed but not selected),
     * it will mark the control as invalid.
     */
    private _requireGroupMatch(): (
        control: AbstractControl
    ) => ValidationErrors | null {
        return (control: AbstractControl): ValidationErrors | null => {
            const selection: Group | null = control.value;

            // If the control's value is an object and has 'id' and 'name' properties,
            // it's considered a valid Group object selected from the list.
            if (
                selection &&
                typeof selection === 'object' &&
                'id' in selection &&
                'name' in selection
            ) {
                return null; // Valid: it's a selected Group object
            }

            // If it's a non-empty string, it means the user typed something but didn't select
            if (typeof selection === 'string') {
                if ((selection as string).length > 0) {
                    return { groupMatch: true }; // Invalid: typed string, not a valid object selection
                }
            }

            // For other cases (null, empty string), let other validators (like `required`) handle it.
            return null;
        };
    }

    /**
     * Function to display the group name in the input field.
     * It now accepts a Group object or null.
     */
    displayGroupName = (group: Group | null): string => {
        return group ? group.name : '';
    };

    /**
     * Handler for when an option is explicitly selected from the autocomplete dropdown.
     * Sets the full Group object to the form control.
     */
    onGroupSelected(event: MatAutocompleteSelectedEvent): void {
        const selectedGroup: Group = event.option.value; // The [value]="group" on mat-option passes the whole Group object
        const groupIdControl = this.form.get('groupId');
        if (groupIdControl) {
            groupIdControl.setValue(selectedGroup); // Set the control's value to the actual Group object
            this._groupSearchInput.set(selectedGroup.name); // Update internal search signal to reflect displayed name
            groupIdControl.markAsDirty(); // Mark dirty and touched to trigger validation update
            groupIdControl.markAsTouched();
        }
    }

    /**
     * Handler for the blur event on the input field.
     * This is crucial to handle cases where the user types but does not select an option.
     */
    onInputBlur(): void {
        const control = this.form.get('groupId');
        if (control) {
            // If the control's value is currently a string (meaning user typed but didn't select)
            if (
                typeof control.value === 'string' &&
                (control.value as string).length > 0
            ) {
                const typedName: string = control.value as string;
                // Try to find an exact match by name in the full list of groups
                const matchedGroup = this.groups().find(
                    (group) =>
                        group.name.toLowerCase() === typedName.toLowerCase()
                );

                if (matchedGroup) {
                    // If an exact name match is found, set the control's value to the actual group object
                    control.setValue(matchedGroup);
                } else {
                    // If no exact match, clear the input and set value to null, making it invalid.
                    control.setValue(null);
                    this._groupSearchInput.set(''); // Clear internal search state
                }
            } else if (control.value === null) {
                // If the input was already cleared (e.g., by backspace), ensure search state is also cleared
                this._groupSearchInput.set('');
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
            const selectedGroup: Group | null = this.form.get('groupId')?.value; // Now it's a Group object
            if (selectedGroup) {
                // Ensure a group was actually selected
                this._repositoryService
                    .createRepo(this.DIALOG_DATA, selectedGroup.id) // Pass the ID from the selected Group object
                    // .pipe(
                    //     this._toastService.observe({
                    //         loading: 'Loading',
                    //         success: () => {
                    //             this.form.enable();
                    //             this.close('success');
                    //             return 'Success';
                    //         },
                    //         error: () => {
                    //             this.form.enable();
                    //             this.close('success');
                    //             return 'Error';
                    //         },
                    //     }),
                    //     catchError((error: unknown) => {
                    //         this.close('success');
                    //         return of(error);
                    //     })
                    // )
                    .subscribe();
                this.form.enable();
                this.close('success');
                this._toastService.success('Success');
            }
        } else {
            console.warn(
                'Form is invalid. Cannot submit.',
                this.form.errors,
                this.form.get('groupId')?.errors
            );
        }
    }

    close(response: 'cancel' | 'success') {
        this._dialogRef.close(response);
    }
}
