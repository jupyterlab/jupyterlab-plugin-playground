import * as React from 'react';

import { PluginLoader } from './loader';

export function formatActivationError(
  error: Error,
  result: PluginLoader.IResult
) {
  return (
    <div>
      Error:
      <pre>{error.stack ? error.stack : error.message}</pre>
      Final code:
      <pre>{result.code}</pre>
      {result.transpiled
        ? 'The code was transpiled'
        : 'The code was not transpiled'}
      .
    </div>
  );
}
