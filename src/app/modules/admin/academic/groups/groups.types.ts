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
    nbRepositories?: number;
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
    tasks?: Task[];
}

export interface GroupStudentDto {
    id: string;
    group: Group;
    student: User;
    mark?: number;
    comment?: string;
    tasks?: Task[];
}

export interface Task {
    id: string;
    description: string;
    dueDate: string;
    createdBy: string;
    lastModifiedBy: string;
    createdAt: string;
    updatedAt: string | null;
    version: number;
    mark: number;
    done: boolean;
    comment: string;
    branchLink: string;
}

export interface AddTaskRequest {
    description: string;
    dueDate: string;
    groupStudentId: string;
}
