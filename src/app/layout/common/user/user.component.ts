import {
    ChangeDetectionStrategy,
    Component,
    DestroyRef,
    inject,
    input,
    OnInit,
    signal,
    ViewEncapsulation,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { MatButtonModule } from '@angular/material/button';
import { MatRippleModule } from '@angular/material/core';
import { MatDividerModule } from '@angular/material/divider';
import { MatIconModule } from '@angular/material/icon';
import { MatMenuModule } from '@angular/material/menu';
import { RouterLink } from '@angular/router';
import { TranslocoModule } from '@jsverse/transloco';
import { KeycloakService } from '../../../core/auth/keycloak.service';
import { UserService } from '../../../core/user/user.service';
import { User } from '../../../core/user/user.types';

@Component({
    selector: 'user',
    templateUrl: './user.component.html',
    encapsulation: ViewEncapsulation.None,
    changeDetection: ChangeDetectionStrategy.OnPush,
    exportAs: 'user',
    imports: [
        MatButtonModule,
        MatMenuModule,
        MatIconModule,
        MatDividerModule,
        TranslocoModule,
        RouterLink,
        MatRippleModule,
    ],
})
export class UserComponent implements OnInit {
    private readonly destroyRef = inject(DestroyRef);
    private readonly _userService = inject(UserService);
    private readonly _keycloakService = inject(KeycloakService);

    showAvatar = input(true);
    readonly user = signal<User | null>(null);

    // -----------------------------------------------------------------------------------------------------
    // @ Lifecycle hooks
    // -----------------------------------------------------------------------------------------------------

    /**
     * On init
     */
    ngOnInit(): void {
        // Subscribe to user changes
        this._userService.user$
            .pipe(takeUntilDestroyed(this.destroyRef))
            .subscribe((user: User) => {
                this.user.set(user);
            });
    }

    // -----------------------------------------------------------------------------------------------------
    // @ Public methods
    // -----------------------------------------------------------------------------------------------------

    updateProfile(): void {
        this._keycloakService.updateProfile();
    }

    /**
     * Sign out
     */
    signOut(): void {
        this._keycloakService.logout();
    }
}
