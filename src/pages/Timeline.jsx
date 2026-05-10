import { HealthTimeline } from '../components/timeline/HealthTimeline'

export function Timeline() {
  return (
    <main>
      <h1 className="text-xl font-semibold">Health Timeline</h1>
      <p className="mt-2 text-sm text-text-mid">
        A unified view of symptoms, vet visits, and prescriptions for your active bunny.
      </p>

      <div className="mt-6">
        <HealthTimeline />
      </div>
    </main>
  )
}

