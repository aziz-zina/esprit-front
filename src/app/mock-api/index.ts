import { inject, Injectable } from '@angular/core';

import { NavigationMockApi } from '@core/navigation/api';
import { NotificationsMockApi } from 'app/mock-api/common/notifications/api';
import { AnalyticsMockApi } from './common/dashboards/analytics/api';

@Injectable({ providedIn: 'root' })
export class MockApiService {
    analyticsMockApi = inject(AnalyticsMockApi);
    navigationMockApi = inject(NavigationMockApi);
    notificationsMockApi = inject(NotificationsMockApi);
}
