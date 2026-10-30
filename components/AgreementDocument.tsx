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

export function AgreementDocument({
  clientName,
  serviceName,
  totalPrice,
  steps,
  date,
  company,
  signer,
}: AgreementDocumentProps) {
  return (
    <div className="prose prose-sm max-w-none text-[hsl(var(--color-text-primary))] print:prose-black space-y-6">
      <div className="border-b border-[hsl(var(--color-border))] pb-6">
        <p className="text-sm text-[hsl(var(--color-text-secondary))]">Date: {date}</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div>
          <h2 className="text-base font-semibold mb-2">Service provider</h2>
          <p className="font-medium">{company.company_name || 'Foreigners.pl'}</p>
          {company.address && <p className="text-sm text-[hsl(var(--color-text-secondary))] whitespace-pre-line">{company.address}</p>}
          {company.tax_id && <p className="text-sm text-[hsl(var(--color-text-secondary))]">Tax ID: {company.tax_id}</p>}
          {company.email && <p className="text-sm text-[hsl(var(--color-text-secondary))]">{company.email}</p>}
          {company.phone && <p className="text-sm text-[hsl(var(--color-text-secondary))]">{company.phone}</p>}
        </div>

        <div>
          <h2 className="text-base font-semibold mb-2">Client</h2>
          <p>{clientName || 'Client name'}</p>
          {signer?.pesel && <p className="text-sm text-[hsl(var(--color-text-secondary))]">PESEL: {signer.pesel}</p>}
          {signer?.idNumber && <p className="text-sm text-[hsl(var(--color-text-secondary))]">ID / passport no.: {signer.idNumber}</p>}
        </div>
      </div>

      <div>
        <h2 className="text-base font-semibold mb-2">Service</h2>
        <p>{serviceName || 'Selected service'}</p>
      </div>

      <div>
        <h2 className="text-base font-semibold mb-2">Price</h2>
        <p className="text-lg font-semibold">{totalPrice ? `${Number(totalPrice).toLocaleString()} PLN` : 'To be agreed'}</p>
      </div>

      <div>
        <h2 className="text-base font-semibold mb-2">What is included</h2>
        {steps.length > 0 ? (
          <ol className="list-decimal pl-5 space-y-1">
            {steps.map((step, i) => (
              <li key={i}>{step}</li>
            ))}
          </ol>
        ) : (
          <p className="text-[hsl(var(--color-text-secondary))]">No mandatory steps configured for this service.</p>
        )}
      </div>

      <div>
        <h2 className="text-base font-semibold mb-2">Important notice</h2>
        <p>
          This document is a summary of the service described above, provided so the client
          understands what they are paying for.
        </p>
        <p>
          The service provider will carry out the included steps with reasonable care and skill. The
          client is responsible for providing accurate information and any requested documents in a
          timely manner.
        </p>
        <p>
          The outcome of any application, residence permit, or other government decision depends
          entirely on the relevant immigration office or authority. The service provider does not
          guarantee a positive decision and cannot influence the final ruling.
        </p>
        <p>
          Payment terms, refund policy, and the exact scope of work are governed by the separate
          engagement agreement and invoices issued through this case.
        </p>
      </div>

      {signer?.signatureData && (
        <div className="border-t border-[hsl(var(--color-border))] pt-6">
          <h2 className="text-base font-semibold mb-2">Signed by the client</h2>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={signer.signatureData} alt="Client signature" className="h-20 border border-[hsl(var(--color-border))] rounded bg-white" />
          <p className="text-sm mt-2">{signer.name}</p>
          {signer.email && <p className="text-sm text-[hsl(var(--color-text-secondary))]">{signer.email}</p>}
          {signer.signedAt && (
            <p className="text-xs text-[hsl(var(--color-text-muted))] mt-1">
              Signed on {new Date(signer.signedAt).toLocaleString()}
            </p>
          )}
        </div>
      )}
    </div>
  )
}
