import { CommonModule } from '@angular/common';
import { Component, inject, OnInit } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import {
    MAT_DIALOG_DATA,
    MatDialogModule,
    MatDialogRef,
} from '@angular/material/dialog'; // Import MatDialogRef
import { MatDividerModule } from '@angular/material/divider'; // For dividers if needed
import { MatIconModule } from '@angular/material/icon';
import { MatToolbarModule } from '@angular/material/toolbar'; // For the header

// Define the User interface (make sure this is accessible or in a shared file)
export interface User {
    id: string;
    createdAt?: string;
    createdBy?: string;
    email: string;
    username: string;
    emailVerified?: boolean;
    enabled?: boolean;
    firstName?: string;
    profilePicture?: string;
    fullName?: string;
    // locale: LocaleType; // If you have this type, uncomment
    lastModifiedBy?: string;
    lastName?: string;
    phoneNumber?: string;
    roles?: Role[];
    notificationPreference?: string;
    updatedAt?: string;
    version?: number;
}

export interface Role {
    id: string;
    name: string; // Assuming Role has a name
    description?: string;
}

@Component({
    standalone: true, // Assuming you are using standalone components
    imports: [
        CommonModule,
        MatDialogModule,
        MatButtonModule,
        MatCardModule,
        MatIconModule,
        MatToolbarModule, // Add MatToolbarModule
        MatDividerModule, // Add MatDividerModule
    ],
    selector: 'app-students-details',
    templateUrl: './students-details.component.html',
})
export class StudentsDetailsComponent implements OnInit {
    // Correctly type the injected data as an array of User
    readonly students: User[] = inject(MAT_DIALOG_DATA);
    private readonly _dialogRef = inject(
        MatDialogRef<StudentsDetailsComponent>
    ); // Inject MatDialogRef

    ngOnInit(): void {
        // You can log the data here to confirm it's received
        // console.log('Received students:', this.students);
    }

    onClose(): void {
        // When the user clicks 'Close', the dialog closes.
        // We don't return 'success' here because this is a *details view*,
        // not an action that inherently implies a data change.
        // This means dialogRef.afterClosed() in the parent will receive undefined,
        // and this.fetchPage() will *not* be called.
        this._dialogRef.close();
    }

    getStudentFullName(student: User): string {
        if (student.fullName) {
            return student.fullName;
        }
        if (student.firstName && student.lastName) {
            return `${student.firstName} ${student.lastName}`;
        }
        if (student.firstName) {
            return student.firstName;
        }
        if (student.lastName) {
            return student.lastName;
        }
        return student.username; // Fallback to username
    }
}
