import { useEffect } from 'react'

/** Sets the document title for the lifetime of the calling page component. */
export function useDocumentTitle(title: string) {
  useEffect(() => {
    document.title = title
  }, [title])
}
