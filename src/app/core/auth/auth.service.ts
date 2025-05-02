import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';

import { catchError, Observable, of, switchMap } from 'rxjs';
import { UserService } from '../user/user.service';
import { User } from '../user/user.types';
import { KeycloakService } from './keycloak.service';

@Injectable({ providedIn: 'root' })
export class AuthService {
    private _authenticated = false;
    private readonly _httpClient = inject(HttpClient);
    private readonly _userService = inject(UserService);
    private readonly _keycloakService = inject(KeycloakService);
    // private readonly API_URL = inject(APP_API_URL);

    // -----------------------------------------------------------------------------------------------------
    // @ Accessors
    // -----------------------------------------------------------------------------------------------------

    /**
     * Setter & getter for access token
     */
    set accessToken(token: string) {
        localStorage.setItem('accessToken', token);
    }

    get accessToken(): string {
        return localStorage.getItem('accessToken') ?? '';
    }

    // -----------------------------------------------------------------------------------------------------
    // @ Public methods
    // -----------------------------------------------------------------------------------------------------

    /**
     * Sign in using the access token
     */
    signInUsingToken(): Observable<boolean> {
        // Sign in using the token
        return this._userService.get().pipe(
            catchError(() =>
                // Return false
                of(false)
            ),
            switchMap((response: User) => {
                // Store the user on the user service
                this._userService.user = response;
                // Return true
                return of(true);
            })
        );
    }

    /**
     * Check the authentication status
     */
    check(): Observable<boolean> {
        // const { authenticated, grantedRoles } = authData;
        // Check if the user is logged in
        // if (this._keycloakService.authenticated) {
        //     return of(true);
        // }

        // console.log('User is not authenticated');

        // const isAdmin = grantedRoles.realmRoles.includes('admin');
        // // 3. Allow access immediately if the user is an admin
        // if (isAdmin) {
        //     return of(true);
        // }

        // If the access token exists, and it didn't expire, sign in using it
        return this.signInUsingToken();
    }
}
