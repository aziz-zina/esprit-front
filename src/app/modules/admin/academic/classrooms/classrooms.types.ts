import { AcademicYear } from "../academic-years/academic-years.types";

export interface Classroom {
    createdBy: string;
    lastModifiedBy: string;
    createdAt: string;
    updatedAt: string | null;
    version: number;
    id: string;
    name: string;
    academicYear: AcademicYear;
}

export interface AddClassroomRequest {
    name: string;
    academicYearId: string;
}

export interface UpdateClassroomRequest {
    id: string;
    name: string;
}
