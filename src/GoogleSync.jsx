import React, { useEffect, useState } from "react";
import { gapi } from "gapi-script";
import { motion, AnimatePresence } from "framer-motion";
import { logEvent } from "./analytics";

const CLIENT_ID = "814388665595-7f47f03kufur70ut0698l8o53qjhih76.apps.googleusercontent.com";
const API_KEY = "AIzaSyDJRs5xgDpvBe1QJk9RS_rZB1_igSzMRGc"; // optional if your Drive API is public
const SCOPES = "https://www.googleapis.com/auth/drive.file";

export default function GoogleSync({ dataToSync, onRestore, darkMode }) {
  const [isSignedIn, setIsSignedIn] = useState(false);
  const [user, setUser] = useState(null);
  const [status, setStatus] = useState("idle");

  useEffect(() => {
    gapi.load("client:auth2", async () => {
      try {
        await gapi.client.init({
          apiKey: API_KEY,
          clientId: CLIENT_ID,
          scope: SCOPES,
          discoveryDocs: ["https://www.googleapis.com/discovery/v1/apis/drive/v3/rest"],
        });
        const auth = gapi.auth2.getAuthInstance();
        auth.isSignedIn.listen(updateSigninStatus);
        updateSigninStatus(auth.isSignedIn.get());
      } catch (err) {
        console.error("⚠️ GAPI init failed:", err);
      }
    });
  }, []);

  const updateSigninStatus = (signedIn) => {
    setIsSignedIn(signedIn);
    if (signedIn) {
      const profile = gapi.auth2.getAuthInstance().currentUser.get().getBasicProfile();
      setUser({ name: profile.getName(), email: profile.getEmail(), image: profile.getImageUrl() });
      autoRestore();
    } else setUser(null);
  };

  const signIn = () => gapi.auth2.getAuthInstance().signIn();
  const signOut = () => gapi.auth2.getAuthInstance().signOut();

  const uploadToDrive = async () => {
    setStatus("uploading");
    try {
      const blob = new Blob([JSON.stringify(dataToSync)], { type: "application/json" });
      const search = await gapi.client.drive.files.list({ q: "name='gratitude_journal_backup.json'", fields: "files(id)" });
      let fileId = search.result.files?.[0]?.id;

      if (fileId) {
        await gapi.client.request({ path: `/upload/drive/v3/files/${fileId}`, method: "PATCH", params: { uploadType: "media" }, body: blob });
      } else {
        const metadata = { name: "gratitude_journal_backup.json", mimeType: "application/json" };
        const form = new FormData();
        form.append("metadata", new Blob([JSON.stringify(metadata)], { type: "application/json" }));
        form.append("file", blob);
        await fetch("https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart", {
          method: "POST",
          headers: new Headers({ Authorization: "Bearer " + gapi.auth.getToken().access_token }),
          body: form,
        });
      }

      setStatus("done");
      logEvent("drive_backup", { status: "success" });
    } catch (err) {
      console.error("Upload failed:", err);
      if (!navigator.onLine) await registerBackgroundSync();
      setStatus("error");
    }
  };

  const autoRestore = async () => {
    try {
      setStatus("restoring");
      const search = await gapi.client.drive.files.list({ q: "name='gratitude_journal_backup.json'", fields: "files(id)" });
      const file = search.result.files?.[0];
      if (!file) return setStatus("idle");
      const resp = await gapi.client.drive.files.get({ fileId: file.id, alt: "media" });
      onRestore(resp.result);
      setStatus("done");
    } catch (err) {
      console.error("Restore failed:", err);
      setStatus("error");
    }
  };

  const registerBackgroundSync = async () => {
    if ("serviceWorker" in navigator && "SyncManager" in window) {
      const reg = await navigator.serviceWorker.ready;
      await reg.sync.register("sync-gratitude-data");
    }
  };

  return (
    <div className="mt-4 text-center">
      <h3 className={`font-semibold ${darkMode ? "text-green-400" : "text-green-700"}`}>☁️ Google Drive Sync</h3>

      {!isSignedIn ? (
        <Button onClick={signIn}>Sign in with Google</Button>
      ) : (
        <>
          <div className="flex justify-center items-center gap-2 my-2">
            <img src={user.image} alt="pfp" className="w-8 h-8 rounded-full" />
            <div>
              <p>{user.name}</p>
              <p className="text-xs opacity-75">{user.email}</p>
            </div>
          </div>
          <Button onClick={uploadToDrive}>Upload Backup</Button>
          <Button onClick={signOut}>Sign Out</Button>
        </>
      )}

      <AnimatePresence>
        {status === "restoring" && (
          <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="text-sm text-gray-400 mt-2">
            🔄 Restoring from Drive...
          </motion.p>
        )}
        {status === "done" && (
          <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="text-sm text-green-500 mt-2">
            ✅ Up to date
          </motion.p>
        )}
      </AnimatePresence>
    </div>
  );
}
