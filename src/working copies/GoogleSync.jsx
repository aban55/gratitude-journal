import React, { useEffect, useRef, useState } from "react";

/**
 * GoogleSync.jsx
 * - Startup: restore local, then silent Drive restore if signed in
 * - Bidirectional merge (no overwrite), de-dup by stable keys
 * - Single Drive file (no duplicates) via encoded query + PATCH update
 * - Local export/import preserved
 * - Minimal console noise
 */

const CLIENT_ID =
  "814388665595-7f47f03kufur70ut0698l8o53qjhih76.apps.googleusercontent.com";
const SCOPES = "https://www.googleapis.com/auth/drive";
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

  // ---------- INIT ----------
  useEffect(() => {
    const init = async () => {
      try {
        if (!window.google?.accounts) {
          await new Promise((res) => {
            const s = document.createElement("script");
            s.src = "https://accounts.google.com/gsi/client";
            s.onload = res;
            document.body.appendChild(s);
          });
        }

        tokenClientRef.current = window.google.accounts.oauth2.initTokenClient({
          client_id: CLIENT_ID,
          scope: SCOPES,
          prompt: "", // silent if previously granted
          callback: async (resp) => {
            if (resp?.access_token) {
              localStorage.setItem("gj_access_token", resp.access_token);
              setAccessToken(resp.access_token);
              await fetchUserProfile(resp.access_token);
            }
          },
        });

        // Load local immediately (good UX offline)
        tryLocalRestore();

        // Silent token reuse if possible
        if (accessToken) fetchUserProfile(accessToken);
        else tokenClientRef.current.requestAccessToken({ prompt: "" });
      } catch (err) {
        console.warn("[GoogleSync] init error:", err);
      }
    };
    init();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ---------- LOCAL RESTORE ----------
  const tryLocalRestore = () => {
    try {
      const entries = JSON.parse(localStorage.getItem("gratitudeEntries") || "[]");
      const affirmations = JSON.parse(localStorage.getItem("savedAffirmations") || "[]");
      if ((entries.length || affirmations.length) && onRestore) {
        onRestore({ entries: [...entries], affirmations: [...affirmations] });
      }
    } catch {
      /* noop */
    }
  };

  // ---------- PROFILE ----------
  const fetchUserProfile = async (token) => {
    try {
      const res = await fetch("https://www.googleapis.com/oauth2/v2/userinfo", {
        headers: { Authorization: `Bearer ${token}` },
      });
      const u = await res.json();
      if (!u?.email) throw new Error("No profile");
      setUser(u);
      await restoreAndMerge(token);
    } catch {
      setUser(null);
    }
  };

  // ---------- FIND BACKUP FILE (single file; no duplicates) ----------
  const locateBackup = async () => {
    if (!accessToken) return null;
    if (backupFileIdRef.current) return backupFileIdRef.current;

    try {
      // IMPORTANT: encode query so we actually find the existing file
      const q = encodeURIComponent(`name='${BACKUP_NAME}' and trashed=false`);
      const res = await fetch(
        `https://www.googleapis.com/drive/v3/files?q=${q}&spaces=drive&fields=files(id,name,modifiedTime)`,
        { headers: { Authorization: `Bearer ${accessToken}` } }
      );

      if (res.status === 401 && tokenClientRef.current) {
        await refreshToken();
        return locateBackup();
      }

      if (!res.ok) throw new Error(`Drive list failed: ${res.status}`);
      const data = await res.json();
      const file = data.files?.[0];
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

  const refreshToken = () =>
    new Promise((resolve) => {
      tokenClientRef.current.callback = (resp) => {
        if (resp?.access_token) {
          localStorage.setItem("gj_access_token", resp.access_token);
          setAccessToken(resp.access_token);
        }
        resolve();
      };
      tokenClientRef.current.requestAccessToken({ prompt: "" });
    });

  // ---------- MERGE ----------
  const mergeData = (localData, driveData) => {
    if (!driveData) return localData || { entries: [], affirmations: [] };
    const merged = { entries: [], affirmations: [] };

    // Entries: prefer id if present; else composite
    const allEntries = [...(localData?.entries || []), ...(driveData?.entries || [])];
    const seen = new Set();
    for (const e of allEntries) {
      const key = e.id || `${e.date}|${e.section}|${e.question}|${e.entry}`;
      if (!seen.has(key)) {
        seen.add(key);
        merged.entries.push(e);
      }
    }

    // Affirmations
    const allAff = [...(localData?.affirmations || []), ...(driveData?.affirmations || [])];
    const seenAff = new Set();
    for (const a of allAff) {
      const key = a.quote || a.text || JSON.stringify(a);
      if (!seenAff.has(key)) {
        seenAff.add(key);
        merged.affirmations.push(a);
      }
    }

    merged.lastModified = new Date().toISOString();
    return merged;
  };

  // ---------- RESTORE + MERGE + RESYNC ----------
  const restoreAndMerge = async (token) => {
    try {
      const localData = {
        entries: JSON.parse(localStorage.getItem("gratitudeEntries") || "[]"),
        affirmations: JSON.parse(localStorage.getItem("savedAffirmations") || "[]"),
      };

      const fileId = await locateBackup();
      if (!fileId) {
        // First time: push local up
        await uploadToDrive(localData);
        return;
      }

      const res = await fetch(
        `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      if (!res.ok) throw new Error(`Drive download failed: ${res.status}`);

      const driveData = await res.json();
      const merged = mergeData(localData, driveData);

      // Update local + app state
      localStorage.setItem("gratitudeEntries", JSON.stringify(merged.entries));
      localStorage.setItem("savedAffirmations", JSON.stringify(merged.affirmations));
      localStorage.setItem("gratitude_local_backup", JSON.stringify(merged));
      if (onRestore) onRestore({ ...merged }); // clone to trigger React re-render

      const now = new Date().toLocaleString();
      setLastRestored(now);
      localStorage.setItem("gj_last_restored", new Date().toISOString());

      // Keep Drive consistent with merged view
      await uploadToDrive(merged);
    } catch (e) {
      console.warn("[GoogleSync] restoreAndMerge failed:", e);
    }
  };

  // ---------- UPLOAD (create/update same file) ----------
  const uploadToDrive = async (payloadData) => {
    if (!accessToken) return;
    try {
      setStatus("syncing");
      const payload = JSON.stringify(payloadData || dataToSync || {}, null, 2);
      const fileId = await locateBackup();

      // Ensure token is valid
      const info = await fetch(
        "https://www.googleapis.com/oauth2/v2/tokeninfo?access_token=" + accessToken
      );
      if (!info.ok) {
        await refreshToken();
      }

      if (fileId) {
        // Update file content (no new files)
        const res = await fetch(
          `https://www.googleapis.com/upload/drive/v3/files/${fileId}?uploadType=media`,
          {
            method: "PATCH",
            headers: {
              Authorization: `Bearer ${localStorage.getItem("gj_access_token")}`,
              "Content-Type": "application/json",
            },
            body: payload,
          }
        );
        if (!res.ok) throw new Error(`Drive update failed: ${res.status}`);
      } else {
        // Create once
        const metadata = { name: BACKUP_NAME, mimeType: "application/json" };
        const form = new FormData();
        form.append(
          "metadata",
          new Blob([JSON.stringify(metadata)], { type: "application/json" })
        );
        form.append("file", new Blob([payload], { type: "application/json" }));

        const res = await fetch(
          "https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart",
          {
            method: "POST",
            headers: { Authorization: `Bearer ${localStorage.getItem("gj_access_token")}` },
            body: form,
          }
        );
        const created = await res.json();
        if (created?.id) backupFileIdRef.current = created.id;
      }

      localStorage.setItem("gratitude_local_backup", payload);
      localStorage.setItem("gj_last_synced", new Date().toISOString());
      setLastSynced(new Date().toLocaleString());
      setStatus("up_to_date");
    } catch (e) {
      console.warn("[GoogleSync] uploadToDrive failed:", e);
      setStatus("error");
    }
  };

  // ---------- UI ACTIONS ----------
  const restoreFromDrive = () => accessToken && restoreAndMerge(accessToken);
  const signIn = () => tokenClientRef.current?.requestAccessToken({ prompt: "consent" });
  const signOut = () => {
    localStorage.removeItem("gj_access_token");
    setAccessToken(null);
    setUser(null);
    setStatus("offline");
  };

  // Auto-sync on data change with debounce
  useEffect(() => {
    if (!accessToken) return;
    const t = setTimeout(() => uploadToDrive(), 1200);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [JSON.stringify(dataToSync), accessToken]);

  // ---------- UI ----------
  return (
    <div className="space-y-3">
      {/* Sync Banner */}
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
        {status === "up_to_date" && "✅ Synced with Drive"}
        {status === "error" && "⚠️ Sync error — using local only"}
        <div className="text-xs text-gray-500 mt-1 space-y-0.5">
          {lastSynced && <div>Last synced: {lastSynced}</div>}
          {lastRestored && <div>Last restored: {lastRestored}</div>}
        </div>
      </div>

      {/* Auth UI */}
      {!accessToken ? (
        <button
          onClick={signIn}
          className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
        >
          Sign in with Google
        </button>
      ) : (
        <div className="space-y-2">
          {user && (
            <div className="flex items-center justify-center gap-3">
              {user.picture && (
                <img src={user.picture} alt="pfp" className="w-8 h-8 rounded-full" />
              )}
              <div className="text-left text-sm">
                <div className="font-medium">{user.name}</div>
                <div className="text-gray-500">{user.email}</div>
              </div>
            </div>
          )}
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

      {/* Local Import / Export */}
      <div className="mt-4 border-t pt-3 text-sm">
        <h4 className="font-medium mb-1">💾 Local Backup</h4>
        <p className="text-xs text-gray-500 mb-2">Offline? Export or import manually anytime.</p>
        <div className="flex flex-wrap gap-2 justify-center">
          <button
            onClick={() => {
              const data = JSON.stringify(
                {
                  entries: JSON.parse(localStorage.getItem("gratitudeEntries") || "[]"),
                  affirmations: JSON.parse(localStorage.getItem("savedAffirmations") || "[]"),
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
                    // Save locally
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
                    // Reflect in UI
                    onRestore && onRestore({ ...imported });
                    // Push to Drive too (keep all devices consistent)
                    uploadToDrive(imported);
                    alert("✅ Local backup restored.");
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
