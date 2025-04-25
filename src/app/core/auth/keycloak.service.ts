import { inject, Injectable } from '@angular/core';
import { TranslocoService } from '@jsverse/transloco';
import Keycloak from 'keycloak-js';
import { LocalStorageService } from '../../shared/services/local-storage.service';

@Injectable({
    providedIn: 'root',
})
export class KeycloakService {
    private readonly keycloak = inject(Keycloak);
    private readonly translocoService = inject(TranslocoService);
    private readonly localStorageService = inject(LocalStorageService);

    get userId(): string {
        return this.keycloak?.tokenParsed?.sub;
    }

    get tokenParsed() {
        return this.keycloak?.tokenParsed;
    }

    get token(): string {
        return this.keycloak?.token;
    }

    get authenticated(): boolean {
        return this.keycloak?.authenticated;
    }

    get isTokenValid(): boolean {
        return !this.keycloak?.isTokenExpired();
    }

    get fullName(): string {
        return this.keycloak?.tokenParsed?.['name'] as string;
    }

    hasRole(role: string): boolean {
        return this.keycloak?.hasRealmRole(role);
    }

    async getUserProfile() {
        return await this.keycloak?.loadUserProfile();
    }

    async login() {
        await this.keycloak?.login({
            locale: this.getActiveLang(),
        });
    }

    async updatePassword() {
        await this.keycloak?.login({
            prompt: 'login',
            action: 'UPDATE_PASSWORD',
            locale: this.getActiveLang(),
        });
    }

    async updateProfile() {
        await this.keycloak?.login({
            action: 'UPDATE_PROFILE',
            locale: this.getActiveLang(),
        });
    }

    async deleteAccount() {
        await this.keycloak?.login({
            action: 'delete_account',
            locale: this.getActiveLang(),
        });
    }

    getActiveLang() {
        return this.translocoService.getActiveLang();
    }

    async configureTotp() {
        await this.keycloak?.login({
            action: 'CONFIGURE_TOTP',
            locale: this.getActiveLang(),
        });
    }

    async logout() {
        this.localStorageService.removeLanguage();
        this.localStorageService.removeScheme();
        this.keycloak.clearToken();

        const logoutUrl = this.keycloak.createLogoutUrl({
            redirectUri: window.location.origin,
        });
        const logoutUrlWithLocale = `${logoutUrl}&ui_locales=${this.getActiveLang()}`;
        window.location.href = logoutUrlWithLocale;
    }

    accountManagement() {
        return this.keycloak?.accountManagement();
    }
}
