"use client";

import { useEffect, useRef } from "react";
import gsap from "gsap";
import { DialRoot, useDialKit } from "dialkit";
import "dialkit/styles.css";

export default function AnimationDemo() {
  const boxRef = useRef(null);
  const values = useDialKit("Box", {
    x: [200, 0, 600],
    duration: [1, 0.1, 3],
  });

  useEffect(() => {
    gsap.to(boxRef.current, {
      x: values.x,
      duration: values.duration,
      ease: "power2.out",
    });
  }, [values.x, values.duration]);

  return (
    <div className="flex flex-1 items-center justify-center bg-zinc-50 dark:bg-black">
      <div
        ref={boxRef}
        className="h-20 w-20 rounded-xl bg-violet-400"
      />
      <DialRoot />
    </div>
  );
}
