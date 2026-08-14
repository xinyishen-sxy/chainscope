import type { Metadata } from "next";
import { ChainScopeApp } from "./chainscope-app";

export const metadata: Metadata = {
  title: "链知 ChainScope｜区块链科研知识中台",
  description: "面向实验室新生与科研助理的可溯源区块链 RAG 知识库。",
};

export default function Home() {
  return <ChainScopeApp />;
}
