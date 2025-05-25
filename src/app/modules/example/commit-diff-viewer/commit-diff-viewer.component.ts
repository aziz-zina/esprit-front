import { CommonModule } from '@angular/common';
import { Component, inject, Input, OnInit, NgZone } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatDialog } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSelectModule } from '@angular/material/select';
import { MatTabsModule } from '@angular/material/tabs';
import FS from '@isomorphic-git/lightning-fs';
import * as git from 'isomorphic-git';

export interface GitLogEntry {
    oid: string;
    commit: {
        message: string;
        author: {
            name: string;
            email: string;
            timestamp: number;
        };
        committer: {
            name: string;
            email: string;
            timestamp: number;
        };
    };
}

export interface DiffEntry {
    file: string;
    status: 'added' | 'deleted' | 'modified';
    oldContent?: string;
    newContent?: string;
    diff?: string;
}

@Component({
    selector: 'app-commit-diff-viewer',
    standalone: true,
    imports: [
        CommonModule,
        MatButtonModule,
        MatCardModule,
        MatIconModule,
        MatProgressSpinnerModule,
        MatSelectModule,
        MatTabsModule,
    ],
    templateUrl: './commit-diff-viewer.component.html',
    styleUrls: ['./commit-diff-viewer.component.scss'],
})
export class CommitDiffViewerComponent implements OnInit {
    private readonly _ngZone = inject(NgZone);

    @Input() fs!: FS;
    @Input() dir!: string;
    @Input() commitHistory: GitLogEntry[] = [];

    // Selected commits for comparison
    commit1: GitLogEntry | null = null;
    commit2: GitLogEntry | null = null;

    // Diff data
    isLoading = false;
    diffEntries: DiffEntry[] = [];
    selectedFile: DiffEntry | null = null;
    error: string | null = null;

    ngOnInit(): void {
        // Auto-select the first two commits if available
        if (this.commitHistory.length >= 2) {
            this.commit1 = this.commitHistory[1]; // Older commit
            this.commit2 = this.commitHistory[0]; // Newer commit
            this.compareCommits();
        }
    }

    async compareCommits(): Promise<void> {
        if (!this.commit1 || !this.commit2 || !this.fs) {
            return;
        }

        this._ngZone.run(() => {
            this.isLoading = true;
            this.error = null;
            this.diffEntries = [];
            this.selectedFile = null;
        });

        try {
            const diffs = await this.calculateDiff(this.commit1.oid, this.commit2.oid);
            
            this._ngZone.run(() => {
                this.diffEntries = diffs;
                if (diffs.length > 0) {
                    this.selectedFile = diffs[0];
                }
            });
        } catch (error: any) {
            console.error('Error comparing commits:', error);
            this._ngZone.run(() => {
                this.error = `Failed to compare commits: ${error.message || error}`;
            });
        } finally {
            this._ngZone.run(() => {
                this.isLoading = false;
            });
        }
    }

    private async calculateDiff(commit1Oid: string, commit2Oid: string): Promise<DiffEntry[]> {
        const diffs: DiffEntry[] = [];

        try {
            // Get the tree for each commit
            const [tree1, tree2] = await Promise.all([
                git.listFiles({ fs: this.fs, dir: this.dir, ref: commit1Oid }),
                git.listFiles({ fs: this.fs, dir: this.dir, ref: commit2Oid }),
            ]);

            // Find all unique files
            const allFiles = new Set([...tree1, ...tree2]);

            for (const file of allFiles) {
                const inTree1 = tree1.includes(file);
                const inTree2 = tree2.includes(file);

                let status: DiffEntry['status'];
                let oldContent: string | undefined;
                let newContent: string | undefined;

                if (!inTree1 && inTree2) {
                    // File was added
                    status = 'added';
                    newContent = await this.getFileContent(commit2Oid, file);
                } else if (inTree1 && !inTree2) {
                    // File was deleted
                    status = 'deleted';
                    oldContent = await this.getFileContent(commit1Oid, file);
                } else {
                    // File exists in both, check if modified
                    [oldContent, newContent] = await Promise.all([
                        this.getFileContent(commit1Oid, file),
                        this.getFileContent(commit2Oid, file),
                    ]);

                    if (oldContent !== newContent) {
                        status = 'modified';
                    } else {
                        // File unchanged, skip
                        continue;
                    }
                }

                const diff = this.generateUnifiedDiff(file, oldContent || '', newContent || '');

                diffs.push({
                    file,
                    status,
                    oldContent,
                    newContent,
                    diff,
                });
            }
        } catch (error) {
            console.error('Error calculating diff:', error);
            throw error;
        }

        return diffs.sort((a, b) => a.file.localeCompare(b.file));
    }

