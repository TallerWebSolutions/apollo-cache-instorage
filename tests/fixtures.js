import { createOperation } from 'apollo-link'
import gql from 'graphql-tag'

// Export a factory to avoid data mutation between tests.
export default () => {
  const queries = {
    simple: gql`
      query Simple {
        field
      }
    `,

    other: gql`
      query Other {
        other
      }
    `,

    localDirective: gql`
      query LocalDirective @local {
        field
      }
    `,

    otherDirective: gql`
      query OtherDirective @other {
        field
      }
    `
  }

  const variables = {}
  const extensions = {}

  const operations = {
    simple: createOperation(
      {},
      { query: queries.simple, variables, extensions }
    ),
    other: createOperation({}, { query: queries.other, variables, extensions }),
    localDirective: createOperation(
      {},
      { query: queries.localDirective, variables, extensions }
    ),
    otherDirective: createOperation(
      {},
      { query: queries.otherDirective, variables, extensions }
    )
  }

  // Fulfil operation names.
  for (let i in operations) {
    operations[i].operationName = operations[i].query.definitions.find(
      ({ kind }) => kind === 'OperationDefinition'
    ).name.value
  }

  const results = {
    simple: { data: { field: 'simple value' } },
    other: { data: { other: 'other value' } },
    localDirective: { data: { field: 'directive value' } },
    otherDirective: { data: { field: 'directive value' } }
  }

  return { queries, operations, results }
}
