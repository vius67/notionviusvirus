import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

export const supabase = createClient(supabaseUrl, supabaseAnonKey)

export type Database = {
  homework: {
    id: string
    user_id: string
    title: string
    subject: string | null
    due_date: string | null
    notes: string | null
    completed: boolean
    created_at: string
  }
  todos: {
    id: string
    user_id: string
    title: string
    description: string | null
    subject: string | null
    due_date: string | null
    priority: 'low' | 'medium' | 'high' | null
    completed: boolean
    created_at: string
  }
  past_papers: {
    id: string
    user_id: string
    subject: string
    year: number | null
    score: number | null
    max_score: number | null
    notes: string | null
    completed_at: string | null
    created_at: string
  }
  study_sessions: {
    id: string
    user_id: string
    subject: string | null
    duration_minutes: number | null
    notes: string | null
    created_at: string
  }
  calendar_events: {
    id: string
    user_id: string
    title: string
    description: string | null
    start_time: string
    end_time: string | null
    color: string | null
    created_at: string
  }
}
