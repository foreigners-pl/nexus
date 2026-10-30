export interface AgreementSigner {
  name: string | null
  email: string | null
  pesel: string | null
  idNumber: string | null
  signedAt: string | null
  signatureData: string | null
}

interface AgreementDocumentProps {
  clientName: string | null
  serviceName: string | null
  totalPrice: number | null
  steps: string[]
  date: string | null
  company: Record<string, string | null>
  signer?: AgreementSigner | null
}

const ARTICLES: { titleEn: string; titlePl: string; en: string; pl: string }[] = [
  {
    titleEn: 'Preamble',
    titlePl: 'Preambuła',
    en: 'By proceeding with the services of FOREIGNERS.PL Sp. z o.o. (the "Provider"), the undersigned Client confirms that they have read, understood, and agree to be bound by the terms set forth in this Agreement and the Provider\'s Terms of Service and Privacy Policy.',
    pl: 'Podpisując niniejszy dokument, Klient potwierdza, że zapoznał się z treścią niniejszej Umowy oraz Regulaminu i Polityki Prywatności Usługodawcy i akceptuje ich postanowienia.',
  },
  {
    titleEn: 'Article 1 — Scope of Services and No Guarantee of Result',
    titlePl: 'Artykuł 1 — Zakres usług i brak gwarancji rezultatu',
    en: 'The Provider shall perform the specific legal and/or administrative work agreed upon with the Client. The agreed fee is remuneration solely for the work performed, not for any guaranteed outcome, approval, decision by an authority, or issuance of a document. Such outcomes depend on independent decisions made by public authorities, courts, and other third parties outside the Provider\'s control.',
    pl: 'Usługodawca wykona konkretną pracę prawną i/lub administracyjną uzgodnioną z Klientem. Uzgodnione wynagrodzenie stanowi wyłącznie zapłatę za wykonaną pracę, a nie za gwarantowany rezultat, zatwierdzenie, decyzję organu lub wydanie dokumentu. Rezultaty te zależą od niezależnych decyzji podejmowanych przez organy publiczne, sądy i inne podmioty trzecie spoza kontroli Usługodawcy.',
  },
  {
    titleEn: 'Article 2 — Refund Policy',
    titlePl: 'Artykuł 2 — Polityka zwrotów',
    en: '2.1 A full refund shall be granted only if the Client cancels the service within 24 hours of the Provider\'s receipt of payment, provided the Provider has not yet performed any substantial part of the service, such as drafting or submitting a crucial application, preparing official documents, or engaging with authorities on the Client\'s behalf.\n\n2.2 If cancellation occurs after the 24-hour period, a refund may be granted only if the cancellation is due to a change in price resulting from a change in scope that is not caused by the Client under section 2.3. Any such refund shall be calculated by deducting the value of the work already completed from the total amount paid. Work already completed includes, but is not limited to, case analysis, legal or administrative research, drafting or preparing documents, correspondence with authorities, and any other tasks directly performed for the Client\'s matter. The Provider will assess this value in good faith and inform the Client of the refundable amount.\n\n2.3 No refund shall be granted if the Client refuses to proceed with the agreed services due to a change in scope, price, or timeframe that results from: (a) the Client requesting additional services beyond the originally agreed scope; or (b) the Client failing to provide complete, accurate, or timely information that affects the scope, complexity, or cost of the agreed services.',
    pl: '2.1 Pełny zwrot przysługuje wyłącznie, gdy Klient anuluje usługę w ciągu 24 godzin od momentu otrzymania płatności przez Usługodawcę, pod warunkiem że Usługodawca nie wykonał jeszcze żadnej istotnej części usługi, takiej jak sporządzenie lub złożenie kluczowego wniosku, przygotowanie dokumentów urzędowych lub podjęcie kontaktu z organami w imieniu Klienta.\n\n2.2 W przypadku anulowania po upływie 24 godzin zwrot może zostać udzielony wyłącznie, jeśli anulowanie wynika ze zmiany zakresu, która nie została spowodowana przez Klienta w rozumieniu pkt 2.3. Wysokość takiego zwrotu zostanie obliczona przez odjęcie wartości już wykonanej pracy od całkowitej zapłaconej kwoty. Do wykonanej pracy zalicza się m.in. analizę sprawy, badanie prawne lub administracyjne, sporządzanie lub przygotowywanie dokumentów, korespondencję z organami oraz inne czynności bezpośrednio wykonane w sprawie Klienta. Usługodawca określi tę wartość w dobrej wierze i poinformuje Klienta o zwracanej kwocie.\n\n2.3 Zwrot nie przysługuje, jeśli Klient odmawia kontynuowania uzgodnionych usług z powodu zmiany zakresu, ceny lub terminu wynikającej z: (a) żądania przez Klienta dodatkowych usług wykraczających poza pierwotnie uzgodniony zakres; lub (b) niepodania przez Klienta pełnych, dokładnych lub terminowych informacji wpływających na zakres, złożoność lub koszt uzgodnionych usług.',
  },
  {
    titleEn: 'Article 3 — Data Processing',
    titlePl: 'Artykuł 3 — Przetwarzanie danych',
    en: 'The Client consents to the processing of their personal data by the Provider for the purpose of performing the agreed services and communication related thereto, in accordance with the Provider\'s Privacy Policy available at foreigners.pl/privacy-policy.',
    pl: 'Klient wyraża zgodę na przetwarzanie swoich danych osobowych przez Usługodawcę w celu wykonania uzgodnionych usług oraz prowadzenia związanej z tym komunikacji, zgodnie z Polityką Prywatności dostępną na foreigners.pl/privacy-policy.',
  },
]

