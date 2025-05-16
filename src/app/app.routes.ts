import { Route } from '@angular/router';
import { AuthGuard } from '@core/auth/guards/auth.guard';
import { NoAuthGuard } from '@core/auth/guards/noAuth.guard';
import { initialDataResolver } from './app.resolvers';
import { LayoutComponent } from './layout/layout.component';

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
            role: 'admin',
            layout: 'classic',
        },

        children: [
            {
                path: 'dashboards',
                data: {
                    role: 'admin',
                },
                children: [
                    {
                        path: 'analytics',
                        data: {
                            role: 'admin',
                        },
                        loadChildren: () =>
                            import(
                                'app/modules/admin/dashboards/analytics/analytics.routes'
                            ),
                    },
                    {
                        path: 'project',
                        data: {
                            role: 'admin',
                        },
                        loadChildren: () =>
                            import(
                                'app/modules/admin/dashboards/project/project.routes'
                            ),
                    },
                ],
            },
            {
                path: 'users',
                title: 'routes.users.teachers.title',
                data: {
                    role: 'admin',
                },
                children: [
                    {
                        path: 'admins',
                        title: 'routes.users.admins.title',
                        data: {
                            role: 'admin',
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
            {
                path: 'academic',
                title: 'routes.academic.title',
                data: {
                    role: 'admin',
                },
                children: [
                    {
                        path: 'academic-years',
                        title: 'routes.users.academic-years.title',
                        data: {
                            role: 'admin',
                        },
                        loadChildren: () =>
                            import(
                                'app/modules/admin/academic/academic-years/academic-years.routes'
                            ),
                    },
                    {
                        path: 'teachers',
                        title: 'routes.users.teachers.title',
                        data: {
                            role: 'admin',
                        },
                        loadChildren: () =>
                            import(
                                'app/modules/admin/academic/classrooms/classrooms.routes'
                            ),
                    },
                    {
                        path: 'subjects',
                        title: 'routes.users.teachers.title',
                        data: {
                            role: 'admin',
                        },
                        loadChildren: () =>
                            import(
                                'app/modules/admin/academic/subjects/subjects.routes'
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
    // User routes
    {
        path: '',
        canActivate: [AuthGuard],
        canActivateChild: [AuthGuard],
        data: {
            role: 'student',
            layout: 'modern',
        },
        component: LayoutComponent,
        resolve: {
            initialData: initialDataResolver,
        },
        children: [
            {
                path: 'example',
                data: {
                    role: 'student',
                },
                loadChildren: () => import('./modules/example/example.routes'),
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
