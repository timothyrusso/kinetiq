/**
 * Why a remote call failed, so the UI can branch on the kind and the query client can decide
 * what is worth retrying: 400s and 404s never are, 429s and 5xxs are.
 */
export type HttpErrorKind =
  | 'offline'
  | 'timeout'
  | 'cancelled'
  | 'rate-limit'
  | 'server'
  | 'not-found'
  | 'bad-request'
  | 'parse'
  | 'unknown';
