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
    students: User[];
    repositories: RepositoryContent[];
}

export interface AddGroupRequest {
    name: string;
    subjectId: string;
    students?: string[];
}
