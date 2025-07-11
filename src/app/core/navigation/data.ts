/* eslint-disable */
import { FuseNavigationItem } from '@fuse/components/navigation';

export const defaultNavigation: FuseNavigationItem[] = [
    {
        id: 'dashboards',
        title: 'Dashboards',
        subtitle: 'Unique dashboard designs',
        type: 'group',
        icon: 'heroicons_outline:home',
        children: [
            {
                id: 'dashboards.analytics',
                title: 'Analytics',
                type: 'basic',
                icon: 'heroicons_outline:chart-pie',
                link: '/dashboards/analytics',
            },
        ],
    },
    {
        id: 'users',
        title: 'Users',
        subtitle: 'Users management',
        type: 'group',
        children: [
            {
                id: 'admins',
                title: 'Admins',
                type: 'basic',
                icon: 'mat_solid:supervised_user_circle',
                link: '/users/admins',
            },
            {
                id: 'teachers',
                title: 'Teachers',
                type: 'basic',
                icon: 'heroicons_outline:academic-cap',
                link: '/users/teachers',
            },
            {
                id: 'students',
                title: 'Students',
                type: 'basic',
                icon: 'feather:users',
                link: '/users/students',
            },
        ],
    },
    {
        id: 'academic',
        title: 'Academic',
        subtitle: 'Academic management',
        type: 'group',
        children: [
            {
                id: 'academicYear',
                title: 'Academic Years',
                type: 'basic',
                icon: 'heroicons_solid:calendar',
                link: '/academic/academic-years',
            },
            {
                id: 'classrooms',
                title: 'Classrooms',
                type: 'basic',
                icon: 'heroicons_outline:academic-cap',
                link: '/academic/classrooms',
            },
            {
                id: 'subjects',
                title: 'Subjects',
                type: 'basic',
                icon: 'mat_solid:menu_book',
                link: '/academic/subjects',
            },
            {
                id: 'groups',
                title: 'Groups',
                type: 'basic',
                icon: 'mat_solid:groups',
                link: '/academic/groups',
            },
        ],
    },
];
export const compactNavigation: FuseNavigationItem[] = [
    {
        id: 'example',
        title: 'Example',
        type: 'basic',
        icon: 'heroicons_outline:chart-pie',
        link: '/example',
    },
];
export const futuristicNavigation: FuseNavigationItem[] = [
    {
        id: 'example',
        title: 'Example',
        type: 'basic',
        icon: 'heroicons_outline:chart-pie',
        link: '/example',
    },
];
export const horizontalNavigation: FuseNavigationItem[] = [
    {
        id: 'example',
        title: 'Git Interface',
        type: 'basic',
        icon: 'feather:github',
        link: '/example',
    },
    {
        id: 'view-grade',
        title: 'Grades',
        type: 'basic',
        icon: 'mat_outline:military_tech',
        link: '/view-grade',
    },
    {
        id: 'view-tasks',
        title: 'Tasks',
        type: 'basic',
        icon: 'feather:check-square',
        link: '/view-tasks',
    },
];
