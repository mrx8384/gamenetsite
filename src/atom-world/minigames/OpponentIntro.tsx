"use client";

import { Canvas, useFrame } from "@react-three/fiber";
import { useEffect, useRef } from "react";
import * as THREE from "three";
import type { AnimSource } from "../characters/CharacterModel";
import { CharacterModel } from "../characters/CharacterModel";
import { type CharacterId, characters } from "../data/characters";
import ui from "../styles/atomWorld.module.css";
import styles from "./minigames.module.css";

/** The other ATOM character plays against you: boy ↔ girl. */
export const rivalOf = (me: CharacterId): CharacterId => (me === "boy" ? "girl" : "boy");

/** Timeline of the arrival (seconds). */
export const OPPONENT_TIMING = { walk: 1.7, turn: 0.45, wave: 1.1 } as const;
export const opponentDuration = (reduced: boolean) => (reduced ? 1.6 : OPPONENT_TIMING.walk + OPPONENT_TIMING.turn + OPPONENT_TIMING.wave);

const START_X = 2.6;

/**
 * Short scene before a round against the computer: the rival ATOM character walks in from the
 * side, turns to the player and gives a little wave, then the countdown starts. «رد کردن» skips it.
 */
export function OpponentIntro({ me, reduced, onDone }: { me: CharacterId; reduced: boolean; onDone: () => void }) {
  const rival = characters[rivalOf(me)];
  const skip = useRef<HTMLButtonElement>(null);
  const done = useRef(onDone);
  useEffect(() => {
    done.current = onDone;
  }, [onDone]);
  useEffect(() => {
    skip.current?.focus();
    const t = window.setTimeout(() => done.current(), opponentDuration(reduced) * 1000);
    return () => window.clearTimeout(t);
  }, [reduced]);

  return (
    <div className={styles.opponent} data-rival={rival.id}>
      <Canvas
        dpr={[1, 1.5]}
        camera={{ fov: 30, position: [0, 1.25, 5.4] }}
        gl={{ antialias: true }}
        style={{ position: "absolute", inset: 0 }}
        onCreated={({ gl, camera }) => {
          gl.toneMapping = THREE.ACESFilmicToneMapping;
          camera.lookAt(0, 0.6, 0); // the figure sits above the text
        }}
      >
        <color attach="background" args={["#050605"]} />
        <hemisphereLight args={["#ffffff", "#202020", 0.6]} />
        <directionalLight position={[1, 4, 5]} intensity={1.6} />
        <pointLight position={[-1.8, 2.4, -1.6]} intensity={16} distance={8} color={rival.accent} />
        <mesh rotation-x={-Math.PI / 2} position={[0, 0, 0]}>
          <circleGeometry args={[3.2, 48]} />
          <meshStandardMaterial color="#111312" roughness={0.6} />
        </mesh>
        <Arrival id={rival.id} reduced={reduced} />
      </Canvas>
      <div className={styles.opponentText} role="status">
        <p>
          👋 <strong style={{ color: rival.accent }}>{rival.name}</strong> آمد با شما بازی کند!
        </p>
        <button ref={skip} type="button" className={ui.btn} onClick={() => done.current()}>
          رد کردن
        </button>
      </div>
    </div>
  );
}

function Arrival({ id, reduced }: { id: CharacterId; reduced: boolean }) {
  const group = useRef<THREE.Group>(null);
  const anim = useRef<AnimSource["current"]>({ state: reduced ? "idle" : "walk", phase: 0, speed: reduced ? 0 : 1.5, turnRate: 0, interact: 0 });
  // real time since the scene opened (not summed frame times), so the walk always fits the timer
  const t0 = useRef(-1);

  useFrame((_, delta) => {
    const g = group.current;
    if (!g) return;
    const a = anim.current;
    if (reduced) {
      g.position.x = 0;
      g.rotation.y = 0;
      return;
    }
    const now = performance.now() / 1000;
    if (t0.current < 0) t0.current = now;
    const time = now - t0.current;
    const { walk, turn } = OPPONENT_TIMING;
    if (time < walk) {
      // walking in from the right, slowing down at the end
      const k = time / walk;
      const ease = 1 - (1 - k) * (1 - k);
      g.position.x = START_X * (1 - ease);
      g.rotation.y = -Math.PI / 2;
      a.state = "walk";
      a.speed = 1.6 * (1 - k * 0.6);
      a.phase += delta * a.speed * 3.1;
    } else if (time < walk + turn) {
      g.position.x = 0;
      const k = (time - walk) / turn;
      g.rotation.y = -Math.PI / 2 * (1 - k * k * (3 - 2 * k));
      a.state = "turn";
      a.speed = 0;
      a.turnRate = 3;
    } else {
      g.rotation.y = 0;
      a.turnRate = 0;
      a.state = "interact";
      a.interact = Math.min(1, (time - walk - turn) / 0.9);
    }
  });

  return (
    <group ref={group} position={[reduced ? 0 : START_X, 0, 0]} rotation-y={reduced ? 0 : -Math.PI / 2}>
      <CharacterModel def={characters[id]} anim={anim} castShadow={false} />
    </group>
  );
}
