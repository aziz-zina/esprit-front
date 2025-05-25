import { CommonModule } from '@angular/common';
import { Component, Inject, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { MatTabsModule } from '@angular/material/tabs';
import { CodemirrorModule } from '@ctrl/ngx-codemirror';
import * as CodeMirror from 'codemirror';

export interface ConflictResolverData {
    file: string;
    content: string;
    conflictMarkers: {
        start: number;
        separator: number;
        end: number;
    }[];
}

interface ConflictSection {
    id: number;
    startLine: number;
    separatorLine: number;
    endLine: number;
    currentContent: string;
    incomingContent: string;
    resolved: boolean;
    selectedSide: 'current' | 'incoming' | 'custom' | null;
    customContent?: string;
}

@Component({
    selector: 'app-conflict-resolver',
    standalone: true,
    imports: [
        CommonModule,
        FormsModule,
        MatButtonModule,
        MatCardModule,
        MatDialogModule,
        MatIconModule,
        MatTabsModule,
        CodemirrorModule,
    ],
    templateUrl: './conflict-resolver.component.html',
    styleUrls: ['./conflict-resolver.component.scss'],
})
export class ConflictResolverComponent implements OnInit {
    fileName: string;
    originalContent: string;
    conflictSections: ConflictSection[] = [];
    resolvedContent: string = '';
    allResolved = false;
    
    // CodeMirror options
    cmOptions: CodeMirror.EditorConfiguration = {
        lineNumbers: true,
        theme: 'material',
        mode: 'text/plain',
        readOnly: false,
        lineWrapping: true,
    };

    constructor(
        public dialogRef: MatDialogRef<ConflictResolverComponent>,
        @Inject(MAT_DIALOG_DATA) public data: ConflictResolverData
    ) {
        this.fileName = data.file;
        this.originalContent = data.content;
    }

    ngOnInit(): void {
        this.parseConflicts();
        this.updateCodeMirrorMode();
        this.generateResolvedContent();
    }

    private updateCodeMirrorMode(): void {
        const extension = this.fileName.split('.').pop()?.toLowerCase() || '';
        let mode = 'text/plain';

        switch (extension) {
            case 'js':
            case 'mjs':
            case 'cjs':
                mode = 'javascript';
                break;
            case 'ts':
                mode = 'text/typescript';
                break;
            case 'html':
            case 'htm':
                mode = 'xml';
                break;
            case 'css':
                mode = 'css';
                break;
            case 'scss':
            case 'sass':
                mode = 'text/x-scss';
                break;
            case 'json':
                mode = 'application/json';
                break;
            case 'md':
            case 'markdown':
                mode = 'markdown';
                break;
            case 'py':
                mode = 'python';
                break;
            case 'java':
                mode = 'text/x-java';
                break;
            case 'xml':
                mode = 'xml';
                break;
            case 'yaml':
            case 'yml':
                mode = 'yaml';
                break;
        }

        this.cmOptions = { ...this.cmOptions, mode };
    }

    private parseConflicts(): void {
        console.log('[ConflictResolver] Initializing parseConflicts...');
        console.log('[ConflictResolver] Original Content Lines:', this.originalContent.split('\n').length);
        console.log('[ConflictResolver] Received Conflict Markers:', JSON.stringify(this.data.conflictMarkers, null, 2));

        const lines = this.originalContent.split('\n');
        this.conflictSections = []; // Clear existing sections

        if (!this.data.conflictMarkers || this.data.conflictMarkers.length === 0) {
            console.warn('[ConflictResolver] No conflict markers provided or markers array is empty.');
            this.updateResolvedStatus(); // Ensure UI reflects no conflicts
            return;
        }

        this.data.conflictMarkers.forEach((marker, index) => {
            console.log(`[ConflictResolver] Processing marker ${index}: Start=${marker.start}, Separator=${marker.separator}, End=${marker.end}`);

            // Basic validation
            if (marker.start === undefined || marker.separator === undefined || marker.end === undefined) {
                console.error(`[ConflictResolver] Marker ${index} is missing line numbers. Skipping.`, marker);
                return;
            }
            if (marker.start < 0 || marker.separator < marker.start || marker.end < marker.separator) {
                console.error(`[ConflictResolver] Marker ${index} has invalid line numbers: Start=${marker.start}, Separator=${marker.separator}, End=${marker.end}. Skipping.`);
                return;
            }
            if (marker.end >= lines.length) {
                console.error(`[ConflictResolver] Marker ${index} end line ${marker.end} is out of bounds (total lines: ${lines.length}). Adjusting or skipping.`);
                // Potentially adjust marker.end or skip, depending on desired handling
                // For now, we'll skip to prevent errors, but this indicates an issue upstream.
                return;
            }

            // Validate marker content (optional, but good for sanity check)
            // if (!lines[marker.start].startsWith('<<<<<<<') || !lines[marker.separator].startsWith('=======') || !lines[marker.end].startsWith('>>>>>>>' )) {
            //     console.warn(`[ConflictResolver] Marker ${index} does not align with expected conflict patterns in content at lines S:${marker.start}, EQ:${marker.separator}, E:${marker.end}.`);
            //     // Decide if to proceed or skip
            // }

            const currentLines = lines.slice(marker.start + 1, marker.separator);
            const incomingLines = lines.slice(marker.separator + 1, marker.end);

            console.log(`[ConflictResolver] Marker ${index} - Current lines content:`, currentLines.join('\n'));
            console.log(`[ConflictResolver] Marker ${index} - Incoming lines content:`, incomingLines.join('\n'));

            this.conflictSections.push({
                id: index,
                startLine: marker.start,
                separatorLine: marker.separator,
                endLine: marker.end,
                currentContent: currentLines.join('\n'),
                incomingContent: incomingLines.join('\n'),
                resolved: false,
                selectedSide: null,
            });
            console.log(`[ConflictResolver] Successfully added section ${index} for marker.`);
        });

        console.log('[ConflictResolver] Finished parsing conflicts. Total sections created:', this.conflictSections.length);
        if (this.conflictSections.length === 0 && this.data.conflictMarkers.length > 0) {
            console.warn('[ConflictResolver] All markers were skipped or invalid. No conflict sections were created despite receiving markers.');
        }
        this.updateResolvedStatus(); // Update based on newly parsed sections
        this.generateResolvedContent(); // Regenerate content if needed
    }

    selectSide(sectionId: number, side: 'current' | 'incoming' | 'custom'): void {
        const section = this.conflictSections.find(s => s.id === sectionId);
        if (section) {
            section.selectedSide = side;
            section.resolved = side !== null;
            
            if (side === 'custom' && !section.customContent) {
                // Initialize custom content with current content
                section.customContent = section.currentContent;
            }
            
            this.updateResolvedStatus();
            this.generateResolvedContent();
        }
    }

    updateCustomContent(sectionId: number, content: string): void {
        const section = this.conflictSections.find(s => s.id === sectionId);
        if (section) {
            section.customContent = content;
            this.generateResolvedContent();
        }
    }

    private updateResolvedStatus(): void {
        this.allResolved = this.conflictSections.every(section => section.resolved);
    }

    private generateResolvedContent(): void {
        const lines = this.originalContent.split('\n');
        const resolvedLines: string[] = [];
        let currentIndex = 0;

        // Sort conflict sections by start line
        const sortedSections = [...this.conflictSections].sort((a, b) => a.startLine - b.startLine);

        for (const section of sortedSections) {
            // Add lines before this conflict
            resolvedLines.push(...lines.slice(currentIndex, section.startLine));

            // Add resolved content for this section
            if (section.resolved && section.selectedSide) {
                let contentToAdd = '';
                
                switch (section.selectedSide) {
                    case 'current':
                        contentToAdd = section.currentContent;
                        break;
                    case 'incoming':
                        contentToAdd = section.incomingContent;
                        break;
                    case 'custom':
                        contentToAdd = section.customContent || section.currentContent;
                        break;
                }
                
                if (contentToAdd) {
                    resolvedLines.push(...contentToAdd.split('\n'));
                }
            } else {
                // Keep original conflict if not resolved
                resolvedLines.push(...lines.slice(section.startLine, section.endLine + 1));
            }

            currentIndex = section.endLine + 1;
        }

        // Add remaining lines after the last conflict
        resolvedLines.push(...lines.slice(currentIndex));

        this.resolvedContent = resolvedLines.join('\n');
    }

    acceptResolution(): void {
        if (this.allResolved) {
            this.dialogRef.close(this.resolvedContent);
        }
    }

    cancelResolution(): void {
        this.dialogRef.close();
    }

    resetSection(sectionId: number): void {
        const section = this.conflictSections.find(s => s.id === sectionId);
        if (section) {
            section.resolved = false;
            section.selectedSide = null;
            section.customContent = undefined;
            this.updateResolvedStatus();
            this.generateResolvedContent();
        }
    }

    resetAll(): void {
        this.conflictSections.forEach(section => {
            section.resolved = false;
            section.selectedSide = null;
            section.customContent = undefined;
        });
        this.updateResolvedStatus();
        this.generateResolvedContent();
    }    getConflictPreview(section: ConflictSection): string {
        const currentPreview = section.currentContent.substring(0, 100);
        const incomingPreview = section.incomingContent.substring(0, 100);
        return `Current: ${currentPreview}${section.currentContent.length > 100 ? '...' : ''}\n---\nIncoming: ${incomingPreview}${section.incomingContent.length > 100 ? '...' : ''}`;
    }

    getResolvedCount(): number {
        return this.conflictSections.filter(s => s.resolved).length;
    }

    getUnresolvedCount(): number {
        return this.conflictSections.filter(s => !s.resolved).length;
    }
}
