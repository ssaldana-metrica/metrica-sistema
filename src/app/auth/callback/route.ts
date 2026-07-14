import { NextResponse } from "next/server";
import { crearClienteServidor } from "@/lib/supabase/server";
import { crearClienteAdmin } from "@/lib/supabase/admin";
import { dominioPermitido } from "@/config/dominios";

// Vuelta de Google. Aquí se decide quién entra:
// 1. Dominio fuera de la lista            → acceso denegado.
// 2. Usuario dado de baja (activo=false)  → acceso denegado.
// 3. Correo de dominio válido sin registro → elige su rol (admin/ejecutivo).
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  if (!code) return NextResponse.redirect(`${origin}/login`);

  const supabase = await crearClienteServidor();
  const { data, error } = await supabase.auth.exchangeCodeForSession(code);
  if (error || !data.user?.email) {
    return NextResponse.redirect(`${origin}/login`);
  }

  const correo = data.user.email.toLowerCase();

  if (!dominioPermitido(correo)) {
    await supabase.auth.signOut();
    return NextResponse.redirect(`${origin}/acceso-denegado?motivo=dominio`);
  }

  const admin = crearClienteAdmin();
  const { data: usuario } = await admin
    .from("usuarios")
    .select("id, activo")
    .eq("correo", correo)
    .maybeSingle();

  if (!usuario) {
    // Primer ingreso: aún no tiene rol. Elige entre Administración y Ejecutivo.
    return NextResponse.redirect(`${origin}/elegir-rol`);
  }
  if (!usuario.activo) {
    await supabase.auth.signOut();
    return NextResponse.redirect(`${origin}/acceso-denegado?motivo=inactivo`);
  }

  return NextResponse.redirect(`${origin}/panel`);
}
