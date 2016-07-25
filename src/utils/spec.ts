/**
 * Spec util functions.
 * Only used in testing.
 */
import { DependencyBranch, DependencyTree } from '../interfaces'

export function removeParentReference(tree: DependencyTree) {
  delete tree.parent

  removeParentReferenceFromDependencies(tree.dependencies)
  removeParentReferenceFromDependencies(tree.devDependencies)
  removeParentReferenceFromDependencies(tree.peerDependencies)
  removeParentReferenceFromDependencies(tree.globalDependencies)
  removeParentReferenceFromDependencies(tree.globalDevDependencies)

  return tree
}

function removeParentReferenceFromDependencies(dependencies: DependencyBranch) {
  Object.keys(dependencies).forEach(function (key) {
    removeParentReference(dependencies[key])
  })
}
