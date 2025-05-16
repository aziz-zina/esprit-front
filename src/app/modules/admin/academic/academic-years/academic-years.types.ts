export interface AcademicYear {
    createdBy: string;
    lastModifiedBy: string;
    createdAt: string;
    updatedAt: string | null;
    version: number;
    id: string;
    startYear: number;
    endYear: number;
}

export interface AddAcademicYearRequest {
    startYear: number;
    endYear: number;
}

export interface UpdateAcademicYearRequest {
    id: string;
    startYear: number;
    endYear: number;
}
