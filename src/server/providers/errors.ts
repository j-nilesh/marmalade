export class ProviderConnectionError extends Error {
  constructor(
    public readonly code:
      | 'PROVIDER_BILLING'
      | 'PROVIDER_MODEL'
      | 'PROVIDER_AUTH'
      | 'PROVIDER_UNAVAILABLE',
    message: string
  ) {
    super(message);
  }
}
