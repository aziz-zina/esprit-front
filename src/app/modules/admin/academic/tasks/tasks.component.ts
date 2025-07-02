// student-tasks.component.ts

import { CdkTextareaAutosize } from '@angular/cdk/text-field';
import { CommonModule } from '@angular/common';
import {
    ChangeDetectionStrategy,
    Component,
    DestroyRef,
    inject,
    OnInit,
    signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import {
    FormBuilder,
    FormGroup,
    FormsModule,
    ReactiveFormsModule,
    Validators,
} from '@angular/forms';
import { MatBadgeModule } from '@angular/material/badge';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatNativeDateModule } from '@angular/material/core';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatDividerModule } from '@angular/material/divider';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatListModule } from '@angular/material/list';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { HotToastService } from '@ngxpert/hot-toast';
import { finalize, Observable, switchMap } from 'rxjs';
import { GroupService } from '../groups/groups.service';
import { AddTaskRequest, GroupStudentDto, Task } from '../groups/groups.types';

@Component({
    selector: 'app-student-tasks',
    templateUrl: './tasks.component.html',
    // styleUrls: ['./tasks.component.scss'],
    standalone: true,
    imports: [
        CommonModule,
        RouterModule,
        FormsModule,
        ReactiveFormsModule,
        MatButtonModule,
        MatIconModule,
        MatFormFieldModule,
        MatInputModule,
        MatListModule,
        MatDatepickerModule,
        MatNativeDateModule,
        MatProgressSpinnerModule,
        MatCardModule,
        MatBadgeModule,
        MatDividerModule,
        CdkTextareaAutosize,
    ],
    changeDetection: ChangeDetectionStrategy.OnPush,
})
export class StudentTasksComponent implements OnInit {
    // -----------------------------------------------------------------------------------------------------
    // @ Dependencies (Updated)
    // -----------------------------------------------------------------------------------------------------
    private readonly _route = inject(ActivatedRoute);
    private readonly _router = inject(Router);
    private readonly _fb = inject(FormBuilder);
    private readonly _groupService = inject(GroupService);
    private readonly _toastService = inject(HotToastService);
    private readonly _destroyRef = inject(DestroyRef);

    // -----------------------------------------------------------------------------------------------------
    // @ Signals and properties (Updated)
    // -----------------------------------------------------------------------------------------------------
    taskForm: FormGroup;
    groupId: string;
    searchQuery = signal('');

    readonly student = signal<GroupStudentDto | null>(null);
    readonly tasks = signal<Task[]>([]);
    readonly selectedTask = signal<Task | null>(null);
    readonly isLoading = signal(true);
    readonly isSubmitting = signal(false);

    // Computed properties
    get filteredTasks(): Task[] {
        const query = this.searchQuery().toLowerCase();
        return this.tasks().filter((task) =>
            task.description.toLowerCase().includes(query)
        );
    }

    get completedTasksCount(): number {
        return this.tasks().filter((task) => task.done === true).length;
    }

    get totalTasksCount(): number {
        return this.tasks().length;
    }

    // -----------------------------------------------------------------------------------------------------
    // @ Lifecycle hooks (Completely Rewritten)
    // -----------------------------------------------------------------------------------------------------
    ngOnInit(): void {
        this.taskForm = this._fb.group({
            description: ['', Validators.required],
            dueDate: [null, Validators.required],
            branchLink: [''],
            mark: [null, [Validators.min(0), Validators.max(20)]],
            comment: [''],
        });

        this._route.paramMap
            .pipe(
                takeUntilDestroyed(this._destroyRef),
                switchMap((params) => {
                    this.groupId = params.get('groupId');
                    const studentId = params.get('studentId');
                    return this._groupService.getGroupStudent(
                        this.groupId,
                        studentId
                    );
                }),
                finalize(() => this.isLoading.set(false))
            )
            .subscribe((groupStudent) => {
                console.log(groupStudent);
                this.student.set(groupStudent);
                this.tasks.set(
                    groupStudent.tasks?.sort(
                        (a, b) =>
                            new Date(b.createdAt).getTime() -
                            new Date(a.createdAt).getTime()
                    ) || []
                );
                this.initNewTaskForm();
                this.isLoading.set(false);
            });
    }

    // -----------------------------------------------------------------------------------------------------
    // @ Public methods (Updated and New)
    // -----------------------------------------------------------------------------------------------------

