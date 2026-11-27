// Parses an Erste Bank PDF statement into sale candidates.
//
// Real layout (pdf text extraction):
//   20260907 20260907 UZNANIE Transfer
//   ASMA OUISSA KRAKÓW 30551 30551 KRAKÓW UL.BOLESŁAWA
//   LIMANOWSKIEGO 37/32 PL37194010765839300500000000
//   799,66 17.052,97                    <- closing line: amount + balance
//
// A transaction starts with `YYYYMMDD YYYYYMMDD <type>` and ends on the
// line that is just `<amount> <balance>` (Polish format: dot thousands,
// comma decimal). Sale rows come from UZNANIE credits only.

export interface SaleRow {
  date: string        // DD.MM.YYYY
  description: string // "Name – service"
  gross: number
  vatRate: number     // 0.23
  paymentId: number   // YYYYMMDDNNN
  channel: 'Bank' | 'Stripe' | 'Other'
  payer: string       // account owner, for review
  note: string        // transfer title, for review
  include: boolean
}

const parseAmount = (s: string) => parseFloat(s.replace(/\./g, '').replace(',', '.'))

const TX_START = /^(\d{8})\s+(\d{8})\s+(.+)$/
const AMOUNTS_LINE = /^(\d[\d.]*,\d{2})\s+(\d[\d.]*,\d{2})\s*$/

const fmtDate = (d8: string) => `${d8.slice(6, 8)}.${d8.slice(4, 6)}.${d8.slice(0, 4)}`

const titleCase = (s: string) =>
  s.toLowerCase().split(/\s+/).map(w => (w ? w[0].toUpperCase() + w.slice(1) : w)).join(' ')

/** Name tokens from the payer line — stops at address fragments, and trims a
 *  duplicated city tail ("ASMA OUISSA KRAKÓW 30551 30551 KRAKÓW UL…" → ASMA OUISSA). */
function extractPayerName(line: string): string {
  const tokens = line.trim().split(/\s+/)
  const out: string[] = []
  for (const t of tokens) {
    if (/^(UL\.?|AL\.?|PL\.?|OS\.?|ELIXIR|BANK|Z)$/i.test(t)) break
    if (/\d/.test(t)) break // postcode, date, street no, IBAN — anything numeric
    out.push(t)
  }
  // trim repeated token tail (city appearing twice in the line)
  for (let i = 0; i < out.length; i++) {
    if (i > 1 && tokens.lastIndexOf(out[i]) !== i && /^[A-ZĄĆĘŁŃÓŚŹŻ]{3,}$/.test(out[i])) {
      return out.slice(0, i).join(' ')
    }
  }
  return out.join(' ')
}

function guessService(full: string): string {
  if (/TRC|pobytu|rezydenc/i.test(full)) return 'TRC Service'
  if (/doradcz|advisory|consult/i.test(full)) return 'Advisory services'
  if (/kierown|szkolen/i.test(full)) return 'Language course'
  return ''
}

export function parseStatementText(rawText: string): SaleRow[] {
  const text = rawText.replace(/­/g, '').replace(/\u00a0/g, ' ')
  const lines = text.split(/\r?\n/).map(l => l.trim()).filter(Boolean)

  const rows: SaleRow[] = []
  const counters: Record<string, number> = {}

  for (let i = 0; i < lines.length; i++) {
    const m = lines[i].match(TX_START)
    if (!m) continue
    const date = m[1]

    // continuation lines until the amounts line closes the transaction
    const cont: string[] = []
    let gross = 0
    let j = i + 1
    for (; j < lines.length; j++) {
      const am = lines[j].match(AMOUNTS_LINE)
      if (am) { gross = parseAmount(am[1]); break }
      if (TX_START.test(lines[j]) || /^Saldo końcowe/.test(lines[j])) break
      cont.push(lines[j])
    }
    i = j // outer loop +1 → next tx
    if (!gross) continue

    const typeLine = m[3]
    const full = (typeLine + ' ' + cont.join(' ')).replace(/\s+/g, ' ')

    // credits only
    if (!/UZNANIE/i.test(typeLine) && !/^UZNANIE/i.test(full)) continue

    const channel: SaleRow['channel'] = /STRIPE/i.test(full) ? 'Stripe' : 'Bank'

    // the payer line carries an address marker (postcode / UL.) — title
    // continuations don't, so prefer those; fall back to the first line
    const hasAddr = (l: string) => /\d{2}-?\d{3}\b|\bUL\.?\s|\bAL\.?\s/i.test(l)
    const payerLine =
      cont.find(l => hasAddr(l) && extractPayerName(l).length >= 3) ??
      cont.find(l => extractPayerName(l).length >= 3)
    const payer = channel === 'Stripe' ? 'Stripe' : (payerLine ? titleCase(extractPayerName(payerLine)) : '')

    // prefer "dla pana/pani X" (someone paying on behalf of a client)
    let name = payer
    const dla = full.match(/dla pan[ai]\s+([A-ZŁŚŻŹĆŃÓ][\wąćęłńóśźż.-]+(?:\s+[\wąćęłńóśźż.-]+){0,5}?)\s+z\s+\d/i)
    if (dla) name = titleCase(dla[1])
    if (!name) name = channel === 'Stripe' ? 'Stripe payout' : 'Unknown payer'

    const service = guessService(full)
    const seq = (counters[date] = (counters[date] || 0) + 1)

    rows.push({
      date: fmtDate(date),
      description: `${name}${service ? ` – ${service}` : ''}`,
      gross,
      vatRate: 0.23,
      paymentId: Number(`${date}${String(seq).padStart(3, '0')}`),
      channel,
      payer,
      note: full.slice(0, 140),
      include: true,
    })
  }

  return rows.sort((a, b) => a.date.localeCompare(b.date))
}
