import {
    Component,
    DestroyRef,
    inject,
    OnInit,
    signal,
    ViewEncapsulation,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { FuseFullscreenComponent } from '@fuse/components/fullscreen';
import { FuseLoadingBarComponent } from '@fuse/components/loading-bar';
import {
    FuseHorizontalNavigationComponent,
    FuseNavigationService,
    FuseVerticalNavigationComponent,
} from '@fuse/components/navigation';
import { FuseMediaWatcherService } from '@fuse/services/media-watcher';
import { NavigationService } from 'app/core/navigation/navigation.service';
import { Navigation } from 'app/core/navigation/navigation.types';
import { LanguagesComponent } from 'app/layout/common/languages/languages.component';
import { UserComponent } from 'app/layout/common/user/user.component';
import { TranslocoModule } from '@jsverse/transloco';
import { RouterOutlet } from '@angular/router';

@Component({
    selector: 'modern-layout',
    templateUrl: './modern.component.html',
    encapsulation: ViewEncapsulation.None,
    imports: [
        FuseLoadingBarComponent,
        FuseVerticalNavigationComponent,
        FuseHorizontalNavigationComponent,
        MatButtonModule,
        MatIconModule,
        LanguagesComponent,
        FuseFullscreenComponent,
        TranslocoModule,
        UserComponent,
        RouterOutlet,
    ],
})
export class ModernLayoutComponent implements OnInit {
    private readonly destroyRef = inject(DestroyRef);
    private readonly _navigationService = inject(NavigationService);
    private readonly _fuseMediaWatcherService = inject(FuseMediaWatcherService);
    private readonly _fuseNavigationService = inject(FuseNavigationService);

    readonly isScreenSmall = signal(false);
    navigation: Navigation;

    // -----------------------------------------------------------------------------------------------------
    // @ Accessors
    // -----------------------------------------------------------------------------------------------------

    /**
     * Getter for current year
     */
    get currentYear(): number {
        return new Date().getFullYear();
    }

    // -----------------------------------------------------------------------------------------------------
    // @ Lifecycle hooks
    // -----------------------------------------------------------------------------------------------------

    /**
     * On init
     */
    ngOnInit(): void {
        // Subscribe to navigation data
        this._navigationService.navigation$
            .pipe(takeUntilDestroyed(this.destroyRef))
            .subscribe((navigation: Navigation) => {
                this.navigation = navigation;
            });

        // Subscribe to media changes
        this._fuseMediaWatcherService.onMediaChange$
            .pipe(takeUntilDestroyed(this.destroyRef))
            .subscribe(({ matchingAliases }) => {
                // Check if the screen is small
                this.isScreenSmall.set(!matchingAliases.includes('md'));
            });
    }

    // -----------------------------------------------------------------------------------------------------
    // @ Public methods
    // -----------------------------------------------------------------------------------------------------

    /**
     * Toggle navigation
     *
     * @param name
     */
    toggleNavigation(name: string): void {
        // Get the navigation
        const navigation =
            this._fuseNavigationService.getComponent<FuseVerticalNavigationComponent>(
                name
            );

        if (navigation) {
            // Toggle the opened status
            navigation.toggle();
        }
    }
}
