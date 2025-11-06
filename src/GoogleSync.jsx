import React, { useEffect, useMemo, useRef, useState } from "react";

const CLIENT_ID = "814388665595-7f47f03kufur70ut0698l8o53qjhih76.apps.googleusercontent.com";
const API_KEY = "AIzaSyDJRs5xgDpvBe1QJk9RS_rZB1_igSzMRGc";
const SCOPES = "https://www.googleapis.com/auth/drive.appdata";
const BACKUP_NAME = "gratitude_journal_backup.json";

export default function GoogleSync({ dataToSync, onRestore }) {
  const [gapiReady, setGapiReady] = useState(false);
  const [driveReady, setDriveReady] = useState(false);
  const [status, setStatus] = useState("idle");
  const [message, setMessage] = useState("");
  const [user, setUser] = useState(null);
  const [backupFile, setBackupFile] = useState(null);
  const tokenClientRef = useRef(null);
  const [accessToken, setAccessToken] = useState(
    () => localStorage.getItem("gj_access_token") || null
  );

  const log = (...a) => console.log("[GoogleSync]", ...a);
  const isSignedIn = useMemo(() => !!accessToken, [accessToken]);

  // -------- Google init ----------
  useEffect(() => {
    let cancel = false;
    (async () => {
      try {
        await loadScripts();
        if (cancel) return;
        setGapiReady(true);
        setDriveReady(true);
        initTokenClient();

        // Restore locally first
        const localData = localStorage.getItem("gratitude_local_backup");
        if (localData) {
          try {
            const parsed = JSON.parse(localData);
            if (onRestore) onRestore(parsed);
            log("✅ Restored from local backup");
          } catch {}
        }

        // If already signed in, try restoring from Drive
        if (accessToken) fetchUserProfile(accessToken);
      } catch (e) {
        log("Init error:", e);
      }
    })();
    return () => (cancel = true);
  }, []);

  const loadScripts = async () => {
    if (!window.google?.accounts) {
      await new Promise((r) => {
        const s = document.createElement("script");
        s.src = "https://accounts.google.com/gsi/client";
        s.onload = r;
        document.body.appendChild(s);
      });
    }
    if (!window.gapi?.client) {
      await new Promise((r) => {
        const s = document.createElement("script");
        s.src = "https://apis.google.com/js/api.js";
        s.onload = async () => {
          await window.gapi.load("client", async () => {
            await window.gapi.client.init({
              apiKey: API_KEY,
              discoveryDocs: [
                "https://www.googleapis.com/discovery/v1/apis/drive/v3/rest",
              ],
            });
            r();
          });
        };
        document.body.appendChild(s);
      });
    }
  };

  const initTokenClient = () => {
    tokenClientRef.current = window.google.accounts.oauth2.initTokenClient({
      client_id: CLIENT_ID,
      scope: SCOPES,
      prompt: "",
      callback: (resp) => {
        if (resp?.access_token) {
          localStorage.setItem("gj_access_token", resp.access_token);
          setAccessToken(resp.access_token);
          fetchUserProfile(resp.access_token);
        }
      },
    });
  };

  const fetchUserProfile = async (token) => {
    try {
      const res = await fetch("https://www.googleapis.com/oauth2/v2/userinfo", {
        headers: { Authorization: `Bearer ${token}` },
      });
      const profile = await res.json();
      setUser(profile);
      log("Signed in as:", profile);
      await locateBackup();
      await restoreFromDrive(); // auto-restore
    } catch (e) {
      log("Profile fetch failed:", e);
    }
  };

  // -------- Drive -----------
  const locateBackup = async () => {
    const res = await window.gapi.client.drive.files.list({
      q: `name='${BACKUP_NAME}' and trashed=false`,
      spaces: "appDataFolder",
      fields: "files(id,name,modifiedTime)",
    });
    const file = res.result.files?.[0];
    setBackupFile(file || null);
    return file;
  };

  const uploadToDrive = async () => {
    if (!isSignedIn) return;
    const blob = new Blob([JSON.stringify(dataToSync)], {
      type: "application/json",
    });
    const headers = { Authorization: `Bearer ${accessToken}` };
    const existing = backupFile || (await locateBackup());
    const url = existing
      ? `https://www.googleapis.com/upload/drive/v3/files/${existing.id}?uploadType=media`
      : "https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart";
    const method = existing ? "PATCH" : "POST";
    await fetch(url, {
      method,
      headers,
      body: existing
        ? blob
        : JSON.stringify({
            name: BACKUP_NAME,
            parents: ["appDataFolder"],
          }),
    });
    log("✅ Synced to Drive");
    setStatus("up_to_date");
  };

  const restoreFromDrive = async () => {
    if (!isSignedIn) return;
    try {
      const file = backupFile || (await locateBackup());
      if (!file?.id) return;
      const res = await fetch(
        `https://www.googleapis.com/drive/v3/files/${file.id}?alt=media`,
        { headers: { Authorization: `Bearer ${accessToken}` } }
      );
      const json = await res.json();
      if (onRestore) onRestore(json);
      log("✅ Restored from Drive");
    } catch (e) {
      log("Restore failed:", e);
    }
  };

  const signIn = () =>
    tokenClientRef.current?.requestAccessToken({ prompt: "consent" });
  const signOut = () => {
    localStorage.removeItem("gj_access_token");
    setAccessToken(null);
    setUser(null);
  };

  // -------- Local export/import ----------
  const exportLocal = () => {
    const json = JSON.stringify(dataToSync, null, 2);
    localStorage.setItem("gratitude_local_backup", json);
    const blob = new Blob([json], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = BACKUP_NAME;
    a.click();
  };

  const importLocal = (e) => {
    const f = e.target.files?.[0];
    if (!f) return;
    f.text().then((t) => {
      try {
        const j = JSON.parse(t);
        onRestore(j);
        localStorage.setItem("gratitude_local_backup", t);
      } catch {}
    });
  };

  return (
    <div className="space-y-4">
      <div className="border rounded-lg p-4">
        <h3 className="font-semibold text-green-700 mb-2">☁️ Google Drive Sync</h3>
        {!isSignedIn ? (
          <button
            onClick={signIn}
            className="bg-blue-600 text-white px-4 py-2 rounded"
          >
            Sign in with Google
          </button>
        ) : (
          <>
            <div className="flex gap-2 items-center mb-2">
              {user?.picture && (
                <img src={user.picture} alt="avatar" className="w-8 h-8 rounded-full" />
              )}
              <div>
                <div className="font-medium">{user?.name}</div>
                <div className="text-sm text-gray-500">{user?.email}</div>
              </div>
            </div>
            <div className="flex gap-2">
              <button
                onClick={uploadToDrive}
                className="bg-green-600 text-white px-3 py-2 rounded"
              >
                Upload Backup
              </button>
              <button
                onClick={restoreFromDrive}
                className="bg-gray-100 px-3 py-2 rounded"
              >
                Restore Backup
              </button>
              <button
                onClick={signOut}
                className="bg-gray-300 px-3 py-2 rounded"
              >
                Sign Out
              </button>
            </div>
          </>
        )}
      </div>

      <div className="border rounded-lg p-4">
        <h3 className="font-semibold mb-2">💾 Local Backup</h3>
        <div className="flex gap-2 items-center">
          <button
            onClick={exportLocal}
            className="bg-green-600 text-white px-3 py-2 rounded"
          >
            Export JSON
          </button>
          <label className="bg-gray-100 px-3 py-2 rounded cursor-pointer">
            Import JSON
            <input type="file" accept="application/json" hidden onChange={importLocal} />
          </label>
        </div>
      </div>
    </div>
  );
}
