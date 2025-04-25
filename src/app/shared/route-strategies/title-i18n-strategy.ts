import { Injectable } from '@angular/core';
import { Title } from '@angular/platform-browser';
import { RouterStateSnapshot, TitleStrategy } from '@angular/router';
import { TranslocoService } from '@jsverse/transloco';
import { filter, take } from 'rxjs';

/**
 * Custom title strategy that updates the title of the page with a translated value.
 * Example Usage:
 * {
 *  path: 'home',
 *  component: HomeComponent,
 *  title: 'home.title' // the key to be translated
 * }
 */

@Injectable({ providedIn: 'root' })
export class TranslateTitleStrategy extends TitleStrategy {
    constructor(
        private readonly title: Title,
        private readonly transloco: TranslocoService
    ) {
        super();
    }

    override updateTitle(snapshot: RouterStateSnapshot): void {
        const titleKey = this.buildTitle(snapshot);
        if (titleKey) {
            this.transloco
                .selectTranslate<string>(titleKey)
                .pipe(
                    filter((translatedTitle) => translatedTitle !== titleKey), // only continue if a translation exists
                    take(1)
                )
                .subscribe((translatedTitle) =>
                    this.title.setTitle(translatedTitle)
                );
        }
    }
}
