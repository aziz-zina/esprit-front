export interface User {
    id: string;
    createdAt?: string;
    createdBy?: string;
    email: string;
    username: string;
    emailVerified?: boolean;
    enabled?: boolean;
    firstName?: string;
    profilePicture?: string;
    fullName?: string;
    // locale: LocaleType;
    lastModifiedBy?: string;
    lastName?: string;
    phoneNumber?: string;
    // roles?: RoleType[];
    notificationPreference?: string;
    updatedAt?: string;
    version?: number;
}

export interface UpdateAccount {
    id: string;
    firstName: string;
    lastName: string;
    gender: string;
    dateOfBirth: string;
    phoneNumber: string;
    position: string;
    country: string;
    address: string;
}
