import { ClipboardModule } from '@angular/cdk/clipboard';
import { CommonModule } from '@angular/common';
import { Component, inject, signal } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatChipsModule } from '@angular/material/chips';
import { MatIconModule } from '@angular/material/icon';
import { MatTableModule } from '@angular/material/table';
import { MatTooltipModule } from '@angular/material/tooltip';
import { KeycloakService } from '@core/auth/keycloak.service';
import { GroupStudent, Task } from '../admin/academic/groups/groups.types';
import { TaskService } from './view-tasks.service';

@Component({
    selector: 'app-view-tasks',
    imports: [
        CommonModule,
        MatCardModule,
        MatIconModule,
        MatTableModule,
        MatTooltipModule,
        MatButtonModule,
        MatChipsModule,
        ClipboardModule,
    ],
    templateUrl: './view-tasks.component.html',
    styleUrl: './view-tasks.component.scss',
})
export class ViewTasksComponent {
    private readonly _taskService = inject(TaskService);
    private readonly _keycloakService = inject(KeycloakService);

    readonly groups = signal<GroupStudent[]>([]);
    copied = new Map<string, boolean>();

    ngOnInit(): void {
        this.fetchData();
    }

    fetchData(): void {
        this._taskService
            .getGroupsPerStudent(this._keycloakService.userId)
            .subscribe((data) => {
                this.groups.set(data);
            });
    }

    getCompletedTasksCount(): number {
        return this.groups().reduce((total, group) => {
            const completedTasks =
                group.tasks?.filter((task) => task.done).length || 0;
            return total + completedTasks;
        }, 0);
    }

    getPendingTasksCount(): number {
        return this.groups().reduce((total, group) => {
            const pendingTasks =
                group.tasks?.filter((task) => !task.done).length || 0;
            return total + pendingTasks;
        }, 0);
    }

    isTaskOverdue(task: any): boolean {
        if (task.done) return false;
        const dueDate = new Date(task.dueDate);
        const now = new Date();
        return dueDate < now;
    }

    getOverdueTasksCount(): number {
        return this.groups().reduce((total, group) => {
            const overdueTasks =
                group.tasks?.filter((task) => this.isTaskOverdue(task))
                    .length || 0;
            return total + overdueTasks;
        }, 0);
    }

    generateBranchName(task: any): string {
        const MAX_SLUG_WORDS = 4;

        const stopwords = new Set([
            'the',
            'a',
            'an',
            'of',
            'for',
            'and',
            'or',
            'on',
            'to',
            'in',
            'with',
            'by',
            'is',
            'are',
            'at',
            'this',
            'that',
        ]);

        const slugify = (text: string) =>
            text
                .toLowerCase()
                .normalize('NFD') // Normalize accented characters
                .replace(/[\u0300-\u036f]/g, '') // Remove accents
                .replace(/[^a-z0-9\s]/g, '') // Remove punctuation/special characters
                .split(/\s+/)
                .filter((word) => word && !stopwords.has(word))
                .slice(0, MAX_SLUG_WORDS)
                .join('-');

        const taskSlug = slugify(task?.description || 'task');

        return `feature/${taskSlug}`;
    }

    isExpired(task: Task): boolean {
        const now = new Date();
        const dueDate = new Date(task.dueDate);

        return task.dueDate && now <= dueDate;
    }

    /**
     * Handles the copy event to provide visual feedback.
     * Sets the state to 'copied' for 2 seconds.
     */
    onCopy(task: Task): void {
        console.log(task);
        const taskId = task.id;
        console.log(taskId);
        const branchName = this.generateBranchName(task);
        console.log(branchName);
        this._taskService.assignBranch(taskId, branchName).subscribe(() => {
            this.fetchData();
        });
        this.copied.set(taskId, true);
        setTimeout(() => {
            this.copied.set(taskId, false);
        }, 2000);
    }
}
