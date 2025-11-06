import React, { useEffect, useRef, useState } from "react";

const CLIENT_ID = "814388665595-7f47f03kufur70ut0698l8o53qjhih76.apps.googleusercontent.com";
const API_KEY = "AIzaSyDJRs5xgDpvBe1QJk9RS_rZB1_igSzMRGc";
const SCOPES = "https://www.googleapis.com/auth/drive.appdata";
const BACKUP_NAME = "gratitude_journal_backup.json";

export default function GoogleSync({ dataToSync, onRestore }) {
  const [accessToken, setAccessToken] = useState(localStorage.getItem("gj_access_token") || null);
  const [user, setUser] = useState(null);
  const [status, setStatus] = useState("idle");
  const [lastRestored, setLastRestored] = useState(localStorage.getItem("gj_last_restored") || null);
  const [lastSynced, setLastSynced] = useState(localStorage.getItem("gj_last_synced") || null);
  const tokenClientRef = useRef(null);

  // ---------------- INIT GOOGLE API ----------------
  useEffect(() => {
    const loadGoogle = async () => {
      try {
        // Load GIS
        if (!window.google?.accounts) {
          await new Promise((res) => {
            const s = document.createElement("script");
            s.src = "https://accounts.google.com/gsi/client";
            s.onload = res;
            document.body.appendChild(s);
          });
        }

        // Load GAPI
        if (!window.gapi?.client) {
          await new Promise((res) => {
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
                res();
              });
            };
            document.body.appendChild(s);
          });
        }

        // Init OAuth client
        tokenClientRef.current = window.google.accounts.oauth2.initTokenClient({
          client_id: CLIENT_ID,
          scope: SCOPES,
          prompt: "",
          callback: (resp) => {
            if (resp?.access_token) {
              localStorage.setItem("gj_access_token", resp.access_token);
              setAccessToken(resp.access_token);
              fetchUser(resp.access_token);
            }
          },
        });

        // Restore if already signed in
        if (accessToken) fetchUser(accessToken);
        else tokenClientRef.current.requestAccessToken({ prompt: "" });
      } catch (e) {
        console.warn("[GoogleSync] Init error:", e);
      }
    };
    loadGoogle();
  }, []);

  // ---------------- FETCH PROFILE ----------------
  const fetchUser = async (token) => {
    try {
      const res = await fetch("https://www.googleapis.com/oauth2/v2/userinfo", {
        headers: { Authorization: `Bearer ${token}` },
      });
      const u = await res.json();
      if (u?.email) {
        setUser(u);
        console.log("[GoogleSync] Signed in as:", u.email);
        await autoRestore();
      }
    } catch {
      setUser(null);
      setStatus("offline");
    }
  };

  // ---------------- AUTO RESTORE ----------------
  const autoRestore = async () => {
    try {
      // Step 1: Local restore
      const localBackup = localStorage.getItem("gratitude_local_backup");
      if (localBackup) {
        const parsed = JSON.parse(localBackup);
        if (onRestore) onRestore(parsed);
        setLastRestored(new Date().toLocaleString());
        console.log("📁 Restored from local backup.");
        return;
      }

      // Step 2: Drive restore if signed in
      if (accessToken) {
        const file = await locateBackup();
        if (file?.id) {
          const res = await fetch(
            `https://www.googleapis.com/drive/v3/files/${file.id}?alt=media`,
            { headers: { Authorization: `Bearer ${accessToken}` } }
          );
          const json = await res.json();
          if (onRestore && json) onRestore(json);
          setLastRestored(new Date().toLocaleString());
          localStorage.setItem("gj_last_restored", new Date().toISOString());
          console.log("☁️ Restored from Drive.");
        }
      }
    } catch (e) {
      console.warn("[GoogleSync] Auto restore failed:", e);
    }
  };

  // ---------------- DRIVE HELPERS ----------------
  const locateBackup = async () => {
    try {
      const res = await window.gapi.client.drive.files.list({
        q: `name='${BACKUP_NAME}' and trashed=false`,
        spaces: "appDataFolder",
        fields: "files(id,name,modifiedTime)",
      });
      return res.result.files?.[0];
    } catch (e) {
      console.warn("[GoogleSync] locateBackup error:", e);
      return null;
    }
  };

  const uploadBackup = async () => {
    if (!accessToken) return;
    try {
      const blob = new Blob([JSON.stringify(dataToSync)], { type: "application/json" });
      const file = await locateBackup();
      const headers = { Authorization: `Bearer ${accessToken}` };

      if (file?.id) {
        await fetch(
          `https://www.googleapis.com/upload/drive/v3/files/${file.id}?uploadType=media`,
          { method: "PATCH", headers, body: blob }
        );
      } else {
        const meta = {
          name: BACKUP_NAME,
          mimeType: "application/json",
          parents: ["appDataFolder"],
        };
        const form = new FormData();
        form.append(
          "metadata",
          new Blob([JSON.stringify(meta)], { type: "application/json" })
        );
        form.append("file", blob);
        await fetch(
          "https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart",
          { method: "POST", headers, body: form }
        );
      }

      const ts = new Date().toISOString();
      setLastSynced(ts);
      localStorage.setItem("gj_last_synced", ts);
      setStatus("✅ Synced");
    } catch (e) {
      console.warn("[GoogleSync] uploadBackup error:", e);
      setStatus("⚠️ Sync failed");
    }
  };

  // ---------------- MANUAL RESTORE ----------------
  const restoreFromDrive = async () => {
    if (!accessToken) return;
    try {
      const file = await locateBackup();
      if (!file?.id) return alert("No backup found in Drive.");
      const res = await fetch(
        `https://www.googleapis.com/drive/v3/files/${file.id}?alt=media`,
        { headers: { Authorization: `Bearer ${accessToken}` } }
      );
      const json = await res.json();
      if (onRestore && json) onRestore(json);
      const ts = new Date().toLocaleString();
      setLastRestored(ts);
      localStorage.setItem("gj_last_restored", ts);
      setStatus("✅ Restored from Drive");
    } catch (e) {
      console.warn("[GoogleSync] restoreFromDrive error:", e);
      setStatus("⚠️ Restore failed");
    }
  };

  // ---------------- SIGN IN / OUT ----------------
  const signIn = () =>
    tokenClientRef.current?.requestAccessToken({ prompt: "consent" });
  const signOut = () => {
    localStorage.removeItem("gj_access_token");
    setAccessToken(null);
    setUser(null);
  };

  // ---------------- AUTO SYNC ----------------
  useEffect(() => {
    if (!accessToken || !dataToSync) return;
    const t = setInterval(uploadBackup, 180000); // every 3 mins
    return () => clearInterval(t);
  }, [dataToSync, accessToken]);

  // ---------------- UI ----------------
  return (
    <div className="mt-6 text-sm text-center">
      <div
        className={`p-3 rounded-lg border ${
          status.startsWith("✅")
            ? "bg-green-50 border-green-300 text-green-700"
            : status.startsWith("⚠️")
            ? "bg-red-50 border-red-300 text-red-700"
            : "bg-gray-50 border-gray-200 text-gray-700"
        }`}
      >
        <p>{status === "idle" ? "☁️ Drive sync ready" : status}</p>
        {lastSynced && (
          <p className="text-xs text-gray-500 mt-1">
            Last synced: {new Date(lastSynced).toLocaleString()}
          </p>
        )}
        {lastRestored && (
          <p className="text-xs text-gray-500">
            Last restored: {lastRestored}
          </p>
        )}
      </div>

      {user ? (
        <div className="mt-3 space-y-2">
          <div className="flex items-center justify-center gap-3">
            <img
              src={user.picture}
              alt="avatar"
              className="w-8 h-8 rounded-full"
            />
            <div className="text-left">
              <p className="font-medium">{user.name}</p>
              <p className="text-xs text-gray-500">{user.email}</p>
            </div>
          </div>

          <div className="flex justify-center gap-2 mt-3">
            <button
              onClick={uploadBackup}
              className="bg-green-600 text-white px-3 py-1 rounded"
            >
              Upload Backup
            </button>
            <button
              onClick={restoreFromDrive}
              className="bg-blue-600 text-white px-3 py-1 rounded"
            >
              Restore from Drive
            </button>
            <button
              onClick={signOut}
              className="bg-gray-400 text-white px-3 py-1 rounded"
            >
              Sign Out
            </button>
          </div>
        </div>
      ) : (
        <button
          className="mt-3 bg-blue-600 text-white px-4 py-2 rounded"
          onClick={signIn}
        >
          Sign in with Google
        </button>
      )}
    </div>
  );
}
