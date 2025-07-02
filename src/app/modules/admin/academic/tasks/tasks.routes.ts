import { Routes } from '@angular/router';
import { StudentTasksComponent } from './tasks.component';

export default [
    {
        path: 'group/:groupId/student/:studentId',
        component: StudentTasksComponent,
    },
] as Routes;
