import { Heading, htmlHeading } from "datatypes/Heading";
import { HeadingNode } from "datatypes/HeadingsTree";
import { UiHelper } from "./UiHelper";

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
 * Title depth:
 * - We determine the heading depth by counting the number of leading '#' characters.
 **/
export const maxHeadingDepth = 6
export class FileParser {
	// Match Markdown headings (levels 1..6) at the start of lines.
	static pattern: RegExp = /^#{1,6} .*/gm

	/**
	 * Scan a document and return all headings with their levels.
	 * @param doc - full document text
	 * @returns array of objects: { headLine: string, depth: number }
	 */
	static getAllHeadingsWithLevels(doc: string): { headLine: string; depth: number }[] {
		const results: { headLine: string; depth: number }[] = []
		// Use matchAll to get all matches with global flag
		for (const match of doc.matchAll(this.pattern)) {
			const headLine = match[0] ?? ""
			// Extract leading hashes (e.g. "###") and count them to get the depth
			const hashMatch = headLine.match(/^#{1,6}/)
			const depth = hashMatch ? hashMatch[0].length : 0
			results.push({ headLine: headLine.substring(depth).trim(), depth })
		}
		return results
	}

	static buildAllItemsNodes(inOrderHeadings: { headLine: string; depth: number }[]): HeadingNode[] {
		const multiLevellevel = Array(maxHeadingDepth).fill(0);
		let currDepth = 0;

		const itemArray: HeadingNode[] = Array()
		inOrderHeadings.forEach((item) => {
			let arr_level = item.depth -1

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
			let uiElem = UiHelper.createHTMLHeading(item.headLine, item.depth)
			let heading = new Heading(item.headLine, multiLevellevel.slice(), uiElem)
			let node = new HeadingNode(heading, currDepth)
			itemArray.push(node)
		});
		return itemArray
	}
	
	static BuildAllHeadingItem(doc: string){
		let headingObj = this.getAllHeadingsWithLevels(doc)
    	return this.buildAllItemsNodes(headingObj)
	}

	
}
