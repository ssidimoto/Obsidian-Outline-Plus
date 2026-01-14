import { Heading, htmlHeading } from "datatypes/Heading";
import { HeadingNode } from "datatypes/HeadingsTree";
import { UiHelper } from "./UiHelper";
import { App, Editor } from "obsidian";

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
	workspace: App
	uiHelper: UiHelper

	constructor(workspace: App, uiHelper: UiHelper){
		this.workspace = workspace
		this.uiHelper = uiHelper
	}
	// Match Markdown headings (levels 1..6) at the start of lines.
	static pattern: RegExp = /^#{1,6} .*/gm

	/**
	 * Scan a document and return all headings with their levels.
	 * @param doc - full document text
	 * @returns array of objects: { headLine: string, depth: number }
	 */
	getAllHeadingsWithLevels(doc: string): { headLine: string; depth: number; lineNbr: number }[] {
		const results: { headLine: string; depth: number; lineNbr: number }[] = [];
		const lines = doc.split('\n');  // Split once: O(n)
		
		lines.forEach((line, index) => {
			// Check if line is a heading
			let hashMatch = line.match(/^#{1,6} /);
			if (hashMatch) {
			let depth = hashMatch[0].trim().length;  // Count '#' characters
			let headLine = line.substring(depth).trim();  // Extract text after hashes
			let lineNbr = index;  // Convert to 1-based line number
			results.push({ headLine, depth, lineNbr });
			}
		});
		
		return results;
	}

	buildAllItemsNodes(inOrderHeadings: { headLine: string; depth: number, lineNbr: number }[], editor: Editor): HeadingNode[] {
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
			let uiElem = this.uiHelper.createHTMLHeading(item.headLine, item.depth, item.lineNbr, editor)
			let heading = new Heading(item.headLine, multiLevellevel.slice(), uiElem)
			let node = new HeadingNode(heading, currDepth, item.lineNbr)
			itemArray.push(node)
		});
		return itemArray
	}
	
	BuildAllHeadingItem(doc: string, editor: Editor){
		let headingObj = this.getAllHeadingsWithLevels(doc)
    	return this.buildAllItemsNodes(headingObj, editor)
	}
}
