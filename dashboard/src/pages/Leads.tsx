import { useState, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { useRealtime } from '../hooks/useRealtime'
import StatusBadge, { getStatusVariant, getServiceVariant } from '../components/StatusBadge'

interface LeadsProps {
  practiceId: string
}

interface Patient {
  id: string
  practice_id: string
  full_name: string
  phone: string
  email: string | null
  service_interest: string | null
  service_category: string | null
  source: string | null
  status: string
  created_at: string
}

type StatusFilter = 'all' | 'new' | 'contacted' | 'nurturing' | 'booked' | 'emergency'

const STATUS_TABS: { value: StatusFilter; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'new', label: 'New' },
  { value: 'contacted', label: 'Contacted' },
  { value: 'booked', label: 'Booked' },
  { value: 'emergency', label: 'Emergency' },
]

function Leads({ practiceId }: LeadsProps) {
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all')
  const [searchQuery, setSearchQuery] = useState('')
  const navigate = useNavigate()

  const { data: patients, loading } = useRealtime<Patient>({
    table: 'patients',
    practiceId,
    orderBy: { column: 'created_at', ascending: false },
  })

  const filteredPatients = useMemo(() => {
    let result = patients

    if (statusFilter !== 'all') {
      result = result.filter((p) => p.status === statusFilter)
    }

    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase()
      result = result.filter(
        (p) =>
          p.full_name?.toLowerCase().includes(query) ||
          p.phone?.includes(query)
      )
    }

    return result
  }, [patients, statusFilter, searchQuery])

  const statusCounts = useMemo(() => {
    const counts: Record<string, number> = { all: patients.length }
    for (const p of patients) {
      counts[p.status] = (counts[p.status] ?? 0) + 1
    }
    return counts
  }, [patients])

  function formatDate(dateStr: string): string {
    return new Date(dateStr).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    })
  }

  function handleRowClick(patientId: string) {
    navigate(`/conversations?patient=${patientId}`)
  }

  function getSourceIcon(source: string | null) {
    switch (source?.toLowerCase()) {
      case 'sms':
        return (
          <svg className="w-3.5 h-3.5 inline mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
          </svg>
        )
      case 'phone':
        return (
          <svg className="w-3.5 h-3.5 inline mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
          </svg>
        )
      case 'form':
        return (
          <svg className="w-3.5 h-3.5 inline mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
        )
      default:
        return null
    }
  }

  if (loading) {
    return (
      <div style={{ padding: '24px 32px' }}>
        <div className="space-y-4">
          <div className="card" style={{ height: 40, opacity: 0.3 }} />
          <div className="card" style={{ height: 60, opacity: 0.3 }} />
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="card" style={{ height: 52, opacity: 0.3 }} />
          ))}
        </div>
      </div>
    )
  }

  return (
    <div style={{ padding: '24px 32px' }}>
      {/* Header */}
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 22, fontWeight: 600, color: 'var(--text-primary)', margin: 0, fontFamily: "'Outfit', sans-serif" }}>Leads</h1>
        <p style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 4 }}>Manage and track your patient leads</p>
      </div>

      {/* Filter pills */}
      <div className="flex items-center gap-2 flex-wrap" style={{ marginBottom: 16 }}>
        {STATUS_TABS.map((tab) => (
          <button
            key={tab.value}
            onClick={() => setStatusFilter(tab.value)}
            style={{
              padding: '6px 16px',
              borderRadius: 'var(--radius-pill)',
              fontSize: 12,
              fontWeight: 500,
              border: 'none',
              cursor: 'pointer',
              fontFamily: "'Outfit', sans-serif",
              background: statusFilter === tab.value ? 'var(--accent)' : 'transparent',
              color: statusFilter === tab.value ? '#0C0F12' : 'var(--text-muted)',
              transition: 'color 0.15s',
            }}
          >
            {tab.label}
            <span style={{
              marginLeft: 6,
              fontSize: 10,
              opacity: 0.8,
            }}>
              {statusCounts[tab.value] ?? 0}
            </span>
          </button>
        ))}
      </div>

      {/* Search */}
      <div style={{ marginBottom: 16 }}>
        <div className="relative">
          <svg
            className="absolute"
            style={{ left: 12, top: '50%', transform: 'translateY(-50%)', width: 16, height: 16, color: 'var(--text-faint)' }}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            type="text"
            placeholder="Search by name or phone..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{
              width: '100%',
              paddingLeft: 36,
              paddingRight: 16,
              paddingTop: 10,
              paddingBottom: 10,
              background: 'var(--bg-elevated)',
              border: '0.5px solid var(--border-default)',
              borderRadius: 'var(--radius-sm)',
              color: 'var(--text-primary)',
              fontSize: 13,
              fontFamily: "'Outfit', sans-serif",
              outline: 'none',
            }}
          />
        </div>
      </div>

      {/* Table */}
      <div className="card" style={{ overflow: 'hidden' }}>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                {['Name', 'Phone', 'Service Interest', 'Source', 'Status', 'Created'].map((h) => (
                  <th
                    key={h}
                    style={{
                      textAlign: 'left',
                      padding: '12px 20px',
                      fontSize: 11,
                      fontWeight: 500,
                      textTransform: 'uppercase',
                      letterSpacing: '1px',
                      color: 'var(--text-faint)',
                      borderBottom: '0.5px solid var(--border-default)',
                      fontFamily: "'Outfit', sans-serif",
                    }}
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filteredPatients.length === 0 ? (
                <tr>
                  <td colSpan={6} style={{ padding: '48px 20px', textAlign: 'center', color: 'var(--text-faint)', fontSize: 13 }}>
                    {searchQuery ? 'No patients match your search' : 'No patients found'}
                  </td>
                </tr>
              ) : (
                filteredPatients.map((patient) => (
                  <tr
                    key={patient.id}
                    onClick={() => handleRowClick(patient.id)}
                    className="card-hover"
                    style={{ cursor: 'pointer', borderBottom: '0.5px solid var(--border-default)' }}
                  >
                    <td style={{ padding: '12px 20px' }}>
                      <div className="flex items-center gap-3">
                        <div
                          className="flex items-center justify-center flex-shrink-0"
                          style={{
                            width: 32,
                            height: 32,
                            borderRadius: '50%',
                            background: patient.status === 'booked' ? 'var(--accent-dim)' : patient.status === 'new' ? 'var(--blue-dim)' : 'rgba(255,255,255,0.06)',
                            color: patient.status === 'booked' ? 'var(--accent)' : patient.status === 'new' ? 'var(--blue)' : 'var(--text-muted)',
                            fontSize: 13,
                            fontWeight: 500,
                          }}
                        >
                          {patient.full_name?.charAt(0)?.toUpperCase() ?? '?'}
                        </div>
                        <div>
                          <p style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-primary)', margin: 0 }}>
                            {patient.full_name}
                          </p>
                          {patient.email && (
                            <p style={{ fontSize: 11, color: 'var(--text-faint)', margin: 0 }}>{patient.email}</p>
                          )}
                        </div>
                      </div>
                    </td>
                    <td style={{ padding: '12px 20px', fontSize: 13, color: 'var(--text-muted)' }}>
                      {patient.phone}
                    </td>
                    <td style={{ padding: '12px 20px' }}>
                      <div className="flex flex-col gap-1">
                        {patient.service_interest && (
                          <span style={{ fontSize: 13, color: 'var(--text-primary)' }}>
                            {patient.service_interest}
                          </span>
                        )}
                        {patient.service_category && (
                          <StatusBadge
                            label={patient.service_category}
                            variant={getServiceVariant(patient.service_category)}
                          />
                        )}
                      </div>
                    </td>
                    <td style={{ padding: '12px 20px', fontSize: 13, color: 'var(--text-muted)' }}>
                      {patient.source ? (
                        <span className="flex items-center">
                          {getSourceIcon(patient.source)}
                          {patient.source}
                        </span>
                      ) : '--'}
                    </td>
                    <td style={{ padding: '12px 20px' }}>
                      <StatusBadge
                        label={patient.status}
                        variant={getStatusVariant(patient.status)}
                      />
                    </td>
                    <td style={{ padding: '12px 20px', fontSize: 12, color: 'var(--text-faint)' }}>
                      {formatDate(patient.created_at)}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Footer */}
        <div style={{ padding: '10px 20px', borderTop: '0.5px solid var(--border-default)' }}>
          <p style={{ fontSize: 12, color: 'var(--text-faint)', margin: 0 }}>
            Showing {filteredPatients.length} of {patients.length} leads
          </p>
        </div>
      </div>
    </div>
  )
}

export default Leads
