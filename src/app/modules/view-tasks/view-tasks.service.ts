import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { APP_API_URL } from 'app/app.config';
import { Observable } from 'rxjs';
import { GroupStudent, Task } from '../admin/academic/groups/groups.types';

@Injectable({ providedIn: 'root' })
export class TaskService {
    private readonly _httpClient = inject(HttpClient);
    private readonly API_URL = inject(APP_API_URL);

    getGroupsPerStudent(studentId: string): Observable<GroupStudent[]> {
        return this._httpClient.get<GroupStudent[]>(
            `${this.API_URL}/groups/student/${studentId}`
        );
    }

    assignBranches(taskId: string, branches: string[]): Observable<Task> {
        return this._httpClient.put<Task>(
            `${this.API_URL}/tasks/${taskId}/update-branch`,
            branches
        );
    }

    markAsDone(taskId: string): Observable<Task> {
        return this._httpClient.put<Task>(
            `${this.API_URL}/tasks/mark-as-done/${taskId}`,
            {}
        );
    }
}
