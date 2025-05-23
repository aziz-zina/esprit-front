import { HttpClient, HttpHeaders } from '@angular/common/http'; // Import HttpHeaders
import { inject, Injectable } from '@angular/core';
import { KeycloakService } from '@core/auth/keycloak.service'; // Make sure this path is correct
import { APP_API_URL } from 'app/app.config';
import { catchError, map, Observable, of } from 'rxjs';

export interface GenerateCommitResponse {
    // Define expected object shape
    commitMessage: string;
}

@Injectable({
    providedIn: 'root',
})
export class ExampleService {
    private readonly _httpClient = inject(HttpClient);
    private readonly _keycloak = inject(KeycloakService);
    private readonly API_URL = inject(APP_API_URL);

    // Fetches the *Keycloak* access token first, then uses it to get the *GitHub* token
    getGithubAccessToken(): Observable<string | null> {
        // Ensure Keycloak token is available and valid
        if (!this._keycloak.token) {
            console.error('Keycloak token not available.');
            // Optionally try to refresh or guide user to login
            return of(null); // Return null observable if no token
        }

        // Keycloak endpoint to retrieve the brokered GitHub token
        // Ensure base URL and realm name are correct from your environment
        const keycloakBrokerTokenUrl = `${import.meta.env.NG_APP_KEYCLOAK_BASE_URL}/realms/${import.meta.env.NG_APP_KEYCLOAK_REALM}/broker/github/token`;

        const headers = new HttpHeaders({
            // Keycloak usually expects the Keycloak Access Token for this endpoint
            Authorization: `Bearer ${this._keycloak.token}`,
            // Accept might not be strictly necessary, but good practice
            Accept: 'application/x-www-form-urlencoded',
        });

        return this._httpClient
            .get(keycloakBrokerTokenUrl, {
                headers,
                responseType: 'text', // Expecting URL-encoded string
            })
            .pipe(
                map((response: string) => {
                    try {
                        const params = new URLSearchParams(response);
                        const ghToken = params.get('access_token');
                        if (!ghToken) {
                            console.warn(
                                'GitHub access_token not found in Keycloak broker response.'
                            );
                            return null;
                        }
                        return ghToken;
                    } catch (e) {
                        console.error(
                            'Error parsing Keycloak broker response:',
                            e
                        );
                        return null;
                    }
                }),
                catchError((error) => {
                    console.error(
                        'HTTP Error fetching GitHub token from Keycloak:',
                        error
                    );
                    // Handle specific errors (e.g., 401 Unauthorized might mean Keycloak session expired)
                    return of(null); // Return null on error
                })
            );
    }

    // New method to fetch repositories from GitHub API
    fetchGithubRepositories(accessToken: string): Observable<GithubApiRepo[]> {
        const apiUrl =
            'https://api.github.com/user/repos?sort=updated&per_page=100'; // Get user's repos, sorted, max 100
        const headers = new HttpHeaders({
            Accept: 'application/vnd.github.v3+json',
            Authorization: `Bearer ${accessToken}`,
        });

        return this._httpClient.get<GithubApiRepo[]>(apiUrl, { headers }).pipe(
            catchError((error) => {
                console.error(
                    'HTTP Error fetching GitHub repositories:',
                    error
                );
                // Handle specific errors (e.g., 401 means bad token)
                return of([]); // Return empty array on error
            })
        );
    }

    generateCommitMessage(diff: string): Observable<GenerateCommitResponse> {
        return this._httpClient.post<GenerateCommitResponse>(
            `${this.API_URL}/generate-commit-message`,
            { diff }
        );
    }
}

// Interface for GitHub API response (add more fields as needed)
export interface GithubApiRepo {
    id: number;
    name: string;
    full_name: string;
    private: boolean;
    clone_url: string;
    html_url: string; // Link to repo on GitHub
    description: string | null;
    updated_at: string;
}
