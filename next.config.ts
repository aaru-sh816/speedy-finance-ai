import type { NextConfig } from "next";
import path from "path";

const nextConfig: NextConfig = {
  reactCompiler: true,
  outputFileTracingRoot: path.resolve(__dirname),
  experimental: {
    optimizePackageImports: ["lucide-react", "@radix-ui/react-dropdown-menu", "@radix-ui/react-slot", "@radix-ui/react-tabs", "@radix-ui/react-tooltip"],
  },
};

export default nextConfig;
