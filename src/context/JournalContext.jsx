import { createContext, useContext, useState } from "react";
import useJournalData from "../hooks/useJournalData.js";

const JournalContext = createContext();

export function JournalProvider({ children }) {
  const { entries, addEntry, updateEntry, deleteEntry, stats, setEntries } =
    useJournalData();

  const [toast, setToast] = useState("");
  const [showGlow, setShowGlow] = useState(false);

  return (
    <JournalContext.Provider
      value={{
        entries,
        addEntry,
        updateEntry,
        deleteEntry,
        setEntries,
        stats,
        toast,
        setToast,
        showGlow,
        setShowGlow,
      }}
    >
      {children}
    </JournalContext.Provider>
  );
}

export const useJournal = () => useContext(JournalContext);

