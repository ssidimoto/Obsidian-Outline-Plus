import { Heading, Itemhierarchy } from "datatypes/Heading";
import { HeadingNode } from "datatypes/HeadingsTree";

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
export const maxHeadingDepth = 6
export class FileParser {
	// Match Markdown headings (levels 1..6) at the start of lines.
	static pattern: RegExp = /^#{1,6} .*/gm

	/**
	 * Scan a document and return all headings with their levels.
	 * @param doc - full document text
	 * @returns array of objects: { headLine: string, level: number }
	 */
	static getAllHeadingsWithLevels(doc: string): { headLine: string; level: number }[] {
		const results: { headLine: string; level: number }[] = []
		// Use matchAll to get all matches with global flag
		for (const match of doc.matchAll(this.pattern)) {
			const headLine = match[0] ?? ""
			// Extract leading hashes (e.g. "###") and count them to get the level
			const hashMatch = headLine.match(/^#{1,6}/)
			const level = hashMatch ? hashMatch[0].length : 0
			results.push({ headLine: headLine.substring(level).trim(), level })
		}
		return results
	}

	static buildAllItemsNodes(inOrderHeadings: { headLine: string; level: number }[]): HeadingNode<Heading>[] {
		const multiLevellevel = Array(maxHeadingDepth).fill(0);
		let currDepth = 0;

		const itemArray: HeadingNode<Heading>[] = Array()
		inOrderHeadings.forEach((item) => {
			let arr_level = item.level -1

			if (currDepth == arr_level) {
				multiLevellevel[currDepth] += 1;
			}
			else if(currDepth < arr_level){
				multiLevellevel[arr_level] = 1
				currDepth = arr_level
			}
			else if(currDepth > arr_level){
				multiLevellevel.fill(0, arr_level + 1, maxHeadingDepth -1)
				multiLevellevel[arr_level] += 1
				currDepth = arr_level
			}
			let heading = new Heading(item.headLine, multiLevellevel.slice())
			let node = new HeadingNode(heading, currDepth)
			itemArray.push(node)
		});
		return itemArray
	}
}
