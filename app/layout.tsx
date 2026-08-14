import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "链知 ChainScope｜区块链科研知识中台",
  description: "覆盖区块链基础、智能合约安全、跨链互操作与实验室成果的公开 RAG 知识库。",
  icons: { icon: "/favicon.svg", shortcut: "/favicon.svg" },
  openGraph: { title:"链知 ChainScope", description:"让每一个结论，都有证据可循。", images:["/og.png"] },
  twitter: { card:"summary_large_image", title:"链知 ChainScope", description:"区块链科研知识中台", images:["/og.png"] },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="zh-CN">
      <body>{children}</body>
    </html>
  );
}
