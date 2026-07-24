import type { RepositoryModel } from "../repository/model.js";

export interface RepositoryCorrelation {
  readonly relatedFiles: readonly string[];
  readonly relatedDependencies: readonly string[];
}

export function correlateRepositoryContext(
  model: RepositoryModel,
  messages: readonly string[],
): RepositoryCorrelation {
  const combined = messages.join("\n").toLowerCase();
  const relatedFiles = model.files
    .map((file) => file.path)
    .filter((path) => messageReferencesPath(combined, path))
    .slice(0, 20);
  const relatedDependencies = collectDependencies(model)
    .filter((dependency) => referencesDependency(combined, dependency))
    .slice(0, 20);

  return {
    relatedFiles,
    relatedDependencies,
  };
}

export function collectDependencies(
  model: RepositoryModel,
): readonly string[] {
  const dependencies = new Set<string>();

  for (const [path, content] of Object.entries(model.manifestContents)) {
    if (!path.toLowerCase().endsWith("package.json")) {
      continue;
    }

    try {
      const manifest = JSON.parse(content) as Record<string, unknown>;
      for (const field of [
        "dependencies",
        "devDependencies",
        "peerDependencies",
        "optionalDependencies",
      ]) {
        const values = manifest[field];
        if (!values || typeof values !== "object" || Array.isArray(values)) {
          continue;
        }
        for (const dependency of Object.keys(values)) {
          dependencies.add(dependency);
        }
      }
    } catch {
      continue;
    }
  }

  return [...dependencies].sort();
}

function messageReferencesPath(message: string, path: string): boolean {
  const normalizedPath = path.toLowerCase().replaceAll("\\", "/");
  if (message.includes(normalizedPath)) {
    return true;
  }

  const basename = normalizedPath.split("/").at(-1);
  return Boolean(basename && basename.includes(".") && message.includes(basename));
}

function referencesDependency(message: string, dependency: string): boolean {
  const escaped = dependency.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`(^|[^a-z0-9_.-])${escaped}([^a-z0-9_.-]|$)`, "i").test(
    message,
  );
}
