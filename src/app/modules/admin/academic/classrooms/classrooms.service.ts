import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { APP_API_URL } from 'app/app.config';
import { Page } from 'app/models/pagination/page-response.types';
import { PageRequest } from 'app/models/pagination/pageRequest';
import { Observable } from 'rxjs';
import {
    AddClassroomRequest,
    Classroom,
    UpdateClassroomRequest,
} from './classrooms.types';

@Injectable({ providedIn: 'root' })
export class ClassroomService {
    private readonly _httpClient = inject(HttpClient);
    private readonly API_URL = inject(APP_API_URL);

    getClassroomsPage(request: PageRequest): Observable<Page<Classroom>> {
        return this._httpClient.get<Page<Classroom>>(
            `${this.API_URL}/classrooms`,
            {
                params: {
                    page: request.page.toString(),
                    size: request.size.toString(),
                    sort: request.sort,
                    sortDirection: request.sortDirection,
                    search: request.search,
                },
            }
        );
    }

    deleteClassroomById(id: string): Observable<void> {
        return this._httpClient.delete<void>(
            `${this.API_URL}/classrooms/${id}`
        );
    }

    getClassrooms(): Observable<Classroom[]> {
        return this._httpClient.get<Classroom[]>(
            `${this.API_URL}/classrooms/all`
        );
    }

    createClassroom(request: AddClassroomRequest): Observable<Classroom> {
        return this._httpClient.post<Classroom>(
            `${this.API_URL}/classrooms`,
            request
        );
    }

    updateClassroom(request: UpdateClassroomRequest): Observable<Classroom> {
        return this._httpClient.put<Classroom>(
            `${this.API_URL}/classrooms`,
            request
        );
    }
}
