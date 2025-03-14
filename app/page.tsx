"use client";

import { invoke } from "@tauri-apps/api/core";
import { useEffect, useRef, useState } from "react";
import { Download, LoaderCircle, Music, Video } from "lucide-react";

import { DialogSettingPath } from "@/components/dialog-setting-path";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";

export default function Home() {
  const [url, setUrl] = useState("");
  const [folderPath, setFolderPath] = useState("");
  const [audioOnly, setAudioOnly] = useState(false);
  const [metadata, setMetadata] = useState<{ title: string } | null>(null);
  const [status, setStatus] = useState("");
  const [downloading, setDownloading] = useState(false);
  const [progress, setProgress] = useState(0);
  
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
        setStatus("メタデータを取得しました");
      } catch (error) {
        setStatus(`メタデータ取得エラー: ${error}`);
      }
    }, 3000);

    return () => {
      if (debounceTimer.current) clearTimeout(debounceTimer.current);
    };
  }, [url]);

  // ダウンロード進捗のシミュレーション
  useEffect(() => {
    if (downloading) {
      const interval = setInterval(() => {
        setProgress((prev) => {
          const newProgress = prev + Math.random() * 10;
          return newProgress >= 100 ? 100 : newProgress;
        });
      }, 500);
      
      return () => {
        clearInterval(interval);
        setProgress(0);
      };
    }
  }, [downloading]);

  const handleDownload = async () => {
    if (!url) {
      setStatus("動画URLを入力してください");
      return;
    }
    setStatus("ダウンロード中...");
    setDownloading(true);
    setProgress(0);
    
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
      setProgress(100);
    }
  };

  return (
    <div className="min-h-screen flex flex-col">
      <header className="border-b border-border/40 backdrop-blur-sm sticky top-0 z-10">
        <div className="container mx-auto px-4 py-3 flex items-center justify-between">
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Download className="h-6 w-6" />
            <span>Video Downloader</span>
          </h1>
          <DialogSettingPath initialPath={folderPath} onPathChange={setFolderPath} disabled={downloading} />
        </div>
      </header>
      
      <main className="flex-1 container mx-auto px-4 py-8">
        <div className="glass-panel p-6 max-w-2xl mx-auto">
          <div className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="url" className="text-sm font-medium">動画URL</Label>
              <div className="relative">
                <Input
                  id="url"
                  type="text"
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  placeholder="https://www.youtube.com/watch?v=..."
                  disabled={downloading}
                  className="input-dark pl-10"
                />
                <div className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                  <Video className="h-4 w-4" />
                </div>
              </div>
            </div>
            
            <div className="flex items-center space-x-2">
              <div className="flex items-center space-x-2">
                <input
                  id="audioOnly"
                  type="checkbox"
                  checked={audioOnly}
                  onChange={(e) => setAudioOnly(e.target.checked)}
                  disabled={downloading}
                  className="rounded border-input/50 bg-muted/50 h-4 w-4"
                />
                <Label htmlFor="audioOnly" className="text-sm font-medium flex items-center gap-1.5">
                  <Music className="h-4 w-4" />
                  音声のみ
                </Label>
              </div>
            </div>
            
            <div>
              <Button
                onClick={handleDownload}
                disabled={downloading || !url}
                className="w-full"
                size="lg"
              >
                {downloading ? (
                  <div className="flex items-center gap-2">
                    <LoaderCircle className="animate-spin h-5 w-5" />
                    ダウンロード中...
                  </div>
                ) : (
                  <div className="flex items-center gap-2">
                    <Download className="h-5 w-5" />
                    ダウンロード開始
                  </div>
                )}
              </Button>
            </div>
            
            {downloading && (
              <div className="space-y-1">
                <Progress value={progress} className="h-2" />
                <p className="text-xs text-right text-muted-foreground">{Math.round(progress)}%</p>
              </div>
            )}
            
            {metadata && (
              <div className="p-3 bg-muted/30 rounded border border-border/50">
                <p className="text-sm">
                  <span className="font-medium">タイトル:</span> {metadata.title}
                </p>
              </div>
            )}
            
            {status && (
              <div className="text-sm text-muted-foreground">
                <p>{status}</p>
              </div>
            )}
          </div>
        </div>
      </main>
      
      <footer className="border-t border-border/40 py-4">
        <div className="container mx-auto px-4 text-center text-xs text-muted-foreground">
          &copy; {new Date().getFullYear()} Video Downloader - シンプルで使いやすい動画ダウンローダー
        </div>
      </footer>
    </div>
  );
}
