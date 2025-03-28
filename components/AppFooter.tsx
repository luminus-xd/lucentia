export function AppFooter() {
  return (
    <footer className="border-t border-border/40 py-4">
      <div className="container mx-auto px-4 text-center text-xs text-muted-foreground">
        &copy; {new Date().getFullYear()} Lucentia - シンプルで使いやすい動画ダウンローダー
      </div>
    </footer>
  );
} 