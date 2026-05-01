"use client";

import dynamic from "next/dynamic";

const FacilityMap = dynamic(() => import("./FacilityMap"), { ssr: false });

export default function FacilityMapWrapper(props: {
  lat: number;
  lng: number;
  name: string;
  address: string;
}) {
  return <FacilityMap {...props} />;
}
