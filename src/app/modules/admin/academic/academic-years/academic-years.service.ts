import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { APP_API_URL } from 'app/app.config';
import { Page } from 'app/models/pagination/page-response.types';
import { PageRequest } from 'app/models/pagination/pageRequest';
import { Observable } from 'rxjs';
import {
    AcademicYear,
    AddAcademicYearRequest,
    UpdateAcademicYearRequest,
} from './academic-years.types';

@Injectable({ providedIn: 'root' })
export class AcademicYearService {
    private readonly _httpClient = inject(HttpClient);
    private readonly API_URL = inject(APP_API_URL);

    getAcademicYearsPage(request: PageRequest): Observable<Page<AcademicYear>> {
        return this._httpClient.get<Page<AcademicYear>>(
            `${this.API_URL}/academic-years`,
            {
                params: {
                    page: request.page.toString(),
                    size: request.size.toString(),
                    sort: request.sort,
                    sortDirection: request.sortDirection,
                },
            }
        );
    }

    deleteAcademicYearById(id: string): Observable<void> {
        return this._httpClient.delete<void>(
            `${this.API_URL}/academic-years/${id}`
        );
    }

    getAcademicYears(): Observable<AcademicYear[]> {
        return this._httpClient.get<AcademicYear[]>(
            `${this.API_URL}/academic-years/all`
        );
    }

    createAcademicYear(
        request: AddAcademicYearRequest
    ): Observable<AcademicYear> {
        return this._httpClient.post<AcademicYear>(
            `${this.API_URL}/academic-years`,
            request
        );
    }

    updateAcademicYear(
        request: UpdateAcademicYearRequest
    ): Observable<AcademicYear> {
        return this._httpClient.put<AcademicYear>(
            `${this.API_URL}/academic-years`,
            request
        );
    }
}
