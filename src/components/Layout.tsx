import Header from "@/components/Header";
import {ReactNode} from "react";
import {Inter} from "next/font/google";

const font = Inter({subsets: ['latin']})

export default function Layout({children}: { children: ReactNode }) {
  return (
    <div className={font.className}>
      <Header/>
      <main>{children}</main>
    </div>
  )
}