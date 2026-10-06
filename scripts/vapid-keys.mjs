// Gera um par de chaves VAPID para as notificações (uma só vez).
// Uso: npm run chaves:vapid
// A chave pública vai para VAPID_PUBLIC_KEY e a privada para VAPID_PRIVATE_KEY (segredo do Sites).
// Nunca guardar a chave privada no repositório.
import { webcrypto as crypto } from 'node:crypto';

const b64u = (buf) => Buffer.from(buf).toString('base64url');
const pair = await crypto.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, ['sign', 'verify']);
const publicKey = b64u(await crypto.subtle.exportKey('raw', pair.publicKey));
const { d } = await crypto.subtle.exportKey('jwk', pair.privateKey);
console.log(`VAPID_PUBLIC_KEY=${publicKey}`);
console.log(`VAPID_PRIVATE_KEY=${d}`);
