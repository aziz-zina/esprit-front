import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { APP_API_URL } from 'app/app.config';
import { BehaviorSubject, Observable, tap } from 'rxjs';
import { Commit, ProjectStats } from './project.types';

@Injectable({ providedIn: 'root' })
export class ProjectService {
    private readonly _httpClient = inject(HttpClient);
    private readonly API_URL = inject(APP_API_URL);
    private _data: BehaviorSubject<any> = new BehaviorSubject(null);

    // -----------------------------------------------------------------------------------------------------
    // @ Accessors
    // -----------------------------------------------------------------------------------------------------

    /**
     * Getter for data
     */
    get data$(): Observable<any> {
        return this._data.asObservable();
    }

    // -----------------------------------------------------------------------------------------------------
    // @ Public methods
    // -----------------------------------------------------------------------------------------------------

    /**
     * Get data
     */
    getData(): Observable<any> {
        return this._httpClient.get('api/dashboards/project').pipe(
            tap((response: any) => {
                this._data.next(response);
            })
        );
    }

    getRepositories(): Observable<string[]> {
        return this._httpClient.get<string[]>(`${this.API_URL}/repos`);
    }

    getStats(repoName: string): Observable<ProjectStats> {
        return this._httpClient.get<any>(
            `${this.API_URL}/repos/${repoName}/statistics`
        );
    }

    getCommits(repoName: string): Observable<Commit[]> {
        return this._httpClient.get<Commit[]>(
            `${this.API_URL}/repos/${repoName}/commits?limit=7`
        );
    }
}
