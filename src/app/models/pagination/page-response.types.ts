/* eslint-disable */

import { SortDirection } from '../enums';

export interface Page<T> {
    content?: Array<T>;
    currentPage?: number;
    isEmpty?: boolean;
    isFirst?: boolean;
    isLast?: boolean;
    pageSize?: number;
    sortInfo?: SortInfo;
    totalElements?: number;
    totalPages?: number;
}

export interface SortInfo {
    direction?: SortDirection;
    sorted?: boolean;
    unsorted?: boolean;
}
