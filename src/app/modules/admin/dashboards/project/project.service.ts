import { HttpClient, HttpParams } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { APP_API_URL } from 'app/app.config';
import { BehaviorSubject, Observable, tap } from 'rxjs';
import {
    Branch,
    Commit,
    ProjectStats,
    RepositoryContent,
} from './project.types';

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

    createRepo(repoName: string, groupId: string): Observable<string> {
        return this._httpClient.post<string>(
            `${this.API_URL}/repos/${repoName}/${groupId}`,
            {}
        );
    }

    getRepositories(): Observable<string[]> {
        return this._httpClient.get<string[]>(`${this.API_URL}/repos`);
    }

    getRepositoriesByGroupId(groupId: string): Observable<string[]> {
        return this._httpClient.get<string[]>(
            `${this.API_URL}/repos/${groupId}`
        );
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

    /**
     * Retrieves the contents (files and directories) of a specific branch in a repository.
     * @param repoName The name of the repository.
     * @param branchName The name of the branch.
     * @returns An Observable of an array of RepositoryContent objects.
     */
    getBranchContents(
        repoName: string,
        branchName: string
    ): Observable<RepositoryContent[]> {
        let params = new HttpParams().set('branchName', branchName);
        return this._httpClient.get<RepositoryContent[]>(
            `${this.API_URL}/repos/${repoName}/contents`,
            { params }
        );
    }

    /**
     * Retrieves a list of branches for a specific repository.
     * @param repoName The name of the repository.
     * @returns An Observable of an array of BranchInfo objects.
     */
    getBranches(repoName: string): Observable<Branch[]> {
        // Assuming you have an endpoint like /api/git/repos/{repoName}/branches
        // You might need to add this method in your Spring Boot controller if not already present
        return this._httpClient.get<Branch[]>(
            `${this.API_URL}/repos/${repoName}/branches`
        );
    }

    /**
     * Downloads a specific file from a repository branch.
     * @param repoName The name of the repository.
     * @param branchName The name of the branch.
     * @param filePath The full path of the file relative to the repository root.
     * @returns An Observable of a Blob containing the file content.
     */
    downloadFile(
        repoName: string,
        branchName: string,
        filePath: string
    ): Observable<Blob> {
        // Encode the filePath to handle special characters in URLs
        const encodedFilePath = encodeURIComponent(filePath);
        return this._httpClient.get(
            `${this.API_URL}/repos/${repoName}/file/${branchName}/${encodedFilePath}`,
            { responseType: 'blob' }
        );
    }
}
