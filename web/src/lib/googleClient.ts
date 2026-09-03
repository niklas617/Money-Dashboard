// Google Identity Services (GIS) – laedt das Client-Script lazy und stellt die Client-ID bereit.

export const GOOGLE_CLIENT_ID: string =
  import.meta.env.VITE_GOOGLE_CLIENT_ID ||
  '501930905580-dipthpsmg8427ect0s3pmk2r6bg23ad7.apps.googleusercontent.com'

let scriptPromise: Promise<void> | null = null

export function loadGoogleScript(): Promise<void> {
  if (scriptPromise) return scriptPromise
  scriptPromise = new Promise((resolve, reject) => {
    if (window.google?.accounts?.id) return resolve()
    const existing = document.getElementById('gsi-client') as HTMLScriptElement | null
    if (existing) {
      existing.addEventListener('load', () => resolve())
      existing.addEventListener('error', () => reject(new Error('load error')))
      return
    }
    const s = document.createElement('script')
    s.id = 'gsi-client'
    s.src = 'https://accounts.google.com/gsi/client'
    s.async = true
    s.defer = true
    s.onload = () => resolve()
    s.onerror = () => reject(new Error('Google-Anmeldung konnte nicht geladen werden'))
    document.head.appendChild(s)
  })
  return scriptPromise
}