    private async getFileContent(commitOid: string, filepath: string): Promise<string> {
        try {
            const result = await git.readObject({
                fs: this.fs,
                dir: this.dir,
                oid: commitOid,
                filepath,            });

            if (result.type === 'blob' && result.object instanceof Uint8Array) {
                return new TextDecoder('utf-8').decode(result.object);
            }
            return '';
        } catch (error) {
            console.warn(`Could not read file ${filepath} from commit ${commitOid}:`, error);
            return '';
        }
    }

    private generateUnifiedDiff(filename: string, oldContent: string, newContent: string): string {
        const oldLines = oldContent.split('\n');
        const newLines = newContent.split('\n');
        
        // Simple line-by-line diff generation
        const diff: string[] = [];
        diff.push(`--- a/${filename}`);
        diff.push(`+++ b/${filename}`);
        
        let oldIndex = 0;
        let newIndex = 0;
        
        while (oldIndex < oldLines.length || newIndex < newLines.length) {
            const oldLine = oldLines[oldIndex];
            const newLine = newLines[newIndex];
            
            if (oldIndex >= oldLines.length) {
                // Only new lines remaining
                diff.push(`+${newLine || ''}`);
                newIndex++;
            } else if (newIndex >= newLines.length) {
                // Only old lines remaining
                diff.push(`-${oldLine || ''}`);
                oldIndex++;
            } else if (oldLine === newLine) {
                // Lines are the same
                diff.push(` ${oldLine || ''}`);
                oldIndex++;
                newIndex++;
            } else {
                // Lines are different - simple approach: mark as removed and added
                diff.push(`-${oldLine || ''}`);
                diff.push(`+${newLine || ''}`);
                oldIndex++;
                newIndex++;
            }
        }
        
        return diff.join('\n');
    }

    selectFile(file: DiffEntry): void {
        this.selectedFile = file;
    }

    getStatusIcon(status: DiffEntry['status']): string {
        switch (status) {
            case 'added':
                return 'add_circle';
            case 'deleted':
                return 'remove_circle';
            case 'modified':
                return 'edit';
            default:
                return 'help';
        }
    }

    getStatusColor(status: DiffEntry['status']): string {
        switch (status) {
            case 'added':
                return 'text-green-600';
            case 'deleted':
                return 'text-red-600';
            case 'modified':
                return 'text-blue-600';
            default:
                return 'text-gray-600';
        }
    }

    getStatusText(status: DiffEntry['status']): string {
        switch (status) {
            case 'added':
                return 'Added';
            case 'deleted':
                return 'Deleted';
            case 'modified':
                return 'Modified';
            default:
                return 'Unknown';
        }
    }

    formatCommitMessage(message: string): string {
        return message.split('\n')[0]; // First line only
    }

    formatDate(timestamp: number): string {
        return new Date(timestamp * 1000).toLocaleString();
    }

    parseDiffLine(line: string): { type: 'add' | 'remove' | 'context'; content: string } {
        if (line.startsWith('+')) {
            return { type: 'add', content: line.substring(1) };
        } else if (line.startsWith('-')) {
            return { type: 'remove', content: line.substring(1) };
        } else {
            return { type: 'context', content: line.startsWith(' ') ? line.substring(1) : line };
        }
    }    isDiffHeaderLine(line: string): boolean {
        return line.startsWith('---') || line.startsWith('+++') || line.startsWith('@@');
    }

    getAddedCount(): number {
        return this.diffEntries.filter(d => d.status === 'added').length;
    }

    getModifiedCount(): number {
        return this.diffEntries.filter(d => d.status === 'modified').length;
    }

    getDeletedCount(): number {
        return this.diffEntries.filter(d => d.status === 'deleted').length;
    }
}
