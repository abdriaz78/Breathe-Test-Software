import Link from "next/link";
import { Icon } from "@/components/ui/Icon";
import { StatusScreen } from "@/components/ui/StatusScreen";

export default function NotFound() {
  return (
    <StatusScreen
      code="404"
      title="We couldn't find that page"
      message="The record may have been removed, the link may be wrong, or it belongs to a hospital outside your access."
      actions={
        <>
          <Link href="/" className="btn-primary">
            <Icon name="home" className="h-4 w-4" /> Back to dashboard
          </Link>
          <Link href="/patients" className="btn-secondary">
            <Icon name="users" className="h-4 w-4" /> Patients
          </Link>
        </>
      }
    />
  );
}
