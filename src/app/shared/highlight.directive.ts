// src/app/highlight.directive.ts
import { Directive, ElementRef, inject, Input, OnChanges } from '@angular/core';
import hljs from 'highlight.js/lib/core';

// Import the languages you want to support to reduce bundle size.
// If you need all languages, you can just `import hljs from 'highlight.js';`
// but it will result in a larger bundle.
import bash from 'highlight.js/lib/languages/bash';
import csharp from 'highlight.js/lib/languages/csharp';
import css from 'highlight.js/lib/languages/css';
import java from 'highlight.js/lib/languages/java';
import javascript from 'highlight.js/lib/languages/javascript';
import json from 'highlight.js/lib/languages/json';
import markdown from 'highlight.js/lib/languages/markdown';
import plaintext from 'highlight.js/lib/languages/plaintext'; // For unknown or plain text files
import python from 'highlight.js/lib/languages/python';
import typescript from 'highlight.js/lib/languages/typescript';
import xml from 'highlight.js/lib/languages/xml'; // Covers HTML, XML, SVG
import yaml from 'highlight.js/lib/languages/yaml';

// Register the languages you imported
hljs.registerLanguage('javascript', javascript);
hljs.registerLanguage('typescript', typescript);
hljs.registerLanguage('html', xml);
hljs.registerLanguage('css', css);
hljs.registerLanguage('json', json);
hljs.registerLanguage('markdown', markdown);
hljs.registerLanguage('python', python);
hljs.registerLanguage('java', java);
hljs.registerLanguage('csharp', csharp);
hljs.registerLanguage('yaml', yaml);
hljs.registerLanguage('bash', bash);
hljs.registerLanguage('plaintext', plaintext);

@Directive({
    selector: '[appHighlight]', // Directive will be applied using `appHighlight` attribute
    standalone: true, // Mark as standalone for Angular 15+
})
export class HighlightDirective implements OnChanges {
    @Input('appHighlight') code!: string | null; // The code content to highlight
    @Input() fileExtension?: string | null; // Optional: file extension for better language detection
    private readonly el = inject(ElementRef);

    ngOnChanges(): void {
        // Clear content if no code is provided or it's explicitly null/undefined
        if (this.code === null || this.code === undefined) {
            this.el.nativeElement.innerHTML = '';
            this.el.nativeElement.classList.remove('hljs');
            return;
        }

        // Handle the special case for binary/unreadable content message
        if (this.code === '(Binary or unreadable content)') {
            this.el.nativeElement.textContent = this.code; // Use textContent to display as plain text
            this.el.nativeElement.classList.remove('hljs'); // Ensure no highlighting classes
            return;
        }

        let language: string | undefined;
        // Try to guess language from file extension
        if (this.fileExtension) {
            const ext = this.fileExtension.toLowerCase();
            switch (ext) {
                case 'js':
                case 'jsx':
                    language = 'javascript';
                    break;
                case 'ts':
                case 'tsx':
                    language = 'typescript';
                    break;
                case 'html':
                case 'xml':
                case 'svg':
                    language = 'html';
                    break;
                case 'css':
                    language = 'css';
                    break;
                case 'json':
                    language = 'json';
                    break;
                case 'md':
                case 'markdown':
                    language = 'markdown';
                    break;
                case 'py':
                    language = 'python';
                    break;
                case 'java':
                    language = 'java';
                    break;
                case 'cs':
                    language = 'csharp';
                    break;
                case 'yml':
                case 'yaml':
                    language = 'yaml';
                    break;
                case 'sh':
                case 'bash':
                    language = 'bash';
                    break;
                default:
                    language = 'plaintext';
                    break; // Fallback for unmapped extensions
            }
        }

        try {
            let highlightedCode: string;
            if (language && hljs.getLanguage(language)) {
                // Highlight with the guessed language if available
                highlightedCode = hljs.highlight(this.code, {
                    language: language,
                }).value;
            } else {
                // Fallback to auto-detection if language not found or not specified
                highlightedCode = hljs.highlightAuto(this.code).value;
            }
            this.el.nativeElement.innerHTML = highlightedCode;
            this.el.nativeElement.classList.add('hljs'); // Add the default highlight.js class for styling
        } catch (e) {
            console.error('Highlight.js error:', e);
            // If highlighting fails, display as plain text
            this.el.nativeElement.textContent = this.code;
            this.el.nativeElement.classList.remove('hljs');
        }
    }
}
