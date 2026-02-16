import {describe, expect, test} from '@jest/globals';
import FileTreeViewPlugin from 'main';
import { TreeFileViewModel } from './TreeFileViewModel';
const oldDoc = `
    # 1
    hahaha
    # 2
    hohoho
    ### 2.0.3
    hihihi
    ### 2.0.4
    huhuhu`

const newDoc = `
    # 1
    hahaha
    # 2
    hohoho
    ### 2.0.4
    huhuhu`

// describe('MyViewModel', () => {
//   let plugin: jest.Mocked<FileTreeViewPlugin>;
//   let viewModel: TreeFileViewModel;

//   beforeEach(() => {
//     plugin = {
//       app: {
//         workspace: {
//           on: jest.fn(),
//         },
//       },
//       registerEvent: jest.fn(),
//     } as unknown as jest.Mocked<FileTreeViewPlugin>;
    
//     viewModel = new TreeFileViewModel(plugin);
//     viewModel.buildHeadingTree(oldDoc)
//     console.log(viewModel.nodeArr)
//     console.log("hello dog")
// });

//   it('should call vault read', async () => {
//         //console.log(viewModel.DocDiffRange(newDoc))
//         expect(true)
//   });
// });
// test("test", ()=>{
//   expect(1).toBe(1)
// })