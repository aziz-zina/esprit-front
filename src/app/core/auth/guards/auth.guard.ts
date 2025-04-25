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
    const router = inject(Router);

    // 1. If the user is not authenticated, redirect to home
    if (!authenticated) {
        return router.parseUrl('/landing');
    }

    // 2. Define role checkers
    const isAdmin = grantedRoles.realmRoles.includes('admin');
    const requiredRole = route.data['role'];

    // 3. Allow access immediately if the user is an admin
    if (isAdmin) {
        return true;
    }

    // 4. Check if the user has the required role
    if (requiredRole) {
        const hasRequiredRole = (role: string): boolean =>
            Object.values(grantedRoles.realmRoles).some((roles) =>
                roles.includes(role)
            );

        if (!hasRequiredRole(requiredRole)) {
            return router.parseUrl('/home');
        }
    }

    return true;
};

// Export the guard
export const AuthGuard = createAuthGuard<CanActivateFn>(isAccessAllowed);
