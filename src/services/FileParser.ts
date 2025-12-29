/**
 * FileParser service
 *
 * This class extracts Markdown headings from a document and computes their levels.
 *
 * Pattern explanation:
 *   - ^         : start of a line (with 'm' multiline flag)
 *   - #{1,6}    : one to six '#' characters (Markdown heading levels 1..6)
 *   -  (space)  : a single space after hashes (typical Markdown heading syntax)
 *   - .*        : the rest of the line (the heading text)
 *   - g         : global - find all matches
 *   - m         : multiline - ^ / $ match start/end of lines
 *
 * Title level:
 * - We determine the heading level by counting the number of leading '#' characters.
 **/
export class FileParser {
	// Match Markdown headings (levels 1..6) at the start of lines.
	pattern: RegExp = /^#{1,6} .*/gm

	/**
	 * Scan a document and return all headings with their levels.
	 * @param doc - full document text
	 * @returns array of objects: { title: string, level: number }
	 */
	getAllHeadingsWithLevels(doc: string): { title: string; level: number }[] {
		const results: { title: string; level: number }[] = []
		// Use matchAll to get all matches with global flag
		for (const match of doc.matchAll(this.pattern)) {
			const title = match[0] ?? ""
			// Extract leading hashes (e.g. "###") and count them to get the level
			const hashMatch = title.match(/^#{1,6}/)
			const level = hashMatch ? hashMatch[0].length : 0
			results.push({ title: title.trim(), level })
		}
		return results
	}
}
