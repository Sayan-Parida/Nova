function bytesToBase64(bytes) {
  let binary = ''
  for (let i = 0; i < bytes.length; i += 1) {
    binary += String.fromCharCode(bytes[i])
  }
  return btoa(binary)
}

async function deriveAesKey(password, salt) {
  const encoder = new TextEncoder()
  const passwordKey = await crypto.subtle.importKey(
    'raw',
    encoder.encode(password),
    'PBKDF2',
    false,
    ['deriveKey'],
  )

  return crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt,
      iterations: 100000,
      hash: 'SHA-256',
    },
    passwordKey,
    {
      name: 'AES-GCM',
      length: 256,
    },
    false,
    ['encrypt'],
  )
}

export async function encryptCyclePayload(payload, password) {
  const encoder = new TextEncoder()
  const salt = crypto.getRandomValues(new Uint8Array(16))
  const iv = crypto.getRandomValues(new Uint8Array(12))
  const key = await deriveAesKey(password, salt)

  const plainText = encoder.encode(JSON.stringify(payload))
  const encryptedBuffer = await crypto.subtle.encrypt(
    {
      name: 'AES-GCM',
      iv,
    },
    key,
    plainText,
  )

  const encryptedBytes = new Uint8Array(encryptedBuffer)
  const output = new Uint8Array(salt.length + iv.length + encryptedBytes.length)
  output.set(salt, 0)
  output.set(iv, salt.length)
  output.set(encryptedBytes, salt.length + iv.length)

  return bytesToBase64(output)
}
