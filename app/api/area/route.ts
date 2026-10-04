import {readArea} from '../../../lib/live.mjs';
export async function GET(request: Request) {
  return readArea(new URL(request.url).searchParams.get('uf') || 'BR');
}
