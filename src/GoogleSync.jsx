import React, { useEffect, useMemo, useRef, useState } from "react";
import { gapi } from "gapi-script";
import { motion } from "framer-motion";

const CLIENT_ID = "814388665595-7f47f03kufur70ut0698l8o53qjhih76.apps.googleusercontent.com";
const API_KEY   = "AIzaSyDJRs5xgDpvBe1QJk9RS_rZB1_igSzMRGc";
const SCOPES    = "https://www.googleapis.com/auth/drive.file";
const BACKUP_FILENAME = "gratitude_journal_backup.json";

export default function GoogleSync({
  dataToSync,
  onRestore,
  autoUploadTrigger,   // increment this from App when a save happens
  darkMode
}) {
  const [isReady, setIsReady] = useState(false);
  const [isSignedIn, setIsSignedIn] = useState(false);
  const [busy, setBusy] = useState(false);
  const [user, setUser] = useState(null);
  const latestPayloadRef = useRef(null);

  // keep latest payload
  useEffect(() => { latestPayloadRef.current = dataToSync; }, [dataToSync]);

  // Initialize GAPI
  useEffect(() => {
    const start = async () => {
      try {
        await gapi.client.init({
          apiKey: API_KEY,
          clientId: CLIENT_ID,
          scope: SCOPES,
          discoveryDocs: ["https://www.googleapis.com/discovery/v1/apis/drive/v3/rest"],
        });
        const auth = gapi.auth2.getAuthInstance();
        auth.isSignedIn.listen(setStateFromAuth);
        setStateFromAuth(auth.isSignedIn.get());
        setIsReady(true);
      } catch (err) {
        console.warn("⚠️ GAPI init failed:", err);
      }
    };
    gapi.load("client:auth2", start);
  }, []);

  function setStateFromAuth(signed) {
    setIsSignedIn(signed);
    if (signed) {
      const profile = gapi.auth2.getAuthInstance().currentUser.get().getBasicProfile();
      setUser({
        name: profile.getName(),
        email: profile.getEmail(),
        image: profile.getImageUrl(),
      });
    } else {
      setUser(null);
    }
  }

  const signIn  = () => gapi.auth2.getAuthInstance().signIn();
  const signOut = () => gapi.auth2.getAuthInstance().signOut();

  // Find or create the backup file ID
  async function getOrCreateFileId() {
    const search = await gapi.client.drive.files.list({
      q: `name='${BACKUP_FILENAME}' and trashed=false`,
      fields: "files(id,name)",
      spaces: "drive",
    });
    if (search.result.files?.length) return search.result.files[0].id;

    // create
    const metadata = { name: BACKUP_FILENAME, mimeType: "application/json" };
    const form = new FormData();
    form.append("metadata", new Blob([JSON.stringify(metadata)], { type: "application/json" }));
    form.append("file", new Blob([JSON.stringify({ created: Date.now() })], { type: "application/json" }));
    const res = await fetch("https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart", {
      method: "POST",
      headers: new Headers({ Authorization: "Bearer " + gapi.auth.getToken().access_token }),
      body: form,
    });
    const created = await res.json();
    return created.id;
  }

  // Overwrite upload (latest wins)
  async function uploadNow(payload) {
    if (!isSignedIn) return;
    setBusy(true);
    try {
      const fileId = await getOrCreateFileId();
      const blob = new Blob([JSON.stringify(payload ?? latestPayloadRef.current, null, 2)], {
        type: "application/json",
      });
      await gapi.client.request({
        path: `/upload/drive/v3/files/${fileId}`,
        method: "PATCH",
        params: { uploadType: "media" },
        body: blob,
      });
      setBusy(false);
      toast("✅ Synced to Drive");
      return true;
    } catch (e) {
      console.warn("Upload failed, scheduling background sync…", e);
      setBusy(false);
      // Try background sync fallback
      if ("serviceWorker" in navigator) {
        try {
          const reg = await navigator.serviceWorker.ready;
          navigator.serviceWorker.controller?.postMessage({
            type: "SET_GRATITUDE_PAYLOAD",
            payload: latestPayloadRef.current,
          });
          await reg.sync.register("sync-gratitude-data");
          toast("📶 Will sync when back online");
        } catch {}
      }
      return false;
    }
  }

  // Manual restore
  async function restoreNow() {
    if (!isSignedIn) return;
    setBusy(true);
    try {
      const search = await gapi.client.drive.files.list({
        q: `name='${BACKUP_FILENAME}' and trashed=false`,
        fields: "files(id,name)",
      });
      const file = search.result.files?.[0];
      if (!file) {
        setBusy(false);
        return toast("No backup found in Drive");
      }
      const res = await gapi.client.drive.files.get({ fileId: file.id, alt: "media" });
      setBusy(false);
      if (res.result && onRestore) onRestore(res.result);
      toast("✅ Restored from Drive");
    } catch (e) {
      console.warn(e);
      setBusy(false);
      toast("Restore failed");
    }
  }

  // Auto upload on save trigger
  useEffect(() => {
    if (autoUploadTrigger && isReady && isSignedIn) {
      uploadNow();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoUploadTrigger]);

  // Retry when back online
  useEffect(() => {
    const onlineHandler = () => isSignedIn && uploadNow();
    window.addEventListener("online", onlineHandler);
    return () => window.removeEventListener("online", onlineHandler);
  }, [isSignedIn]);

  const cloudColor = darkMode ? "#86efac" : "#16a34a";

  return (
    <div className="rounded-lg border p-4 mt-4">
      <div className="flex items-center gap-2 mb-2">
        <motion.div
          animate={{ y: busy ? [0, -2, 0] : 0, opacity: busy ? [1, 0.7, 1] : 1 }}
          transition={{ repeat: busy ? Infinity : 0, duration: 1.2 }}
          style={{ width: 20, height: 20, borderRadius: 6, background: cloudColor }}
        />
        <p className="font-semibold" style={{ color: cloudColor }}>
          Google Drive Sync
        </p>
      </div>

      {!isSignedIn ? (
        <button onClick={signIn} className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700">
          Sign in with Google Drive
        </button>
      ) : (
        <>
          <div className="flex items-center gap-3 mb-3">
            {user?.image && <img src={user.image} className="w-8 h-8 rounded-full" alt="" />}
            <div className="text-sm">
              <div className="font-medium">{user?.name}</div>
              <div className="text-gray-500">{user?.email}</div>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => uploadNow()}
              disabled={busy}
              className="bg-green-600 text-white px-3 py-2 rounded hover:bg-green-700 disabled:opacity-60"
            >
              {busy ? "Syncing…" : "Upload Backup"}
            </button>
            <button
              onClick={restoreNow}
              disabled={busy}
              className="bg-emerald-600 text-white px-3 py-2 rounded hover:bg-emerald-700 disabled:opacity-60"
            >
              Restore
            </button>
            <button onClick={signOut} className="bg-gray-300 px-3 py-2 rounded hover:bg-gray-400">
              Sign Out
            </button>
          </div>
        </>
      )}
    </div>
  );
}

// tiny toast
function toast(msg) {
  try {
    const el = document.createElement("div");
    el.textContent = msg;
    el.style.cssText =
      "position:fixed;left:50%;bottom:20px;transform:translateX(-50%);background:#111;color:#fff;padding:8px 12px;border-radius:10px;z-index:9999;font-size:12px;opacity:.95";
    document.body.appendChild(el);
    setTimeout(() => el.remove(), 1800);
  } catch {}
}
