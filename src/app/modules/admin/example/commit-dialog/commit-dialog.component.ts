// src/app/modules/admin/example/commit-dialog/commit-dialog.component.ts
import { TextFieldModule } from '@angular/cdk/text-field';
import { CommonModule } from '@angular/common';
import { Component, Inject, OnInit, Optional } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import {
    MAT_DIALOG_DATA,
    MatDialogModule,
    MatDialogRef,
} from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';

// Interface for the data passed into the dialog
export interface CommitDialogData {
    title: string;
    messageLabel: string;
    initialMessage?: string;
    // Function provided by the parent to generate the suggestion
    // It returns a Promise that resolves with the suggested string or rejects on error
    generateSuggestion?: () => Promise<string>;
}

@Component({
    selector: 'app-commit-dialog',
    standalone: true, // <-- Make sure standalone is intended and imports are correct
    imports: [
        CommonModule,
        FormsModule,
        MatDialogModule,
        MatFormFieldModule,
        MatInputModule,
        MatButtonModule,
        MatProgressSpinnerModule,
        MatIconModule,
        TextFieldModule,
    ],
    templateUrl: './commit-dialog.component.html',
    // styleUrls: ['./commit-dialog.component.css'] // Add if you have specific styles
})
export class CommitDialogComponent implements OnInit {
    commitMessage: string = '';
    title: string = 'Commit Changes';
    messageLabel: string = 'Enter commit message:';
    isGenerating: boolean = false;
    generationError: string | null = null;
    canGenerate: boolean = false; // <-- Will be set based on passed function

    constructor(
        public dialogRef: MatDialogRef<CommitDialogComponent>,
        @Optional() @Inject(MAT_DIALOG_DATA) public data: CommitDialogData
    ) {
        this.title = data?.title ?? this.title;
        this.messageLabel = data?.messageLabel ?? this.messageLabel;
        this.commitMessage = data?.initialMessage ?? '';
        // Determine if generation is possible based on the presence of the function
        this.canGenerate = typeof data?.generateSuggestion === 'function';
    }

    ngOnInit(): void {
        // Pre-fill message if provided
        if (this.data?.initialMessage) {
            this.commitMessage = this.data.initialMessage;
        }
    }

    async generateMessage(): Promise<void> {
        // Ensure the function exists and we're not already generating
        if (!this.data?.generateSuggestion || this.isGenerating) {
            return;
        }

        this.isGenerating = true;
        this.generationError = null;
        console.log('Requesting commit message generation via callback...');

        try {
            // Call the function passed from the parent component
            const suggestedMessage = await this.data.generateSuggestion();
            this.commitMessage = suggestedMessage; // Update the textarea
            console.log('Suggestion received:', suggestedMessage);
        } catch (error: any) {
            console.error('Error generating commit message:', error);
            // Display a user-friendly error message
            this.generationError = `Failed to generate suggestion: ${error?.message || 'Unknown error'}`;
        } finally {
            this.isGenerating = false;
        }
    }

    onCancel(): void {
        this.dialogRef.close(); // Close without returning data
    }

    onConfirm(): void {
        if (this.commitMessage?.trim()) {
            this.dialogRef.close(this.commitMessage.trim());
        } else {
            console.warn('Commit message is empty.');
            // Optionally set an error state on the form field instead of just logging
        }
    }
}
