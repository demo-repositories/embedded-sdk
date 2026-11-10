# From a new Next.js app to the Sanity App SDK with Sanity OAuth

This guide takes a fresh Next.js app and turns it into a self-hosted Sanity App SDK app, where users sign in with their own Sanity account. Each step points to the file in this repo that implements it, so you can copy those files or adapt them.

By the end you'll have:

- a confidential OAuth client on your Next.js server (authorization code flow with PKCE)
- tokens stored in an encrypted, httpOnly cookie, never in `localStorage`
- the App SDK (`@sanity/sdk-react`) running in the browser with the signed-in user's token, refreshed automatically
- optionally, an embedded Sanity Studio at `/studio`

The repo was built against Next.js 16.4, `@sanity/sdk` and `@sanity/sdk-react` 3.12, and `iron-session` 9.

## 1. Prerequisites

- Node.js 20 or later, and pnpm (npm or yarn also work; adjust the commands).
- A Sanity project with a dataset, and the ID of the organization that owns it.
- An OAuth client registered for that organization, with its client ID and client secret. If you don't have access to create one, ask your organization admin or Sanity support.

## 2. Create the Next.js app and install dependencies

```bash
pnpm create next-app@latest my-sdk-app --ts --app --eslint
cd my-sdk-app
pnpm add @sanity/sdk @sanity/sdk-react @sanity/client iron-session server-only
```

For the optional embedded Studio (step 11), also add:

```bash
pnpm add sanity next-sanity styled-components
```

## 3. Register the redirect URI on the OAuth client

The OAuth client needs to know where Sanity may send users after sign-in. Register one redirect URI per environment, for example:

- `http://localhost:3000/api/auth/sanity/callback` for local development
- `https://your-app.example.com/api/auth/sanity/callback` for production

The redirect URI the app sends must match a registered URI exactly, including scheme, port and path.

## 4. Add CORS origins to the project

The SDK calls `<projectId>.api.sanity.io` straight from the browser, so your app's origin must be in the project's CORS origins (sanity.io/manage, then your project, then **API**, then **CORS origins**). Add each origin, for example `http://localhost:3000` and `https://your-app.example.com`. Enable **Allow credentials** if you use the embedded Studio.

You can also add an origin with the Sanity CLI: `npx sanity cors add http://localhost:3000 --credentials`.

## 5. Environment variables

Copy [`.env.example`](../.env.example) to `.env.local` and fill it in. `.env*` files are gitignored, except `.env.example`.

| Variable | Where it's used | Notes |
| --- | --- | --- |
| `SANITY_OAUTH_CLIENT_ID` | Server | The OAuth client's ID |
| `SANITY_OAUTH_CLIENT_SECRET` | Server | Never prefix with `NEXT_PUBLIC_` |
| `SESSION_SECRET` | Server | At least 32 characters. Generate with `openssl rand -base64 48` |
| `SANITY_OAUTH_AUTHORIZE_URL`, `_TOKEN_URL`, `_REVOKE_URL` | Server | Defaults in `.env.example` point at `api.sanity.io` |
| `SANITY_OAUTH_REDIRECT_URI` | Server | Must match step 3 exactly |
| `SANITY_TOKEN_REFRESH_WINDOW_SECONDS` | Server | Refresh this long before expiry. Default 86400 (one day) |
| `NEXT_PUBLIC_SANITY_PROJECT_ID` | Browser | Not a secret |
| `NEXT_PUBLIC_SANITY_DATASET` | Browser | For example `production` |
| `NEXT_PUBLIC_SANITY_ORG_ID` | Browser and server | The organization that owns the project |

Anything prefixed `NEXT_PUBLIC_` is inlined into the browser bundle, so only identifiers go there, never credentials.

## 6. Server modules

These live in `lib/` and are only imported on the server, except `public-env.ts` and `cookie-names.ts`.

- [`lib/env.ts`](../lib/env.ts) reads and validates the server-only variables once. It starts with `import 'server-only'`, which makes the build fail if a client component imports it. That's what keeps the client secret out of the browser.
- [`lib/public-env.ts`](../lib/public-env.ts) exports the three `NEXT_PUBLIC_*` values. Next only inlines literal `process.env.NEXT_PUBLIC_X` accesses, so don't read them dynamically.
- [`lib/cookie-names.ts`](../lib/cookie-names.ts) holds the cookie names in a module with no server-only imports, so `proxy.ts` can share them.
- [`lib/session.ts`](../lib/session.ts) configures iron-session. The whole session (access token, refresh token, expiry and `sanityUserId`) is sealed into an httpOnly cookie, so you don't need a session store. `chunk: true` splits it across several cookies when it's larger than the browser's per-cookie limit.
- [`lib/oauth.ts`](../lib/oauth.ts) implements the protocol:
  - `beginOauth` creates a random `state` and PKCE verifier, seals both (plus `returnTo`) into a 10-minute cookie, and redirects to the authorize URL with the S256 challenge.
  - Every authorize and token request includes `resource=urn:io.sanity:organization:<orgId>`, which scopes the tokens to your organization.
  - `exchangeCode` and `refreshTokens` post form data with the client ID and secret to the token endpoint.
  - `safeReturnTo` only accepts same-origin paths, which blocks open redirects.
- [`lib/sanity-user.ts`](../lib/sanity-user.ts) does two checks with the new token:
  - `assertProjectAccess` reads `/projects/<projectId>` and confirms that the project's `organizationId` matches. Users who belong to several organizations choose one on the Sanity login screen, and a token for the wrong one is rejected here.
  - `fetchSanityUserId` reads `/users/me` and returns `sanityUserId`. That response has both `id` and `sanityUserId`, and they're different values; `sanityUserId` is the one documents and history refer to.

## 7. Route handlers

