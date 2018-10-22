import gql from 'graphql-tag'
import { print } from 'graphql/language/printer'
import { cloneDeep } from 'apollo-utilities'
import { addPersistFieldToDocument, __get__ } from '../src/transform'
import { oneLiner } from './test-utils.js'

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

    it('should not add __persist to the root of deep selection sets', () => {
      const result = addPersistFieldToDocument(docs.deep)
      expect(oneLiner(print(result))).toBe('{ field { field __persist } }')
    })
  })
})
