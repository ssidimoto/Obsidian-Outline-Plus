import { HeadingsTree } from "./HeadingsTree";
import { HeadingNode } from "./HeadingsTree";
import { Itemhierarchy } from "./ItemHierarchy";
import {Heading } from "./Heading";
import exp from "constants";
import { of } from "rxjs";
import { off } from "process";
import { write } from "fs";
import { writeLog } from "utils/uilts";

describe("HeadingsTree", () => {
    let tree: HeadingsTree<Heading>;

    let addAllNodes = (nodes: HeadingNode<Heading>[]) => {
        nodes.forEach((node) => {
            tree.addNode(node)
        })
    }

    let buildTree = () => {
        let nodes: HeadingNode<Heading>[] = [
            new HeadingNode(new Heading("1",   0,  3), 1, 0),
            new HeadingNode(new Heading("1.1", 3,  1), 2, 1),
            new HeadingNode(new Heading("1.2", 4,  4), 2, 2),
            new HeadingNode(new Heading("2",   8,  2), 1, 3),
            new HeadingNode(new Heading("2.1", 10, 1), 2, 4),
            new HeadingNode(new Heading("2.2", 11, 7), 2, 5),
            new HeadingNode(new Heading("2.3", 18, 5), 2, 6),
            new HeadingNode(new Heading("2.4", 23, 1), 2, 7),
            new HeadingNode(new Heading("2.5", 24, 5), 2, 8)
        ];

        nodes.forEach((node) => {
            tree.addNode(node)
        })
    }

    beforeEach(() => {
        const root = new HeadingNode(new Heading("root", -1, 0), 0, -1);
        tree = new HeadingsTree(root);
    })

    test("inorder Traversal", () => {
        buildTree()
        let result: string[] = []
        let apply = (node: HeadingNode<Heading>) => {
            result.push(node.data.headLine)
        }
        tree.inorderTraversal(apply, {begin: 0, end: Number.POSITIVE_INFINITY})
        expect(result).toEqual(["1", "1.1", "1.2", "2", "2.1", "2.2", "2.3", "2.4", "2.5"])     
    })

    test("heading tree correctly initialized", () => {
        expect(tree.root).toBeDefined();
    })
    test.only("heading tree correctly adds nodes", () => {
        buildTree()

        let one = tree.root.childrens[0];
        expect(one).toBeDefined();
        let two = tree.root.childrens[1];
        expect(two).toBeDefined();

        expect(one?.childrens.length).toBe(2);
        expect(two?.childrens.length).toBe(5);
        
        expect(one!.childrens[0]).toBeDefined();
        expect(one!.childrens[0]!.data.headLine).toBe("1.1");
        expect(one!.childrens[1]).toBeDefined();
        expect(one!.childrens[1]!.data.headLine).toBe("1.2");

        expect(two!.childrens[0]).toBeDefined();
        expect(two!.childrens[0]!.data.headLine).toBe("2.1");
        expect(two!.childrens[1]).toBeDefined();
        expect(two!.childrens[1]!.data.headLine).toBe("2.2");
        expect(two!.childrens[2]).toBeDefined();
        expect(two!.childrens[2]!.data.headLine).toBe("2.3");
        expect(two!.childrens[3]).toBeDefined();
        expect(two!.childrens[3]!.data.headLine).toBe("2.4");
        expect(two!.childrens[4]).toBeDefined();
        expect(two!.childrens[4]!.data.headLine).toBe("2.5");
        //insert node line 15 with depth of 1
        let node = new HeadingNode(new Heading("3", 15, 0), 1, 8)
        tree.addNode(node)  

        let three = tree.root.childrens[2]
        console.log(tree.toString())
        expect(three).toBeDefined();
        expect(three!.data.headLine).toBe("3");
        expect(three!.childrens.length).toBe(3);
        expect(tree.root.childrens.length).toBe(3);

    })

    test("heading tree correctly inserts nodes", () => {
        let nodes: HeadingNode<Heading>[] = [
            new HeadingNode(new Heading("1",   3,  0), 1, 0),
            new HeadingNode(new Heading("1.2", 6,  0), 2, 1),
            new HeadingNode(new Heading("1.3", 9,  0), 2, 2),
        ];
        
        nodes.forEach((node) => {
            tree.addNode(node)
        })

        let insertNodes: HeadingNode<Heading>[] = [
            new HeadingNode(new Heading("0",     1,  0), 1, 3),
            new HeadingNode(new Heading("1.1",   4,  0), 2, 4),
            new HeadingNode(new Heading("2",     12, 0), 1, 5),
            new HeadingNode(new Heading("1.4",   11, 0), 2, 6),
            new HeadingNode(new Heading("1.2.1", 7,  0), 3, 7),
        ]
        addAllNodes(insertNodes)

        let zero = tree.root.childrens[0];
        expect(zero).toBeDefined();
        expect(zero!.childrens.length).toBe(0);
        expect(tree.root.childrens[0]!.data.headLine).toBe("0");

        let one = tree.root.childrens[1];
        expect(one).toBeDefined();
        expect(one!.childrens.length).toBe(4);
        expect(one!.childrens[0]!.data.headLine).toBe("1.1");
        expect(one!.childrens[1]!.data.headLine).toBe("1.2");
        expect(one!.childrens[2]!.data.headLine).toBe("1.3");
        expect(one!.childrens[3]!.data.headLine).toBe("1.4");

        let one_two = one!.childrens[1];
        expect(one_two!.childrens.length).toBe(1);
        expect(one_two!.childrens[0]!.data.headLine).toBe("1.2.1");

        let two = tree.root.childrens[2];
        expect(two).toBeDefined();
        expect (two!.childrens.length).toBe(0);
        expect(two!.data.headLine).toBe("2");
    })

    test("correctly remove nodes", () => {
        buildTree()
        let node3 = new HeadingNode(new Heading("3", 30, 0), 1, 9)
        tree.addNode(node3)
        console.log(tree.toString())

        let node = tree.root.childrens[1]!.childrens[1] //node 2.2
        tree.removeNode(node!)

        //check 2.2 is removed
        let two = tree.root.childrens[1]
        expect(two).toBeDefined();
        expect(two!.childrens.length).toBe(4);
        
        console.log(tree.toString())
        let node2 = tree.root.childrens[1]
        tree.removeNode(node2!) //remove node 1

        //check root has 1, 3, and all two childrens
        expect(tree.root.childrens.length).toBe(2 + node2!.childrens.length);
    })


    test("find Closest Node", () => {
        buildTree()

        //exct match
        let node = tree.findClosestNode(10)
        expect(node).toBeDefined();
        expect(node!.data.headLine).toBe("2.1");

        //exact match
        node = tree.findClosestNode(18)
        expect(node).toBeDefined();
        expect(node!.data.headLine).toBe("2.3");    

        //No exact match
        node = tree.findClosestNode(0)
        expect(node).toBeDefined();
        expect(node!.data.headLine ).toBe("1");
        
        node = tree.findClosestNode(6)
        expect(node).toBeDefined();
        expect(node!.data.headLine === "1.2"|| node!.data.headLine === "2")

        node = tree.findClosestNode(9)
        expect(node).toBeDefined();
        expect(node!.data.headLine === "2" || node!.data.headLine === "2.1")

        node = tree.findClosestNode(19)
        expect(node).toBeDefined();
        expect(node!.data.headLine === "2.3"|| node!.data.headLine === "2.4")
    })

    test("shift lines", () => {
        buildTree()
        let offset = 2
        let lineNbrs: number[] = []
        let apply = (node: HeadingNode<Heading>) => {
            lineNbrs.push(node.data.lineNbr)
        }
        tree.inorderTraversal(apply, {begin: 5, end: Number.POSITIVE_INFINITY})
        tree.shiftLines(offset, 5)

        let shiftedLineNbrs: number[] = []
        let apply2 = (node: HeadingNode<Heading>) => {
            shiftedLineNbrs.push(node.data.lineNbr)
        }
        tree.inorderTraversal(apply2, {begin: 5, end: Number.POSITIVE_INFINITY})

        expect(shiftedLineNbrs.length).toBe(lineNbrs.length)
        for(let i = 0; i < lineNbrs.length; i++){
            expect(shiftedLineNbrs[i]).toBe(lineNbrs[i]! + offset)
        }
    })         
})