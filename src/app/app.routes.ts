import { Route } from '@angular/router';
import { AuthGuard } from '@core/auth/guards/auth.guard';
import { NoAuthGuard } from '@core/auth/guards/noAuth.guard';
import { initialDataResolver } from './app.resolvers';
import { LayoutComponent } from './layout/layout.component';
import { ExampleComponent } from './modules/admin/example/example.component'; // Import ExampleComponent

// @formatter:off

export const appRoutes: Route[] = [
    { path: '', pathMatch: 'full', redirectTo: 'example' },

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
            {
                path: 'users',
                title: 'routes.users.teachers.title',
                data: {
                    roles: ['admin', 'student'],
                },
                children: [
                    {
                        path: 'admins',
                        title: 'routes.users.admins.title',
                        data: {
                            roles: ['admin', 'student'],
                        },
                        loadChildren: () =>
                            import(
                                'app/modules/admin/users/admins/admins.routes'
                            ),
                    },
                    {
                        path: 'teachers',
                        title: 'routes.users.teachers.title',
                        loadChildren: () =>
                            import(
                                'app/modules/admin/users/teachers/teachers.routes'
                            ),
                    },
                    {
                        path: 'students',
                        title: 'routes.users.students.title',
                        loadChildren: () =>
                            import(
                                'app/modules/admin/users/students/students.routes'
                            ),
                    },
                ],
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
