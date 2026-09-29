# Security Policy

## Supported Versions

Security fixes are released for the latest minor version. Older versions are
not patched; please upgrade to the current release before reporting an issue.

| Version | Supported          |
| ------- | ------------------ |
| 1.3.x   | :white_check_mark: |
| < 1.3   | :x:                |

## Reporting a Vulnerability

Report vulnerabilities privately through GitHub's private vulnerability
reporting: open
[Report a vulnerability](https://github.com/kpanuragh/xdebug-mcp/security/advisories/new)
on the Security tab. The report is visible only to the maintainers until an
advisory is published.

Please do not open a public issue for a security report.

Where practical, include:

- the affected version, and how the server is configured — TCP or Unix socket,
  with or without DBGp proxy registration
- steps to reproduce, ideally a minimal PHP script and the MCP tool calls used
- what an attacker gains

You can expect an acknowledgement within 7 days and an initial assessment
within 14 days. Accepted reports are fixed and published together with an
advisory; declined reports come with the reasoning.

## Security model

`xdebug-mcp` is a debugger. By design it reads and modifies the state of the
PHP process it is attached to, and can evaluate arbitrary PHP in that process
through the `evaluate` and `set_variable` tools. Access to the DBGp listener,
or to the MCP stdio channel, is therefore equivalent to code execution as the
user running PHP.

The following are deployment considerations rather than vulnerabilities in
themselves, but are worth getting right:

- **Bind address.** `XDEBUG_HOST` defaults to `0.0.0.0`, which accepts DBGp
  connections on every interface. Set it to `127.0.0.1`, or use
  `XDEBUG_SOCKET_PATH`, unless you specifically need connections from another
  host such as a Docker container.
- **Transport.** DBGp is neither authenticated nor encrypted. Do not expose
  the listener to an untrusted network.
- **Session data.** A debug session exposes request state to the connected MCP
  client, including `$_SESSION`, `$_COOKIE` and request headers. Do not attach
  the debugger to a process handling other people's data unless that is
  acceptable for your environment.
