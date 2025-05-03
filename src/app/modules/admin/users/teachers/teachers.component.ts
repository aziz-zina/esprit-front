import { ChangeDetectionStrategy, Component } from '@angular/core';
import { Role, RoleEnum } from 'app/models/enums';
import { UserManagementComponent } from '../user-management/user-management.component';

@Component({
    selector: 'app-teachers',
    imports: [UserManagementComponent],
    templateUrl: './teachers.component.html',
    changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TeachersComponent {
    role: Role = RoleEnum.TEACHER;
}
