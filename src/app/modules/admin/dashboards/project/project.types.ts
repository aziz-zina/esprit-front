export interface Contributor {
    name: string;
    email: string;
    commitCount: number;
}

export interface Branch {
    name: string;
    latestCommitHash: string;
    latestCommitMessage: string;
    latestCommitAuthor: string;
    latestCommitDate: string;
}

export interface Commit {
    hash: string;
    shortMessage: string;
    fullMessage: string;
    authorName: string;
    authorEmail: string;
    committerName: string;
    committerEmail: string;
    commitDate: string;
}

export interface ProjectStats {
    createdBy: string | null;
    lastModifiedBy: string | null;
    createdAt: string | null;
    updatedAt: string | null;
    version: string | null;
    repositoryName: string;
    totalCommits: number;
    totalBranches: number;
    totalTags: number;
    lastCommitDate: string;
    lastCommitAuthor: string;
    contributors: Contributor[];
    branches: Branch[];
    dailyNewCommits: { [date: string]: number };
    dailyMergedCommits: { [date: string]: number };
}
