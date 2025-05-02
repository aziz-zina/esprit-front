import {
    ChangeDetectionStrategy,
    Component,
    OnInit,
    ViewEncapsulation,
    inject,
    signal,
} from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatMenuModule } from '@angular/material/menu';
import { MatTooltipModule } from '@angular/material/tooltip';
import {
    FuseNavigationService,
    FuseVerticalNavigationComponent,
} from '@fuse/components/navigation';
import {
    LangDefinition,
    TranslocoModule,
    TranslocoService,
} from '@jsverse/transloco';

import { LocalStorageService } from '@shared/services/local-storage.service';
import { take } from 'rxjs';

@Component({
    selector: 'languages',
    templateUrl: './languages.component.html',
    encapsulation: ViewEncapsulation.Emulated,
    changeDetection: ChangeDetectionStrategy.OnPush,
    imports: [
        MatButtonModule,
        MatMenuModule,
        MatIconModule,
        TranslocoModule,
        MatTooltipModule,
    ],
})
export class LanguagesComponent implements OnInit {
    private readonly _fuseNavigationService = inject(FuseNavigationService);
    private readonly _translocoService = inject(TranslocoService);
    private readonly _localStorageService = inject(LocalStorageService);

    availableLangs = signal<LangDefinition[]>([]);
    activeLang = signal('');

    // -----------------------------------------------------------------------------------------------------
    // @ Lifecycle hooks
    // -----------------------------------------------------------------------------------------------------

    /**
     * On init
     */
    ngOnInit(): void {
        // Get the available languages from transloco
        this.availableLangs.set(
            this._translocoService.getAvailableLangs() as LangDefinition[]
        );

        // Subscribe to language changes
        this._translocoService.langChanges$.subscribe((activeLang) => {
            // Get the active lang
            this.activeLang.set(activeLang);
            // Update the navigation
            this._updateNavigation(activeLang);
        });

        setTimeout(() => {
            this._updateNavigation(this.activeLang());
        }, 0);
    }

    // -----------------------------------------------------------------------------------------------------
    // @ Public methods
    // -----------------------------------------------------------------------------------------------------

    /**
     * Set the active lang
     *
     * @param lang
     */
    setActiveLang(lang: string): void {
        this._localStorageService.language = lang;
        // Set the active lang
        this._translocoService.setActiveLang(lang);
    }

    /**
     * Track by function for ngFor loops
     *
     * @param index
     * @param item
     */
    trackByFn(index: number, item: any): any {
        return item.id || index;
    }

    // -----------------------------------------------------------------------------------------------------
    // @ Private methods
    // -----------------------------------------------------------------------------------------------------

    /**
     * Update the navigation
     *
     * @param lang
     * @private
     */
    private _updateNavigation(lang: string): void {
        // Get the component -> navigation data -> item
        const navComponent =
            this._fuseNavigationService.getComponent<FuseVerticalNavigationComponent>(
                'mainNavigation'
            );

        // Return if the navigation component does not exist
        if (!navComponent) {
            return null;
        }

        // Get the flat navigation data
        const navigation = navComponent.navigation;

        // List of navigation items to update
        const navItems = [{ key: 'home', label: 'navbar.home' }];

        // Loop over each navigation item and update its title
        navItems.forEach((item) => {
            const navItem = this._fuseNavigationService.getItem(
                item.key,
                navigation
            );
            if (navItem) {
                this._translocoService
                    .selectTranslate(item.label)
                    .pipe(take(1))
                    .subscribe((translation) => {
                        // Set the title
                        navItem.title = translation;
                        // Refresh the navigation component
                        navComponent.refresh();
                    });
            }
        });
    }
}
