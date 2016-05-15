/**
 * User configuration.
 */
export interface RcConfig {
  /**
   * A HTTP(s) proxy URI for outgoing requests.
   */
  proxy?: string
  /**
   * The proxy to use for HTTP requests (default: `process.env.HTTP_PROXY`).
   */
  httpProxy?: string
  /**
   * The proxy to use for HTTPS requests (default: `process.env.HTTPS_PROXY`).
   */
  httpsProxy?: string
  /**
   * A string of space-separated hosts to not proxy (default: `process.env.NO_PROXY`).
   */
  noProxy?: string
  /**
   * Reject invalid SSL certificates (default: `true`).
   */
  rejectUnauthorized?: boolean
  /**
   * A string or array of strings of trusted certificates in PEM format.
   */
  ca?: string | string[]
  /**
   * Private key to use for SSL.
   */
  key?: string
  /**
   * Public x509 certificate to use.
   */
  cert?: string
  /**
   * Set the User-Agent for HTTP requests (default: `'typings/{typingsVersion} node/{nodeVersion} {platform} {arch}'`).
   */
  userAgent?: string
  /**
   * Set your GitHub for resolving `github:*` locations.
   */
  githubToken?: string
  /**
   * Override the registry URL.
   */
  registryURL?: string
  /**
   * Override the default installation source (E.g. when doing `typings install debug`) (default: `npm`).
   */
  defaultSource?: string
}
