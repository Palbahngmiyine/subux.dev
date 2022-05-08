import { NavLink } from "solid-app-router";

// TODO: Add more links and processing
export default function Navigator() {
  //const pathname = useLocation().pathname;

  return (
    <ul class="flex list-none items-center">
      <li class="mr-6">
        <h2><NavLink href="/">/ Subux</NavLink></h2>
      </li>
    </ul>
  );
}