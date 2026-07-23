import type { RepositoryFile } from "../../investigation/repository/model.js";

export interface SourceLine {
  readonly file: RepositoryFile;
  readonly line: number;
  readonly text: string;
}

export function collectSourceLines(
  files: readonly RepositoryFile[],
): readonly SourceLine[] {
  return files.flatMap((file) =>
    file.content === null
      ? []
      : file.content.split(/\r?\n/).map((text, index) => ({
          file,
          line: index + 1,
          text,
        })),
  );
}

export function evidenceSnippet(text: string): string {
  const normalized = text.trim().replace(/\s+/g, " ");
  return normalized.length <= 180
    ? normalized
    : `${normalized.slice(0, 177)}...`;
}

export function redactAssignment(text: string): string {
  return evidenceSnippet(
    text.replace(
      /([=:]\s*["']?)([^"',\s;}{]{4,})(["']?)/,
      "$1[REDACTED]$3",
    ),
  );
}

export function isLikelyTestOrExample(path: string): boolean {
  const lowerPath = path.toLowerCase();
  return (
    lowerPath.includes("/test/") ||
    lowerPath.includes("/tests/") ||
    lowerPath.includes("/fixture") ||
    lowerPath.includes("/example") ||
    lowerPath.endsWith(".example") ||
    lowerPath.endsWith(".sample")
  );
}
