# Sites Deployment Status

## Current state

- Sites project: `appgprj_6ac8f06c850481918db964e4b3df08cb`
- Site status: active
- Latest published version: none
- Live URL: not available

## Verified blocker

The source workflow was attempted against the Sites-managed repository and failed with:

```text
fatal: unable to access 'https://git.chatgpt-team.site/...git/': getaddrinfo() thread failed to start
```

This is an infrastructure/DNS failure in the Sites source workflow, not an application build or database failure. The process was stopped after repeated unchanged waits.

## Recovery contract

GitHub remains the canonical source repository and Google Drive remains the independent release archive. Sites can be retried later by obtaining a fresh short-lived source credential, pushing the exact GitHub-backed source state, and publishing only after a returned saved version and deployment URL confirm success.

No production URL is claimed until Sites returns a successful saved version and deployment result.

