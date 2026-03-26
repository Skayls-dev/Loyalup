## GitHub Copilot Chat

- Extension: 0.39.2 (prod)
- VS Code: 1.111.0 (ce099c1ed25d9eb3076c11e4a280f3eb52b4fbeb)
- OS: win32 10.0.26200 x64
- GitHub Account: theliscompany

## Network

User Settings:
```json
  "http.systemCertificatesNode": true,
  "github.copilot.advanced.debug.useElectronFetcher": true,
  "github.copilot.advanced.debug.useNodeFetcher": false,
  "github.copilot.advanced.debug.useNodeFetchFetcher": true
```

Connecting to https://api.github.com:
- DNS ipv4 Lookup: Error (5520 ms): getaddrinfo ENOTFOUND api.github.com
- DNS ipv6 Lookup: timed out after 10 seconds
- Proxy URL: None (2 ms)
- Electron fetch (configured): timed out after 10 seconds
- Node.js https: Error (1963 ms): Error: getaddrinfo ENOTFOUND api.github.com
	at GetAddrInfoReqWrap.onlookupall [as oncomplete] (node:dns:122:26)
- Node.js fetch: timed out after 10 seconds

Connecting to https://api.githubcopilot.com/_ping:
- DNS ipv4 Lookup: timed out after 10 seconds
- DNS ipv6 Lookup: Error (2 ms): getaddrinfo ENOTFOUND api.githubcopilot.com
- Proxy URL: None (25 ms)
- Electron fetch (configured): Error (9918 ms): Error: net::ERR_NETWORK_CHANGED
	at SimpleURLLoaderWrapper.<anonymous> (node:electron/js2c/utility_init:2:10684)
	at SimpleURLLoaderWrapper.emit (node:events:519:28)
  [object Object]
  {"is_request_error":true,"network_process_crashed":false}
- Node.js https: Error (114 ms): Error: getaddrinfo ENOTFOUND api.githubcopilot.com
	at GetAddrInfoReqWrap.onlookupall [as oncomplete] (node:dns:122:26)
- Node.js fetch: Error (32 ms): TypeError: fetch failed
	at node:internal/deps/undici/undici:14902:13
	at process.processTicksAndRejections (node:internal/process/task_queues:105:5)
	at async n._fetch (c:\Users\ghygi\.vscode\extensions\github.copilot-chat-0.39.2\dist\extension.js:5075:5229)
	at async n.fetch (c:\Users\ghygi\.vscode\extensions\github.copilot-chat-0.39.2\dist\extension.js:5075:4541)
	at async u (c:\Users\ghygi\.vscode\extensions\github.copilot-chat-0.39.2\dist\extension.js:5107:186)
	at async Zm._executeContributedCommand (file:///c:/Users/ghygi/AppData/Local/Programs/Microsoft%20VS%20Code/ce099c1ed2/resources/app/out/vs/workbench/api/node/extensionHostProcess.js:494:48675)
  Error: getaddrinfo ENOTFOUND api.githubcopilot.com
  	at GetAddrInfoReqWrap.onlookupall [as oncomplete] (node:dns:122:26)

Connecting to https://copilot-proxy.githubusercontent.com/_ping:
- DNS ipv4 Lookup: Error (8 ms): getaddrinfo ENOTFOUND copilot-proxy.githubusercontent.com
- DNS ipv6 Lookup: Error (1 ms): getaddrinfo ENOTFOUND copilot-proxy.githubusercontent.com
- Proxy URL: None (3400 ms)
- Electron fetch (configured): HTTP 200 (213 ms)
- Node.js https: HTTP 200 (191 ms)
- Node.js fetch: HTTP 200 (179 ms)

Connecting to https://mobile.events.data.microsoft.com: HTTP 404 (284 ms)
Connecting to https://dc.services.visualstudio.com: Error (136 ms): Error: net::ERR_NETWORK_CHANGED
	at SimpleURLLoaderWrapper.<anonymous> (node:electron/js2c/utility_init:2:10684)
	at SimpleURLLoaderWrapper.emit (node:events:519:28)
  [object Object]
  {"is_request_error":true,"network_process_crashed":false}
Connecting to https://copilot-telemetry.githubusercontent.com/_ping: HTTP 200 (579 ms)
Connecting to https://copilot-telemetry.githubusercontent.com/_ping: HTTP 200 (1105 ms)
Connecting to https://default.exp-tas.com: HTTP 400 (216 ms)

Number of system certificates: 63

## Documentation

In corporate networks: [Troubleshooting firewall settings for GitHub Copilot](https://docs.github.com/en/copilot/troubleshooting-github-copilot/troubleshooting-firewall-settings-for-github-copilot).