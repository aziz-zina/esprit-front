import { Direction, Directionality } from '@angular/cdk/bidi';
import { DOCUMENT } from '@angular/common';
import { computed, inject, Injectable, signal } from '@angular/core';

/**
 * Service to manage application directionality (LTR/RTL)
 *
 * @example
 * ```typescript
 * @Component({
 *   selector: 'app-my-component',
 *   template: `
 *     <div [class.rtl-specific-style]="isRtl()">
 *       {{ isRtl() ? 'Right to Left' : 'Left to Right' }}
 *     </div>
 *   `
 * })
 * export class MyComponent {
 *   private readonly appDir = inject(AppDirectionality);
 *   readonly isRtl = computed(() => this.appDir.isRtl());
 * }
 * ```
 */
@Injectable({
    providedIn: 'root',
})
export class AppDirectionality {
    private readonly document = inject(DOCUMENT);
    private readonly dir = inject(Directionality);
    private readonly htmlElement = this.document.querySelector('html')!;

    /** Signal holding the current direction state */
    private readonly _direction = signal<Direction>('ltr');

    /**
     * Computed signal that indicates if the current direction is RTL
     * @returns boolean - True if direction is RTL, false otherwise
     */
    readonly isRtl = computed(() => this._direction() === 'rtl');

    constructor() {
        // Subscribe to direction changes from Angular Material's Directionality
        this.dir.change.subscribe((dir) => {
            this._direction.set(dir);
            this.htmlElement.dir = dir;
        });
    }

    /**
     * Sets the application's direction
     * @param value - The direction to set ('ltr' or 'rtl')
     */
    set direction(value: Direction) {
        this.dir.change.emit(value || 'ltr');
        this._direction.set(value || 'ltr');
        this.htmlElement.dir = value || 'ltr';
    }
}
