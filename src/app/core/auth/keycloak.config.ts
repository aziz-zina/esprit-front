import {
    AutoRefreshTokenService,
    createInterceptorCondition,
    INCLUDE_BEARER_TOKEN_INTERCEPTOR_CONFIG,
    IncludeBearerTokenCondition,
    provideKeycloak,
    UserActivityService,
    withAutoRefreshToken,
} from 'keycloak-angular';

const backendUrl = import.meta.env.NG_APP_API_URL;

const backendUrlPattern = new RegExp(`^${backendUrl}/?.*$`, 'i');
const urlCondition = createInterceptorCondition<IncludeBearerTokenCondition>({
    urlPattern: backendUrlPattern,
});

export const provideKeycloakAngular = () =>
    provideKeycloak({
        config: {
            realm: import.meta.env.NG_APP_KEYCLOAK_REALM,
            url: import.meta.env.NG_APP_KEYCLOAK_BASE_URL,
            clientId: import.meta.env.NG_APP_KEYCLOAK_CLIENT_ID,
        },
        initOptions: {
            onLoad: 'login-required',
            silentCheckSsoRedirectUri:
                window.location.origin + '/silent-check-sso.html',
            // redirectUri: window.location.origin + '/',
        },
        features: [
            withAutoRefreshToken({
                onInactivityTimeout: 'none',
                sessionTimeout: 60000,
            }),
        ],
        providers: [
            AutoRefreshTokenService,
            UserActivityService,
            {
                provide: INCLUDE_BEARER_TOKEN_INTERCEPTOR_CONFIG,
                useValue: [urlCondition],
            },
        ],
    });
