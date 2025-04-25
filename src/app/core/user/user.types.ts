export interface User {
    createdAt?: string;
    createdBy?: string;
    dateOfBirth?: string;
    email: string;
    username: string;
    emailVerified?: boolean;
    enabled?: boolean;
    firstName?: string;
    profilePicture?: string;
    fullName?: string;
    id: string;
    lastModifiedBy?: string;
    lastName?: string;
    phoneNumber?: string;
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
