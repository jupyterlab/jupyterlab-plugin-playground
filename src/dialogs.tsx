import * as React from 'react';

export function formatCDNConsentDialog(
  moduleName: string,
  url: string
): JSX.Element {
  return (
    <div>
      <p>
        {moduleName} is not a part of the distribution and needs to be
        downloaded before execution.
      </p>
      <p>The current CDN URL is: {url}</p>
      <p>You should only allow to execute code from CDN if:</p>
      <ul>
        <li>
          you fully trust the CDN provider AND your internet service provider
          AND your network administrator AND their ability to immediately remedy
          any attack against the network, or
        </li>
        <li>
          you verified the integrity of the package by defining a cryptographic
          hash for verification via SRI feature [support to be implemented]
        </li>
      </ul>
      <p>
        You can abort execution and change the CDN URL in the settings first.
      </p>
    </div>
  );
}
