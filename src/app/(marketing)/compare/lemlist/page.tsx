import { ComparePage, compareMetadata } from "@/components/marketing/pages/compare/ComparePage";

export const metadata = compareMetadata("lemlist");

export default function Page() {
  return <ComparePage slug="lemlist" />;
}
