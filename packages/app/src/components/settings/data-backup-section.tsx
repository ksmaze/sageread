import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { exportBackup, importBackup, type BackupImportMode } from "@/services/backup-service";
import { AlertTriangle, ChevronDownIcon, Download, Upload } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

const importModeLabels: Record<BackupImportMode, string> = {
  merge: "合并",
  overwrite: "覆盖",
};

export default function DataBackupSection() {
  const [importMode, setImportMode] = useState<BackupImportMode>("merge");
  const [isExporting, setIsExporting] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [overwriteConfirmOpen, setOverwriteConfirmOpen] = useState(false);

  const isBusy = isExporting || isImporting;

  const handleExport = async () => {
    setIsExporting(true);
    try {
      const result = await exportBackup();
      if (!result) return;

      const skippedCount = result.manifest.skippedBooks.length;
      toast.success(skippedCount > 0 ? `备份已导出，跳过 ${skippedCount} 本缺失文件的书籍` : "备份已导出");
    } catch (error) {
      toast.error(getErrorMessage("导出失败", error));
    } finally {
      setIsExporting(false);
    }
  };

  const handleImport = async (mode: BackupImportMode) => {
    setIsImporting(true);
    try {
      const result = await importBackup(mode);
      if (!result) return;

      toast.success(`导入完成：${result.importedBooks} 本书，正在重新加载`);
      window.setTimeout(() => window.location.reload(), 800);
    } catch (error) {
      toast.error(getErrorMessage("导入失败", error));
    } finally {
      setIsImporting(false);
    }
  };

  const startImport = () => {
    if (importMode === "overwrite") {
      setOverwriteConfirmOpen(true);
      return;
    }
    void handleImport(importMode);
  };

  return (
    <section className="rounded-lg bg-muted/80 p-4">
      <h2 className="mb-4 text dark:text-neutral-200">数据</h2>

      <div className="space-y-4">
        <div className="flex gap-2 rounded-md border border-amber-300/70 bg-amber-50 p-3 text-amber-950 dark:border-amber-800/70 dark:bg-amber-950/25 dark:text-amber-100">
          <AlertTriangle className="mt-0.5 h-4 w-4 flex-shrink-0" />
          <div className="space-y-1">
            <p className="text-sm">备份 zip 未加密，包含书籍、笔记、AI 配置和 API Key。</p>
            <p className="text-xs opacity-80">请只保存到可信位置；合并导入会保留当前设备配置，覆盖导入会恢复备份内配置。</p>
          </div>
        </div>

        <div className="flex items-center justify-between gap-3">
          <div>
            <span className="text dark:text-neutral-200">导出数据</span>
            <p className="mt-2 text-xs text-neutral-600 dark:text-neutral-400">打包当前书籍、数据库和 Tauri 配置。</p>
          </div>
          <Button onClick={handleExport} disabled={isBusy} variant="outline" className="min-w-24">
            <Download className="h-4 w-4" />
            {isExporting ? "导出中" : "导出"}
          </Button>
        </div>

        <div className="flex items-center justify-between gap-3">
          <div>
            <span className="text dark:text-neutral-200">导入数据</span>
            <p className="mt-2 text-xs text-neutral-600 dark:text-neutral-400">
              合并按更新时间保留较新记录，覆盖会替换本机数据。
            </p>
          </div>
          <div className="flex flex-shrink-0 items-center gap-2">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button size="sm" variant="outline" className="w-24 justify-between">
                  {importModeLabels[importMode]}
                  <ChevronDownIcon className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-24">
                {(Object.keys(importModeLabels) as BackupImportMode[]).map((mode) => (
                  <DropdownMenuItem key={mode} onClick={() => setImportMode(mode)}>
                    {importModeLabels[mode]}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
            <Button onClick={startImport} disabled={isBusy} className="min-w-24">
              <Upload className="h-4 w-4" />
              {isImporting ? "导入中" : "导入"}
            </Button>
          </div>
        </div>
      </div>

      <AlertDialog open={overwriteConfirmOpen} onOpenChange={setOverwriteConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>覆盖本机数据？</AlertDialogTitle>
            <AlertDialogDescription>
              覆盖导入会清空当前书籍、笔记、阅读进度、AI 数据和相关配置，然后恢复备份内容。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isImporting}>取消</AlertDialogCancel>
            <AlertDialogAction
              disabled={isImporting}
              className="bg-destructive text-white hover:bg-destructive/90"
              onClick={() => void handleImport("overwrite")}
            >
              覆盖导入
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </section>
  );
}

function getErrorMessage(prefix: string, error: unknown) {
  if (error instanceof Error) {
    return `${prefix}: ${error.message}`;
  }
  if (typeof error === "string") {
    return `${prefix}: ${error}`;
  }
  return prefix;
}
