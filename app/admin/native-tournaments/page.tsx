import { NativeTournamentsSection } from "@/components/admin/sections/NativeTournamentsSection";
import { listNativeTournaments } from "@/app/admin/native-tournaments/actions";

export default async function AdminNativeTournamentsPage() {
  return <NativeTournamentsSection initialRows={await listNativeTournaments()} />;
}
