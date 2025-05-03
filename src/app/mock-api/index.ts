import { inject, Injectable } from '@angular/core';

import { NavigationMockApi } from '@core/navigation/api';
import { NotificationsMockApi } from 'app/mock-api/common/notifications/api';

import { AnalyticsMockApi } from 'app/mock-api/dashboards/analytics/api';
import { CryptoMockApi } from 'app/mock-api/dashboards/crypto/api';
import { FinanceMockApi } from 'app/mock-api/dashboards/finance/api';
import { ProjectMockApi } from 'app/mock-api/dashboards/project/api';

@Injectable({ providedIn: 'root' })
export class MockApiService {
    analyticsMockApi = inject(AnalyticsMockApi);
    cryptoMockApi = inject(CryptoMockApi);
    financeMockApi = inject(FinanceMockApi);
    navigationMockApi = inject(NavigationMockApi);
    notificationsMockApi = inject(NotificationsMockApi);
    projectMockApi = inject(ProjectMockApi);
}
