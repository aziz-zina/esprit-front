import { MatPaginatorIntl } from '@angular/material/paginator';
import { TranslocoService } from '@jsverse/transloco';

export class PaginatorI18nService extends MatPaginatorIntl {
    constructor(private readonly transloco: TranslocoService) {
        super();

        this.transloco.langChanges$.subscribe(() => {
            this.updateLabels();
            this.changes.next();
        });

        this.updateLabels();
    }

    updateLabels() {
        this.transloco
            .selectTranslate('paginator.items-per-page')
            .subscribe((translatedValue) => {
                this.itemsPerPageLabel = translatedValue;
            });
        this.transloco
            .selectTranslate('paginator.next-page')
            .subscribe((translatedValue) => {
                this.nextPageLabel = translatedValue;
            });
        this.transloco
            .selectTranslate('paginator.previous-page')
            .subscribe((translatedValue) => {
                this.previousPageLabel = translatedValue;
            });
        this.transloco
            .selectTranslate('paginator.first-page')
            .subscribe((translatedValue) => {
                this.firstPageLabel = translatedValue;
            });
        this.transloco
            .selectTranslate('paginator.last-page')
            .subscribe((translatedValue) => {
                this.lastPageLabel = translatedValue;
            });
        this.transloco
            .selectTranslate('paginator.of')
            .subscribe((translatedValue) => {
                this.getRangeLabel = this.rangeLabel(translatedValue);
            });
    }

    rangeLabel =
        (ofTranslation: string) =>
        (page: number, pageSize: number, length: number) => {
            if (length == 0 || pageSize == 0) {
                return `0 ${ofTranslation} ${length}`;
            }

            length = Math.max(length, 0);

            const startIndex = page * pageSize;

            const endIndex =
                startIndex < length
                    ? Math.min(startIndex + pageSize, length)
                    : startIndex + pageSize;

            return `${startIndex + 1} - ${endIndex} ${ofTranslation} ${length}`;
        };
}
