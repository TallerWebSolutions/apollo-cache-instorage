import gql from 'graphql-tag'
import { print } from 'graphql/language/printer'
import { cloneDeep } from 'apollo-utilities'
import { oneLiner } from './test-utils.js'

import {
  addPersistFieldToDocument,
  extractPersistDirectivePaths,
  __get__
} from '../src/transform'

const addPersistFieldToSelectionSet = __get__('addPersistFieldToSelectionSet')

const queries = {
  simple: gql`
    query {
      field
    }
  `,
  deep: gql`
    query {
      field {
        field
      }
    }
  `,
  directive: gql`
    query {
      first @persist {
        field
      }

      second {
        field
      }

      third {
        fourth @persist {
          field
        }
      }
    }
  `,
  inlineFragment: gql`
    query {
      typeField {
        ... on TypeName @persist {
          field
        }
      }
    }
  `,
  namedFragment: gql`
    query {
      typeField {
        ...NamedFragment
      }
    }

    fragment NamedFragment on TypeName @persist {
      field
    }
  `,
  complexFragments: gql`
    query {
      typeField {
        ...FirstFragment
      }
    }

    fragment FirstFragment on TypeName {
      field {
        ... on SubTypeName {
          ...SecondFragment
        }
      }
    }

    fragment SecondFragment on SubTypeName @persist {
      deepField
    }
  `
}

describe('transform', () => {
  const docs = {}

  beforeEach(() => {
    for (let name in queries) {
      docs[name] = cloneDeep(queries[name])
    }
  })

  describe('addPersistFieldToSelectionSet', () => {
    it('should add __persist field to selectionSet', () => {
      addPersistFieldToSelectionSet(
        docs.simple.definitions[0].selectionSet,
        false
      )

      expect(oneLiner(print(docs.simple))).toBe('{ field __persist }')
    })

    it('should not add __persist field to the root', () => {
      addPersistFieldToSelectionSet(
        docs.simple.definitions[0].selectionSet,
        true
      )

      expect(oneLiner(print(docs.simple))).toBe('{ field }')
    })

    it('should add __persist to deep selection sets', () => {
      addPersistFieldToSelectionSet(
        docs.deep.definitions[0].selectionSet,
        false
      )

      expect(oneLiner(print(docs.deep))).toBe(
        '{ field { field __persist } __persist }'
      )
    })

    it('should not add __persist to the root of deep selection sets', () => {
      addPersistFieldToSelectionSet(docs.deep.definitions[0].selectionSet, true)

      expect(oneLiner(print(docs.deep))).toBe('{ field { field __persist } }')
    })
  })

  describe('addPersistFieldToDocument', () => {
    it('should not add __persist field to the root', () => {
      const result = addPersistFieldToDocument(docs.simple)
      expect(oneLiner(print(result))).toBe('{ field }')
    })

    it('should add __persist to deep selection sets', () => {
      const result = addPersistFieldToDocument(docs.deep)
      expect(oneLiner(print(result))).toBe('{ field { field __persist } }')
    })

    it('should add __persist to inline fragments', () => {
      const result = addPersistFieldToDocument(docs.inlineFragment)
      expect(oneLiner(print(result))).toBe(
        '{ typeField { ... on TypeName @persist { field __persist } __persist } }'
      )
    })

    it('should add __persist to named fragments', () => {
      const result = addPersistFieldToDocument(docs.namedFragment)
      expect(oneLiner(print(result))).toBe(
        '{ typeField { ...NamedFragment __persist } } fragment NamedFragment on TypeName @persist { field __persist }'
      )
    })
  })

  describe('extractPersistDirectivePaths', () => {
    it('should remove any @persist directives from query', () => {
      const { query } = extractPersistDirectivePaths(docs.directive)
      expect(oneLiner(print(query))).toBe(
        '{ first { field } second { field } third { fourth { field } } }'
      )
    })

    it('should return no path when no @persist directive found', () => {
      const { paths } = extractPersistDirectivePaths(docs.simple)
      expect(paths.length).toBe(0)
    })

    it('should return one path for each @persist directive found', () => {
      const { paths } = extractPersistDirectivePaths(docs.directive)
      expect(paths.length).toBe(2)
    })

    it('should return each path for @persist directives found', () => {
      const { paths } = extractPersistDirectivePaths(docs.directive)
      expect(paths[0]).toEqual(['first'])
      expect(paths[1]).toEqual(['third', 'fourth'])
    })

    it('should return @persist directives path for inline fragments', () => {
      const { paths } = extractPersistDirectivePaths(docs.inlineFragment)
      expect(paths[0]).toEqual(['typeField'])
    })

    it('should return @persist directives path for named fragments', () => {
      const { paths } = extractPersistDirectivePaths(docs.namedFragment)
      expect(paths[0]).toEqual(['typeField'])
    })

    it('should return @persist directives path for complex fragment structures', () => {
      const { paths } = extractPersistDirectivePaths(docs.complexFragments)
      expect(paths[0]).toEqual(['typeField', 'field'])
    })
  })
})
