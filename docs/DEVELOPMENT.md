# Development

## Phase 0: GAS Diagnostics

The initial app is a read-only browser capability check. It does not access Drive, run a model, send diagnostic results, or keep application state. IndexedDB and Cache Storage checks confirm that the browser exposes those APIs; they do not test quota or persistent writes.

### Deploy to Apps Script

1. Create a standalone project in [Google Apps Script](https://script.google.com/).
2. Add the files from `gas/` using the matching names: `Code.gs`, `index.html`, `stylesheet.html`, `javascript.html`, and `appsscript.json`.
3. In the Apps Script project settings, make sure the manifest file is visible and use the `appsscript.json` in this directory.
4. Create a web app deployment. The manifest sets access to `MYSELF` and execution to `USER_DEPLOYING`, so only the deploying account can open it and the app runs as that account.
5. Open the deployed `/exec` URL in Chrome and review the diagnostic results. The `/dev` test URL is available to project editors during development.

The GAS source does not include external JavaScript or CSS dependencies. The diagnostics run in the page's browser context. Test the published web app itself because Apps Script HTML Service runs its page in an iframe sandbox.

## Project state

Phase 0 is implemented. No Google Drive scopes or model runtime are configured yet.
