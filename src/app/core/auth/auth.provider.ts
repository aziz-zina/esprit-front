import { provideHttpClient, withInterceptors } from '@angular/common/http';
import {
    EnvironmentProviders,
    Provider,
    inject,
    provideEnvironmentInitializer,
} from '@angular/core';
import { includeBearerTokenInterceptor } from 'keycloak-angular';
import { errorInterceptor, languageInterceptor } from './interceptors';
import { KeycloakService } from './keycloak.service';

// Http interceptor providers in outside-in order
const interceptors = [
    languageInterceptor,
    includeBearerTokenInterceptor,
    errorInterceptor,
];
export const provideAuth = (): (Provider | EnvironmentProviders)[] => {
    return [
        provideHttpClient(withInterceptors(interceptors)),
        provideEnvironmentInitializer(() => inject(KeycloakService)),
    ];
};
