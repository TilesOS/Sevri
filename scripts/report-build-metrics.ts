import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";

interface TraceSpan {
  name: string;
  duration?: number;
  tags?: Record<string, string>;
}

const buildDirectory = ".next";
const tracePath = join(buildDirectory, "trace");

function loadTrace() {
  return readFileSync(tracePath, "utf8")
    .trim()
    .split("\n")
    .flatMap((line) => JSON.parse(line) as TraceSpan[]);
}

function formatDuration(microseconds: number) {
  return `${(microseconds / 1_000_000).toFixed(3)}s`;
}

function formatBytes(bytes: number) {
  if (bytes < 1_024) return `${bytes} B`;
  if (bytes < 1_024 ** 2) return `${(bytes / 1_024).toFixed(1)} KiB`;
  if (bytes < 1_024 ** 3) return `${(bytes / 1_024 ** 2).toFixed(1)} MiB`;
  return `${(bytes / 1_024 ** 3).toFixed(2)} GiB`;
}

function listFiles(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    return entry.isDirectory() ? listFiles(path) : [path];
  });
}

function directorySize(directory: string) {
  return listFiles(directory).reduce((total, path) => total + statSync(path).size, 0);
}

function reportLargestFiles(title: string, directory: string, suffix: string) {
  console.log(`\n${title}`);
  listFiles(directory)
    .filter((path) => path.endsWith(suffix))
    .map((path) => ({ path, size: statSync(path).size }))
    .sort((left, right) => right.size - left.size)
    .slice(0, 10)
    .forEach(({ path, size }) => {
      console.log(`${formatBytes(size).padStart(10)}  ${relative(buildDirectory, path)}`);
    });
}

const spans = loadTrace();
const phases = [
  "next-build",
  "worker-main-server",
  "worker-main-edge-server",
  "worker-main-client",
  "verify-and-lint",
  "verify-typescript-setup",
  "static-check",
  "static-generation",
  "next-export",
  "node-file-trace-build",
];

console.log("Build phases (parallel child spans are shown independently)");
phases.forEach((name) => {
  const matching = spans.filter((span) => span.name === name && span.duration !== undefined);
  if (matching.length === 0) {
    return;
  }

  const durations = matching.map((span) => span.duration ?? 0);
  console.log(
    `${name.padEnd(28)} max ${formatDuration(Math.max(...durations)).padStart(8)}  ` +
      `sum ${formatDuration(durations.reduce((total, duration) => total + duration, 0)).padStart(8)}  ` +
      `count ${matching.length}`,
  );
});

console.log("\nSlowest traced modules");
spans
  .filter((span) => span.name.startsWith("build-module") && span.duration && span.tags?.name)
  .sort((left, right) => (right.duration ?? 0) - (left.duration ?? 0))
  .slice(0, 10)
  .forEach((span) => {
    console.log(
      `${formatDuration(span.duration ?? 0).padStart(8)}  ${relative(process.cwd(), span.tags?.name ?? "")}`,
    );
  });

reportLargestFiles("Largest client JavaScript assets", join(buildDirectory, "static", "chunks"), ".js");
reportLargestFiles("Largest server route/page bundles", join(buildDirectory, "server", "app"), ".js");

console.log(`\nWebpack cache: ${formatBytes(directorySize(join(buildDirectory, "cache", "webpack")))}`);
