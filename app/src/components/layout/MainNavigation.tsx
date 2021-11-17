import React from "react";
import styles from "./MainNavigation.module.css";
import ConnectButton from "../ConnectButton";
import Head from "next/head";
import Link from "next/link";

const MainNavigation: React.FC = () => {
  return (
    <>
      <Head>
        <link
          href="https://fonts.googleapis.com/css2?family=Arvo&display=swap"
          rel="stylesheet"
        />
      </Head>
      <header className={styles.header}>
        <h1 className={styles.logo}>Block Swap &nbsp; V2</h1>
        <nav className={styles.nav}>
          <ul>
            <li>
              <Link href="/">Swap</Link>
            </li>
            <li>
              <Link href="/stats">Stats</Link>
            </li>
          </ul>
        </nav>
        <div className={styles.button}>
          <ConnectButton />
        </div>
      </header>
    </>
  );
};

export default MainNavigation;
