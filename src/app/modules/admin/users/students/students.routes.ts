import { Routes } from '@angular/router';
import { StudentsComponent } from './students.component';

export default [
    {
        path: '',
        data: {
            roles: ['admin', 'student'],
        },
        component: StudentsComponent,
    },
] as Routes;
