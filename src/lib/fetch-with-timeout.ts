/**
 * Fetch with timeout and optional abort signal.
 * Fails after timeoutMs or when the optional signal is aborted (e.g. modal close / tab switch).
 */
export async function fetchWithTimeout(
  input: RequestInfo | URL,
  init?: RequestInit & { timeoutMs?: number }
): Promise<Response> {
  const { timeoutMs = 18000, signal: userSignal, ...rest } = init ?? {}
  const timeoutSignal = AbortSignal.timeout(timeoutMs)
  let signal: AbortSignal = timeoutSignal
  if (userSignal) {
    const c = new AbortController()
    const onAbort = () => c.abort()
    timeoutSignal.addEventListener('abort', onAbort)
    userSignal.addEventListener('abort', onAbort)
    signal = c.signal
  }
  return fetch(input, { ...rest, signal })
}
