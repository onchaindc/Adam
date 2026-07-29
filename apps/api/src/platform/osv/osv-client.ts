import type { PackageCoordinate } from "../../analyzers/security/package-coordinate-extractor.js";

export interface OsvVulnerability {
  readonly id: string;
  readonly summary?: string;
  readonly details?: string;
  readonly aliases?: readonly string[];
  readonly severity?: readonly { readonly type?: string; readonly score?: string }[];
  readonly database_specific?: Readonly<Record<string, unknown>>;
  readonly ecosystem_specific?: Readonly<Record<string, unknown>>;
}

export interface OsvPackageAdvisory {
  readonly package: PackageCoordinate;
  readonly vulnerability: OsvVulnerability;
}

export interface OsvClientOptions {
  readonly baseUrl: string;
  readonly timeoutMs: number;
  readonly maxAdvisories: number;
  readonly fetch?: typeof fetch;
}

interface QueryBatchResponse {
  readonly results?: readonly {
    readonly vulns?: readonly { readonly id?: string }[];
  }[];
}

export class OsvClient {
  private readonly fetchImpl: typeof fetch;

  public constructor(private readonly options: OsvClientOptions) {
    this.fetchImpl = options.fetch ?? fetch;
  }

  public async queryPackages(
    packages: readonly PackageCoordinate[],
  ): Promise<readonly OsvPackageAdvisory[]> {
    if (packages.length === 0) {
      return [];
    }

    const response = await this.request<QueryBatchResponse>("/v1/querybatch", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        queries: packages.map((coordinate) => ({
          package: {
            ecosystem: coordinate.ecosystem,
            name: coordinate.name,
          },
          version: coordinate.version,
        })),
      }),
    });

    const matches = new Map<string, PackageCoordinate[]>();
    for (const [index, result] of (response.results ?? []).entries()) {
      const coordinate = packages[index];
      if (!coordinate) {
        continue;
      }
      for (const vulnerability of result.vulns ?? []) {
        if (!vulnerability.id || matches.size >= this.options.maxAdvisories) {
          continue;
        }
        const affected = matches.get(vulnerability.id) ?? [];
        affected.push(coordinate);
        matches.set(vulnerability.id, affected);
      }
    }

    const advisories: OsvPackageAdvisory[] = [];
    for (const [id, affectedPackages] of matches) {
      const vulnerability = await this.request<OsvVulnerability>(
        `/v1/vulns/${encodeURIComponent(id)}`,
      );
      for (const coordinate of affectedPackages) {
        advisories.push({ package: coordinate, vulnerability });
      }
    }
    return advisories;
  }

  private async request<Result>(
    path: string,
    init: RequestInit = {},
  ): Promise<Result> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.options.timeoutMs);

    try {
      const response = await this.fetchImpl(
        new URL(path, ensureTrailingSlash(this.options.baseUrl)),
        { ...init, signal: controller.signal },
      );
      if (!response.ok) {
        throw new Error(`OSV returned HTTP ${response.status}.`);
      }
      return (await response.json()) as Result;
    } finally {
      clearTimeout(timer);
    }
  }
}

function ensureTrailingSlash(value: string): string {
  return value.endsWith("/") ? value : `${value}/`;
}
