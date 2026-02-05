---
status: resolved
trigger: "Continue debugging ui-freeze-large-depot-operations. The previous fix resolved the cache invalidation issue, but a new error appeared."
created: 2026-02-04T00:00:00Z
updated: 2026-02-04T00:00:02Z
---

## Current Focus

hypothesis: CONFIRMED - incrementalTreeUpdate uses Immer produce() which returns a frozen object, then calls reAggregateSyncStatus which tries to mutate it
test: Fix by wrapping reAggregateSyncStatus mutations inside the produce() call or using another produce() call
expecting: Mutations happen inside Immer draft, producing new immutable tree
next_action: Apply fix to move reAggregateSyncStatus logic inside produce() or wrap it

## Symptoms

expected: After file operations, tree should update without errors
actual: TypeError when trying to assign to 'hasOutOfDateDescendants' property
errors:
```
Uncaught TypeError: Cannot assign to read only property 'hasOutOfDateDescendants' of object '#<Object>'
    at aggregateSyncStatus (treeBuilder.ts:151:8)
    at Array.forEach (<anonymous>)
    at aggregateSyncStatus (treeBuilder.ts:133:17)
    at Array.forEach (<anonymous>)
    at reAggregateSyncStatus (treeBuilder.ts:182:8)
    at incrementalTreeUpdate (treeBuilder.ts:223:5)
    at useFileTree.ts:389:17
```
reproduction: Perform file operation (likely add/edit/revert) in large depot
started: After implementing targeted cache update fix (replaced invalidateQueries with setQueriesData)

## Eliminated

## Evidence

- timestamp: 2026-02-04T00:00:00Z
  checked: treeBuilder.ts lines 151, 182, 223
  found: Line 151 directly assigns to node.hasOutOfDateDescendants; line 223 calls reAggregateSyncStatus on updatedTree (which is result of produce())
  implication: incrementalTreeUpdate uses Immer produce() to create updatedTree (line 201-219), then calls reAggregateSyncStatus (line 223) which tries to mutate the "finalized" Immer result

- timestamp: 2026-02-04T00:00:01Z
  checked: TypeScript compilation
  found: No compilation errors after applying fix
  implication: Syntax is correct

- timestamp: 2026-02-04T00:00:01Z
  checked: Fix logic
  found:Wrapping reAggregateSyncStatus in produce() creates a new mutable draft, allows mutations, returns new frozen tree
  implication: Fix is correct - maintains immutability while allowing necessary mutations during sync status aggregation

## Resolution

root_cause: incrementalTreeUpdate calls produce() to create updatedTree (frozen/immutable), then calls reAggregateSyncStatus(updatedTree) which tries to directly mutate node.hasOutOfDateDescendants and node.outOfDateCount. Immer returns frozen objects that cannot be mutated outside of produce().
fix: Wrapped reAggregateSyncStatus call in another produce() to ensure mutations happen on mutable draft. The second produce() creates a new mutable draft from the frozen updatedTree, allows reAggregateSyncStatus to mutate sync status properties, then returns a new frozen tree.
verification:
  - TypeScript compilation passes with no errors
  - Logic verified: produce(updatedTree, draft => reAggregateSyncStatus(draft)) creates mutable draft, allows mutations, returns new immutable tree
  - Fix maintains Immer's structural sharing benefits while preventing mutation errors
  - Ready for runtime testing with file operations
files_changed:
  - src/utils/treeBuilder.ts: Modified incrementalTreeUpdate to wrap reAggregateSyncStatus in produce()
