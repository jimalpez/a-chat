/**
 * Run `build` or `dev` with `SKIP_ENV_VALIDATION` to skip env validation. This is especially useful
 * for Docker builds.
 */
import "./src/env.js";

/** @type {import("next").NextConfig} */
const config = {
  // Allow socket.io to work with the custom server
  webpack: (config) => {
    config.externals = [...(config.externals || []), "bufferutil", "utf-8-validate"];
    return config;
  },
};

export default config;
