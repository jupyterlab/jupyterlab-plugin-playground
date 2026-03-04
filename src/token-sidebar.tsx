import { Dialog, ReactWidget, showDialog } from '@jupyterlab/apputils';

import { checkIcon, copyIcon } from '@jupyterlab/ui-components';

import * as React from 'react';

export class TokenSidebar extends ReactWidget {
  private readonly _tokenNames: ReadonlyArray<string>;
  private _query = '';
  private _copiedTokenName: string | null = null;
  private _copiedTimer: number | null = null;

  constructor(tokenNames: ReadonlyArray<string>) {
    super();
    this._tokenNames = tokenNames;
    this.addClass('jp-PluginPlayground-tokenSidebar');
  }

  dispose(): void {
    if (this._copiedTimer !== null) {
      window.clearTimeout(this._copiedTimer);
      this._copiedTimer = null;
    }
    super.dispose();
  }

  render(): JSX.Element {
    try {
      const tokenNames = this._tokenNames.filter(
        (tokenName): tokenName is string => typeof tokenName === 'string'
      );
      const query = this._query.trim().toLowerCase();
      const filteredTokenNames =
        query.length > 0
          ? tokenNames.filter(tokenName =>
              tokenName.toLowerCase().includes(query)
            )
          : tokenNames;

      return (
        <div className="jp-PluginPlayground-tokenSidebarInner">
          <input
            className="jp-PluginPlayground-tokenFilter"
            type="search"
            placeholder="Filter token strings"
            value={this._query}
            onChange={this._onQueryChange}
          />
          <p className="jp-PluginPlayground-tokenCount">
            {filteredTokenNames.length} of {tokenNames.length} token strings
          </p>
          {filteredTokenNames.length === 0 ? (
            <p className="jp-PluginPlayground-tokenCount">
              No matching token strings.
            </p>
          ) : (
            <ul className="jp-PluginPlayground-tokenList">
              {filteredTokenNames.map(tokenName => (
                <li
                  key={tokenName}
                  className="jp-PluginPlayground-tokenListItem"
                >
                  <div className="jp-PluginPlayground-tokenRow">
                    <code className="jp-PluginPlayground-tokenString">
                      {tokenName}
                    </code>
                    <button
                      className="jp-Button jp-mod-styled jp-mod-minimal jp-PluginPlayground-copyButton"
                      type="button"
                      onClick={() => {
                        void this._copyTokenName(tokenName);
                      }}
                      aria-label={
                        this._copiedTokenName === tokenName
                          ? `Copied token string ${tokenName}`
                          : `Copy token string ${tokenName}`
                      }
                      title={
                        this._copiedTokenName === tokenName
                          ? 'Copied'
                          : 'Copy token string'
                      }
                    >
                      {React.createElement(
                        this._copiedTokenName === tokenName
                          ? checkIcon.react
                          : copyIcon.react,
                        {
                          tag: 'span',
                          elementSize: 'normal',
                          className: 'jp-PluginPlayground-copyIcon'
                        }
                      )}
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      );
    } catch (error) {
      console.error('Plugin token sidebar render failed', error);
      return (
        <div className="jp-PluginPlayground-tokenSidebarInner">
          <p className="jp-PluginPlayground-tokenSidebarHint">
            Could not render token list.
          </p>
        </div>
      );
    }
  }

  private _onQueryChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    this._query = event.currentTarget.value;
    this.update();
  };

  private async _copyTokenName(tokenName: string): Promise<void> {
    if (!navigator.clipboard) {
      await showDialog({
        title: 'Clipboard API unavailable',
        body: 'This browser does not allow clipboard writes in this context.',
        buttons: [Dialog.okButton({ label: 'OK' })]
      });
      return;
    }

    try {
      await navigator.clipboard.writeText(tokenName);
      this._copiedTokenName = tokenName;
      this.update();

      if (this._copiedTimer !== null) {
        window.clearTimeout(this._copiedTimer);
      }
      this._copiedTimer = window.setTimeout(() => {
        this._copiedTokenName = null;
        this._copiedTimer = null;
        this.update();
      }, 1200);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Unknown clipboard error';
      await showDialog({
        title: 'Failed to copy token string',
        body: `Could not copy "${tokenName}". ${message}`,
        buttons: [Dialog.okButton({ label: 'OK' })]
      });
    }
  }
}
