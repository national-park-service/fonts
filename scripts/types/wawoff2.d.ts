declare module 'wawoff2' {
  export function compress(input: Uint8Array | ArrayBuffer | Buffer): Promise<Uint8Array>
  export function decompress(input: Uint8Array | ArrayBuffer | Buffer): Promise<Uint8Array>
}