    selectTask(task: Task): void {
        this.selectedTask.set(task);

        const formattedDueDate = new Date(task.dueDate)
            .toISOString()
            .split('T')[0];

        this.taskForm.patchValue({
            ...task,
            dueDate: formattedDueDate,
        });
        this.taskForm.get('description')?.disable();
        this.taskForm.get('branchLink')?.disable();

        this.taskForm.get('dueDate')?.enable();
        this.taskForm.get('mark')?.enable();
        this.taskForm.get('comment')?.enable();

        this.taskForm.markAsPristine();
    }

    initNewTaskForm(): void {
        this.selectedTask.set(null);
        this.taskForm.reset();
        this.taskForm.get('description')?.enable();
        this.taskForm.get('branchLink')?.enable();
        this.taskForm.get('dueDate')?.enable();
    }

    navigateBack(): void {
        this._router.navigate(['/academic/groups']);
    }

    getStatusClass(task: Task): string {
        if (task.done) {
            return 'bg-green-100 text-green-800';
        }

        const now = new Date();
        const dueDate = new Date(task.dueDate);

        if (task.dueDate && now <= dueDate) {
            return 'bg-blue-100 text-blue-800';
        }

        return 'bg-red-100 text-red-800';
    }

    getStatusIcon(task: Task): string {
        if (task.done) {
            return 'check_circle_outline';
        }

        const now = new Date();
        const dueDate = new Date(task.dueDate);

        if (task.dueDate && now <= dueDate) {
            return 'access_time';
        }

        return 'error_outline';
    }

    getStatusText(task: Task): string {
        if (task.done) {
            return 'Completed';
        }

        const now = new Date();
        const dueDate = new Date(task.dueDate);

        if (task.dueDate && now <= dueDate) {
            return 'Pending';
        }

        return 'Overdue';
    }

    formatDate(dateString: string): string {
        return new Date(dateString).toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
        });
    }

    isOverdue(dueDate: string): boolean {
        return new Date(dueDate) < new Date();
    }

    onSearchChange(event: Event): void {
        const target = event.target as HTMLInputElement;
        this.searchQuery.set(target.value);
    }

    onSubmit(): void {
        if (this.taskForm.invalid) {
            this.taskForm.markAllAsTouched();
            this._toastService.error('Please fill in all required fields.');
            return;
        }

        this.isSubmitting.set(true);

        const formValue = this.taskForm.getRawValue();

        const currentTask = this.selectedTask();
        const studentId = this.student()?.id;

        if (!studentId) {
            this._toastService.error(
                'Student information not found. Cannot proceed.'
            );
            this.isSubmitting.set(false);
            return;
        }
        let operation$: Observable<Task>;

        if (currentTask) {
            const payload: AddTaskRequest = {
                description: formValue.description,
                dueDate: formValue.dueDate,
                groupStudentId: currentTask.id,
            };
            operation$ = this._groupService.updateTask(payload);
        } else {
            const payload: AddTaskRequest = {
                description: formValue.description,
                dueDate: formValue.dueDate,
                groupStudentId: this.student().id,
            };
            operation$ = this._groupService.assignTaskToStudent(payload);
        }
        operation$
            .pipe(
                switchMap(() =>
                    this._groupService.getGroupStudent(
                        this.student().group.id,
                        this.student().student.id
                    )
                ),

                this._toastService.observe({
                    loading: currentTask
                        ? 'Updating task...'
                        : 'Assigning task...',
                    success: 'Data saved successfully!',
                    error: 'An error occurred while saving.',
                }),

                takeUntilDestroyed(this._destroyRef),
                finalize(() => this.isSubmitting.set(false))
            )
            .subscribe((updatedStudent: GroupStudentDto) => {
                this.student.set(updatedStudent);

                const sortedTasks =
                    updatedStudent.tasks?.sort(
                        (a, b) =>
                            new Date(b.createdAt).getTime() -
                            new Date(a.createdAt).getTime()
                    ) || [];
                this.tasks.set(sortedTasks);

                if (currentTask) {
                    const newlyUpdatedTask = sortedTasks.find(
                        (t) => t.id === currentTask.id
                    );
                    if (newlyUpdatedTask) {
                        this.selectTask(newlyUpdatedTask);
                    }
                } else {
                    this.initNewTaskForm();
                }
            });
    }
}
