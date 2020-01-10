import { IdGetter } from 'apollo-cache-inmemory'

export const oneLiner = (string: string) =>
  string
    .replace(/(?:\r\n|\r|\n)/g, ' ')
    .replace(/\s\s+/g, ' ')
    .trim()

export const dataIdFromObject: IdGetter = ({ __typename, id }) =>
  id ? `${__typename}:${id}` : undefined
