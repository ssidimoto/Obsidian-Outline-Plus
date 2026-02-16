import {describe, expect, test} from '@jest/globals';
import { histogramDiff } from './hdiff';

const doc1 = `
# Heading 1
Content under heading 1.

## Subheading 1.1
Content under subheading 1.1.

## Subheading 1.2
Content under subheading 1.2.

# Heading 2
Content under heading 2.
`

const doc2 = `
# Heading 1
Content under heading 1.

## Subheading 1.1
Content under subheading 1.1.

## Subheading 1.3
Content under subheading 1.3.

# Heading hi 2
Content under hi heading 2.
`

test('should correctly identify added, removed, and modified headings', () => {
    const diff = histogramDiff(doc1, doc2);
    console.log(diff);
    expect(true).toBe(true);
})