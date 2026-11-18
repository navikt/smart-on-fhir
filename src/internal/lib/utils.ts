export function removeTrailingSlash(url: string): string {
    return url.replace(/\/$/, '')
}

export function inferResourceType(path: string): string {
    return path.match(/(\w+)\b/)?.[1] ?? 'Unknown'
}
