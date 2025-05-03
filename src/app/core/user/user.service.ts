import { HttpClient, HttpParams } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { KeycloakService } from '@core/auth/keycloak.service';
import { APP_API_URL } from 'app/app.config';
import {
    AddUserRequest,
    UpdateUserRequest,
    User,
} from 'app/core/user/user.types';
import { Role } from 'app/models/enums';
import { Page } from 'app/models/pagination/page-response.types';
import { PageRequest } from 'app/models/pagination/pageRequest';
import { BehaviorSubject, from, Observable } from 'rxjs';

@Injectable({ providedIn: 'root' })
export class UserService {
    private readonly _httpClient = inject(HttpClient);
    private readonly _keycloakService = inject(KeycloakService);

    private readonly _user: BehaviorSubject<User> = new BehaviorSubject<User>(
        null
    );
    private readonly API_URL = inject(APP_API_URL);

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
        return from(
            this._keycloakService.getUserProfile().then((res) => {
                const user = {
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

    getUsersByRole(
        role: Role,
        pageRequest: PageRequest
    ): Observable<Page<User>> {
        const params = new HttpParams()
            .set('size', pageRequest.size)
            .set('page', pageRequest.page)
            .set('sort', pageRequest.sort)
            .set('query', pageRequest.search)
            .set('sortDirection', pageRequest.sortDirection)
            .set('role', role);

        return this._httpClient.get<Page<User>>(`${this.API_URL}/users`, {
            params,
        });
    }

    toggleUserStatus(userId: string): Observable<boolean> {
        return this._httpClient.put<boolean>(
            `${this.API_URL}/users/toggle/${userId}`,
            {}
        );
    }

    deleteById(id: string): Observable<void> {
        return this._httpClient.delete<void>(`${this.API_URL}/users/${id}`);
    }

    createUser(request: AddUserRequest): Observable<User> {
        return this._httpClient.post<User>(`${this.API_URL}/users`, request);
    }

    updateUser(request: UpdateUserRequest): Observable<User> {
        return this._httpClient.put<User>(`${this.API_URL}/users`, request);
    }

    checkEmailExists(email: string): Observable<boolean> {
        return this._httpClient.get<boolean>(
            `${this.API_URL}/users/email-exists`,
            {
                params: { email },
            }
        );
    }
}
