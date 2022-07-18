import Link from 'next/link';

export default function Home() {
    return (
      <>        
        <h1>Hello world!</h1>
        <Link href="/about">About me</Link>
        <br />
        <br />
        <a href="https://blog.subux.dev" target="_blank" rel="noopener noreferrer">Go to korean blog page</a>
      </>
    );
}
