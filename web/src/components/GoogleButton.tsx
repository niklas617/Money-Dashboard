import { useCallback, useEffect, useRef, useState } from 'react'
import { GOOGLE_CLIENT_ID, loadGoogleScript } from '../lib/googleClient'

/**
 * Rendert den offiziellen „Sign in with Google"-Button.
 * Bei Erfolg liefert Google ein id_token (credential) -> onCredential.
 *
 * Wichtig: Die aktuelle Origin (z. B. http://localhost:5173 und die Prod-URL)
 * muss in der Google Cloud Console unter „Authorized JavaScript origins"
 * der OAuth-Client-ID eingetragen sein, sonst rendert der Button nicht.
 */
export function GoogleButton({ onCredential }: { onCredential: (idToken: string) => void }) {
  const ref = useRef<HTMLDivElement>(null)
  const [failed, setFailed] = useState(false)

  const cb = useCallback(onCredential, [onCredential])

  useEffect(() => {
    let cancelled = false
    loadGoogleScript()
      .then(() => {
        if (cancelled || !ref.current || !window.google) return
        window.google.accounts.id.initialize({
          client_id: GOOGLE_CLIENT_ID,
          callback: (resp) => cb(resp.credential),
          cancel_on_tap_outside: true,
        })
        const width = Math.min(400, Math.max(240, ref.current.offsetWidth || 320))
        window.google.accounts.id.renderButton(ref.current, {
          type: 'standard',
          theme: 'filled_black',
          size: 'large',
          text: 'continue_with',
          shape: 'pill',
          logo_alignment: 'center',
          width,
        })
      })
      .catch(() => setFailed(true))
    return () => {
      cancelled = true
    }
  }, [cb])

  if (failed) return null
  return <div ref={ref} className="flex min-h-[44px] justify-center" />
}
