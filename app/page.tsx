import Painel from '@/components/painel/painel';
import { snapshot } from '@/lib/collector.mjs';
import { store, flags } from '@/lib/runtime';
import type { Snapshot } from '@/lib/types';

export const dynamic = 'force-dynamic';

/** A página chega já com os resultados guardados; o componente cliente atualiza-os depois. */
export default async function Home() {
  let initial: Snapshot | null = null;
  try {
    // Renderizada a cada pedido: a hora atual faz parte dos dados.
    // eslint-disable-next-line react-hooks/purity
    initial = (await snapshot(store(), Date.now(), flags())) as Snapshot;
  } catch (error) {
    console.error('Página:', error);
  }
  return <Painel initial={initial} />;
}
