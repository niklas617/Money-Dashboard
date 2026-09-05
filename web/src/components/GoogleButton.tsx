import { useCallback, useEffect, useRef, useState } from 'react'
import { GOOGLE_CLIENT_ID, loadGoogleScript } from '../lib/googleClient'

/**
 * „Weiter mit Google"-Button im Monetra-Dark-Design.
 *
 * Trick: Wir zeigen einen eigenen, dunklen Button (volle Style-Kontrolle) und
 * legen den offiziellen Google-Identity-Services-Button unsichtbar darueber.
 * So bleibt der sichere id_token-Flow erhalten, aber Google kann uns keinen
 * weissen/hellen iframe-Button ins Layout rendern.
 *
 * Wichtig: Die aktuelle Origin (Prod-URL) muss in der Google Cloud Console unter
 * „Authorized JavaScript origins" der OAuth-Client-ID eingetragen sein.
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
        // Der unsichtbare Google-Button muss die sichtbare Flaeche voll abdecken,
        // damit jeder Klick ankommt -> Breite an den Container koppeln.
        const width = Math.round(ref.current.offsetWidth) || 320
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

  return (
    <div className="relative w-full">
      {/* Sichtbarer Button im App-Design (faengt keine Klicks) */}
      <div
        aria-hidden
        className="pointer-events-none flex min-h-[46px] w-full items-center justify-center gap-3 rounded-sm border border-border bg-surface-elevated py-3 text-[14.5px] font-semibold text-text-primary"
      >
        <GoogleG />
        Weiter mit Google
      </div>
      {/* Echter Google-Button, transparent darueber – uebernimmt den Klick */}
      <div
        ref={ref}
        className="absolute inset-0 z-10 flex items-center justify-center overflow-hidden opacity-0"
      />
    </div>
  )
}

function GoogleG() {
  return (
    <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden focusable="false">
      <path
        fill="#EA4335"
        d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"
      />
      <path
        fill="#4285F4"
        d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"
      />
      <path
        fill="#FBBC05"
        d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"
      />
      <path
        fill="#34A853"
        d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"
      />
    </svg>
  )
}
