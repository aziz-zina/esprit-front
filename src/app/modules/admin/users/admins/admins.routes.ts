import { Routes } from '@angular/router';
import { AdminComponent } from './admins.component';

export default [
    {
        path: '',
        data: {
            roles: ['admin', 'student'],
        },
        component: AdminComponent,
    },
] as Routes;
