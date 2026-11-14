"use client";

import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { SDKProvider, useSanityInstance } from "@sanity/sdk-react";
import { setAuthToken } from "@sanity/sdk";
import { SANITY_DATASET, SANITY_PROJECT_ID } from "@/lib/public-env";

/*
 * Bridges the server-side OAuth session to the Sanity App SDK.
 *
 * The browser never sees the refresh token or the client secret. It fetches a
 * short-lived access token from the token route, starts `SDKProvider` with it,
 * and then (when `rotate` is on) re-fetches it every few minutes, on window
 * focus, and on the `sanity-token-refresh` event, handing any new token to the
 * SDK with `setAuthToken`. A 401 from the token route sends the user to sign in.
 *
 * `SDKProvider` and `setAuthToken` are marked `@internal` in @sanity/sdk 3.12,
 * so they may change between SDK releases.
 */

export interface SanityProviderProps {
  /** Endpoint returning `{ accessToken, expiresAt }`. */
  tokenUrl: string;
  /** Poll the token endpoint and push rotated tokens into the SDK. */
  rotate: boolean;
  children?: ReactNode;
}

interface TokenResponse {
  accessToken: string;
  expiresAt: string | number | null;
}

const ROTATE_INTERVAL_MS = 5 * 60 * 1000;

class AuthRequiredError extends Error {}

async function fetchToken(tokenUrl: string): Promise<TokenResponse> {
  const res = await fetch(tokenUrl, {
    cache: "no-store",
    credentials: "same-origin",
  });
  if (res.status === 401) throw new AuthRequiredError("Session expired");
  if (!res.ok) throw new Error(`Token request failed (${res.status})`);
  return (await res.json()) as TokenResponse;
}

function redirectToLogin() {
  const returnTo = window.location.pathname + window.location.search;
  // Login is a Route Handler, not a page, so a full navigation is intended here.
  // eslint-disable-next-line @next/next/no-location-assign-relative-destination
  window.location.assign(
    `/api/auth/sanity/login?returnTo=${encodeURIComponent(returnTo)}`,
  );
}

export default function SanityProvider({
  tokenUrl,
  rotate,
  children,
}: SanityProviderProps) {
  const [initialToken, setInitialToken] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetchToken(tokenUrl)
      .then((t) => {
        if (!cancelled) setInitialToken(t.accessToken);
      })
      .catch((e: unknown) => {
        if (cancelled) return;
        if (e instanceof AuthRequiredError) redirectToLogin();
        else setError(e instanceof Error ? e.message : "Unknown error");
      });
    return () => {
      cancelled = true;
    };
  }, [tokenUrl]);

  // Built once. Later token changes go through setAuthToken, not a new config,
  // so the SDK instance (and its listeners) is not recreated.
  const config = useMemo(
    () =>
      initialToken
        ? [
            {
              projectId: SANITY_PROJECT_ID,
              dataset: SANITY_DATASET,
              auth: { token: initialToken },
            },
          ]
        : null,
    [initialToken],
  );

  if (error) return <p role="alert">Could not start the Sanity SDK: {error}</p>;
  if (!config || !initialToken) return <p>Loading session…</p>;

  return (
    <SDKProvider config={config} fallback={<p>Connecting to Sanity…</p>}>
      {rotate ? (
        <TokenSync tokenUrl={tokenUrl} initialToken={initialToken} />
      ) : null}
      {children}
    </SDKProvider>
  );
}

function TokenSync({
  tokenUrl,
  initialToken,
}: {
  tokenUrl: string;
  initialToken: string;
}) {
  const instance = useSanityInstance();
  const lastToken = useRef(initialToken);

  useEffect(() => {
    let active = true;

    const refresh = async () => {
      try {
        const { accessToken } = await fetchToken(tokenUrl);
        if (!active || accessToken === lastToken.current) return;
        lastToken.current = accessToken;
        setAuthToken(instance, accessToken);
      } catch (e) {
        if (e instanceof AuthRequiredError) redirectToLogin();
        else
          console.warn(
            "Sanity token refresh failed:",
            e instanceof Error ? e.message : "unknown",
          );
      }
    };

    const onVisible = () => {
      if (document.visibilityState === "visible") void refresh();
    };
    const timer = window.setInterval(refresh, ROTATE_INTERVAL_MS);
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("focus", refresh);
    window.addEventListener("sanity-token-refresh", refresh);

    return () => {
      active = false;
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("focus", refresh);
      window.removeEventListener("sanity-token-refresh", refresh);
    };
  }, [instance, tokenUrl]);

  return null;
}
