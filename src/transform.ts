import {
  ASTNode,
  visit,
  BREAK,
  DocumentNode,
  SelectionSetNode,
  OperationDefinitionNode,
  FragmentDefinitionNode,
  FieldNode,
} from 'graphql'
import { checkDocument, cloneDeep } from 'apollo-utilities'

const PERSIST_FIELD = {
  kind: 'Field',
  name: {
    kind: 'Name',
    value: '__persist',
  },
}

// TODO: Make private by not exporting
export const addPersistFieldToSelectionSet = (
  selectionSet: SelectionSetNode,
  isRoot = false,
) => {
  if (selectionSet.selections) {
    if (!isRoot) {
      const alreadyHasThisField = selectionSet.selections.some(
        selection =>
          selection.kind === 'Field' && selection.name.value === '__typename',
      )

      if (!alreadyHasThisField) {
        // This was written pre-TS. I assume it works, and I don't know how else
        // to fix it with TS.
        // eslint-disable-next-line @typescript-eslint/ban-ts-ignore
        // @ts-ignore
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
      } else if (selection.kind === 'InlineFragment') {
        if (selection.selectionSet) {
          addPersistFieldToSelectionSet(selection.selectionSet)
        }
      }
    })
  }
}

export const addPersistFieldToDocument = (doc: DocumentNode) => {
  checkDocument(doc)
  const docClone = cloneDeep(doc)

  docClone.definitions.forEach(definition => {
    const isRoot = definition.kind === 'OperationDefinition'
    addPersistFieldToSelectionSet(
      (definition as OperationDefinitionNode).selectionSet,
      isRoot,
    )
  })

  return docClone
}

export const extractPersistDirectivePaths = (
  originalQuery: ASTNode,
  directive = 'persist',
) => {
  const paths: string[][] = []
  const fragmentPaths: { [name: string]: string[] } = {}
  const fragmentPersistPaths: { [name: string]: string[] } = {}

  const query = visit(originalQuery, {
    FragmentSpread: (
      { name: { value: name } },
      key,
      parent,
      path,
      ancestors,
    ) => {
      const root = ancestors.find(
        ancestor =>
          (ancestor as OperationDefinitionNode).kind ===
            'OperationDefinition' ||
          (ancestor as FragmentDefinitionNode).kind === 'FragmentDefinition',
      ) as OperationDefinitionNode | FragmentDefinitionNode

      const rootKey =
        root.kind === 'FragmentDefinition' ? root.name.value : '$ROOT'

      const fieldPath = (ancestors.filter(
        ancestor => (ancestor as FieldNode).kind === 'Field',
      ) as FieldNode[]).map(({ name: { value: name } }) => name)

      fragmentPaths[name] = [rootKey].concat(fieldPath)
    },
    Directive: ({ name: { value: name } }, key, parent, path, ancestors) => {
      if (name === directive) {
        const fieldPath = (ancestors.filter(
          ancestor => (ancestor as FieldNode).kind === 'Field',
        ) as FieldNode[]).map(({ name: { value: name } }) => name)

        const fragmentDefinition = ancestors.find(
          ancestor =>
            (ancestor as FragmentDefinitionNode).kind === 'FragmentDefinition',
        ) as FragmentDefinitionNode

        // If we are inside a fragment, we must save the reference.
        if (fragmentDefinition) {
          fragmentPersistPaths[fragmentDefinition.name.value] = fieldPath
        } else if (fieldPath.length) {
          paths.push(fieldPath)
        }

        return null
      }
      return
    },
  })

  // In case there are any FragmentDefinition items, we need to combine paths.
  if (Object.keys(fragmentPersistPaths).length) {
    visit(originalQuery, {
      FragmentSpread: (
        { name: { value: name } },
        key,
        parent,
        path,
        ancestors,
      ) => {
        if (fragmentPersistPaths[name]) {
          let fieldPath = (ancestors.filter(
            ancestor => (ancestor as FieldNode).kind === 'Field',
          ) as FieldNode[]).map(({ name: { value: name } }) => name)

          fieldPath = fieldPath.concat(fragmentPersistPaths[name])

          let parent = fragmentPaths[name][0]
          while (parent && parent !== '$ROOT' && fragmentPaths[parent]) {
            fieldPath = fragmentPaths[parent].slice(1).concat(fieldPath)
            parent = fragmentPaths[parent][0]
          }

          paths.push(fieldPath)
        }
      },
    })
  }

  return { query, paths }
}

export const hasPersistDirective = (doc: DocumentNode) => {
  let hasDirective = false

  visit(doc, {
    Directive: ({ name: { value: name } }) => {
      if (name === 'persist') {
        hasDirective = true
        return BREAK
      }
    },
  })

  return hasDirective
}
