/* eslint-disable no-debugger */
import { ApolloLink, toPromise, Observable, createOperation } from 'apollo-link'
import { ApolloClient } from 'apollo-client'
import gql from 'graphql-tag'
import { print } from 'graphql/language/printer'
import storage from 'localStorage'
import { oneLiner } from './test-utils'

import { InStorageCache } from '../src/inStorageCache'
import { PersistLink, __get__ } from '../src/persistLink'

const attachPersists = __get__('attachPersists')

const dataIdFromObject = ({ __typename, id }) =>
  id ? `${__typename}:${id}` : undefined

// prettier-ignore
const queries = {
  simple: gql`query simple { field }`,
  noPersist: gql`query noPersist { typeField { id field } }`,
  persist: gql`query persist { typeField @persist { id field } }`,
  both: gql`query both { first @persist { id field } second { id field } }`,
  inlineFragment: gql`query inlineFragment { typeField { id ... on TypeName @persist { field } } }`,
  namedFragment: gql`query namedFragment { typeField { id ...NamedFragment } } fragment NamedFragment on TypeName @persist { field }`,
  complexFragment: gql`
    query complexFragment { persisted { id ...NamedFragment } notPersisted { id } }
    fragment NamedFragment on TypeName { nestedOne { ...DeepNamedFragment } }
    fragment DeepNamedFragment on DeepTypeName { nestedTwo @persist { id field } }`
}

const variables = {}
const extensions = {}

// prettier-ignore
const operations = {
  simple: createOperation({}, { query: queries.simple, variables, extensions }),
  noPersist: createOperation({}, { query: queries.noPersist, variables, extensions }),
  persist: createOperation({}, { query: queries.persist, variables, extensions }),
  both: createOperation({}, { query: queries.both, variables, extensions }),
  inlineFragment: createOperation({}, { query: queries.inlineFragment, variables, extensions }),
  namedFragment: createOperation({}, { query: queries.namedFragment, variables, extensions }),
  complexFragment: createOperation({}, { query: queries.complexFragment, variables, extensions }),
}

// Fulfil operation names.
for (let i in operations) {
  operations[i].operationName = operations[i].query.definitions.find(
    ({ kind }) => kind === 'OperationDefinition'
  ).name.value
}

// prettier-ignore
const results = {
  simple: { data: { field: 'simple value' } },
  noPersist: { data: { typeField: { id: '111111', field: 'value', __typename: 'TypeName' } } },
  persist: { data: { typeField: { id: '111111', field: 'value', __typename: 'TypeName' } } },
  both: { data: {
    first: { id: '111111', field: 'value first', __typename: 'TypeName' },
    second: { id: '222222', field: 'value second', __typename: 'TypeName' }
  } },
  inlineFragment: { data: { typeField: { id: '111111', field: 'value', __typename: 'TypeName' } } },
  namedFragment: { data: { typeField: { id: '111111', field: 'value', __typename: 'TypeName' } } },
  complexFragment: { data: {
    persisted: {
      id: '111',
      __typename: 'TypeName',
      nestedOne: { id: '333', __typename: 'DeepTypeName', nestedTwo: { field: 'value', id: '444', __typename: 'DeeperTypeName' } } },
    notPersisted: { id: '222', __typename: 'TypeName' }
  } }
}

beforeEach(() => storage.clear())

describe('PersistedLink', () => {
  let network, link

  const createCache = (config, initial) =>
    new InStorageCache({
      addPersistField: true,
      dataIdFromObject,
      storage,
      shouldPersist: PersistLink.shouldPersist,
      ...config
    }).restore(initial || {})

  beforeEach(() => {
    network = jest.fn(({ operationName }) =>
      Observable.of(results[operationName])
    )
    link = ApolloLink.from([new PersistLink(), new ApolloLink(network)])
  })

  describe('attachPersists', () => {
    it('should not attach a __persist field on the root', () => {
      const paths = [['field']]
      const result = attachPersists(paths, { field: { id: '1' } })
      expect(result).not.toHaveProperty('__persist')
    })

    it('should attach a persist on a first level field', () => {
      const paths = [['field']]
      const result = attachPersists(paths, { field: { id: '1' } })
      expect(result).toHaveProperty('field.__persist', true)
    })

    it('should attach a persist on all levels above marked field', () => {
      const paths = [['fieldA', 'fieldB']]
      const result = attachPersists(paths, {
        fieldA: { fieldB: { id: '1' } }
      })
      expect(result).toHaveProperty('fieldA.__persist', true)
      expect(result).toHaveProperty('fieldA.fieldB.__persist', true)
    })

    it('should attach a persist on a first level array field', () => {
      const paths = [['field']]
      const result = attachPersists(paths, {
        field: [{ id: '1' }, { id: '2' }]
      })
      expect(result).not.toHaveProperty('field.__persist')
      expect(result).toHaveProperty('field.0.__persist', true)
      expect(result).toHaveProperty('field.1.__persist', true)
    })
  })

  describe('link', () => {
    it('should extract @persist directives from query', async () => {
      const cache = createCache()
      const client = new ApolloClient({ link, cache })
      const query = queries.persist

      expect(oneLiner(print(query))).toBe(
        'query persist { typeField @persist { id field } }'
      )

      await toPromise(client.watchQuery({ query }))

      expect(network).toHaveBeenCalledTimes(1)

      expect(oneLiner(print(network.mock.calls[0][0].query))).toBe(
        'query persist { typeField { id field } }'
      )
    })

    it('should persist marked data', async () => {
      const cache = createCache()
      const client = new ApolloClient({ link, cache })
      const query = queries.both

      await toPromise(client.watchQuery({ query }))
      expect(storage.getItem('TypeName:111111')).not.toBeNull()
    })

    it('should selectively persist data', async () => {
      const cache = createCache()
      const client = new ApolloClient({ link, cache })
      const query = queries.both

      await toPromise(client.watchQuery({ query }))
      expect(storage.getItem('TypeName:111111')).not.toBeNull()
      expect(storage.getItem('TypeName:222222')).toBeNull()
    })

    it('should persist data on marked inline fragments', async () => {
      const cache = createCache()
      const client = new ApolloClient({ link, cache })
      const query = queries.inlineFragment

      await toPromise(client.watchQuery({ query }))
      expect(storage.getItem('TypeName:111111')).not.toBeNull()
    })

    it('should persist data on marked named fragments', async () => {
      const cache = createCache()
      const client = new ApolloClient({ link, cache })
      const query = queries.namedFragment

      await toPromise(client.watchQuery({ query }))
      expect(storage.getItem('TypeName:111111')).not.toBeNull()
    })

    it('should persist data on marked complex fragment structures', async () => {
      const cache = createCache()
      const client = new ApolloClient({ link, cache })
      const query = queries.complexFragment

      await toPromise(client.watchQuery({ query }))
      expect(storage.getItem('TypeName:222')).toBeNull()
      expect(storage.getItem('TypeName:111')).not.toBeNull()
      expect(storage.getItem('DeepTypeName:333')).not.toBeNull()
      expect(storage.getItem('DeeperTypeName:444')).not.toBeNull()
    })
  })
})
