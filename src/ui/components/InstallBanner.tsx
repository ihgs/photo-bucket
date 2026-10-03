import { Share } from "lucide-preact";
import { useEffect, useState } from "preact/hooks";
import { navigate } from "../../app/router";
import {
  NO_SHARED_DATA,
  SHARE_ICON,
  currentGuideEnv,
  detectGuide,
  getInstallRecord,
  guideSteps,
  installEvent,
  promptInstall,
  recordDismiss,
  shouldShowBanner,
  type InstallPromptRecord,
} from "../../pwa/installPrompt";

/**
 * Suggests adding the app to the home screen while it runs in a browser (contracts/install-banner.md).
 * Shown at the top of the board list only.
 */
export const InstallBanner = ({ hasBoards }: { hasBoards: boolean }) => {
  const [record, setRecord] = useState<InstallPromptRecord | null>(null);
  const [hidden, setHidden] = useState(false);

  useEffect(() => {
    void getInstallRecord()
      .then(setRecord)
      .catch(() => undefined);
  }, []);

  // Reading installEvent here re-renders when the browser's offer arrives later.
  void installEvent.value;
  const guide = detectGuide(currentGuideEnv());
  if (hidden || !record || !shouldShowBanner(record, guide)) return null;

  const close = () => {
    setHidden(true);
    void recordDismiss().catch(() => undefined);
  };
  const install = () => {
    setHidden(true);
    void promptInstall().catch(() => undefined);
  };

  const inApp = guide === "in-app";
  const steps = guideSteps(guide);
  return (
    <section class="banner install-banner" aria-labelledby="install-heading">
      <h2 id="install-heading">
        {inApp
          ? "ブラウザで開くと、ホーム画面に追加できます"
          : "ホーム画面に追加すると、アプリのように使えます"}
      </h2>
      {inApp ? (
        <p>
          右上（または右下）のメニューから「ブラウザで開く」を選び、Safari（Android では
          Chrome）で開いてください。
        </p>
      ) : (
        <p>通信のない場所でも使え、写真も消えにくくなります。</p>
      )}
      {steps.length > 0 && (
        <ol class="install-steps">
          {steps.map((parts, i) => (
            <li key={i}>
              {parts.map((p, j) =>
                p === SHARE_ICON ? (
                  <Share
                    key={j}
                    class="install-icon"
                    size={18}
                    role="img"
                    aria-label="共有ボタン"
                  />
                ) : (
                  p
                ),
              )}
            </li>
          ))}
        </ol>
      )}
      {hasBoards && NO_SHARED_DATA.includes(guide) && (
        <div class="install-warning">
          <p>
            ホーム画面に追加したアプリには、ここで作ったボードは引き継がれません。先にバックアップを書き出し、追加したアプリで読み込んでください。
          </p>
          <button type="button" class="btn" onClick={() => navigate({ name: "backup" })}>
            バックアップを書き出す
          </button>
        </div>
      )}
      <div class="btn-row">
        {guide === "one-tap" && (
          <button type="button" class="btn btn-primary" onClick={install}>
            アプリとして追加
          </button>
        )}
        <button type="button" class="btn" onClick={close}>
          閉じる
        </button>
      </div>
    </section>
  );
};
