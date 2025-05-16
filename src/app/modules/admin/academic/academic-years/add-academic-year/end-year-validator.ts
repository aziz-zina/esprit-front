import { AbstractControl, ValidationErrors, ValidatorFn } from '@angular/forms';

export const endYearAfterStartYearValidator: ValidatorFn = (
    control: AbstractControl
): ValidationErrors | null => {
    const startYear = control.get('startYear')?.value;
    const endYear = control.get('endYear')?.value;

    if (startYear != null && endYear != null && endYear !== startYear + 1) {
        return { endYearNotOneYearAfter: true };
    }

    return null;
};
