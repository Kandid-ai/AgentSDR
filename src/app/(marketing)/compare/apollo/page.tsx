import { ComparePage, compareMetadata } from "@/components/marketing/pages/compare/ComparePage";

export const metadata = compareMetadata("apollo");

export default function Page() {
  return <ComparePage slug="apollo" />;
}
