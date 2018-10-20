/* eslint-disable no-debugger */
import { ApolloLink, toPromise, Observable, createOperation } from 'apollo-link'
import { ApolloClient } from 'apollo-client'
import gql from 'graphql-tag'
import storage from 'localStorage'
import {
  InStorageCache,
  DepTrackingStorageCache,
  PersistLink
} from 'apollo-cache-instorage'

const { toObject } = DepTrackingStorageCache

const dataIdFromObject = ({ __typename, id }) =>
  id ? `${__typename}:${id}` : undefined

// prettier-ignore
const queries = {
  simple: gql`query simple { field }`,
  persist: gql`query typed { typeField @persist { field } }`,
}

const variables = {}
const extensions = {}

// prettier-ignore
const operations = {
  simple: createOperation({}, { query: queries.simple, variables, extensions }),
  persist: createOperation({}, { query: queries.persist, variables, extensions }),
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
  persist: { data: { typeField: { field: 'value', __typename: 'TypeName' } } },
}

beforeEach(() => storage.clear())

describe('PersistedLink', () => {
  let network, link

  const createCache = (config, initial) =>
    new InStorageCache({
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

  it('should not cache non persisting queries', async () => {
    const cache = createCache()
    const client = new ApolloClient({ link, cache })
    const query = queries.simple

    await toPromise(client.watchQuery({ query }))

    expect(network).toHaveBeenCalledTimes(1)
    expect(toObject(storage)).toEqual({})
  })
})
