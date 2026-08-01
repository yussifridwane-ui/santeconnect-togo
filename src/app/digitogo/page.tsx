import { redirect } from "next/navigation";

// DigiTogo est servi comme fichier statique public ; /digitogo y redirige proprement.
export default function DigiTogoPage() {
  redirect("/digitogo/index.html");
}
