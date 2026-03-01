// Redirect /research to /apple-notes (the full research hub)
import { redirect } from 'next/navigation'

export default function ResearchPage() {
  redirect('/apple-notes')
}
