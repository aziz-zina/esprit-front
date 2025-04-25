import { Route } from '@angular/router';
import { NoAuthGuard } from '@core/auth/guards/noAuth.guard';
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
];
