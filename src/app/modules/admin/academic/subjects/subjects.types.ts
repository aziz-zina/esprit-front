import { User } from '@core/user/user.types';
import { Classroom } from '../classrooms/classrooms.types';

export interface Subject {
    createdBy: string;
    lastModifiedBy: string;
    createdAt: string;
    updatedAt: string | null;
    version: number;
    id: string;
    name: string;
    teacher: User;
    classroom: Classroom;
    groupMarkPercentage: number;
    individualMarkPercentage: number;
}

export interface AddSubjectRequest {
    name: string;
    classroomId: string;
    teacherId: string;
    groupMarkPercentage: number;
    individualMarkPercentage: number;
}

export interface UpdateSubjectRequest {
    id: string;
    name: string;
    groupMarkPercentage: number;
    individualMarkPercentage: number;
}
