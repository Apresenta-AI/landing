import { useEffect, useState } from 'react'
import bundledReleasesData from '@/content/releases.json'

export interface ReleaseAsset {
  name: string
  size: number
  browser_download_url: string
  download_count: number
}

export interface Release {
  tag_name: string
  name: string | null
  body: string | null
  html_url: string
  published_at: string
  prerelease: boolean
  draft: boolean
  assets: ReleaseAsset[]
}

interface ReleasesState {
  status: 'loading' | 'success' | 'error'
  releases: Release[]
  latest: Release | null
}

const bundledReleases = bundledReleasesData as Release[]

function mergeReleases(remote: Release[] = []): Release[] {
  const releasesByTag = new Map(
    bundledReleases.filter((release) => !release.draft).map((release) => [release.tag_name, release]),
  )

  for (const release of remote) {
    if (!release.draft) releasesByTag.set(release.tag_name, release)
  }

  return [...releasesByTag.values()].sort(
    (a, b) => Date.parse(b.published_at) - Date.parse(a.published_at),
  )
}

function releasesState(releases: Release[]): ReleasesState {
  const latest = releases.find((release) => !release.prerelease) ?? releases[0] ?? null
  return { status: 'success', releases, latest }
}

export function useReleases(owner: string, repo: string): ReleasesState {
  const [state, setState] = useState<ReleasesState>(() => releasesState(mergeReleases()))

  useEffect(() => {
    let cancelled = false
    fetch(`https://api.github.com/repos/${owner}/${repo}/releases?per_page=10`, {
      headers: { Accept: 'application/vnd.github+json' },
    })
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        return res.json()
      })
      .then((data: Release[]) => {
        if (cancelled) return
        setState(releasesState(mergeReleases(data)))
      })
      .catch(() => {
        // The bundled manifest keeps downloads available when GitHub's
        // anonymous API is rate-limited, unavailable, or blocked by a client.
      })
    return () => {
      cancelled = true
    }
  }, [owner, repo])

  return state
}

export function matchAsset(
  assets: ReleaseAsset[],
  patterns: string[],
): ReleaseAsset | undefined {
  const regs = patterns.map((p) => new RegExp(p, 'i'))
  return assets.find((a) => regs.some((r) => r.test(a.name)))
}

export function formatBytes(n: number): string {
  if (!n) return ''
  const mb = n / 1024 / 1024
  return mb >= 1 ? `${mb.toFixed(1)} MB` : `${(n / 1024).toFixed(0)} KB`
}

export function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    })
  } catch {
    return ''
  }
}
