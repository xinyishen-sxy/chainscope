import type { Source } from "./types";

const ORCID = "0000-0001-5870-5730";
const synced = "2026-08-13T10:00:00Z";

type Work = [id: string, title: string, year: number, doi?: string];

const additionalWorks: Work[] = [
  ["heterogeneous-gnn-filtering", "Heterogeneous graphs neural networks based on neighbor relationship filtering", 2024, "10.1016/j.eswa.2023.122489"],
  ["treemerge", "TreeMerge: Efficient Generation of Minimal Hitting-Sets for Conflict Sets in Tree Structure for Model-Based Fault Diagnosis", 2021, "10.1109/TR.2021.3115130"],
  ["minimal-diagnosis-des", "Minimal Diagnosis and Diagnosability of Discrete-Event Systems Modeled by Automata", 2020, "10.1155/2020/4306261"],
  ["twin-engined-diagnosis", "Twin-engined diagnosis of discrete-event systems", 2019, "10.1002/eng2.12060"],
  ["minimal-hitting-subset", "Computing all minimal hitting sets by subset recombination", 2018, "10.1007/s10489-017-0971-7"],
  ["minimal-hitting-join", "Deriving All Minimal Hitting Sets Based on Join Relation", 2015, "10.1109/TSMC.2015.2400423"],
  ["diagnosis-semantic-patterns", "Diagnosis of active systems by semantic patterns", 2014, "10.1109/TSMC.2013.2296277"],
  ["chs-tree", "Computing minimal hitting sets with CHS-tree method", 2014, "10.13196/j.cims.2014.02.wangxiao.0401.6.20140220"],
  ["optical-flow-3d-gradient", "A fast simple optical flow computation approach based on the 3-D gradient", 2014, "10.1109/TCSVT.2013.2283648"],
  ["candidate-space-monotonicity", "Monotonicity of candidate space in model-based diagnosis", 2013, "10.13196/j.cims.2013.12.wangxiao.3043.6.20131215"],
  ["higher-order-des-spec", "Specification and model-based diagnosis of higher-order discrete-event systems", 2013, "10.1109/SMC.2013.400"],
  ["higher-order-des", "Diagnosis of higher-order discrete-event systems", 2013, "10.1007/978-3-642-40511-2_12"],
  ["contingent-planning-observations", "Improving helpful actions for contingent planning with enforced observations", 2013],
  ["partially-ordered-observations", "Reasoning on partially-ordered observations in online diagnosis of DESs", 2012, "10.3233/AIC-2012-0518"],
  ["bdd-truncation", "New results to BDD truncation method for efficient top event probability calculation", 2012, "10.5516/NET.03.2011.058"],
  ["incremental-diagnosis-measurement", "Improving incremental diagnosis with choosing measurement order", 2010, "10.1109/ISME.2010.22"],
  ["minimal-consistency-sat", "Deriving all minimal consistency-based diagnosis sets using SAT solvers", 2009, "10.1016/j.pnsc.2008.07.017"],
  ["causal-model-diagnosis", "New method of using causal relations for model-based fault diagnosis", 2009],
  ["atms-conflict-measurement", "Approach for conflict sets identification and diagnostic measurement based on ATMS", 2009],
  ["minimal-conflict-sat", "Deriving all minimal conflict sets using satisfiability algorithms", 2009],
  ["two-temporal-windows", "On-line diagnosis of discrete event systems with two successive temporal windows", 2008, "10.3233/AIC-2008-0439"],
  ["online-diagnosis-hierarchical", "On-line diagnosis of discrete-event systems: A hierarchical approach", 2008, "10.1109/RAMECH.2008.4681372"],
  ["failure-behavior-diagnosis", "Model diagnosis based on failure behavior", 2008],
  ["atms-complete-conflict", "A complete approach to identify conflict sets based on ATMS", 2008, "10.1109/ICSMC.2008.4811581"],
  ["diagnosability-hierarchical", "An extended hierarchical framework for definitions of diagnosability of discrete event systems", 2008, "10.1109/ICSMC.2008.4811578"],
  ["minimal-conflict-new-methods", "New methods for deriving all minimal conflict sets in model-based diagnosis", 2007],
  ["minimal-conflict-improved", "Improved algorithms for deriving all minimal conflict sets in model-based diagnosis", 2007],
  ["se-tree-hitting-sets", "A method of combining SE-tree to compute all minimal hitting sets", 2006, "10.1080/10020070612331343209"],
];

export const ORCID_ADDITIONAL_SOURCES: Source[] = additionalWorks.map(([id, title, year, doi]) => ({
  id,
  title,
  url: doi ? `https://doi.org/${doi}` : `https://orcid.org/${ORCID}?work=${encodeURIComponent(id)}`,
  topic: "lab",
  type: "paper",
  authors: ["Xiangfu Zhao et al."],
  year,
  license: "Metadata only",
  status: "published",
  lastSyncedAt: synced,
  doi,
  collection: "lab",
  orcid: ORCID,
  contentScope: "metadata",
  fulltextStatus: "metadata_only",
}));