All four live under [`app/api/auth/sanity/`](../app/api/auth/sanity):

- **`login`**: `GET /api/auth/sanity/login?returnTo=/some/path` calls `beginOauth`.
- **`callback`**: Sanity redirects here with `code` and `state`. The handler then:
  1. Unseals the transaction cookie and compares `state` in constant time.
  2. Exchanges the code for tokens.
  3. Runs both checks from `lib/sanity-user.ts`. If either fails, it revokes the new tokens and shows an error page.
  4. Writes the session cookie and redirects to `returnTo`.
- **`token`**: the only way the browser gets an access token. It returns `{ accessToken, expiresAt }` from the session, first refreshing the tokens if they're inside the refresh window. If refresh fails with a 4xx (other than 408 or 429), the refresh token is no longer usable, so the session is destroyed and the route returns 401. A network error or 5xx returns 503 and keeps the session. Responses are `Cache-Control: no-store`.
- **`logout`**: revokes the token, destroys the session, and redirects to login.

## 8. Gate pages with `proxy.ts`

Next.js 16 renamed Middleware to **Proxy**. The file is `proxy.ts` at the project root, and it exports a `proxy` function. See `node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/proxy.md` for details.

[`proxy.ts`](../proxy.ts) redirects any page request without a session cookie to the login route, passing the original path as `returnTo`. It only checks that the cookie exists, not that it's valid, so pages and route handlers still check the session themselves. The matcher excludes `/api`, `_next` assets and files with an extension, so the auth routes stay reachable.

## 9. Start the SDK in the browser

The SDK uses browser APIs, so it must not render on the server.

- [`components/ClientRoot.tsx`](../components/ClientRoot.tsx) loads the provider with `next/dynamic` and `ssr: false`.
- [`components/SanityProvider.tsx`](../components/SanityProvider.tsx) handles the token:
  - It fetches the first token from `/api/auth/sanity/token`.
  - It builds the `SDKProvider` config once, with `projectId`, `dataset` and `auth: { token }`.
  - When `rotate` is on, `TokenSync` re-fetches the token every 5 minutes, on window focus, and on a `sanity-token-refresh` event. It passes any new token to the existing SDK instance with `setAuthToken`, so queries and listeners aren't torn down.
  - A 401 from the token route sends the user back through login.

The server component [`app/page.tsx`](../app/page.tsx) checks the session and renders it:

```tsx
<ClientRoot tokenUrl="/api/auth/sanity/token" rotate>
  <ProofPanel />
</ClientRoot>
```

`SDKProvider` and `setAuthToken` are marked `@internal` in `@sanity/sdk` 3.12. Pin your SDK version, and recheck them when you upgrade.

## 10. Use the hooks

Inside the provider, the standard hooks work with the user's token:

- [`components/DocList.tsx`](../components/DocList.tsx) uses `useQuery` with a GROQ query for the 10 most recently updated documents.
- [`components/TitleEditor.tsx`](../components/TitleEditor.tsx) reads a document with `useDocument` and saves the `title` field with `useEditDocument`. The save is attributed to the signed-in user.

In sdk-react 3.12, loading and errors surface through Suspense and error boundaries rather than `error` fields, so wrap the hooks accordingly.

## 11. Optional: embed Studio at `/studio`

- [`sanity.config.ts`](../sanity.config.ts) defines the Studio with `basePath: '/studio'` and reads the project and dataset from `lib/public-env.ts`.
- [`app/studio/[[...tool]]/page.tsx`](../app/studio/[[...tool]]/page.tsx) renders `NextStudio` from `next-sanity/studio`.
- [`sanity/schema/sdkProof.ts`](../sanity/schema/sdkProof.ts) is an example document type. Studio needs a schema for any type you want to open there.

The Studio has its own Sanity login, separate from the OAuth session. Its origin needs a CORS entry with credentials allowed (see step 4). The `compiler.styledComponents` option in [`next.config.ts`](../next.config.ts) is there for Studio.

## 12. Deploy

- Serve over HTTPS. Cookies are marked `Secure` when `NODE_ENV=production`, so sign-in won't work over plain HTTP in production.
- Register the production redirect URI on the OAuth client, and set `SANITY_OAUTH_REDIRECT_URI` to it.
- Add the production origin to the project's CORS origins.
- Set the secrets (`SANITY_OAUTH_CLIENT_SECRET` and `SESSION_SECRET`) in your host's environment settings, not in committed files. Changing `SESSION_SECRET` signs everyone out.

## 13. Gotchas

- **The global API ignores your CORS origins.** Content requests go to `<projectId>.api.sanity.io`, which honors the project's CORS origins. Requests to the global `api.sanity.io` (for example `/users/me` and `/projects/<id>`) only accept origins that Sanity itself allowlists. `localhost` is on that list, but your production domain isn't. That's why this app reads the user and checks the project on the server. If the SDK makes those global calls from the browser on a custom domain, they fail CORS. In testing, that didn't block `useQuery`, `useDocument` or `useEditDocument`, but don't depend on global-API calls from the browser.
- **Test a custom domain locally, not just `localhost`.** Because `localhost` is allowlisted everywhere, it can hide CORS problems. To try a real hostname in development, map it to `127.0.0.1` and add it to the project's CORS origins. Next's dev server also blocks dev assets requested from hostnames other than `localhost` unless they're listed in `allowedDevOrigins` in `next.config.ts` (hostnames only, no scheme or port). That's a Next.js restriction, not a Sanity one.
- **Logout doesn't end the sanity.io login.** Revoking the token doesn't necessarily sign the user out of sanity.io, so the next sign-in may skip the login screen.
- **The SDK APIs used here are internal.** As noted in step 9, `SDKProvider` and `setAuthToken` are `@internal` and may change.
