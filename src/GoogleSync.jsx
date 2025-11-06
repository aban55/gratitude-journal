import React, { useEffect, useRef, useState } from "react";

/**
 * GoogleSync.jsx
 * -------------------------------------
 * Auto-syncs gratitude entries & affirmations between LocalStorage and Google Drive.
 * - Restores from local immediately
 * - Merges with Drive data (no overwrite)
 * - Auto silent sign-in with token refresh
 * - Local JSON Export / Import included
 */

const CLIENT_ID =
  "814388665595-7f47f03kufur70ut0698l8o53qjhih76.apps.googleusercontent.com";
const API_KEY = "AIzaSyDJRs5xgDpvBe1QJk9RS_rZB1_igSzMRGc";
const SCOPES = "https://www.googleapis.com/auth/drive"; // ✅ Full drive access for listing & reading created files
const BACKUP_NAME = "gratitude_journal_backup.json";

export default function GoogleSync({ dataToSync, onRestore }) {
  const [accessToken, setAccessToken] = useState(
    localStorage.getItem("gj_access_token") || null
  );
  const [user, setUser] = useState(null);
  const [status, setStatus] = useState("idle");
  const [lastSynced, setLastSynced] = useState(
    localStorage.getItem("gj_last_synced") || null
  );
  const [lastRestored, setLastRestored] = useState(
    localStorage.getItem("gj_last_restored") || null
  );

  const tokenClientRef = useRef(null);
  const backupFileIdRef = useRef(null);

  // ---------------- Init Google Client ----------------
  useEffect(() => {
    let cancelled = false;
    const init = async () => {
      try {
        // Load Google Identity
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

        if (cancelled) return;

        tokenClientRef.current = window.google.accounts.oauth2.initTokenClient({
          client_id: CLIENT_ID,
          scope: SCOPES,
          prompt: "",
          callback: async (resp) => {
            if (resp?.access_token) {
              localStorage.setItem("gj_access_token", resp.access_token);
              setAccessToken(resp.access_token);
              await fetchUserProfile(resp.access_token);
            }
          },
        });

        // Always restore local first
        tryLocalRestore();

        // Silent sign-in
        if (accessToken) fetchUserProfile(accessToken);
        else tokenClientRef.current.requestAccessToken({ prompt: "" });
      } catch (e) {
        console.warn("[GoogleSync] init error:", e);
        setStatus("offline");
      }
    };

    init();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ---------------- Silent token refresh ----------------
  useEffect(() => {
    if (!tokenClientRef.current || !accessToken) return;
    const t = setInterval(() => {
      tokenClientRef.current.requestAccessToken({ prompt: "" });
    }, 55 * 60 * 1000);
    return () => clearInterval(t);
  }, [accessToken]);

  // ---------------- Local Restore ----------------
  const tryLocalRestore = () => {
    try {
      const entries = JSON.parse(localStorage.getItem("gratitudeEntries") || "[]");
      const affirmations = JSON.parse(localStorage.getItem("savedAffirmations") || "[]");
      if ((entries.length || affirmations.length) && onRestore) {
        onRestore({ entries, affirmations });
        console.log("📁 [GoogleSync] Restored local data.");
      }
    } catch {
      console.warn("[GoogleSync] local restore error");
    }
  };

  // ---------------- Fetch Profile & Auto Restore ----------------
  const fetchUserProfile = async (token) => {
    try {
      const res = await fetch("https://www.googleapis.com/oauth2/v2/userinfo", {
        headers: { Authorization: `Bearer ${token}` },
      });
      const u = await res.json();
      if (!u?.email) throw new Error("No profile");
      setUser(u);
      console.log("[GoogleSync] Signed in as:", u.email);
      await restoreAndMerge(token);
    } catch (e) {
      console.warn("[GoogleSync] Profile fetch failed:", e);
      setUser(null);
    }
  };

  // ---------------- Locate / Upload / Restore Helpers ----------------
  const locateBackup = async () => {
    if (backupFileIdRef.current) return backupFileIdRef.current;
    try {
      const res = await window.gapi.client.drive.files.list({
        q: `name='${BACKUP_NAME}' and trashed=false`,
        spaces: "drive",
        fields: "files(id,name,modifiedTime)",
      });
      const file = res.result?.files?.[0];
      if (file?.id) {
        backupFileIdRef.current = file.id;
        return file.id;
      }
      return null;
    } catch (e) {
      console.warn("[GoogleSync] locateBackup error:", e);
      return null;
    }
  };

  const mergeData = (localData, driveData) => {
    if (!driveData) return localData;
    const merged = { entries: [], affirmations: [] };

    const allEntries = [...(localData.entries || []), ...(driveData.entries || [])];
    const seen = new Set();
    for (const e of allEntries) {
      const key = `${e.date}-${e.section}-${e.question}-${e.entry}`;
      if (!seen.has(key)) {
        seen.add(key);
        merged.entries.push(e);
      }
    }

    const allAffirmations = [...(localData.affirmations || []), ...(driveData.affirmations || [])];
    const seenAff = new Set();
    for (const a of allAffirmations) {
      const key = a.quote || a.text;
      if (!seenAff.has(key)) {
        seenAff.add(key);
        merged.affirmations.push(a);
      }
    }

    merged.lastModified = new Date().toISOString();
    return merged;
  };

  const restoreAndMerge = async (token) => {
    try {
      const localData = {
        entries: JSON.parse(localStorage.getItem("gratitudeEntries") || "[]"),
        affirmations: JSON.parse(localStorage.getItem("savedAffirmations") || "[]"),
      };

      const fileId = await locateBackup();
      if (!fileId) {
        console.log("[GoogleSync] No Drive backup, uploading local data...");
        await uploadToDrive(localData);
        return;
      }

      const res = await fetch(
        `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      const driveData = await res.json();
      const merged = mergeData(localData, driveData);

      localStorage.setItem("gratitudeEntries", JSON.stringify(merged.entries));
      localStorage.setItem("savedAffirmations", JSON.stringify(merged.affirmations));
      localStorage.setItem("gratitude_local_backup", JSON.stringify(merged));

      if (onRestore) onRestore(merged);
      setLastRestored(new Date().toLocaleString());
      localStorage.setItem("gj_last_restored", new Date().toISOString());

      console.log("☁️ [GoogleSync] Merged and restored from Drive.");
      await uploadToDrive(merged);
    } catch (e) {
      console.warn("[GoogleSync] restoreAndMerge failed:", e);
    }
  };

  const uploadToDrive = async (payloadData) => {
    if (!accessToken) return;
    try {
      setStatus("syncing");
      const payload = JSON.stringify(payloadData || dataToSync || {}, null, 2);
      const blob = new Blob([payload], { type: "application/json" });
      const headers = { Authorization: `Bearer ${accessToken}` };
      let fileId = await locateBackup();

      if (fileId) {
        await fetch(
          `https://www.googleapis.com/upload/drive/v3/files/${fileId}?uploadType=media`,
          { method: "PATCH", headers, body: blob }
        );
      } else {
        const metadata = { name: BACKUP_NAME, mimeType: "application/json" };
        const form = new FormData();
        form.append(
          "metadata",
          new Blob([JSON.stringify(metadata)], { type: "application/json" })
        );
        form.append("file", blob);
        const res = await fetch(
          "https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart",
          { method: "POST", headers, body: form }
        );
        const created = await res.json();
        if (created?.id) backupFileIdRef.current = created.id;
      }

      localStorage.setItem("gratitude_local_backup", payload);
      localStorage.setItem("gj_last_synced", new Date().toISOString());
      setLastSynced(new Date().toLocaleString());
      setStatus("up_to_date");
      console.log("✅ [GoogleSync] Backup synced to Drive.");
    } catch (e) {
      console.warn("[GoogleSync] uploadToDrive failed:", e);
      setStatus("error");
    }
  };

  const restoreFromDrive = () => accessToken && restoreAndMerge(accessToken);

  const signIn = () =>
    tokenClientRef.current?.requestAccessToken({ prompt: "consent" });

  const signOut = () => {
    localStorage.removeItem("gj_access_token");
    setAccessToken(null);
    setUser(null);
    setStatus("offline");
  };

  useEffect(() => {
    if (!accessToken) return;
    const t = setTimeout(() => uploadToDrive(), 4000);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [JSON.stringify(dataToSync), accessToken]);

  // ---------------- UI ----------------
  return (
    <div className="space-y-3">
      <div
        className={`p-3 rounded-lg border text-sm text-center ${
          status === "up_to_date"
            ? "bg-green-50 border-green-300 text-green-700"
            : status === "syncing"
            ? "bg-yellow-50 border-yellow-300 text-yellow-800"
            : status === "error"
            ? "bg-red-50 border-red-300 text-red-700"
            : "bg-gray-50 border-gray-200 text-gray-700"
        }`}
      >
        {status === "idle" && "☁️ Drive sync ready"}
        {status === "syncing" && "🔄 Syncing with Drive…"}
        {status === "up_to_date" && "✅ Synced"}
        {status === "error" && "⚠️ Sync error — local only"}
        <div className="text-xs text-gray-500 mt-1 space-y-0.5">
          {lastSynced && <div>Last synced: {lastSynced}</div>}
          {lastRestored && <div>Last restored: {lastRestored}</div>}
        </div>
      </div>

      {!accessToken ? (
        <button
          onClick={signIn}
          className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
        >
          Sign in with Google
        </button>
      ) : (
        <div className="space-y-2">
          <div className="flex items-center justify-center gap-3">
            {user?.picture && (
              <img src={user.picture} alt="pfp" className="w-8 h-8 rounded-full" />
            )}
            <div className="text-left text-sm">
              <div className="font-medium">{user?.name}</div>
              <div className="text-gray-500">{user?.email}</div>
            </div>
          </div>

          <div className="flex flex-wrap justify-center gap-2">
            <button
              onClick={() => uploadToDrive()}
              className="bg-green-600 text-white px-3 py-2 rounded hover:bg-green-700"
            >
              Upload Backup
            </button>
            <button
              onClick={restoreFromDrive}
              className="bg-white border px-3 py-2 rounded hover:bg-gray-50"
            >
              Restore from Drive
            </button>
            <button
              onClick={signOut}
              className="bg-gray-300 text-gray-800 px-3 py-2 rounded hover:bg-gray-400"
            >
              Sign Out
            </button>
          </div>
        </div>
      )}

      {/* ──────────────────────────────── */}
      {/* Local Backup / Manual Export */}
      <div className="mt-4 border-t pt-3 text-sm">
        <h4 className="font-medium mb-1">💾 Local Backup</h4>
        <p className="text-xs text-gray-500 mb-2">
          Offline? Export or import manually anytime.
        </p>
        <div className="flex flex-wrap gap-2 justify-center">
          <button
            onClick={() => {
              const data = JSON.stringify(
                {
                  entries: JSON.parse(localStorage.getItem("gratitudeEntries") || "[]"),
                  affirmations: JSON.parse(
                    localStorage.getItem("savedAffirmations") || "[]"
                  ),
                  lastModified: new Date().toISOString(),
                },
                null,
                2
              );
              const blob = new Blob([data], { type: "application/json" });
              const url = URL.createObjectURL(blob);
              const a = document.createElement("a");
              a.href = url;
              a.download = "gratitude_local_backup.json";
              a.click();
            }}
            className="bg-gray-800 text-white px-3 py-2 rounded hover:bg-gray-900"
          >
            Export JSON
          </button>

          <label className="cursor-pointer bg-white border px-3 py-2 rounded hover:bg-gray-50">
            Import JSON
            <input
              type="file"
              accept="application/json"
              hidden
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (!file) return;
                const reader = new FileReader();
                reader.onload = (evt) => {
                  try {
                    const imported = JSON.parse(evt.target.result);
                    if (onRestore) onRestore(imported);
                    localStorage.setItem(
                      "gratitudeEntries",
                      JSON.stringify(imported.entries || [])
                    );
                    localStorage.setItem(
                      "savedAffirmations",
                      JSON.stringify(imported.affirmations || [])
                    );
                    localStorage.setItem(
                      "gratitude_local_backup",
                      JSON.stringify(imported)
                    );
                    alert("✅ Local backup restored successfully!");
                  } catch {
                    alert("❌ Invalid JSON file");
                  }
                };
                reader.readAsText(file);
              }}
            />
          </label>
        </div>
      </div>
    </div>
  );
}
