import type { Metadata } from "next";
import { Geist_Mono, Zen_Maru_Gothic } from "next/font/google";
import { Toaster } from "@/components/ui/sonner";
import { Providers } from "@/components/Providers";
import "./globals.css";

const zenMaruGothic = Zen_Maru_Gothic({
	variable: "--font-zen-maru-gothic",
	subsets: ["latin"],
	weight: ["400", "500", "700"],
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
				className={`${zenMaruGothic.variable} ${geistMono.variable} antialiased`}
			>
				<Providers>{children}</Providers>
				<Toaster />
			</body>
		</html>
	);
}
