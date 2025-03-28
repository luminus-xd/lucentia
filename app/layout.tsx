import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
	variable: "--font-geist-sans",
	subsets: ["latin"],
	weight: ["400", "500", "600", "700"],
});

const geistMono = Geist_Mono({
	variable: "--font-geist-mono",
	subsets: ["latin"],
});

export const metadata: Metadata = {
	title: "Lucentia",
	description: "シンプルで使いやすい動画ダウンローダー",
};

export default function RootLayout({
	children,
}: Readonly<{
	children: React.ReactNode;
}>) {
	return (
		<html lang="ja" className="dark">
			<body
				className={`${geistSans.variable} ${geistMono.variable} antialiased font-sans`}
			>
				{children}
			</body>
		</html>
	);
}
