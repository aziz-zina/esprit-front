import { Injectable } from '@angular/core';
import { PreloadingStrategy, Route } from '@angular/router';

import { Observable, of } from 'rxjs';

/**
 * Custom preloading strategy that preloads modules based on a flag in the route data.
 * The flag is set in the route configuration.
 * If the flag is set to true, the module is preloaded.
 * Usage:
 * 
 *  {
        path: 'saha-info',
        loadChildren: () => import('app/modules/user/saha-info/saha-info.routes'),
        data: {
             preload: true,            
        },
  }
 */

@Injectable({ providedIn: 'root' })
export class FlagBasedPreloadingStrategy extends PreloadingStrategy {
    preload(
        route: Route,
        load: () => Observable<unknown>
    ): Observable<unknown> {
        return route.data?.['preload'] === true ? load() : of(null);
    }
}
