import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { KeycloakService } from '@core/auth/keycloak.service';
import { map, Observable } from 'rxjs';

@Injectable({
    providedIn: 'root',
})
export class ExampleService {
    private readonly _httpClient = inject(HttpClient);
    private readonly _keycloak = inject(KeycloakService);

    getGithubAccessToken(): Observable<string> {
        const keycloakUrl = `${import.meta.env.NG_APP_KEYCLOAK_BASE_URL}/realms/${import.meta.env.NG_APP_KEYCLOAK_REALM}/broker/github/token`;
        const headers = {
            'Content-Type': 'application/x-www-form-urlencoded',
            Authorization: `Bearer ${this._keycloak.token}`,
        };

        return this._httpClient
            .get(keycloakUrl, {
                headers,
                responseType: 'text',
            })
            .pipe(
                map((response: string) => {
                    // Parse the URL-encoded string to extract the access token
                    const params = new URLSearchParams(response);
                    return params.get('access_token') || '';
                })
            );
    }
}
