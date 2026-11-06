const studioImage =
  /^\/images\/(watch-(?:hero|silver|gold|blue))\.(?:webp|png)$/;

/** Responsive local studio assets; merchant uploads retain their original URLs. */
export function productImageSet(source: string): string | undefined {
  const match = source.match(studioImage);
  return match
    ? [400, 800, 1100]
        .map(
          (width) =>
            `${width === 1100 ? `/images/${match[1]}.webp` : `/images/${match[1]}-${width}.webp`} ${width}w`,
        )
        .join(", ")
    : undefined;
}

export function productThumbnail(source: string): string {
  const match = source.match(studioImage);
  return match ? `/images/${match[1]}-80.webp` : source;
}
