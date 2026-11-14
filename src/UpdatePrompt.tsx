import type { CSSProperties } from 'react';
import { Capacitor } from '@capacitor/core';
import { BottomSheet, useKeyboard } from './mobile';
import { appVersion, useAppUpdates } from './appUpdates';

type Props = {
  updates: ReturnType<typeof useAppUpdates>;
  blocked: boolean;
  theme: string;
  themeStyle: CSSProperties;
};

export function UpdatePrompt({ updates, blocked, theme, themeStyle }: Props) {
  const keyboard = useKeyboard();
  const { update, postpone } = updates;
  const openDownload = () => {
    if (!update) return;
    keyboard.hide();
    if (Capacitor.isNativePlatform()) window.location.assign(update.downloadPage);
    else window.open(update.downloadPage, '_blank', 'noopener,noreferrer');
    postpone();
  };

  return <BottomSheet open={Boolean(update) && !blocked} onOpenChange={open=>{if(!open)postpone()}} title="发现新版本">
    {update && <div className={`form glass-sheet-controls update-prompt ${theme}`} style={themeStyle}>
      <p className="update-versions">当前 {appVersion} · 最新 {update.version}</p>
      <h2>更新内容与修复</h2>
      <p className="update-notes">{update.notes || '完整更新说明请查看 GitHub 发布页。'}</p>
      <div className="update-actions">
        <button className="line-action" onClick={postpone}>稍后再说</button>
        <button className="primary" onClick={openDownload}>前往下载</button>
      </div>
    </div>}
  </BottomSheet>;
}
