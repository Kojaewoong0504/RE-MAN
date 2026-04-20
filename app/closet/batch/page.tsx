import Link from "next/link";
import { BatchCaptureClient } from "@/components/closet/BatchCaptureClient";
import { AccountAccessButton } from "@/components/common/AccountAccessButton";
import { BottomTabNav } from "@/components/common/BottomTabNav";

export default function ClosetBatchPage() {
  return (
    <main className="app-shell flex min-h-screen flex-col justify-between">
      <div className="poster-grid pt-6">
        <div className="app-header">
          <div className="flex items-center gap-4">
            <Link className="app-back-button" href="/closet">
              ←
            </Link>
            <div>
              <p className="app-brand">RE:MAN</p>
              <p className="app-subbrand">Closet Capture</p>
            </div>
          </div>
          <AccountAccessButton />
        </div>
        <BatchCaptureClient />
      </div>
      <BottomTabNav />
    </main>
  );
}
