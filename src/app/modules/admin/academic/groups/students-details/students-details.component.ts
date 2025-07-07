import { CommonModule } from '@angular/common';
import { Component, inject, OnInit } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import {
    MAT_DIALOG_DATA,
    MatDialog,
    MatDialogModule,
    MatDialogRef,
} from '@angular/material/dialog'; // Import MatDialogRef
import { MatDividerModule } from '@angular/material/divider'; // For dividers if needed
import { MatIconModule } from '@angular/material/icon';
import { MatToolbarModule } from '@angular/material/toolbar'; // For the header
import { Router } from '@angular/router';
import { AddStudentMarkComponent } from '../add-student-mark/add-student-mark.component';
import { Group, GroupStudent } from '../groups.types';

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
    // Correctly type the injected data as GroupStudent array
    readonly data = inject(MAT_DIALOG_DATA);
    readonly students: GroupStudent[] = this.data.students || this.data;
    readonly group: Group = this.data.group;
    private readonly _dialogRef = inject(
        MatDialogRef<StudentsDetailsComponent>
    ); // Inject MatDialogRef
    private readonly _matDialog = inject(MatDialog);
    private readonly _router = inject(Router);

    ngOnInit(): void {
        // You can log the data here to confirm it's received
        console.log('Received students:', this.students);
        console.log('Received group:', this.group);
    }

    onClose(): void {
        // When the user clicks 'Close', the dialog closes.
        // We don't return 'success' here because this is a *details view*,
        // not an action that inherently implies a data change.
        // This means dialogRef.afterClosed() in the parent will receive undefined,
        // and this.fetchPage() will *not* be called.
        this._dialogRef.close();
    }
    getStudentFullName(groupStudent: GroupStudent): string {
        const student = groupStudent.student;
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

    openStudentMarkDialog(groupStudent: GroupStudent): void {
        console.log('salem hné: ', groupStudent);
        const dialogRef = this._matDialog.open(AddStudentMarkComponent, {
            data: {
                groupStudent: groupStudent,
                group: this.group,
                student: groupStudent.student,
                currentMark: groupStudent.individualMark,
                currentComment: groupStudent.individualComment,
            },
        });
        dialogRef.afterClosed().subscribe((result) => {
            if (result === 'success') {
                // Optionally refresh data or notify parent
                this._dialogRef.close('success');
            }
        });
    }

    navigateToTaskManagement(student: GroupStudent): void {
        // First, close this details dialog
        this._dialogRef.close();

        // Then, navigate to the new component's route
        this._router.navigate([
            '/academic/tasks', // Base path to the tasks module
            'group', // The static 'group' segment
            this.group.id, // The value for the :groupId parameter
            'student', // The static 'student' segment
            student.student.id, // The value for the :studentId parameter
        ]);
    }
}
