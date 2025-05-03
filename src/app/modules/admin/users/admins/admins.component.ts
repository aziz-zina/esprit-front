import { ChangeDetectionStrategy, Component } from '@angular/core';
import { Role, RoleEnum } from 'app/models/enums';
import { UserManagementComponent } from '../user-management/user-management.component';

@Component({
    selector: 'app-admins',
    imports: [UserManagementComponent],
    templateUrl: './admins.component.html',
    changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AdminComponent {
    role: Role = RoleEnum.ADMIN;
}
