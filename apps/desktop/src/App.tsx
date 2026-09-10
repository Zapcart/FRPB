import { useEffect, useState } from "react";
import type { LicenseProfile } from "./lib/ipc";
import ActivationScreen from "./components/ActivationScreen";
import MainDashboard from "./components/MainDashboard";

/**
 * Root component. Every launch starts at the ActivationScreen (online
 * verification is the source of truth — the encrypted cached profile only
 * pre-fills the key as a convenience hint). A successful verify() elevates
 * the user into MainDashboard for the rest of the session.
 */
export default function App() {
  const [profile, setProfile] = useState<LicenseProfile | null>(null);
  const [cached, setCached] = useState<LicenseProfile | null>(null);

  useEffect(() => {
    window.frpb.license
      .getCachedProfile()
      .then(setCached)
      .catch(() => {});
  }, []);

  return profile ? (
    <MainDashboard profile={profile} onSignOut={() => setProfile(null)} />
  ) : (
    <ActivationScreen cached={cached} onActivated={setProfile} />
  );
}
