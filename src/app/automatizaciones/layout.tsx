import { ToastProvider } from '@/components/ui/Toast';

// Automatizaciones vive FUERA del grupo (app) para tener su propia navegación
// en lugar del sidebar de Cotizaciones. El costo de esa separación es que no
// hereda el layout de allá, y con él se perdía el ToastProvider: sin proveedor,
// `useToast` cae a una función vacía y los avisos de "guardado" o "no se pudo"
// desaparecen en silencio, que es peor que no tenerlos.
export default function LayoutAutomatizaciones({
  children,
}: {
  children: React.ReactNode;
}) {
  return <ToastProvider>{children}</ToastProvider>;
}
