import { Routes } from '@angular/router';
import { TeachersComponent } from './teachers.component';

export default [
    {
        path: '',
        data: {
            roles: ['admin', 'student'],
        },
        component: TeachersComponent,
    },
] as Routes;
