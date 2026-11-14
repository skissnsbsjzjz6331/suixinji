import { useCallback, useEffect, useRef, useState } from 'react';
import { version } from '../package.json';

export const appVersion = version;
const repository = 'skissnsbsjzjz6331/suixinji';
const releasesApi = `https://api.github.com/repos/${repository}/releases?per_page=30`;
const stableVersion = /^v?(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/;

type Update = { version: string; notes: string; downloadPage: string };

function compareVersions(a: string, b: string) {
  const left = a.split('.').map(Number);
  const right = b.split('.').map(Number);
  return left[0] - right[0] || left[1] - right[1] || left[2] - right[2];
}

export function findUpdate(releases: unknown): Update | null {
  if (!Array.isArray(releases)) throw new Error('Invalid GitHub releases response');
  let latest: Update | null = null;
  for (const release of releases) {
    if (!release || release.draft || release.prerelease || typeof release.tag_name !== 'string') continue;
    const match = stableVersion.exec(release.tag_name);
    if (!match) continue;
    const candidate = match.slice(1).join('.');
    if (compareVersions(candidate, latest?.version ?? appVersion) <= 0) continue;
    latest = {
      version: candidate,
      notes: typeof release.body === 'string' ? release.body.trim() : '',
      downloadPage: `https://github.com/${repository}/releases/tag/${release.tag_name}`,
    };
  }
  return latest;
}

export function useAppUpdates() {
  const [update, setUpdate] = useState<Update | null>(null);
  const [checking, setChecking] = useState(false);
  const postponed = useRef<string | null>(null);
  const lastAttempt = useRef(-Infinity);
  const activeRequest = useRef<AbortController | null>(null);

  const check = useCallback(async (manual = false) => {
    if (activeRequest.current || (!manual && Date.now() - lastAttempt.current < 300_000)) return;
    lastAttempt.current = Date.now();
    const controller = new AbortController();
    activeRequest.current = controller;
    if (manual) setChecking(true);
    const timer = window.setTimeout(() => controller.abort(), 8000);
    try {
      const response = await fetch(releasesApi, {
        headers: { Accept: 'application/vnd.github+json' },
        credentials: 'omit',
        cache: 'no-store',
        signal: controller.signal,
      });
      if (!response.ok) throw new Error(`GitHub responded with ${response.status}`);
      const next = findUpdate(await response.json());
      if (activeRequest.current !== controller) return;
      if (next && (manual || next.version !== postponed.current)) setUpdate(next);
      return next ? 'available' : 'current';
    } catch {
      if (activeRequest.current === controller) return 'unavailable';
    } finally {
      window.clearTimeout(timer);
      if (activeRequest.current === controller) {
        activeRequest.current = null;
        setChecking(false);
      }
    }
  }, []);

  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState === 'visible') void check();
    };
    onVisible();
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      document.removeEventListener('visibilitychange', onVisible);
      if (activeRequest.current) {
        activeRequest.current.abort();
        activeRequest.current = null;
        lastAttempt.current = -Infinity;
      }
    };
  }, [check]);

  const postpone = () => {
    if (update) postponed.current = update.version;
    setUpdate(null);
  };

  return { update, checking, check, postpone };
}
