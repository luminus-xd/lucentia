import type { NextConfig } from "next";

/** @type {import('next').NextConfig} */
const nextConfig: NextConfig = {
	output: "export",
	reactStrictMode: true,
	images: {
		domains: [
			'i.ytimg.com', 
			'img.youtube.com',
			'static-cdn.jtvnw.net',
			'vod-secure.twitch.tv',
			'i0.hdslb.com',
			'i1.hdslb.com',
			'i2.hdslb.com',
			'nicovideo.cdn.nimg.jp',
			'img.cdn.nimg.jp'
		],
		remotePatterns: [
			{
				protocol: 'https',
				hostname: '**.ytimg.com',
			},
			{
				protocol: 'https',
				hostname: '**.youtube.com',
			},
			{
				protocol: 'https',
				hostname: '**.twitch.tv',
			},
			{
				protocol: 'https',
				hostname: '**.jtvnw.net',
			},
			{
				protocol: 'https',
				hostname: '**.hdslb.com',
			},
			{
				protocol: 'https',
				hostname: '**.nimg.jp',
			},
		],
		unoptimized: true,
	},
};

export default nextConfig;
