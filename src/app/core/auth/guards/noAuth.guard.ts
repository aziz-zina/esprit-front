import { inject } from '@angular/core';
import { CanActivateChildFn, CanActivateFn, Router } from '@angular/router';
import { of } from 'rxjs';
import { KeycloakService } from '../keycloak.service';

export const NoAuthGuard: CanActivateFn | CanActivateChildFn = () => {
    const router: Router = inject(Router);

    const keycloakService = inject(KeycloakService);

    if (!keycloakService.authenticated) {
        return of(true);
    }

    // if (keycloakService.hasRole('admin')) {
    //     router.navigate(['/example']);
    //     return of(false);
    // }
    return of(false);
};
