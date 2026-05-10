import { supabase } from './supabase'

function escapeHtml(input) {
  return String(input ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;')
}

function fmtDate(value) {
  if (!value) return '—'
  try {
    // Supabase date columns come as "YYYY-MM-DD"
    if (typeof value === 'string' && value.length >= 10) return value.slice(0, 10)
    return new Date(value).toLocaleDateString()
  } catch {
    return String(value)
  }
}

function fmtDateTime(value) {
  if (!value) return '—'
  try {
    return new Date(value).toLocaleString()
  } catch {
    return String(value)
  }
}

function section(title, bodyHtml) {
  return `
    <section class="card">
      <h2>${escapeHtml(title)}</h2>
      ${bodyHtml}
    </section>
  `
}

function kv(label, value) {
  return `<div class="kv"><div class="k">${escapeHtml(label)}</div><div class="v">${escapeHtml(value)}</div></div>`
}

function list(items, renderItem) {
  if (!items?.length) return `<div class="muted">None</div>`
  return `<ul>${items.map(renderItem).join('')}</ul>`
}

function pageHtml({ userEmail, exportedAt, bunnies, byBunnyId }) {
  const bunnyCards = bunnies
    .map((b) => {
      const bucket = byBunnyId[b.id] || {}
      const header = `
        <div class="bunnyHeader">
          <div class="bunnyTitle">${escapeHtml(b.name || 'Unnamed bunny')}</div>
          <div class="muted">${escapeHtml(b.breed || '—')}</div>
        </div>
      `

      const meta = `
        <div class="grid">
          ${kv('Birthday', fmtDate(b.date_of_birth))}
          ${kv('Sex', b.sex || '—')}
          ${kv('Neutered / spayed', b.is_neutered ? 'Yes' : 'No')}
        </div>
      `

      const symptoms = section(
        'Symptom logs',
        list(bucket.symptom_logs, (s) => {
          const parts = [
            `<div class="rowTitle">${escapeHtml(s.body_area)} — ${escapeHtml(
              s.symptom_type,
            )}</div>`,
            `<div class="muted">${escapeHtml(
              `Logged: ${fmtDateTime(s.logged_at)} • Severity: ${s.severity ?? '—'} • Observed since: ${fmtDate(
                s.observed_since,
              )}`,
            )}</div>`,
            s.notes ? `<div class="notes">${escapeHtml(s.notes)}</div>` : '',
          ].filter(Boolean)
          return `<li>${parts.join('')}</li>`
        }),
      )

      const records = section(
        'Medical records',
        list(bucket.medical_records, (r) => {
          const costItems = (bucket.cost_items_by_record_id?.[r.id] ?? [])
            .map((ci) => `${ci.description}: ${ci.amount}`)
            .join(' • ')
          const files = (bucket.files_by_record_id?.[r.id] ?? [])
            .map((f) => `${f.file_kind}: ${f.storage_path}`)
            .join(' • ')

          const sub = [
            `<div class="rowTitle">${escapeHtml(r.title || r.category || 'Record')}</div>`,
            `<div class="muted">${escapeHtml(
              `Date: ${fmtDate(r.record_date)} • Vet: ${r.vet_name || '—'} • Clinic: ${r.clinic_name || '—'}`,
            )}</div>`,
            r.notes ? `<div class="notes">${escapeHtml(r.notes)}</div>` : '',
            costItems ? `<div class="muted">Cost items: ${escapeHtml(costItems)}</div>` : '',
            files ? `<div class="muted">Files: ${escapeHtml(files)}</div>` : '',
          ].filter(Boolean)

          return `<li>${sub.join('')}</li>`
        }),
      )

      const prescriptions = section(
        'Prescriptions',
        list(bucket.prescriptions, (p) => {
          const sub = [
            `<div class="rowTitle">${escapeHtml(p.drug_name)}</div>`,
            `<div class="muted">${escapeHtml(
              `Dosage: ${p.dosage || '—'} • Frequency: ${p.frequency || '—'} • Start: ${fmtDate(
                p.start_date,
              )} • End: ${fmtDate(p.end_date)} • Active: ${p.is_active ? 'Yes' : 'No'}`,
            )}</div>`,
            p.notes ? `<div class="notes">${escapeHtml(p.notes)}</div>` : '',
          ].filter(Boolean)
          return `<li>${sub.join('')}</li>`
        }),
      )

      const weights = section(
        'Weight logs',
        list(bucket.weight_logs, (w) => {
          return `<li><div class="rowTitle">${escapeHtml(
            `${Number(w.weight_g)} g`,
          )}</div><div class="muted">${escapeHtml(fmtDateTime(w.logged_at))}</div></li>`
        }),
      )

      const expenses = section(
        'Expenses',
        list(bucket.expenses, (e) => {
          return `<li><div class="rowTitle">${escapeHtml(
            `${e.amount} ${e.currency || ''} — ${e.category || 'Expense'}`,
          )}</div><div class="muted">${escapeHtml(
            `Date: ${fmtDate(e.expense_date)} • ${e.description || '—'}`,
          )}</div></li>`
        }),
      )

      return `
        <article class="bunny">
          ${header}
          ${meta}
          <div class="stack">
            ${symptoms}
            ${records}
            ${prescriptions}
            ${weights}
            ${expenses}
          </div>
        </article>
      `
    })
    .join('')

  return `<!doctype html>
  <html>
    <head>
      <meta charset="utf-8" />
      <meta name="viewport" content="width=device-width, initial-scale=1" />
      <title>Binky Labs — Export</title>
      <style>
        :root { --bg: #fff; --fg: #111827; --muted: #6b7280; --border: rgba(71,85,105,.18); }
        html, body { margin: 0; padding: 0; background: var(--bg); color: var(--fg); font-family: ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, "Apple Color Emoji", "Segoe UI Emoji"; }
        .page { padding: 28px; max-width: 920px; margin: 0 auto; }
        h1 { margin: 0; font-size: 22px; }
        .sub { margin-top: 8px; color: var(--muted); font-size: 12px; }
        .bunny { margin-top: 18px; padding-top: 18px; border-top: 1px solid var(--border); page-break-inside: avoid; }
        .bunnyTitle { font-size: 18px; font-weight: 700; }
        .bunnyHeader { display: flex; align-items: baseline; justify-content: space-between; gap: 12px; }
        .grid { margin-top: 10px; display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 10px; }
        .kv { border: 1px solid var(--border); border-radius: 12px; padding: 10px 12px; }
        .k { color: var(--muted); font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: .04em; }
        .v { margin-top: 4px; font-size: 13px; }
        .stack { margin-top: 12px; display: grid; gap: 12px; }
        .card { border: 1px solid var(--border); border-radius: 14px; padding: 12px 14px; }
        h2 { margin: 0; font-size: 13px; letter-spacing: .02em; text-transform: uppercase; color: var(--muted); }
        ul { margin: 10px 0 0; padding-left: 16px; }
        li { margin: 8px 0; }
        .rowTitle { font-weight: 700; font-size: 13px; }
        .muted { color: var(--muted); font-size: 12px; }
        .notes { margin-top: 4px; font-size: 12px; white-space: pre-wrap; }
        @media print {
          .page { padding: 0; }
          .card { break-inside: avoid; }
        }
      </style>
    </head>
    <body>
      <div class="page">
        <h1>Binky Labs — Export</h1>
        <div class="sub">Account: ${escapeHtml(userEmail || '—')} • Exported: ${escapeHtml(
    fmtDateTime(exportedAt),
  )}</div>
        ${bunnies.length ? bunnyCards : '<div class="sub" style="margin-top:14px">No bunnies found.</div>'}
      </div>
      <script>
        window.addEventListener('load', () => {
          setTimeout(() => window.print(), 50)
        })
      </script>
    </body>
  </html>`
}

export async function exportAllDataToPdf({ userId, email } = {}) {
  if (!userId) throw new Error('userId is required')

  const exportedAt = new Date().toISOString()

  const { data: memberships, error: memErr } = await supabase
    .from('bunhouse_members')
    .select('bunhouse_id')
    .eq('user_id', userId)
  if (memErr) throw memErr

  const bunhouseIds = Array.from(
    new Set((memberships ?? []).map((m) => m?.bunhouse_id).filter(Boolean)),
  )

  const { data: bunnies, error: bunnyError } = await supabase
    .from('bunnies')
    .select(
      'id, bunhouse_id, owner_id, name, breed, date_of_birth, sex, is_neutered, photo_url, created_at',
    )
    .in('bunhouse_id', bunhouseIds.length ? bunhouseIds : ['00000000-0000-0000-0000-000000000000'])
    .order('created_at', { ascending: true })
  if (bunnyError) throw bunnyError

  const bunnyIds = (bunnies ?? []).map((b) => b.id)
  const byBunnyId = {}
  for (const id of bunnyIds) byBunnyId[id] = {}

  if (bunnyIds.length) {
    const [
      symptomRes,
      recordRes,
      prescriptionRes,
      weightRes,
      expenseRes,
    ] = await Promise.all([
      supabase
        .from('symptom_logs')
        .select('*')
        .in('bunny_id', bunnyIds)
        .order('logged_at', { ascending: false }),
      supabase
        .from('medical_records')
        .select('*')
        .in('bunny_id', bunnyIds)
        .order('record_date', { ascending: false }),
      supabase
        .from('prescriptions')
        .select('*')
        .in('bunny_id', bunnyIds)
        .order('created_at', { ascending: false }),
      supabase
        .from('weight_logs')
        .select('*')
        .in('bunny_id', bunnyIds)
        .order('logged_at', { ascending: false }),
      supabase
        .from('expenses')
        .select('*')
        .in('bunny_id', bunnyIds)
        .order('expense_date', { ascending: false }),
    ])

    if (symptomRes.error) throw symptomRes.error
    if (recordRes.error) throw recordRes.error
    if (prescriptionRes.error) throw prescriptionRes.error
    if (weightRes.error) throw weightRes.error
    if (expenseRes.error) throw expenseRes.error

    const medicalRecords = recordRes.data ?? []
    const recordIds = medicalRecords.map((r) => r.id)

    let costItems = []
    let files = []
    if (recordIds.length) {
      const [costRes, fileRes] = await Promise.all([
        supabase
          .from('medical_record_cost_items')
          .select('*')
          .in('medical_record_id', recordIds)
          .order('created_at', { ascending: true }),
        supabase
          .from('medical_record_files')
          .select('*')
          .in('medical_record_id', recordIds)
          .order('created_at', { ascending: true }),
      ])
      if (costRes.error) throw costRes.error
      if (fileRes.error) throw fileRes.error
      costItems = costRes.data ?? []
      files = fileRes.data ?? []
    }

    for (const bunnyId of bunnyIds) {
      byBunnyId[bunnyId].symptom_logs = (symptomRes.data ?? []).filter((r) => r.bunny_id === bunnyId)
      byBunnyId[bunnyId].medical_records = medicalRecords.filter((r) => r.bunny_id === bunnyId)
      byBunnyId[bunnyId].prescriptions = (prescriptionRes.data ?? []).filter((r) => r.bunny_id === bunnyId)
      byBunnyId[bunnyId].weight_logs = (weightRes.data ?? []).filter((r) => r.bunny_id === bunnyId)
      byBunnyId[bunnyId].expenses = (expenseRes.data ?? []).filter((r) => r.bunny_id === bunnyId)

      const bunnyRecordIds = new Set(byBunnyId[bunnyId].medical_records.map((r) => r.id))
      const cost_items_by_record_id = {}
      const files_by_record_id = {}
      for (const ci of costItems) {
        if (!bunnyRecordIds.has(ci.medical_record_id)) continue
        cost_items_by_record_id[ci.medical_record_id] ||= []
        cost_items_by_record_id[ci.medical_record_id].push(ci)
      }
      for (const f of files) {
        if (!bunnyRecordIds.has(f.medical_record_id)) continue
        files_by_record_id[f.medical_record_id] ||= []
        files_by_record_id[f.medical_record_id].push(f)
      }
      byBunnyId[bunnyId].cost_items_by_record_id = cost_items_by_record_id
      byBunnyId[bunnyId].files_by_record_id = files_by_record_id
    }
  }

  const w = window.open('', '_blank', 'noopener,noreferrer')
  if (!w) throw new Error('Pop-up blocked. Allow pop-ups to export.')

  w.document.open()
  w.document.write(
    pageHtml({
      userEmail: email ?? '',
      exportedAt,
      bunnies: bunnies ?? [],
      byBunnyId,
    }),
  )
  w.document.close()
}

