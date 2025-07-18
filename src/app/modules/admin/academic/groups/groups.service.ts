import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { APP_API_URL } from 'app/app.config';
import { Page } from 'app/models/pagination/page-response.types';
import { PageRequest } from 'app/models/pagination/pageRequest';
import { Observable } from 'rxjs';
import {
    AddGroupRequest,
    AddTaskRequest,
    Group,
    GroupMarkDto,
    GroupStudent,
    GroupStudentDto,
    StudentMarkDto,
    Task,
    UpdateTaskRequest,
} from './groups.types';

@Injectable({ providedIn: 'root' })
export class GroupService {
    private readonly _httpClient = inject(HttpClient);
    private readonly API_URL = inject(APP_API_URL);

    getGroupsPage(request: PageRequest): Observable<Page<Group>> {
        return this._httpClient.get<Page<Group>>(`${this.API_URL}/groups`, {
            params: {
                page: request.page.toString(),
                size: request.size.toString(),
                sort: request.sort,
                sortDirection: request.sortDirection,
                search: request.search,
            },
        });
    }

    deleteGroupById(id: string): Observable<void> {
        return this._httpClient.delete<void>(`${this.API_URL}/groups/${id}`);
    }

    getGroups(): Observable<Group[]> {
        return this._httpClient.get<Group[]>(`${this.API_URL}/groups/all`);
    }

    getGroupsByStudentId(id: string): Observable<Group[]> {
        return this._httpClient.get<Group[]>(
            `${this.API_URL}/groups/all/${id}`
        );
    }

    createGroup(request: AddGroupRequest): Observable<Group> {
        return this._httpClient.post<Group>(`${this.API_URL}/groups`, request);
    }

    assignStudent(groupId: string, studentId: string): Observable<Group> {
        return this._httpClient.patch<Group>(
            `${this.API_URL}/groups/assign/${groupId}/${studentId}`,
            {}
        );
    }

    addMarkToGroup(groupId: string, markDto: GroupMarkDto): Observable<Group> {
        return this._httpClient.put<Group>(
            `${this.API_URL}/groups/${groupId}/mark`,
            markDto
        );
    }

    addMarkToStudent(
        groupId: string,
        studentId: string,
        markDto: StudentMarkDto
    ): Observable<GroupStudentDto> {
        console.log(studentId);
        return this._httpClient.put<GroupStudentDto>(
            `${this.API_URL}/groups/${groupId}/student/${studentId}/mark`,
            markDto
        );
    }

    getGroupStudent(
        groupId: string,
        studentId: string
    ): Observable<GroupStudentDto> {
        return this._httpClient.get<GroupStudentDto>(
            `${this.API_URL}/groups/${groupId}/student/${studentId}`
        );
    }

    assignTaskToStudent(taskData: AddTaskRequest): Observable<Task> {
        console.log(taskData);
        return this._httpClient.post<Task>(`${this.API_URL}/tasks`, taskData);
    }

    updateTask(taskData: UpdateTaskRequest, taskId: string): Observable<Task> {
        return this._httpClient.put<Task>(
            `${this.API_URL}/tasks/${taskId}`,
            taskData
        );
    }

    calculateIndividualMark(groupId: string): Observable<GroupStudent> {
        return this._httpClient.put<GroupStudent>(
            `${this.API_URL}/groups/calculate-mark/${groupId}`,
            {}
        );
    }
}
