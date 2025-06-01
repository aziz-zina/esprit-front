import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { APP_API_URL } from 'app/app.config';
import { Page } from 'app/models/pagination/page-response.types';
import { PageRequest } from 'app/models/pagination/pageRequest';
import { Observable } from 'rxjs';
import {
    AddSubjectRequest,
    Subject,
    UpdateSubjectRequest,
} from './subjects.types';

@Injectable({ providedIn: 'root' })
export class SubjectService {
    private readonly _httpClient = inject(HttpClient);
    private readonly API_URL = inject(APP_API_URL);

    getSubjectsPage(request: PageRequest): Observable<Page<Subject>> {
        return this._httpClient.get<Page<Subject>>(
            `${this.API_URL}/subjects`,
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

    deleteSubjectById(id: string): Observable<void> {
        return this._httpClient.delete<void>(
            `${this.API_URL}/subjects/${id}`
        );
    }

    getSubjects(): Observable<Subject[]> {
        return this._httpClient.get<Subject[]>(`${this.API_URL}/subjects/all`);
    }

    createSubject(request: AddSubjectRequest): Observable<Subject> {
        return this._httpClient.post<Subject>(
            `${this.API_URL}/subjects`,
            request
        );
    }

    updateSubject(request: UpdateSubjectRequest): Observable<Subject> {
        return this._httpClient.put<Subject>(
            `${this.API_URL}/subjects`,
            request
        );
    }
}
