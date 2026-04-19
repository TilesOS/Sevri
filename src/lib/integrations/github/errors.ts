export class GitHubIntegrationError extends Error {
  constructor(message?: string) {
    super(message);
    this.name = "GitHubIntegrationError";
  }
}

export class GitHubNotConnectedError extends GitHubIntegrationError {
  constructor(message = "GitHub is not connected") {
    super(message);
    this.name = "GitHubNotConnectedError";
  }
}

export class GitHubTokenRevokedError extends GitHubIntegrationError {
  constructor(message = "GitHub token is invalid or revoked") {
    super(message);
    this.name = "GitHubTokenRevokedError";
  }
}

export class GitHubRateLimitedError extends GitHubIntegrationError {
  constructor(message = "GitHub rate limit exceeded") {
    super(message);
    this.name = "GitHubRateLimitedError";
  }
}

export class GitHubRepoNotFoundError extends GitHubIntegrationError {
  constructor(message = "Repository not found or unreachable") {
    super(message);
    this.name = "GitHubRepoNotFoundError";
  }
}

export class GitHubPrivateRepoError extends GitHubIntegrationError {
  constructor(message = "Repository is private") {
    super(message);
    this.name = "GitHubPrivateRepoError";
  }
}
