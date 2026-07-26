import type { NextConfig } from "next";
import { withSentryConfig } from "@sentry/nextjs";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  typescript: {
    ignoreBuildErrors: false,
    tsconfigPath: "tsconfig.build.json",
  },
  async redirects() {
    return [
      // Focus mode used to be the one project surface under a `/projects/`
      // prefix. Everything now lives under `/project/`; existing links, saved
      // tabs, and emails keep working through these.
      {
        source: "/projects/:id",
        destination: "/project/:id",
        permanent: true,
      },
      {
        source: "/projects/:id/:path*",
        destination: "/project/:id/:path*",
        permanent: true,
      },
      // The lens section is "Project Lens" on both tracks, so the URL no longer
      // claims the software one is research.
      {
        source: "/project/:id/research-lens",
        destination: "/project/:id/lens",
        permanent: true,
      },
    ];
  },
};

export default withSentryConfig(nextConfig, {
  bundleSizeOptimizations: {
    excludeDebugStatements: true,
    excludeReplayIframe: true,
    excludeReplayShadowDom: true,
    excludeTracing: true,
  },
  disableLogger: true,
  disableManifestInjection: true,
  release: {
    create: false,
  },
  silent: true,
  sourcemaps: {
    disable: true,
  },
  telemetry: false,
});
