import { useEffect, useState } from "react";
import { api } from "../api/client";

/** A private file, such as a card or dive photo, as a URL for this page. It's
 * fetched with the sign-in token, which an <img> can't send, and kept in
 * memory until the component goes. */
export function usePrivateFile(path: string): { url: string | null; failed: boolean } {
  const [state, setState] = useState<{ path: string; url: string | null; failed: boolean }>({ path, url: null, failed: false });
  useEffect(() => {
    let live = true;
    let made: string | null = null;
    api
      .blob(path)
      .then((b) => {
        made = URL.createObjectURL(b);
        if (live) setState({ path, url: made, failed: false });
        else URL.revokeObjectURL(made);
      })
      .catch(() => live && setState({ path, url: null, failed: true }));
    return () => {
      live = false;
      if (made) URL.revokeObjectURL(made);
    };
  }, [path]);
  // Nothing stale while a new path loads
  return state.path === path ? state : { url: null, failed: false };
}
