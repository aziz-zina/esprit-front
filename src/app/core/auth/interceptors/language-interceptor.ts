import { HttpHandlerFn, HttpRequest } from '@angular/common/http';
import { inject } from '@angular/core';
import { TranslocoService } from '@jsverse/transloco';

export function languageInterceptor(
    req: HttpRequest<unknown>,
    next: HttpHandlerFn
) {
    const transloco = inject(TranslocoService);

    return next(
        req.clone({
            headers: req.headers.append(
                'Accept-Language',
                transloco.getActiveLang()
            ),
        })
    );
}
