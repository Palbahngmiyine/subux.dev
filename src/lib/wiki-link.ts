export const wikiLinkHref = (permalink: string): string => {
  // Wiki links are always local article paths. Normalize Windows separators
  // and encode control characters before a browser can interpret a host name.
  const path = permalink.replace(/^[\\/]+/, '').replace(/\\/g, '/')
  return `/${encodeURI(path).replace(/%25([0-9a-f]{2})/gi, '%$1')}`
}

export const wikiLinkOptions = {
  pageResolver: (name: string) => [name.replace(/ /g, '-').toLowerCase()],
  hrefTemplate: wikiLinkHref,
  aliasDivider: '|',
}
