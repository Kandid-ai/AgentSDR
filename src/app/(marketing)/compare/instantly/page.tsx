import { ComparePage, compareMetadata } from "@/components/marketing/pages/compare/ComparePage";

export const metadata = compareMetadata("instantly");

export default function Page() {
  return <ComparePage slug="instantly" />;
}
