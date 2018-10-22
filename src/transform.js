import { visit } from 'graphql'
import { checkDocument, cloneDeep } from 'apollo-utilities'

const PERSIST_FIELD = {
  kind: 'Field',
  name: {
    kind: 'Name',
    value: '__persist'
  }
}

const addPersistFieldToSelectionSet = (selectionSet, isRoot = false) => {
  if (selectionSet.selections) {
    if (!isRoot) {
      const alreadyHasThisField = selectionSet.selections.some(selection => {
        return (
          selection.kind === 'Field' && selection.name.value === '__typename'
        )
      })

      if (!alreadyHasThisField) {
        selectionSet.selections.push(PERSIST_FIELD)
      }
    }

    selectionSet.selections.forEach(selection => {
      // Must not add __typename if we're inside an introspection query
      if (selection.kind === 'Field') {
        if (
          selection.name.value.lastIndexOf('__', 0) !== 0 &&
          selection.selectionSet
        ) {
          addPersistFieldToSelectionSet(selection.selectionSet)
        }
      }
      else if (selection.kind === 'InlineFragment') {
        if (selection.selectionSet) {
          addPersistFieldToSelectionSet(selection.selectionSet)
        }
      }
    })
  }
}

const addPersistFieldToDocument = doc => {
  checkDocument(doc)
  const docClone = cloneDeep(doc)

  docClone.definitions.forEach(definition => {
    const isRoot = definition.kind === 'OperationDefinition'
    addPersistFieldToSelectionSet(definition.selectionSet, isRoot)
  })

  return docClone
}

const extractPersistDirectivePaths = (originalQuery, directive = 'persist') => {
  let paths = []

  const query = visit(originalQuery, {
    Directive: ({ name: { value: name } }, key, parent, path, ancestors) => {
      if (name === directive) {
        paths.push(
          ancestors
            .filter(({ kind }) => kind === 'Field')
            .map(({ name: { value: name } }) => name)
        )

        return null
      }
    }
  })

  return { query, paths }
}

export { addPersistFieldToDocument, extractPersistDirectivePaths }
