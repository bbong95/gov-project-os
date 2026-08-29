import type { NextConfig } from "next";

const nextConfig: NextConfig = {
	agentRules: false,
	// fflate must not be tree-shaken out of the worker bundle because the
	// HWPX parser imports it via a sync named export, and OpenNext's
	// module walk does not detect that. Marking it external keeps the
	// import as a real runtime require on the worker.
	serverExternalPackages: ["fflate"],
};

export default nextConfig;

// Enable calling `getCloudflareContext()` in `next dev`.
// See https://opennext.js.org/cloudflare/bindings#local-access-to-bindings.
import { initOpenNextCloudflareForDev } from "@opennextjs/cloudflare";
initOpenNextCloudflareForDev();
