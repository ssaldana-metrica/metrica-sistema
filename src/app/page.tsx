import { redirect } from "next/navigation";

// El proxy decide: con sesión va a /panel, sin sesión a /login.
export default function Inicio() {
  redirect("/panel");
}
