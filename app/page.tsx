"use client";

import { AppFooter } from "@/components/AppFooter";
import { AppHeader } from "@/components/AppHeader";
import { VideoForm } from "@/components/VideoForm";
import { useVideoDownloader } from "@/lib/hooks/useVideoDownloader";

export default function Home() {
  const {
    url,
    folderPath,
    audioOnly,
    bestQuality,
    downloadSubtitles,
    preferredFormat,
    metadata,
    status,
    downloading,
    progress,
    setUrl,
    setFolderPath,
    setAudioOnly,
    setBestQuality,
    setDownloadSubtitles,
    setPreferredFormat,
    handleDownload,
  } = useVideoDownloader();

  return (
    <div className="min-h-screen flex flex-col">
      <AppHeader 
        folderPath={folderPath} 
        setFolderPath={setFolderPath} 
        downloading={downloading}
      />
      
      <main className="flex-1 container mx-auto px-4 py-8">
        <div className="glass-panel p-6 max-w-2xl mx-auto">
          <VideoForm
            url={url}
            setUrl={setUrl}
            audioOnly={audioOnly}
            setAudioOnly={setAudioOnly}
            bestQuality={bestQuality}
            setBestQuality={setBestQuality}
            downloadSubtitles={downloadSubtitles}
            setDownloadSubtitles={setDownloadSubtitles}
            preferredFormat={preferredFormat}
            setPreferredFormat={setPreferredFormat}
            metadata={metadata}
            status={status}
            downloading={downloading}
            progress={progress}
            handleDownload={handleDownload}
          />
        </div>
      </main>
      
      <AppFooter />
    </div>
  );
}
