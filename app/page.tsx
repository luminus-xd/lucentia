"use client";

import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";

export default function Home() {
  const [url, setUrl] = useState("");
  const [outputPath, setOutputPath] = useState("");
  const [status, setStatus] = useState("");
  const [progress, setProgress] = useState(0);
  const [downloading, setDownloading] = useState(false);

  useEffect(() => {
    const unlistenPromise = listen("download-progress", (event) => {
      console.log("進捗イベント受信:", event.payload);
      if (typeof event.payload === "number") {
        setProgress(event.payload);
      }
    });
    return () => {
      unlistenPromise.then((unlisten) => unlisten());
    };
  }, []);

  const handleDownload = async () => {
    setStatus("ダウンロード中...");
    setProgress(0);
    setDownloading(true);
    try {
      // Rust 側の download_video コマンドを呼び出す
      // outputPath が空の場合、Rust 側でタイトルからファイル名生成＋システムのダウンロードフォルダが利用される
      const result = await invoke<string>("download_video", {
        url,
        outputPath,
      });
      setStatus(result);
    } catch (error) {
      setStatus(`エラー: ${error}`);
    } finally {
      setDownloading(false);
    }
  };

  return (
    <main className="px-6 py-4">
      <h1 className="text-3xl font-bold">Download</h1>
      <div className="grid w-full gap-6 mt-6">
        <div className="grid w-full max-w-sm items-center gap-1.5">
          <Label htmlFor="url">動画URL:</Label>
          <Input
            id="url"
            type="text"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://www.youtube.com/watch?v=..."
            disabled={downloading}
          />
        </div>
        <div className="grid w-full max-w-sm items-center gap-1.5">
          <Label htmlFor="outputPath">
            出力ファイル名
            (空の場合はタイトルが使用され、システムのダウンロードフォルダに保存されます):
          </Label>
          <Input
            id="outputPath"
            type="text"
            value={outputPath}
            onChange={(e) => setOutputPath(e.target.value)}
            placeholder="例: myvideo.mp4"
            disabled={downloading}
          />
        </div>
      </div>
      <div className="mt-5">
        <Button onClick={handleDownload} disabled={downloading}>
          {downloading ? "ダウンロード中..." : "ダウンロード開始"}
        </Button>
      </div>
      <div className="mt-6">
        <Progress value={progress} />
        <p>{progress.toFixed(1)}%</p>
      </div>
      <p className="mt-2">{status}</p>
    </main>
  );
}
