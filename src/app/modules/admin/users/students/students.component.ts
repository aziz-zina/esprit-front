import { ChangeDetectionStrategy, Component } from '@angular/core';
import { Role, RoleEnum } from 'app/models/enums';
import { UserManagementComponent } from '../user-management/user-management.component';

@Component({
    selector: 'app-students',
    imports: [UserManagementComponent],
    templateUrl: './students.component.html',
    changeDetection: ChangeDetectionStrategy.OnPush,
})
export class StudentsComponent {
    role: Role = RoleEnum.STUDENT;
}
