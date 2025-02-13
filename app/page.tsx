"use client";

import { invoke } from "@tauri-apps/api/core";
import { useEffect, useRef, useState } from "react";
import { LoaderCircle } from "lucide-react";

import { DialogSettingPath } from "@/components/dialog-setting-path";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default function Home() {
  const [url, setUrl] = useState("");
  const [folderPath, setFolderPath] = useState("");
  const [audioOnly, setAudioOnly] = useState(false);
  const [metadata, setMetadata] = useState<{ title: string } | null>(null);
  const [status, setStatus] = useState("");
  const [downloading, setDownloading] = useState(false);
  
  const debounceTimer = useRef<NodeJS.Timeout | null>(null);

  // ローカルストレージから保存先パスを読み込み
  useEffect(() => {
    const storedPath = localStorage.getItem("folderPath");
    if (storedPath) {
      setFolderPath(storedPath);
    }
  }, []);

  // 保存先パスが変更されたらローカルストレージに保存
  useEffect(() => {
    localStorage.setItem("folderPath", folderPath);
  }, [folderPath]);

  // URL 入力後3秒で自動的にメタデータ取得
  useEffect(() => {
    if (!url) {
      setMetadata(null);
      return;
    }
    if (debounceTimer.current) clearTimeout(debounceTimer.current);
    debounceTimer.current = setTimeout(async () => {
      try {
        const title = await invoke<string>("download_metadata", { url });
        setMetadata({ title });
      } catch (error) {
        setStatus(`メタデータ取得エラー: ${error}`);
      }
    }, 3000);

    return () => {
      if (debounceTimer.current) clearTimeout(debounceTimer.current);
    };
  }, [url]);

  const handleDownload = async () => {
    if (!url) {
      setStatus("動画URLを入力してください");
      return;
    }
    setStatus("ダウンロード中...");
    setDownloading(true);
    try {
      // download_video コマンドは、メタデータ取得も内部で行うので、外部からは folderPath と audioOnly を渡すだけでよい
      const result = await invoke<string>("download_video", {
        url,
        audioOnly,
        folderPath: folderPath === "" ? null : folderPath,
      });
      setStatus(result);
    } catch (error) {
      setStatus(`ダウンロードエラー: ${error}`);
    } finally {
      setDownloading(false);
    }
  };

  return (
    <main className="px-6 py-4">
      <h1 className="text-3xl font-bold">Video Downloader</h1>
      <div className="mt-4">
        <DialogSettingPath initialPath={folderPath} onPathChange={setFolderPath} disabled={downloading} />
      </div>
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
          <Label htmlFor="audioOnly">Audio Only:</Label>
          <Input
            id="audioOnly"
            type="checkbox"
            checked={audioOnly}
            onChange={(e) => setAudioOnly(e.target.checked)}
            disabled={downloading}
          />
        </div>
      </div>
      <div className="mt-5">
        <Button onClick={handleDownload} disabled={downloading || !url}>
          {downloading ? (
            <div className="flex items-center gap-2">
              <LoaderCircle className="animate-spin h-5 w-5" />
              ダウンロード中...
            </div>
          ) : (
            "ダウンロード開始"
          )}
        </Button>
      </div>
      {metadata && (
        <div className="mt-4">
          <p>
            <strong>タイトル:</strong> {metadata.title}
          </p>
        </div>
      )}
      <div className="mt-4">
        <p>{status}</p>
      </div>
    </main>
  );
}
