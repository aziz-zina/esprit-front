import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { KeycloakService } from '@core/auth/keycloak.service';
import { User } from 'app/core/user/user.types';
import { ResponseBlob } from 'app/models/common/blob';
import { BehaviorSubject, Observable, of, tap } from 'rxjs';
import { APP_API_URL } from '../../app.config';

@Injectable({ providedIn: 'root' })
export class UserService {
    private readonly _httpClient = inject(HttpClient);
    private readonly keycloakService = inject(KeycloakService);
    private readonly _user: BehaviorSubject<User> = new BehaviorSubject<User>(
        null
    );
    private readonly APP_API_URL = inject(APP_API_URL);

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
    get(refresh = false): Observable<User> {
        if (this._user.value && refresh === false) {
            return of(this._user.value);
        }
        if (this.keycloakService.hasRole('admin')) {
            return this._httpClient
                .get<User>(`${this.APP_API_URL}/idp/me`)
                .pipe(
                    tap((user) => {
                        this._user.next(user);
                    })
                );
        } else {
            return this._httpClient
                .get<User>(`${this.APP_API_URL}/users/me`)
                .pipe(
                    tap((user) => {
                        this._user.next(user);
                    })
                );
        }
    }

    getUserId(): string {
        if (this._user.value) {
            return this._user.value.id;
        }
        return null;
    }

    updateProfilePicture(blob: ResponseBlob) {
        const currentUser = this._user.getValue();
        this._user.next({
            ...currentUser,
            profilePicture: blob.url,
        });
    }
    updateUserName(userName: User) {
        this._user.subscribe((user) => {
            user.firstName = userName.firstName;
            user.lastName = userName.lastName;
        });
    }

    setUser(user: User): void {
        this._user.next(user);
    }

    updateLocale(locale: string): Observable<User> {
        return this._httpClient
            .put<User>(`${this.APP_API_URL}/idp/me/locale/${locale}`, {})
            .pipe(tap((user) => {}));
    }
}
