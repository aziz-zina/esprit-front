import { Route } from '@angular/router';
import { AuthGuard } from '@core/auth/guards/auth.guard';
import { NoAuthGuard } from '@core/auth/guards/noAuth.guard';
import { initialDataResolver } from './app.resolvers';
import { LayoutComponent } from './layout/layout.component';

// @formatter:off

export const appRoutes: Route[] = [
    { path: '', pathMatch: 'full', redirectTo: 'landing' },

    // Landing routes
    {
        path: '',
        component: LayoutComponent,
        canActivate: [NoAuthGuard],
        data: {
            layout: 'empty',
        },
        children: [
            {
                path: 'landing',
                title: 'routes.landing.home.title',
                loadChildren: () =>
                    import('app/modules/landing/home/home.routes'),
            },
        ],
    },
    {
        path: '',
        canActivate: [AuthGuard],
        canActivateChild: [AuthGuard],
        component: LayoutComponent,
        resolve: {
            initialData: initialDataResolver,
        },
        data: {
            roles: ['admin', 'student'],
        },

        children: [
            {
                path: 'example',
                data: {
                    roles: ['admin', 'student'],
                },

                loadChildren: () =>
                    import('./modules/admin/example/example.routes'),
            },
        ],
    },
    {
        path: '404-not-found',
        pathMatch: 'full',
        loadChildren: () =>
            import('./modules/error/error-404/error-404.routes'),
    },
    { path: '**', redirectTo: '404-not-found' },
];
