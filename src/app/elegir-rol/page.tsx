import Image from 'next/image';
import { redirect } from 'next/navigation';
import { crearClienteServidor } from '@/lib/supabase/server';
import { crearClienteAdmin } from '@/lib/supabase/admin';
import { dominioPermitido } from '@/config/dominios';
import { SelectorRol } from './selector-rol';

// Primer ingreso de un usuario Métrica que aún no tiene rol: elige entre
// Administración y Ejecutivo. Si ya tiene cuenta, no pasa por aquí.
export default async function PaginaElegirRol() {
  const supabase = await crearClienteServidor();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user?.email) redirect('/login');

  const correo = user.email.toLowerCase();
  if (!dominioPermitido(correo)) redirect('/acceso-denegado?motivo=dominio');

  const admin = crearClienteAdmin();
  const { data: usuario } = await admin
    .from('usuarios')
    .select('activo')
    .eq('correo', correo)
    .maybeSingle();

  if (usuario) {
    if (!usuario.activo) redirect('/acceso-denegado?motivo=inactivo');
    redirect('/panel');
  }

  return (
    <main className="flex flex-1 items-center justify-center p-6">
      <div className="w-full max-w-md">
        <div className="rounded-2xl border border-linea bg-white p-8 shadow-tarjeta">
          <div className="mb-7">
            <Image
              src="/marca/logo-metrica.png"
              alt="Métrica"
              width={734}
              height={372}
              priority
              className="h-9 w-auto"
            />
            <div className="mt-2 text-[11px] tracking-wide text-tinta-tenue">
              Sistema Operativo
            </div>
          </div>

          <h1 className="text-lg font-bold tracking-tight">¿Cuál es tu rol?</h1>
          <p className="mb-6 mt-1 text-[13px] text-tinta-suave">
            Bienvenido a Métrica. Elige cómo usarás el sistema para continuar.
          </p>

          <SelectorRol />
        </div>

        <p className="mt-4 text-center font-mono text-[11px] text-tinta-tenue">
          métrica · comunicación estratégica
        </p>
      </div>
    </main>
  );
}
