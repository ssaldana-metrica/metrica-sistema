import { NextResponse } from "next/server";
import { crearClienteServidor } from "@/lib/supabase/server";
import { crearClienteAdmin } from "@/lib/supabase/admin";
import { dominioPermitido } from "@/config/dominios";

// Vuelta de Google. Aquí se decide quién entra:
// 1. Dominio fuera de la lista        → acceso denegado.
// 2. Usuario dado de baja (activo=false) → acceso denegado.
// 3. Correo de dominio válido sin registro → se crea como 'ejecutivo'.
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
    const nombre =
      (data.user.user_metadata?.full_name as string | undefined) ??
      (data.user.user_metadata?.name as string | undefined) ??
      correo.split("@")[0];
    const { error: errorAlta } = await admin
      .from("usuarios")
      .insert({ nombre, correo, rol: "ejecutivo" });
    if (errorAlta) {
      await supabase.auth.signOut();
      return NextResponse.redirect(`${origin}/acceso-denegado?motivo=error`);
    }
  } else if (!usuario.activo) {
    await supabase.auth.signOut();
    return NextResponse.redirect(`${origin}/acceso-denegado?motivo=inactivo`);
  }

  return NextResponse.redirect(`${origin}/panel`);
}
