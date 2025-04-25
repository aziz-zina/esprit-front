import { Injectable } from '@angular/core';
import { Scheme } from '@fuse/services/config';

@Injectable({
    providedIn: 'root',
})
export class LocalStorageService {
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

    set refreshToken(token: string) {
        localStorage.setItem('refreshToken', token);
    }

    get refreshToken(): string {
        return localStorage.getItem('refreshToken') ?? '';
    }

    get scheme(): Scheme {
        return (localStorage.getItem('scheme') as Scheme) ?? 'auto';
    }

    set scheme(scheme: string) {
        localStorage.setItem('scheme', scheme);
    }

    get language(): string {
        return localStorage.getItem('language') ?? 'fr';
    }

    set language(language: string) {
        localStorage.setItem('language', language);
    }

    removeAccessToken(): void {
        localStorage.removeItem('accessToken');
    }

    removeRefreshToken(): void {
        localStorage.removeItem('refreshToken');
    }

    removeScheme(): void {
        localStorage.removeItem('scheme');
    }

    removeLanguage(): void {
        localStorage.removeItem('language');
    }
}
