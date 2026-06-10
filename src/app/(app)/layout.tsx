import { redirect } from "next/navigation";
import { obtenerSesion } from "@/lib/auth";
import { crearClienteServidor } from "@/lib/supabase/server";

// Candado de la zona protegida: sin sesión válida no se ve nada.
// Cubre también al usuario dado de baja A MITAD de sesión: su login de
// Google sigue vivo, pero su fila en `usuarios` ya no responde (activo=false),
// así que se le cierra la sesión y se le muestra acceso denegado.
export default async function LayoutProtegido({
  children,
}: {
  children: React.ReactNode;
}) {
  const sesion = await obtenerSesion();

  if (!sesion) {
    const supabase = await crearClienteServidor();
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      // Tiene login de Google pero no acceso al sistema.
      redirect("/acceso-denegado?motivo=inactivo");
    }
    redirect("/login");
  }

  return <>{children}</>;
}
