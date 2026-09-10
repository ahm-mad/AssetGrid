import 'server-only'

import * as React from 'react'
import { Document, Page, Text, View, StyleSheet, renderToBuffer } from '@react-pdf/renderer'

/**
 * Server-side contract PDF render — replaces the Laravel Blade + DomPDF
 * (`contracts.contracts`). Produces the buffer that `sendContract` /
 * `generateContract` upload to the private `contracts` Storage bucket
 * (ADR-011/030). Kept deliberately plain — the UI is redone later.
 */

export interface ContractPdfData {
  contractId: number
  xnid: string | null
  marinaName: string
  boatName: string
  slipName: string | null
  customerName: string | null
  startDate: string | null
  endDate: string | null
  monthlyRate: number
  status: string
  structuredTerms: Record<string, string | null> | null
  signUrl?: string | null
  signedAt?: string | null
}

const s = StyleSheet.create({
  page: { padding: 48, fontSize: 11, fontFamily: 'Helvetica', lineHeight: 1.5, color: '#111' },
  h1: { fontSize: 18, fontFamily: 'Helvetica-Bold', marginBottom: 4 },
  meta: { fontSize: 9, color: '#666', marginBottom: 16 },
  row: { flexDirection: 'row', marginBottom: 3 },
  label: { width: 130, color: '#555' },
  value: { flex: 1, fontFamily: 'Helvetica-Bold' },
  section: { marginTop: 16, marginBottom: 6, fontSize: 13, fontFamily: 'Helvetica-Bold' },
  term: { marginBottom: 6 },
  termKey: { fontFamily: 'Helvetica-Bold', textTransform: 'capitalize' },
  signBox: { marginTop: 28, borderTop: '1 solid #999', paddingTop: 10 },
  small: { fontSize: 9, color: '#666' },
})

const TERM_ORDER = [
  'liability_clause',
  'refund_policy',
  'electrical_requirements',
  'slip_assignment',
  'arrival_procedures',
]

function ContractDoc({ data }: { data: ContractPdfData }) {
  const terms = data.structuredTerms ?? {}
  const keys = [...TERM_ORDER, ...Object.keys(terms).filter((k) => !TERM_ORDER.includes(k))]
  return (
    <Document title={`Contract #${data.contractId}`}>
      <Page size="A4" style={s.page}>
        <Text style={s.h1}>Marina slip contract</Text>
        <Text style={s.meta}>
          {data.marinaName} · #{data.contractId}
          {data.xnid ? ` · ${data.xnid}` : ''}
        </Text>

        <View style={s.row}>
          <Text style={s.label}>Customer</Text>
          <Text style={s.value}>{data.customerName ?? '—'}</Text>
        </View>
        <View style={s.row}>
          <Text style={s.label}>Boat</Text>
          <Text style={s.value}>{data.boatName}</Text>
        </View>
        <View style={s.row}>
          <Text style={s.label}>Slip</Text>
          <Text style={s.value}>{data.slipName ?? '—'}</Text>
        </View>
        <View style={s.row}>
          <Text style={s.label}>Term</Text>
          <Text style={s.value}>
            {data.startDate ?? '—'} to {data.endDate ?? '—'}
          </Text>
        </View>
        <View style={s.row}>
          <Text style={s.label}>Monthly rate</Text>
          <Text style={s.value}>${data.monthlyRate.toFixed(2)}</Text>
        </View>
        <View style={s.row}>
          <Text style={s.label}>Status</Text>
          <Text style={s.value}>{data.status}</Text>
        </View>

        <Text style={s.section}>Terms &amp; conditions</Text>
        {keys
          .filter((k) => terms[k])
          .map((k) => (
            <View key={k} style={s.term}>
              <Text style={s.termKey}>{k.replace(/_/g, ' ')}</Text>
              <Text>{terms[k]}</Text>
            </View>
          ))}

        <View style={s.signBox}>
          {data.signedAt ? (
            <Text>Signed electronically on {new Date(data.signedAt).toLocaleString()}.</Text>
          ) : (
            <>
              <Text>This contract is not yet signed.</Text>
              {data.signUrl ? (
                <Text style={s.small}>Sign online: {data.signUrl}</Text>
              ) : null}
            </>
          )}
        </View>
      </Page>
    </Document>
  )
}

export async function renderContractPdf(data: ContractPdfData): Promise<Buffer> {
  return renderToBuffer(<ContractDoc data={data} />)
}
