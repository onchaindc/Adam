import type { RepositoryModel } from "../investigation/repository/model.js";
import type { RepositoryScanner } from "../investigation/repository/repository-scanner.js";
import type { GitHubRepositoryAcquirer } from "../platform/github/github-repository.js";

export async function withRepositoryModel<Result>(
  acquirer: GitHubRepositoryAcquirer,
  scanner: RepositoryScanner,
  repositoryUrl: string,
  execute: (model: RepositoryModel) => Promise<Result> | Result,
): Promise<Result> {
  const acquired = await acquirer.acquire(repositoryUrl);

  try {
    const model = await scanner.scan(acquired.directory, {
      name: acquired.reference.name,
      owner: acquired.reference.owner,
      url: acquired.reference.canonicalUrl.replace(/\.git$/, ""),
      defaultBranch: acquired.defaultBranch,
      commitSha: acquired.commitSha,
    });
    return await execute(model);
  } finally {
    await acquired.cleanup();
  }
}
