import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { from, Observable, ReplaySubject } from 'rxjs';
import { KeycloakService } from '../auth/keycloak.service';
import { User } from './user.types';

@Injectable({ providedIn: 'root' })
export class UserService {
    private _httpClient = inject(HttpClient);
    private _user: ReplaySubject<User> = new ReplaySubject<User>(1);
    private readonly _keycloakService = inject(KeycloakService);

    // -----------------------------------------------------------------------------------------------------
    // @ Accessors
    // -----------------------------------------------------------------------------------------------------

    /**
     * Setter & getter for user
     *
     * @param value
     */
    set user(value: User) {
        // Store the value
        this._user.next(value);
    }

    get user$(): Observable<User> {
        return this._user.asObservable();
    }

    // -----------------------------------------------------------------------------------------------------
    // @ Public methods
    // -----------------------------------------------------------------------------------------------------

    /**
     * Get the current signed-in user data
     */
    get(): Observable<User> {
        let user: User | null = null;
        return from(
            this._keycloakService.getUserProfile().then((res) => {
                user = {
                    firstName: res.firstName,
                    lastName: res.lastName,
                    email: res.email,
                    username: res.username,
                    id: res.id,
                };
                this._user.next(user);
                return user;
            })
        );
    }
}
