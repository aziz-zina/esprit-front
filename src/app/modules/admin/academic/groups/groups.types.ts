import { User } from '@core/user/user.types';
import { RepositoryContent } from '../../dashboards/project/project.types';
import { Subject } from '../subjects/subjects.types';

export interface Group {
    id: string;
    createdBy: string;
    lastModifiedBy: string;
    createdAt: string;
    updatedAt: string | null;
    version: number;
    name: string;
    subject: Subject;
    students: GroupStudent[];
    repositories: RepositoryContent[];
    mark?: number;
    comment?: string;
}

export interface AddGroupRequest {
    name: string;
    subjectId: string;
    students?: string[];
}

export interface GroupMarkDto {
    mark: number;
    comment?: string;
}

export interface StudentMarkDto {
    mark: number;
    comment?: string;
}

export interface GroupStudent {
    id: string;
    student: User;
    individualMark?: number;
    individualComment?: string;
    finalMark?: number;
}

export interface GroupStudentDto {
    id: string;
    groupId: string;
    studentId: string;
    mark?: number;
    comment?: string;
}
