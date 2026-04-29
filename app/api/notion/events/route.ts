import { NextResponse } from 'next/server'

const TOKEN = process.env.NOTION_TOKEN
const DB_ID  = process.env.NOTION_CALENDAR_DB_ID

// Notion property names you use for the date and title — adjust if yours differ
const DATE_PROP  = process.env.NOTION_DATE_PROP  || 'Date'
const TITLE_PROP = process.env.NOTION_TITLE_PROP || 'Name'

// Map Notion's named colors → hex
const NOTION_COLORS: Record<string, string> = {
  default: '#000000', gray: '#9ca3af', brown: '#92400e', orange: '#f97316',
  yellow: '#eab308', green: '#22c55e', blue: '#3b82f6', purple: '#a855f7',
  pink: '#ec4899', red: '#ef4444',
}

export async function GET() {
  if (!TOKEN || !DB_ID) {
    return NextResponse.json({ events: [], configured: false })
  }

  try {
    // Fetch up to 100 events; paginate if needed
    const pages: unknown[] = []
    let cursor: string | undefined

    do {
      const body: Record<string, unknown> = {
        sorts: [{ property: DATE_PROP, direction: 'ascending' }],
        page_size: 100,
      }
      if (cursor) body.start_cursor = cursor

      const res = await fetch(`https://api.notion.com/v1/databases/${DB_ID}/query`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${TOKEN}`,
          'Notion-Version': '2022-06-28',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
        next: { revalidate: 60 }, // cache 60s
      })

      if (!res.ok) break
      const json = await res.json() as { results: unknown[]; has_more: boolean; next_cursor: string | null }
      pages.push(...json.results)
      cursor = json.has_more && json.next_cursor ? json.next_cursor : undefined
    } while (cursor)

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const events = (pages as any[]).flatMap((page: any) => {
      const props = page.properties as Record<string, any>

      // Find title — look for the TITLE_PROP key, or fall back to first title-type prop
      const titleProp = props[TITLE_PROP] ?? Object.values(props).find((p: any) => p.type === 'title')
      const title: string = titleProp?.title?.map((t: any) => t.plain_text).join('') || 'Untitled'

      // Find date — look for the DATE_PROP key, or fall back to first date-type prop
      const dateProp = props[DATE_PROP] ?? Object.values(props).find((p: any) => p.type === 'date')
      const dateVal  = dateProp?.date
      if (!dateVal?.start) return []

      // Color from a select/status property named "Color" or fall back to page icon color
      const colorProp = props['Color'] ?? props['Status'] ?? props['Priority'] ?? null
      const colorName: string = colorProp?.select?.color ?? colorProp?.status?.color ?? 'default'
      const color = NOTION_COLORS[colorName] ?? '#000000'

      return [{
        id:          `notion-${page.id}`,
        title,
        description: null,
        start_time:  dateVal.start  as string,
        end_time:    (dateVal.end ?? null) as string | null,
        color,
        source:      'notion',
        url:         page.url as string,
      }]
    })

    return NextResponse.json({ events, configured: true })
  } catch (err) {
    console.error('[notion/events]', err)
    return NextResponse.json({ events: [], configured: true, error: String(err) })
  }
}
