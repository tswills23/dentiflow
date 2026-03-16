import { useEffect, useState, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import type { RealtimeChannel } from '@supabase/supabase-js'

interface UseRealtimeOptions {
  table: string
  practiceId: string | null
  filter?: string
  orderBy?: { column: string; ascending?: boolean }
  limit?: number
}

interface UseRealtimeResult<T> {
  data: T[]
  loading: boolean
  error: string | null
  refetch: () => Promise<void>
}

export function useRealtime<T = Record<string, unknown>>(
  options: UseRealtimeOptions
): UseRealtimeResult<T> {
  const { table, practiceId, filter, orderBy, limit } = options
  const [data, setData] = useState<T[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchData = useCallback(async () => {
    if (!practiceId) return

    try {
      setLoading(true)
      setError(null)

      let query = supabase
        .from(table)
        .select('*')
        .eq('practice_id', practiceId)

      if (filter) {
        // Apply additional filter string in "column=eq.value" format
        const [col, val] = filter.split('=')
        if (col && val) {
          const [op, operand] = val.split('.')
          if (op === 'eq') {
            query = query.eq(col, operand)
          } else if (op === 'gte') {
            query = query.gte(col, operand)
          } else if (op === 'lte') {
            query = query.lte(col, operand)
          }
        }
      }

      if (orderBy) {
        query = query.order(orderBy.column, {
          ascending: orderBy.ascending ?? false,
        })
      }

      if (limit) {
        query = query.limit(limit)
      }

      const { data: result, error: queryError } = await query

      if (queryError) {
        setError(queryError.message)
        return
      }

      setData((result as T[]) ?? [])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred')
    } finally {
      setLoading(false)
    }
  }, [table, practiceId, filter, orderBy?.column, orderBy?.ascending, limit])

  useEffect(() => {
    if (!practiceId) {
      setLoading(false)
      return
    }

    fetchData()

    // Subscribe to real-time changes
    const channel: RealtimeChannel = supabase
      .channel(`${table}_changes_${practiceId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: table,
          filter: `practice_id=eq.${practiceId}`,
        },
        (payload) => {
          setData((current) => {
            const newRecord = payload.new as T & { id: string }
            const oldRecord = payload.old as T & { id: string }

            switch (payload.eventType) {
              case 'INSERT':
                return [newRecord, ...current]
              case 'UPDATE':
                return current.map((item) =>
                  (item as T & { id: string }).id === newRecord.id
                    ? newRecord
                    : item
                )
              case 'DELETE':
                return current.filter(
                  (item) =>
                    (item as T & { id: string }).id !== oldRecord.id
                )
              default:
                return current
            }
          })
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [table, practiceId, fetchData])

  return { data, loading, error, refetch: fetchData }
}
