import Link from "next/link";

// TODO: Add more links and processing
export default function Navigator() {
  return (
    <ul className="flex list-none items-center">
      <li className="mr-6">
        <h2><Link href="/" className="no-underline">/ Subux</Link></h2>
      </li>
    </ul>
  );
}
