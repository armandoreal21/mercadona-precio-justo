import { Pipe, PipeTransform } from '@angular/core';

/**
 * Pipe to attempt fixing mojibake produced when UTF-8 bytes were interpreted as Latin1.
 * Usage: {{ text | fixMojibake }}
 */
@Pipe({
 name: 'fixMojibake',
 standalone: true
})
export class FixMojibakePipe implements PipeTransform {
 transform(value: string | null | undefined): string | null {
 if (!value) return value || null;
 // fast heuristic: only try when we see typical sequences
 if (!/[\u00C2\u00C3]/.test(value)) return value;
 try {
 const bytes = Uint8Array.from(Array.from(value).map(ch => ch.charCodeAt(0)));
 const decoded = new TextDecoder('utf-8').decode(bytes);
 if (decoded.includes('\uFFFD')) return value;
 return decoded;
 } catch {
 return value;
 }
 }
}
