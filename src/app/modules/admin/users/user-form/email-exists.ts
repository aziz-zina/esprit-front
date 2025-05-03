import { AbstractControl, AsyncValidatorFn } from '@angular/forms';
import { UserService } from '@core/user/user.service';
import { catchError, map, of } from 'rxjs';

export function emailExistsValidator(userService: UserService): AsyncValidatorFn {
    return (control: AbstractControl) => {
        if (!control.value) {
            return of(null);
        }
        return userService.checkEmailExists(control.value).pipe(
            map((exists) => (exists ? { emailExists: true } : null)),
            catchError(() => of(null))
        );
    };
}
