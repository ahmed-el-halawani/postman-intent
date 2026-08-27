import { createWriteStream, existsSync, readdirSync, statSync } from 'fs';
import { mkdir } from 'fs/promises';
import os from 'os';
import path from 'path';
import { Readable } from 'stream';
import { pipeline } from 'stream/promises';

const REPO = 'ahmed-el-halawani/postman-intent';
const APK_ASSET = 'app-debug.apk';
const CACHE_DIR = path.join(os.tmpdir(), 'intent-postman-mcp');

export interface LatestRelease {
  tag: string;
  version: string;
  apkPath: string;
}

interface GithubRelease {
  tag_name: string;
  assets: Array<{ name: string; browser_download_url: string }>;
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

async function fetchJson(url: string): Promise<unknown> {
  let lastErr: unknown = null;
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const res = await fetch(url, {
        headers: {
          'User-Agent': 'intent-postman-mcp',
          Accept: 'application/vnd.github+json',
        },
      });
      if (!res.ok) throw new Error(`GitHub API error ${res.status} for ${url}`);
      return await res.json();
    } catch (err) {
      lastErr = err;
      if (attempt < 3) await sleep(2000 * attempt);
    }
  }
  throw lastErr;
}

/** Newest previously-downloaded APK in the cache, if any. */
function newestCachedApk(): LatestRelease | null {
  try {
    const files = readdirSync(CACHE_DIR).filter((f) => f.endsWith(`-${APK_ASSET}`));
    if (files.length === 0) return null;
    const newest = files
      .map((f) => ({ f, mtime: statSync(path.join(CACHE_DIR, f)).mtimeMs }))
      .sort((a, b) => b.mtime - a.mtime)[0];
    const tag = newest.f.slice(0, -(APK_ASSET.length + 1));
    return { tag, version: tag.replace(/^v/, ''), apkPath: path.join(CACHE_DIR, newest.f) };
  } catch {
    return null;
  }
}

/**
 * Get the latest GitHub release and make sure its APK is in the local cache.
 * Downloads only when the tag is not cached yet. Falls back to the newest
 * cached APK when GitHub is unreachable.
 */
export async function ensureLatestApk(): Promise<LatestRelease> {
  let release: GithubRelease;
  try {
    release = (await fetchJson(`https://api.github.com/repos/${REPO}/releases/latest`)) as GithubRelease;
  } catch (err) {
    const cached = newestCachedApk();
    if (cached) return cached;
    throw err;
  }

  const asset = release.assets.find((a) => a.name === APK_ASSET);
  if (!asset) {
    throw new Error(`Latest release ${release.tag_name} has no ${APK_ASSET} asset`);
  }

  await mkdir(CACHE_DIR, { recursive: true });
  const apkPath = path.join(CACHE_DIR, `${release.tag_name}-${APK_ASSET}`);

  if (!existsSync(apkPath)) {
    let res: Response | null = null;
    let lastErr: unknown = null;
    for (let attempt = 1; attempt <= 3 && !res; attempt++) {
      try {
        res = await fetch(asset.browser_download_url, { headers: { 'User-Agent': 'intent-postman-mcp' } });
        if (!res.ok || !res.body) throw new Error(`Failed to download ${APK_ASSET}: HTTP ${res.status}`);
      } catch (err) {
        lastErr = err;
        res = null;
        if (attempt < 3) await sleep(2000 * attempt);
      }
    }
    if (!res || !res.ok || !res.body) {
      const cached = newestCachedApk();
      if (cached) return cached;
      throw lastErr ?? new Error(`Failed to download ${APK_ASSET}`);
    }
    // ponytail: sequential tag-keyed files accumulate; prune old ones when cache grows
    await pipeline(Readable.fromWeb(res.body as never), createWriteStream(apkPath));
  }

  return { tag: release.tag_name, version: release.tag_name.replace(/^v/, ''), apkPath };
}
