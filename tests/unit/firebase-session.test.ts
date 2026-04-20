import { beforeEach, describe, expect, it, vi } from "vitest";

const authStateReady = vi.fn();
const getIdToken = vi.fn();
const setPersistenceMock = vi.fn();
const signInWithPopupMock = vi.fn();
const signInWithRedirectMock = vi.fn();
const getRedirectResultMock = vi.fn();

vi.mock("@/lib/firebase/client", () => ({
  getFirebaseAuthInstance: () => ({
    authStateReady
  }),
  hasFirebaseClientConfig: () => true
}));

vi.mock("firebase/auth", () => ({
  browserLocalPersistence: "local",
  GoogleAuthProvider: vi.fn(function GoogleAuthProvider() {
    return { providerId: "google.com" };
  }),
  getRedirectResult: getRedirectResultMock,
  setPersistence: setPersistenceMock,
  signInWithPopup: signInWithPopupMock,
  signInWithRedirect: signInWithRedirectMock,
  signOut: vi.fn()
}));

const credential = {
  user: {
    uid: "user-1",
    email: "user@example.com",
    displayName: "User One",
    photoURL: "https://example.com/user.png",
    getIdToken
  }
};

describe("firebase session", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authStateReady.mockResolvedValue(undefined);
    getIdToken.mockResolvedValue("id-token-1");
    setPersistenceMock.mockResolvedValue(undefined);
    signInWithPopupMock.mockResolvedValue(credential);
    signInWithRedirectMock.mockResolvedValue(undefined);
    getRedirectResultMock.mockResolvedValue(null);
  });

  it("falls back to redirect login when Google popup is blocked", async () => {
    signInWithPopupMock.mockRejectedValueOnce(
      Object.assign(new Error("Firebase: Error (auth/popup-blocked)."), {
        code: "auth/popup-blocked"
      })
    );

    const { signInWithGoogleSession } = await import("@/lib/firebase/session");

    const result = await signInWithGoogleSession();

    expect(result).toEqual({ status: "redirecting" });
    expect(signInWithRedirectMock).toHaveBeenCalledTimes(1);
  });

  it("uses redirect first when requested for mobile or in-app browsers", async () => {
    const { signInWithGoogleSession } = await import("@/lib/firebase/session");

    const result = await signInWithGoogleSession({ preferRedirect: true });

    expect(result).toEqual({ status: "redirecting" });
    expect(signInWithPopupMock).not.toHaveBeenCalled();
    expect(signInWithRedirectMock).toHaveBeenCalledTimes(1);
  });

  it("normalizes a completed redirect login into an authenticated session", async () => {
    getRedirectResultMock.mockResolvedValueOnce(credential);

    const { completeGoogleRedirectSession } = await import("@/lib/firebase/session");

    const result = await completeGoogleRedirectSession();

    expect(result).toEqual({
      status: "authenticated",
      uid: "user-1",
      email: "user@example.com",
      displayName: "User One",
      photoURL: "https://example.com/user.png",
      idToken: "id-token-1"
    });
  });
});
