"use client";

import dynamic from "next/dynamic";

const ModelLab = dynamic(() => import("./ModelLab").then((m) => m.ModelLab), { ssr: false });

export function ModelLabLoader() {
  return <ModelLab />;
}
