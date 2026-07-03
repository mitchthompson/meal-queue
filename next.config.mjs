/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  devIndicators: {
    position: "top-right",
  },
  // Linting is a dedicated step (`eslint .`, see eslint.config.mjs + CI), not
  // part of the build. `next build`'s built-in lint uses the deprecated
  // `next lint` path (removed in Next 16), so we disable it here to keep a
  // single lint gate and a faster, single-purpose build. TS type-checking
  // during build is unaffected.
  eslint: {
    ignoreDuringBuilds: true,
  },
};

export default nextConfig;
