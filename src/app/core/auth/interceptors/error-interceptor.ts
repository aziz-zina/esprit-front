import { HttpErrorResponse, HttpHandlerFn, HttpRequest } from '@angular/common/http';
import { inject } from '@angular/core';
import { TranslocoService } from '@jsverse/transloco';
import { HotToastService } from '@ngxpert/hot-toast';
import { catchError, throwError } from 'rxjs';
import { KeycloakService } from '../keycloak.service';

export enum STATUS {
    UNAUTHORIZED = 401,
    FORBIDDEN = 403,
    NOT_FOUND = 404,
    INTERNAL_SERVER_ERROR = 500,
}

export function errorInterceptor(req: HttpRequest<unknown>, next: HttpHandlerFn) {
    const toast = inject(HotToastService);
    const transloco = inject(TranslocoService);
    const keycloakService = inject(KeycloakService);
    const errorPages = [STATUS.FORBIDDEN, STATUS.NOT_FOUND, STATUS.INTERNAL_SERVER_ERROR];

    const getMessage = (error: HttpErrorResponse) => {
        if (error.error?.message) {
            return transloco.translate(error.error.message);
        }
        if (error.error?.msg) {
            return transloco.translate(error.error.msg);
        }
        return `${error.status} ${error.statusText}`;
    };

    return next(req).pipe(
        catchError((error: HttpErrorResponse) => {
            if (errorPages.includes(error.status)) {
                toast.error(getMessage(error), {
                    position: 'top-right',
                });
                if (error.status === STATUS.UNAUTHORIZED) {
                    keycloakService.logout();
                }
            }

            return throwError(() => error);
        })
    );
}
