import * as React from 'react';

import { PluginLoader } from './loader';

export function formatErrorWithResult(
  error: Error,
  result: Omit<PluginLoader.IResult, 'plugin'>
): JSX.Element {
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

export function formatImportError(error: Error, module: string): JSX.Element {
  return (
    <div>
      Error when importing <code>{module}</code>:
      <pre>{error.stack ? error.stack : error.message}</pre>
    </div>
  );
}
