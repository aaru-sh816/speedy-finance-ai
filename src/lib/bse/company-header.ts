/**
 * Only BSE direct API call in the app. nse-bse-api has no ComHeadernew equivalent.
 * Do not add other direct BSE URLs here; use unified-market (nse-bse-api) instead.
 */
const BSE_COM_HEADER_URL = "https://api.bseindia.com/BseIndiaAPI/api/ComHeadernew/w"

const HEADERS = {
  "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:138.0) Gecko/20100101 Firefox/138.0",
  "Accept": "application/json, text/plain, */*",
  "Accept-Language": "en-US,en;q=0.5",
  "Origin": "https://www.bseindia.com",
  "Referer": "https://www.bseindia.com",
}

export interface BseCompanyHeader {
  scripCode: string
  symbol: string
  companyName: string
  industry: string
  sector: string
  group: string
  faceValue: number | null
  isin: string
  marketCap: number | null
  lastPrice: number | null
}

export async function fetchBseCompanyHeader(scripCode: string): Promise<BseCompanyHeader | null> {
  try {
    const url = `${BSE_COM_HEADER_URL}?scripcode=${scripCode}`
    const response = await fetch(url, {
      method: "GET",
      headers: HEADERS,
      cache: "no-store",
      signal: AbortSignal.timeout(5000),
    })

    if (!response.ok) return null

    const contentType = response.headers.get("content-type") || ""
    if (!contentType.includes("application/json")) return null

    const text = await response.text()
    if (text.startsWith("<") || text.startsWith("<!")) return null

    let data: unknown
    try {
      data = JSON.parse(text)
    } catch {
      return null
    }

    const header = (data as any)?.Header || (data as any)?.[0] || data
    return {
      scripCode,
      symbol: header?.ScripName || header?.ShortN || header?.SLONGNAME || header?.Scrip_id || scripCode,
      companyName: header?.LongN || header?.SLONGNAME || header?.CompanyName || header?.Issuer_Name || "",
      industry: header?.Industry || header?.INDUSTRY || header?.Ind_name || "",
      sector: header?.Sector || header?.SECTOR || "",
      group: header?.Scrip_grp || header?.Group || header?.GROUP || "",
      faceValue: parseFloat(header?.FaceValue || header?.FACE_VALUE || header?.Face_Value) || null,
      isin: header?.ISIN || header?.Isin_no || header?.ISIN_NUMBER || "",
      marketCap: header?.Mktcap ?? header?.MarketCap ?? header?.CUR_MKTCAP ?? null,
      lastPrice: header?.CurrRate ?? header?.LTP ?? header?.CLOSE ?? header?.Curr_rate ?? null,
    }
  } catch (e) {
    console.error("[Company Header] Error:", e)
    return null
  }
}
