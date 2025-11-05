import React, { useEffect, useRef, useState } from "react";

/** Configure your Google OAuth + Drive */
const CLIENT_ID =
  "814388665595-7f47f03kufur70ut0698l8o53qjhih76.apps.googleusercontent.com";
const API_KEY = "AIzaSyDJRs5xgDpvBe1QJk9RS_rZB1_igSzMRGc";
const SCOPES = "openid email profile https://www.googleapis.com/auth/drive.file";

const BACKUP_NAME = "gratitude_journal_backup.json";

export default function GoogleSync({ dataToSync, onRestore, darkMode }) {
  const [ready, setReady] = useState(false);
  const [token, setToken] = useState(null);
  const [user, setUser] = useState(null);
  const [status, setStatus] = useState("idle"); // idle | uploading | restoring | done | error

  const tokenClientRef = useRef(null);

  /** Load the GIS client if needed (safe if already loaded) */
  useEffect(() => {
    if (window.google && window.google.accounts && window.google.accounts.oauth2) {
      initTokenClient();
      setReady(true);
      return;
    }
    const s = document.createElement("script");
    s.src = "https://accounts.google.com/gsi/client";
    s.async = true;
    s.defer = true;
    s.onload = () => {
      initTokenClient();
      setReady(true);
    };
    s.onerror = () => console.error("Failed to load Google Identity Services script.");
    document.head.appendChild(s);
  }, []);

  /** Initialize token client */
  function initTokenClient() {
    tokenClientRef.current = window.google.accounts.oauth2.initTokenClient({
      client_id: CLIENT_ID,
      scope: SCOPES,
      callback: async (resp) => {
        if (resp.error) {
          console.warn("Token error:", resp);
          return;
        }
        setToken(resp.access_token);
        // fetch profile
        const info = await fetch("https://www.googleapis.com/oauth2/v3/userinfo", {
          headers: { Authorization: `Bearer ${resp.access_token}` },
        }).then((r) => r.json());
        setUser({ name: info.name, email: info.email, image: info.picture });

        // auto-restore after login
        try {
          await restoreFromDrive(resp.access_token);
        } catch (e) {
          console.warn("Auto-restore failed", e);
        }
      },
    });
  }

  /** Sign-in / Sign-out */
  const signIn = () => {
    if (!ready || !tokenClientRef.current) return;
    tokenClientRef.current.requestAccessToken({ prompt: "consent" });
  };

  const signOut = () => {
    if (!token) return;
    window.google.accounts.oauth2.revoke(token, () => {
      setToken(null);
      setUser(null);
      setStatus("idle");
    });
  };

  /** Drive helpers */
  async function driveList(accessToken) {
    const q = encodeURIComponent(`name='${BACKUP_NAME}'`);
    const url = `https://www.googleapis.com/drive/v3/files?q=${q}&fields=files(id,name,modifiedTime)`;
    const res = await fetch(url, { headers: { Authorization: `Bearer ${accessToken}` } });
    if (!res.ok) throw new Error("List failed");
    return res.json();
  }

  async function driveDownload(accessToken, id) {
    const url = `https://www.googleapis.com/drive/v3/files/${id}?alt=media&key=${API_KEY}`;
    const res = await fetch(url, { headers: { Authorization: `Bearer ${accessToken}` } });
    if (!res.ok) throw new Error("Download failed");
    return res.json();
  }

  async function driveUpload(accessToken, fileId, payload) {
    // multipart upload (metadata + file)
    const meta = { name: BACKUP_NAME, mimeType: "application/json" };
    const boundary = "gratz-" + Math.random().toString(36).slice(2);
    const body =
      `--${boundary}\r\n` +
      `Content-Type: application/json; charset=UTF-8\r\n\r\n` +
      JSON.stringify(meta) +
      `\r\n--${boundary}\r\n` +
      `Content-Type: application/json\r\n\r\n` +
      JSON.stringify(payload) +
      `\r\n--${boundary}--`;

    const method = fileId ? "PATCH" : "POST";
    const url = fileId
      ? `https://www.googleapis.com/upload/drive/v3/files/${fileId}?uploadType=multipart&key=${API_KEY}`
      : `https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&key=${API_KEY}`;

    const res = await fetch(url, {
      method,
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": `multipart/related; boundary=${boundary}`,
      },
      body,
    });
    if (!res.ok) throw new Error("Upload failed");
    return res.json();
  }

  /** Actions */
  const uploadToDrive = async () => {
    if (!token) return alert("Please sign in first.");
    setStatus("uploading");
    try {
      const list = await driveList(token);
      const fileId = list.files?.[0]?.id;
      await driveUpload(token, fileId, dataToSync || {});
      setStatus("done");
      alert("✅ Synced to Google Drive.");
    } catch (e) {
      console.error(e);
      setStatus("error");
      alert("❌ Upload failed.");
    }
  };

  async function restoreFromDrive(accessToken = token) {
    if (!accessToken) return;
    setStatus("restoring");
    const list = await driveList(accessToken);
    const file = list.files?.[0];
    if (!file) {
      setStatus("idle");
      return;
    }
    const data = await driveDownload(accessToken, file.id);
    if (onRestore) onRestore(data);
    setStatus("done");
  }

  /* ----------------------- UI ----------------------- */
  return (
    <div className="text-sm">
      {!token ? (
        <button
          onClick={signIn}
          disabled={!ready}
          className="px-4 py-2 rounded bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-60"
        >
          Sign in with Google Drive
        </button>
      ) : (
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            {user?.image && (
              <img src={user.image} alt="" className="w-8 h-8 rounded-full" />
            )}
            <div>
              <div className="font-medium">{user?.name}</div>
              <div className="text-xs opacity-80">{user?.email}</div>
            </div>
          </div>

          <div className="flex gap-2">
            <button
              onClick={uploadToDrive}
              disabled={status === "uploading"}
              className="px-3 py-2 rounded bg-green-600 text-white hover:bg-green-700"
            >
              {status === "uploading" ? "Syncing…" : "Upload Backup"}
            </button>
            <button
              onClick={() => restoreFromDrive()}
              className="px-3 py-2 rounded bg-gray-200 hover:bg-gray-300"
            >
              Restore Now
            </button>
            <button
              onClick={signOut}
              className={`px-3 py-2 rounded ${
                darkMode ? "bg-gray-700 text-gray-100" : "bg-gray-300 text-gray-900"
              } hover:opacity-90`}
            >
              Sign Out
            </button>
          </div>

          {status === "restoring" && (
            <p className="opacity-75">🔄 Restoring from Drive…</p>
          )}
          {status === "done" && <p className="text-green-600">✅ Up to date</p>}
          {status === "error" && <p className="text-red-600">❌ Error</p>}
        </div>
      )}
    </div>
  );
}
