import { SortDirectionType } from '../common/enums';

export interface PaginationParams {
    page: number;
    size: number;
    sort: string;
    search: string;
    sortDirection: SortDirectionType;
}
