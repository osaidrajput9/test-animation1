import "./style.css";
import gsap from "gsap";
import { createDialKit, createDialRoot } from "dialkit/vanilla";
import "dialkit/vanilla/styles.css";

const box = document.querySelector(".box");

createDialRoot();
const kit = createDialKit("Box", {
  x: [200, 0, 600],
  duration: [1, 0.1, 3],
});

kit.subscribe((values) => {
  gsap.to(box, { x: values.x, duration: values.duration, ease: "power2.out" });
});