export function AgreementDocument({
  clientName,
  serviceName,
  totalPrice,
  steps,
  date,
  company,
  signer,
}: AgreementDocumentProps) {
  const providerBlock = [
    company.company_name || 'FOREIGNERS.PL Sp. z o.o.',
    company.address,
    company.tax_id ? `NIP: ${company.tax_id}` : null,
    company.email ? `E-mail: ${company.email}` : null,
  ].filter(Boolean).join('\n')

  return (
    <div
      className="p-8 md:p-12"
      style={{
        fontFamily: "'Times New Roman', Times, serif",
        backgroundColor: '#ffffff',
        border: '1px solid #d1d5db',
        color: '#111827',
      }}
    >
      <div className="text-center pb-6 mb-8" style={{ borderBottom: '2px solid #1f2937' }}>
        <h2 className="text-2xl font-semibold uppercase tracking-wide">Client Service Agreement</h2>
        <p className="text-sm mt-1 italic text-gray-600">Umowa o świadczenie usług dla Klienta</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-6 text-sm leading-relaxed">
        <div>
          <p className="font-bold mb-1">Provider:</p>
          <p className="whitespace-pre-line">{providerBlock}</p>
        </div>
        <div>
          <p className="font-bold mb-1">Usługodawca:</p>
          <p className="whitespace-pre-line">{providerBlock}</p>
        </div>

        <div>
          <p className="font-bold mb-1">Client:</p>
          <p>
            {clientName || '_________________________________'}<br />
            {signer?.pesel && <>PESEL: {signer.pesel}<br /></>}
            {signer?.idNumber && <>ID no.: {signer.idNumber}<br /></>}
            Date: {date}
          </p>
        </div>
        <div>
          <p className="font-bold mb-1">Klient:</p>
          <p>
            {clientName || '_________________________________'}<br />
            {signer?.pesel && <>PESEL: {signer.pesel}<br /></>}
            {signer?.idNumber && <>Nr dokumentu: {signer.idNumber}<br /></>}
            Data: {date}
          </p>
        </div>

        <div>
          <p className="font-bold mb-1">Service:</p>
          <p>{serviceName || 'Selected service'}</p>
          {totalPrice != null && <p className="mt-1">Fee: {Number(totalPrice).toLocaleString()} PLN</p>}
          {steps.length > 0 && (
            <>
              <p className="mt-2 font-bold">Included steps:</p>
              <ol className="list-decimal pl-5 space-y-0.5">
                {steps.map((s, i) => <li key={i}>{s}</li>)}
              </ol>
            </>
          )}
        </div>
        <div>
          <p className="font-bold mb-1">Usługa:</p>
          <p>{serviceName || 'Wybrana usługa'}</p>
          {totalPrice != null && <p className="mt-1">Wynagrodzenie: {Number(totalPrice).toLocaleString()} PLN</p>}
          {steps.length > 0 && (
            <>
              <p className="mt-2 font-bold">Etap w zakresie usługi:</p>
              <ol className="list-decimal pl-5 space-y-0.5">
                {steps.map((s, i) => <li key={i}>{s}</li>)}
              </ol>
            </>
          )}
        </div>

        {ARTICLES.map(a => (
          <div key={a.titleEn} className="contents">
            <div>
              <h3 className="font-bold uppercase tracking-wide text-xs pb-1 mb-2" style={{ borderBottom: '1px solid #1f2937' }}>{a.titleEn}</h3>
              {a.en.split('\n\n').map((p, i) => <p key={i} className={i > 0 ? 'mt-2' : ''}>{p}</p>)}
            </div>
            <div>
              <h3 className="font-bold uppercase tracking-wide text-xs pb-1 mb-2" style={{ borderBottom: '1px solid #1f2937' }}>{a.titlePl}</h3>
              {a.pl.split('\n\n').map((p, i) => <p key={i} className={i > 0 ? 'mt-2' : ''}>{p}</p>)}
            </div>
          </div>
        ))}
      </div>

      <div className="mt-8 pt-6" style={{ borderTop: '1px solid #1f2937' }}>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 text-sm">
          <div>
            <p className="font-bold mb-2">Client signature</p>
            {signer?.signatureData ? (
              <>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={signer.signatureData} alt="Signature" className="h-16" />
                <p className="mt-1">{signer.name}</p>
                {signer.signedAt && (
                  <p className="text-xs text-gray-500">{new Date(signer.signedAt).toLocaleString()}</p>
                )}
              </>
            ) : (
              <p className="text-gray-400">_______________________________</p>
            )}
          </div>
          <div>
            <p className="font-bold mb-2">Podpis Klienta</p>
            <p className="text-gray-400">{signer ? 'Podpisano' : '_______________________________'}</p>
          </div>
        </div>
      </div>
    </div>
  )
}
