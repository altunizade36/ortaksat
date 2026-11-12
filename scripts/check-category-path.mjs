import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';import vm from 'node:vm';import ts from 'typescript';
function load(file){const exports={};vm.runInNewContext(ts.transpileModule(readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText,{exports});return exports;}
const tree=load('lib/category-tree.ts').topCategories(),resolve=load('lib/category-path.ts').resolveCategoryPath;
let count=0,deep;
function walk(nodes,path=[]){for(const node of nodes){const next=[...path,node];const saved=next.map(({key,slug})=>({key,slug,formKey:'untrusted',children:[]}));const restored=resolve(tree,saved);assert.equal(restored.length,next.length);restored.forEach((n,i)=>assert.equal(n,next[i]));count++;if(next.length>=4)deep=next;if(node.children)walk(node.children,next);}}walk(tree);
assert.ok(deep);assert.equal(resolve(tree,null).length,0);assert.equal(resolve(tree,[{key:'missing'}]).length,0);
assert.equal(resolve(tree,[...deep.slice(0,2),{key:'missing'},...deep.slice(3)]).length,2);
assert.equal(resolve(tree,deep.map(({slug})=>({slug}))).length,deep.length);
assert.equal(resolve(tree,[deep[0],tree.find(n=>n.key!==deep[0].key)]).length,1);
console.log(`Passed ${count} category paths: canonical nodes/children, branch restoration, stale suffix, slug fallback, malformed input and cross-root rejection.`);
