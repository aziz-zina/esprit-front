import { CommonModule } from '@angular/common';
import {
    ChangeDetectionStrategy,
    Component,
    DestroyRef,
    inject,
    OnInit,
    signal,
    ViewEncapsulation,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatChipsModule } from '@angular/material/chips';
import { MatDividerModule } from '@angular/material/divider';
import { MatExpansionModule } from '@angular/material/expansion';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatListModule } from '@angular/material/list';
import { MatTooltipModule } from '@angular/material/tooltip';
import { UserService } from '@core/user/user.service'; // Assuming User type is exported here or defined globally
import { User } from '@core/user/user.types';
import { switchMap, tap } from 'rxjs/operators';
import { GroupService } from '../admin/academic/groups/groups.service';
import { Group, GroupStudent } from '../admin/academic/groups/groups.types';

// If User type is not exported from UserService, and not in groups.types,
// you might need a minimal definition here or ensure it's correctly imported.
// For example, if it's part of groups.types, it might be:
// import { Group, GroupStudent, User } from '../admin/academic/groups/groups.types';

@Component({
    selector: 'app-view-grade',
    standalone: true, // Added standalone: true as you have an 'imports' array
    imports: [
        CommonModule,
        MatCardModule,
        MatListModule,
        MatIconModule,
        MatChipsModule,
        MatDividerModule,
        MatExpansionModule,
        MatTooltipModule,
        MatButtonModule,
        FormsModule,
        MatInputModule,
    ],
    templateUrl: './view-grade.component.html',
    styleUrl: './view-grade.component.scss',
    changeDetection: ChangeDetectionStrategy.OnPush,
    encapsulation: ViewEncapsulation.None,
})
export class ViewGradeComponent implements OnInit {
    // -----------------------------------------------------------------------------------------------------
    // @ Dependencies
    // -----------------------------------------------------------------------------------------------------
    private readonly _destroyRef = inject(DestroyRef);
    private readonly _groupService = inject(GroupService);
    private readonly _userService = inject(UserService);

    // -----------------------------------------------------------------------------------------------------
    // @ Observables and signals
    // -----------------------------------------------------------------------------------------------------
    readonly studentGroups = signal<Group[]>([]);
    readonly isLoading = signal<boolean>(true);
    readonly currentStudentId = signal<string | undefined>(undefined);

    searchTerm = ''; // Local binding for ngModel

    filteredGroups(): Group[] {
        const search = this.searchTerm.toLowerCase().trim();
        if (!search) return this.studentGroups();
        return this.studentGroups().filter(
            (g) =>
                g.name.toLowerCase().includes(search) ||
                g.subject.name.toLowerCase().includes(search)
        );
    }

    // -----------------------------------------------------------------------------------------------------
    // @ Lifecycle hooks
    // -----------------------------------------------------------------------------------------------------
    ngOnInit(): void {
        this._userService
            .get()
            .pipe(
                takeUntilDestroyed(this._destroyRef), // Automatically unsubscribes when the component is destroyed
                tap((user: User) => {
                    // Assuming _userService.get() returns User
                    this.currentStudentId.set(user.id);
                }),
                switchMap((user: User) =>
                    this._groupService.getGroupsByStudentId(user.id)
                )
            )
            .subscribe({
                next: (data) => {
                    console.log(data);
                    this.studentGroups.set(data);
                },
                error: (err) => {
                    console.error('Error fetching student groups:', err);
                    this.studentGroups.set([]); // Set to empty array on error
                    // Optionally, display a toast message or error state
                },
            });
    }

    // -----------------------------------------------------------------------------------------------------
    // @ Public methods
    // -----------------------------------------------------------------------------------------------------

    /**
     * Retrieves the GroupStudent data for the currently logged-in student within a specific group.
     * @param group The group to search within.
     * @returns The GroupStudent object if found, otherwise undefined.
     */
    getStudentData(group: Group): GroupStudent | undefined {
        const studentId = this.currentStudentId();
        if (!studentId || !group.students) {
            return undefined;
        }
        return group.students.find((gs) => gs.student.id === studentId);
    }

    getGradeColor(mark: number | undefined | null): string {
        if (mark == null) return 'bg-slate-300 text-slate-800';

        if (mark >= 16) return 'bg-green-500 text-black';
        if (mark >= 12) return 'bg-yellow-400 text-slate-800';
        if (mark >= 8) return 'bg-orange-400 text-black';
        return 'bg-red-500 text-black';
    }
}
