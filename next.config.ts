import type { NextConfig } from "next";

/** @type {import('next').NextConfig} */
const nextConfig: NextConfig = {
	output: "export",
	reactStrictMode: true,
	experimental: {
		optimizePackageImports: ["lucide-react"],
	},
	images: {
		remotePatterns: [
			{
				protocol: "https",
				hostname: "**.ytimg.com",
			},
			{
				protocol: "https",
				hostname: "**.youtube.com",
			},
			{
				protocol: "https",
				hostname: "**.twitch.tv",
			},
			{
				protocol: "https",
				hostname: "**.jtvnw.net",
			},
			{
				protocol: "https",
				hostname: "**.hdslb.com",
			},
			{
				protocol: "https",
				hostname: "**.nimg.jp",
			},
		],
		unoptimized: true,
	},
};

export default nextConfig;
