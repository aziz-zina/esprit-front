import { inject } from '@angular/core';
import {
    ActivatedRouteSnapshot,
    CanActivateFn,
    Router,
    RouterStateSnapshot,
    UrlTree,
} from '@angular/router';
import { AuthGuardData, createAuthGuard } from 'keycloak-angular';

const isAccessAllowed = async (
    route: ActivatedRouteSnapshot,
    _: RouterStateSnapshot,
    authData: AuthGuardData
): Promise<boolean | UrlTree> => {
    const { authenticated, grantedRoles } = authData;

    const requiredRole = route.data['roles'] as string[];
    if (!requiredRole) {
        return false;
    }

    const hasRequiredRole = (roles: string[]): boolean =>
        roles.some((role) =>
            Object.values(grantedRoles.realmRoles).some((realmRoles) =>
                realmRoles.includes(role)
            )
        );

    if (authenticated && hasRequiredRole(requiredRole)) {
        return true;
    }

    const router = inject(Router);
    return router.parseUrl('/example');
};

// Export the guard
export const AuthGuard = createAuthGuard<CanActivateFn>(isAccessAllowed);
