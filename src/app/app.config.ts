import { provideHttpClient } from '@angular/common/http';
import {
    ApplicationConfig,
    inject,
    InjectionToken,
    isDevMode,
    provideAppInitializer,
} from '@angular/core';
import { LuxonDateAdapter } from '@angular/material-luxon-adapter';
import { DateAdapter, MAT_DATE_FORMATS } from '@angular/material/core';
import { MatPaginatorIntl } from '@angular/material/paginator';
import { provideAnimationsAsync } from '@angular/platform-browser/animations/async';
import {
    provideRouter,
    TitleStrategy,
    withComponentInputBinding,
    withInMemoryScrolling,
} from '@angular/router';
import { provideFuse } from '@fuse';
import { Scheme } from '@fuse/services/config';
import { provideTransloco, TranslocoService } from '@jsverse/transloco';
import { provideHotToastConfig } from '@ngxpert/hot-toast';
import { appRoutes } from 'app/app.routes';
import { provideAuth } from 'app/core/auth/auth.provider';
import { provideIcons } from 'app/core/icons/icons.provider';
import { firstValueFrom } from 'rxjs';
import { TranslocoHttpLoader } from './core/transloco/transloco.http-loader';
import { provideKeycloakAngular } from './keycloak.config';
import { MockApiService } from './mock-api/index';
import { PaginatorI18nService } from './shared/services/paginator-i18n.service';
import { TranslateTitleStrategy } from './shared/route-strategies/title-i18n-strategy';

export const APP_API_URL = new InjectionToken<string>('APP_API_URL');

function getScheme(): Scheme {
    const scheme = (localStorage.getItem('scheme') as Scheme) || 'light';
    localStorage.setItem('scheme', scheme);
    return scheme;
}

export const appConfig: ApplicationConfig = {
    providers: [
        provideKeycloakAngular(),
        provideAnimationsAsync(),
        provideHttpClient(),
        provideRouter(
            appRoutes,
            withInMemoryScrolling({
                scrollPositionRestoration: 'enabled',
                anchorScrolling: 'enabled',
            }),
            withComponentInputBinding()
        ),
        provideHotToastConfig(),
        // API URL injection token
        {
            provide: APP_API_URL,
            useValue: import.meta.env.NG_APP_API_URL,
        },
        // Material Date Adapter
        {
            provide: DateAdapter,
            useClass: LuxonDateAdapter,
        },
        {
            provide: MAT_DATE_FORMATS,
            useValue: {
                parse: {
                    dateInput: 'D',
                },
                display: {
                    dateInput: 'DDD',
                    monthYearLabel: 'LLL yyyy',
                    dateA11yLabel: 'DD',
                    monthYearA11yLabel: 'LLLL yyyy',
                },
            },
        },

        // Transloco Config
        provideTransloco({
            config: {
                availableLangs: [
                    {
                        id: 'fr',
                        label: 'French',
                    },
                    {
                        id: 'ar',
                        label: 'Arabic',
                    },
                ],
                defaultLang: localStorage.getItem('language') || 'ar',
                fallbackLang: 'ar',
                reRenderOnLangChange: true,
                prodMode: !isDevMode(),
            },
            loader: TranslocoHttpLoader,
        }),
        {
            provide: MatPaginatorIntl,
            useClass: PaginatorI18nService,
            deps: [TranslocoService],
        },
        // provideAppInitializer(() => inject(KeycloakService).init()),
        provideAppInitializer(() => {
            const translocoService = inject(TranslocoService);
            const defaultLang = translocoService.getDefaultLang();
            translocoService.setActiveLang(defaultLang);
            console.log(`Successfully initialized '${defaultLang}' language.`);
            return firstValueFrom(translocoService.load(defaultLang));
        }),
        {
            provide: TitleStrategy,
            useClass: TranslateTitleStrategy,
        },
        // Fuse
        provideAuth(),
        provideIcons(),
        provideFuse({
            mockApi: {
                delay: 0,
                service: MockApiService,
            },
            fuse: {
                layout: 'compact',
                scheme: getScheme(),
                screens: {
                    sm: '600px',
                    md: '960px',
                    lg: '1280px',
                    xl: '1440px',
                },
                theme: 'theme-brand',
                themes: [
                    {
                        id: 'theme-default',
                        name: 'Default',
                    },
                    {
                        id: 'theme-brand',
                        name: 'Brand',
                    },
                ],
            },
        }),
    ],
};
