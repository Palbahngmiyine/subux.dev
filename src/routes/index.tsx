import { Link } from "solid-app-router";

export default function Home() {
  return (
    <>
      <title>Home</title>
      <h1>Hello world!</h1>
      <Link href="/about">About me</Link>
      <br />
      <br />
      <a href="https://blog.subux.dev" target="_blank" rel="noopener">Go to korean blog page</a>
    </>
  );
}
