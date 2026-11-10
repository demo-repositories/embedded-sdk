# Phase 1 findings (localhost and a non-localhost origin)

Recorded 2026-11-09 against `@sanity/sdk` / `@sanity/sdk-react` 3.12.0, project `sin73gke`, dataset `production`. The browser used a dev token passed through `SDKProvider` `auth.token`. No proxy.

## Hosts the SDK calls

On `http://localhost:3000/dev` both hosts are used, and both succeed. `localhost` is special-cased enough that this does not prove a custom domain.

From `http://sdk-test.local:3000/dev` (Chrome `--host-resolver-rules=MAP sdk-test.local 127.0.0.1`, so `/etc/hosts` was not edited):

| Host | Path | Result once `http://sdk-test.local:3000` is a project CORS origin |
|---|---|---|
| `sin73gke.api.sanity.io` | `GET /v2025-05-06/data/query/production` | 200. This is `useQuery`. |
| `sin73gke.api.sanity.io` | `GET /v2025-05-06/data/live/events/production` | 200 |
| `sin73gke.api.sanity.io` | `GET /v2025-05-06/data/listen/production` | 200. Opens when a document is selected. |
| `sin73gke.api.sanity.io` | `GET /v2025-05-06/data/doc/production/<id>` and `.../drafts.<id>` | 200. This is `useDocument`. |
| `sin73gke.api.sanity.io` | `POST /v2025-05-06/data/actions/production` | 200. This is `useEditDocument`. The UI showed `Saved (<transaction id>)`. |
| `sin73gke.api.sanity.io` | `GET /v2025-05-06/projects/sin73gke/datasets/production/acl` | 200 |
| `api.sanity.io` | `GET /v2021-06-07/users/me` | CORS failure. Preflight has no `Access-Control-Allow-Origin`. |
| `api.sanity.io` | `GET /v2025-02-19/projects/sin73gke` | CORS failure, same reason. |

Before that origin was added, the project-host query failed CORS too and the page stayed on "Connecting to Sanity…". After it was added, the list and the save worked while the two global-API calls kept failing. Those failures did not block `useQuery`, `useDocument`, or `useEditDocument`.

The temporary origin was removed after the check. `http://localhost:3000` (credentials allowed) remains.

## What this means

The content hooks this app uses talk to `<projectId>.api.sanity.io`, which honors the project's CORS origins. The global API (`api.sanity.io`) does not, and the browser calls the provider makes there (`/users/me`, `/projects/<id>`) fail from any origin that is not allowlisted by Sanity itself. `localhost` is allowlisted. `sdk-test.local` is not.

Those global calls can be avoided for this proof. The signed-in user is read on the server, which has no CORS. A same-origin proxy is not required for the list and the edit.

`SDKProvider` and `setAuthToken` are `@internal`.

## Phase 2 (OAuth routes)

The authorize redirect is accepted by Sanity. Opening `http://localhost:3000` with no session sends the browser to `https://api.sanity.io/v1/auth/oauth/authorize` and then to the Sanity login page. The request uses the registered localhost callback, PKCE `S256`, and `resource=urn:io.sanity:organization:owdwn9v45`. The client secret stays on the server, in the token and revoke form bodies.

`/users/me` (API `2021-06-07`, `useProjectHostname: false`) returns both `id` and `sanityUserId`, and they are different. The session and the home page use `sanityUserId`. A token that cannot read project `sin73gke`, or that sees it under a different organization, gets the "Wrong organization" page and no session.

The session cookie is `httpOnly` and `SameSite=Lax`. `Secure` is set outside development. The PKCE verifier lives in a separate 10-minute `httpOnly` cookie. Token rotation calls `setAuthToken` (`@internal`) on an interval, on focus, and when the dev-only "force token refresh" control asks the token route to refresh immediately.

A save from the signed-in page is attributed to the person. Saves from `/dev` were attributed to the robot dev token (`"embedded-sdk localhost dev"`). That route has been removed. The token itself may still exist in the Sanity project until it is deleted there.

## Dev-server note

Next.js 16 refuses dev assets from a hostname other than `localhost` unless it is in `allowedDevOrigins`. `next.config.ts` lists `sdk-test.local` for this check. That is a Next dev restriction, not a Sanity one.
