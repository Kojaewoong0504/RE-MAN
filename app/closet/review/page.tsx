import Link from "next/link";
import { ClosetDraftReviewClient } from "@/components/closet/ClosetDraftReviewClient";
import { AccountAccessButton } from "@/components/common/AccountAccessButton";
import { BottomTabNav } from "@/components/common/BottomTabNav";

export default function ClosetReviewPage() {
  return (
    <main className="app-shell flex min-h-screen flex-col justify-between">
      <div className="poster-grid pt-6">
        <div className="app-header">
          <div className="flex items-center gap-4">
            <Link className="app-back-button" href="/closet/batch">
              ←
            </Link>
            <div>
              <p className="app-brand">RE:MAN</p>
              <p className="app-subbrand">Review</p>
            </div>
          </div>
          <AccountAccessButton />
        </div>
        <ClosetDraftReviewClient />
      </div>
      <BottomTabNav />
    </main>
  );
}
