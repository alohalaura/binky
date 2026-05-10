import { useEffect, useMemo, useState } from 'react'
import { Button } from '../ui/Button'

const STORAGE_KEY = 'binkylabs-ios-a2hs-dismissed-v1'

function isIos() {
  if (typeof navigator === 'undefined') return false
  const ua = navigator.userAgent || ''
  return /iPad|iPhone|iPod/.test(ua)
}

function isStandaloneIos() {
  // iOS Safari exposes navigator.standalone when launched from home screen.
  return typeof navigator !== 'undefined' && Boolean(navigator.standalone)
}

export function IosAddToHomeScreenBanner() {
  const eligible = useMemo(() => isIos() && !isStandaloneIos(), [])
  const [open, setOpen] = useState(false)

  useEffect(() => {
    if (!eligible) return
    try {
      const dismissed = window.localStorage.getItem(STORAGE_KEY)
      if (dismissed) return
      setOpen(true)
    } catch {
      setOpen(true)
    }
  }, [eligible])

  if (!open) return null

  return (
    <div className="fixed inset-x-0 bottom-24 z-50 px-4 pb-2 sm:bottom-6">
      <div className="mx-auto max-w-4xl rounded-3xl border border-lavender-mid/30 bg-warm-white p-4 shadow-lg">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            <div className="text-sm font-semibold text-text-dark">Add Binky Labs to your Home Screen</div>
            <div className="mt-1 text-xs font-semibold text-text-mid">
              Tap <span className="font-bold">Share</span> then{' '}
              <span className="font-bold">Add to Home Screen</span> for the best offline experience.
            </div>
          </div>

          <div className="flex shrink-0 items-center gap-2">
            <Button
              type="button"
              className="rounded-full bg-lavender px-4 py-2 text-sm font-semibold text-white hover:brightness-95"
              onClick={() => {
                try {
                  window.localStorage.setItem(STORAGE_KEY, '1')
                } catch {
                  // ignore
                }
                setOpen(false)
              }}
            >
              Got it
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}

