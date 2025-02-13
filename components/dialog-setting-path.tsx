import { useState, useEffect } from "react";
import { Copy } from "lucide-react";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface DialogSettingPathProps {
  initialPath: string;
  onPathChange: (newPath: string) => void;
  disabled?: boolean;
}

export function DialogSettingPath({ initialPath, onPathChange, disabled = false }: DialogSettingPathProps) {
  const [open, setOpen] = useState(false);
  const [tempPath, setTempPath] = useState(initialPath);

  useEffect(() => {
    setTempPath(initialPath);
  }, [initialPath]);

  const handleSave = () => {
    onPathChange(tempPath);
    setOpen(false);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" disabled={disabled}>保存先パス設定</Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>出力ディレクトリ</DialogTitle>
          <DialogDescription>
            ダウンロードしたファイルを保存するディレクトリを設定します。設定しない場合は、OS のダウンロードフォルダが利用されます。
          </DialogDescription>
        </DialogHeader>
        <div className="flex items-center space-x-2">
          <div className="grid flex-1 gap-2">
            <Label htmlFor="path" className="sr-only">Path</Label>
            <Input
              id="path"
              value={tempPath}
              onChange={(e) => setTempPath(e.target.value)}
              placeholder="/Users/user/Downloads"
            />
          </div>
          <Button onClick={handleSave} type="button" size="sm" className="px-3">
            <span className="sr-only">Save</span>
            <Copy />
          </Button>
        </div>
        <DialogFooter className="sm:justify-start">
          <DialogClose asChild>
            <Button type="button" variant="secondary">
              閉じる
            </Button>
          </DialogClose>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
