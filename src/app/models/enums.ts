/**
 * A TypeScript type that represents the possible values of the `Theme` object.
 *
 * Explanation:
 * 1. `typeof Theme`: Gets the type of the `Theme` object, which is:
 *    ```typescript
 *    {
 *        readonly LIGHT: 'light';
 *        readonly DARK: 'dark';
 *    }
 *    ```
 *
 * 2. `keyof typeof Theme`: Extracts the keys of the `Theme` object as a union of string literals:
 *    ```typescript
 *    'LIGHT' | 'DARK'
 *    ```
 *
 * 3. `(typeof Theme)[keyof typeof Theme]`: Uses the keys (`'LIGHT' | 'DARK'`) to access the corresponding values in the `Theme` object:
 *    ```typescript
 *    'light' | 'dark'
 *    ```
 *
 * This type dynamically matches the values of the `Theme` object and ensures consistency.
 * If you add or change values in `Theme`, `ThemeType` will automatically update.
 */
export const ThemeEnum = {
    LIGHT: 'light',
    DARK: 'dark',
} as const;
export type Theme = (typeof ThemeEnum)[keyof typeof ThemeEnum];

export const SortDirectionEnum = {
    ASC: 'ASC',
    DESC: 'DESC',
} as const;
export type SortDirection =
    (typeof SortDirectionEnum)[keyof typeof SortDirectionEnum];

export const GenderEnum = {
    MALE: 'MALE',
    FEMALE: 'FEMALE',
} as const;
export type Gender = (typeof GenderEnum)[keyof typeof GenderEnum];

export const RoleEnum = {
    ADMIN: 'admin',
    TEACHER: 'teacher',
    STUDENT: 'student',
} as const;
export type Role = (typeof RoleEnum)[keyof typeof RoleEnum];

export const LocaleEnum = {
    EN: 'EN',
    FR: 'fr',
} as const;
export type Locale = (typeof LocaleEnum)[keyof typeof LocaleEnum];
