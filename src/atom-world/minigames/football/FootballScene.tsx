"use client";

import { useFrame } from "@react-three/fiber";
import { useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import { bakeColors } from "../../characters/bakeColors";
import { applyPose, buildToonCharacter } from "../../characters/buildToonCharacter";
import { blendPose, neutralPose, targetPose } from "../../characters/CharacterAnimations";
import type { AnimState } from "../../data/characters";
import { blobTexture } from "../city/city3d";
import { type FootballState, GOAL, L, W } from "./engine";
import {
  BALL_R,
  ballTexture,
  BOARD_H,
  boardsTexture,
  crowdTexture,
  drawScoreboard,
  GOAL_D,
  GOAL_H,
  kitLook,
  netTexture,
  numberTexture,
  pitchTexture,
  toX,
  toZ,
} from "./football3d";

/** How the camera looks at the match: from the side like TV (wide screens), or from behind ATOM's attack (tall phones). */
export interface FootballView {
  mode: "side" | "behind";
}

interface Props {
  initial: FootballState;
  simRef: React.RefObject<FootballState>;
  tickRef: React.RefObject<(dt: number) => void>;
  viewRef: React.RefObject<FootballView>;
  /** lighter textures and no crowd on «کم» */
  low: boolean;
}

const wrap = (a: number) => Math.atan2(Math.sin(a), Math.cos(a));
const placeFigure = (o: THREE.Object3D, x: number, z: number, yaw: number) => {
  o.position.set(x, 0, z);
  o.rotation.y = yaw;
};
/** Upload a canvas texture again after drawing on its canvas. */
const refresh = (t: THREE.Texture) => {
  t.needsUpdate = true;
};
const STAND_LEN = L + 18;
/** The advert strip (4 adverts) is about 17.5 m long on a board of this height. */
const AD_STRIP = 17.5;
/** Engine heading (angle in the x / y plane) → yaw of a figure built facing +Z. */
const yawOf = (face: number) => Math.PI / 2 - face;

/**
 * «فوتبال اتم» in 3D: a floodlit futsal court with boards, goals with nets, a stand and a score
 * screen; the six players are the club's toon figures in kits, animated from the rules' state
 * (run, kick, keeper stance, goal celebrations). Calls `tickRef` (one rules step) every frame first.
 */
export function FootballScene({ initial, simRef, tickRef, viewRef, low }: Props) {
  const ball = useRef<THREE.Mesh>(null);
  const ballShadow = useRef<THREE.Mesh>(null);
  const ring = useRef<THREE.Mesh>(null);
  const wedge = useRef<THREE.Mesh>(null);
  const marker = useRef<THREE.Mesh>(null);
  const shadows = useRef<(THREE.Mesh | null)[]>([]);
  const screen = useRef<{ text: string }>({ text: "" });
  const cam = useRef({ pos: new THREE.Vector3(0, 15, W / 2 + 17), look: new THREE.Vector3(), snap: true });
  const anim = useRef({ score: [0, 0] as [number, number], celebrate: { team: -1, until: 0 }, ballVis: new THREE.Vector3(), ballOwner: -2 as number | null, blendUntil: 0 });
  // scratch vectors (no allocations per frame)
  const tmp = useRef({ tgt: new THREE.Vector3(), before: new THREE.Vector3(), mv: new THREE.Vector3(), axis: new THREE.Vector3(), pos: new THREE.Vector3(), look: new THREE.Vector3() });

  const [tex] = useState(() => {
    const scoreCanvas = document.createElement("canvas");
    scoreCanvas.width = 512;
    scoreCanvas.height = 160;
    const score = new THREE.CanvasTexture(scoreCanvas);
    score.colorSpace = THREE.SRGBColorSpace;
    const crowd = crowdTexture();
    crowd.repeat.x = STAND_LEN / 14;
    return { pitch: pitchTexture(low ? 16 : 32), boards: boardsTexture(), net: netTexture(), crowd, ball: ballTexture(), blob: blobTexture(), score, scoreCanvas };
  });
  const [geo] = useState(() => ({
    ring: new THREE.RingGeometry(0.72, 0.92, 36).rotateX(-Math.PI / 2),
    wedge: new THREE.ShapeGeometry(new THREE.Shape([new THREE.Vector2(0.55, 0), new THREE.Vector2(0, 0.28), new THREE.Vector2(0, -0.28)])).rotateX(-Math.PI / 2).translate(1.05, 0, 0),
    marker: new THREE.ConeGeometry(0.2, 0.38, 4).rotateX(Math.PI),
    shadow: new THREE.PlaneGeometry(1.4, 1.4).rotateX(-Math.PI / 2),
    number: new THREE.PlaneGeometry(0.19, 0.19),
  }));

  // the six players: the club's toon figure in kits, colours baked for fewer draw calls, number on the back
  const team = useMemo(
    () =>
      initial.players.map((p) => {
        const k = kitLook(p.team, p.role, p.id);
        const rig = buildToonCharacter(k.look, false, k.build);
        const baked = bakeColors(rig.root, false);
        const numTex = numberTexture(p.num, k.number);
        const numMat = new THREE.MeshBasicMaterial({ map: numTex, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2 });
        const num = new THREE.Mesh(geo.number, numMat);
        num.position.set(0, 0.36, -0.142);
        num.rotation.y = Math.PI;
        rig.torso.add(num);
        rig.root.scale.setScalar(1.25);
        rig.root.name = `footballer-${p.id}`;
        return {
          rig,
          dispose: () => {
            rig.dispose();
            baked.forEach((g) => g.dispose());
            numTex.dispose();
            numMat.dispose();
          },
        };
      }),
    [initial, geo],
  );
  // per-player animation state (changes every frame)
  const motion = useRef(initial.players.map((p) => ({ pose: neutralPose(), target: neutralPose(), phase: 0, yaw: yawOf(p.face), kickT: 9, prevKick: 0 })));
  useEffect(() => () => team.forEach((t) => t.dispose()), [team]);
  useEffect(
    () => () => {
      for (const t of Object.values(tex)) if (t instanceof THREE.Texture) t.dispose();
      for (const g of Object.values(geo)) g.dispose();
    },
    [tex, geo],
  );

  useFrame((state, delta) => {
    const camera = state.camera as THREE.PerspectiveCamera;
    const size = state.size;
    const w = tmp.current;
    const dt = Math.min(0.05, delta);
    tickRef.current?.(dt);
    const s = simRef.current;
    const v = viewRef.current;
    if (!s || !v) return;
    const a = anim.current;
    const t = s.time;

    // a goal: the scorers celebrate during the kick-off pause
    if (s.score[0] !== a.score[0] || s.score[1] !== a.score[1]) {
      a.celebrate = { team: s.score[0] !== a.score[0] ? 0 : 1, until: t + 1.6 };
      a.score = [s.score[0], s.score[1]];
    }
    const party = t < a.celebrate.until;

    // ── players
    s.players.forEach((p, i) => {
      const f = motion.current[i];
      const rig = team[i].rig;
      const sp = Math.hypot(p.vx, p.vy);
      f.phase += sp * dt * 2.3;
      // a kick: the rules restart the player's kick cooldown at 0.35 s
      if (p.kickCd > f.prevKick + 0.05 && Math.abs(p.kickCd - 0.35) < 0.02) f.kickT = 0;
      f.prevKick = p.kickCd;
      f.kickT += dt;
      const state: AnimState = sp > 5 ? "run" : sp > 0.6 ? "walk" : "idle";
      const tp = targetPose({ state, time: t + i, phase: f.phase, speed: sp, turnRate: 0, interact: 0 }, f.target);
      const holding = s.ball.owner === p.id;
      if (p.role === "gk" && sp < 3 && !holding) {
        // keeper's ready stance
        tp.kneeL = tp.kneeR = 0.5;
        tp.thighL = tp.thighR = 0.32;
        tp.lean = 0.28;
        tp.armOutL = tp.armOutR = 0.6;
        tp.armL = tp.armR = -0.35;
        tp.elbowL = tp.elbowR = 0.55;
      }
      if (p.role === "gk" && holding) {
        // ball held at the chest
        tp.armL = tp.armR = -1.25;
        tp.armOutL = tp.armOutR = 0.12;
        tp.elbowL = tp.elbowR = 0.5;
      }
      if (f.kickT < 0.34) {
        // wind up, strike with the right foot, follow through
        const u = f.kickT / 0.34;
        tp.thighR = u < 0.35 ? -0.75 * (u / 0.35) : -0.75 + 2.1 * Math.min(1, (u - 0.35) / 0.3);
        tp.kneeR = u < 0.35 ? 1.25 : 1.25 * Math.max(0, 1 - (u - 0.35) / 0.2) + 0.1;
        tp.thighL = 0.15;
        tp.kneeL = 0.3;
        tp.armOutL = tp.armOutR = 0.75;
        tp.armL = -0.5;
        tp.armR = 0.3;
        tp.lean = -0.08;
      }
      if (party && p.role === "field") {
        if (p.team === a.celebrate.team) {
          tp.armL = tp.armR = -2.75;
          tp.armOutL = tp.armOutR = 0.35;
          tp.elbowL = tp.elbowR = 0.15;
          tp.bob = Math.abs(Math.sin(t * 9 + i)) * 0.14;
          tp.headX = -0.25;
        } else {
          tp.headX = 0.5;
          tp.armL = tp.armR = 0.05;
          tp.lean = 0.12;
        }
      }
      blendPose(f.pose, tp, dt, f.kickT < 0.34 ? 26 : 14);
      applyPose(rig, f.pose, t + i * 0.37);
      f.yaw += wrap(yawOf(p.face) - f.yaw) * (1 - Math.exp(-dt * 14));
      placeFigure(rig.root, toX(p.x), toZ(p.y), f.yaw);
      const sh = shadows.current[i];
      if (sh) sh.position.set(toX(p.x), 0.02, toZ(p.y));
    });

    // ── the player the user steers: ring, direction wedge and a marker over the head
    const me = s.players[s.controlled];
    if (me) {
      ring.current?.position.set(toX(me.x), 0.03, toZ(me.y));
      if (wedge.current) {
        wedge.current.position.set(toX(me.x), 0.031, toZ(me.y));
        wedge.current.rotation.y = -me.face;
      }
      marker.current?.position.set(toX(me.x), 2.75 + Math.sin(t * 5) * 0.08, toZ(me.y));
    }

    // ── the ball: at the carrier's feet (or in the keeper's hands), rolling when free
    const b = s.ball;
    const own = b.owner === null ? null : s.players[b.owner];
    const tgt = w.tgt.set(toX(b.x), BALL_R, toZ(b.y));
    if (own) {
      const f = motion.current[own.id];
      const ahead = own.role === "gk" ? 0.38 : 0.5 + Math.abs(Math.sin(f.phase)) * 0.12;
      tgt.set(toX(own.x) + Math.cos(own.face) * ahead, own.role === "gk" ? 1.0 : BALL_R, toZ(own.y) + Math.sin(own.face) * ahead);
    }
    if (b.owner !== a.ballOwner) {
      a.ballOwner = b.owner;
      a.blendUntil = t + 0.15;
    }
    const before = w.before.copy(a.ballVis);
    if (own || t < a.blendUntil) a.ballVis.lerp(tgt, 1 - Math.exp(-dt * 24));
    else a.ballVis.copy(tgt);
    if (ball.current) {
      ball.current.position.copy(a.ballVis);
      const mv = w.mv.copy(a.ballVis).sub(before);
      mv.y = 0;
      const d = mv.length();
      if (d > 1e-4 && d < 3) ball.current.rotateOnWorldAxis(w.axis.set(mv.z, 0, -mv.x).normalize(), d / BALL_R);
    }
    if (ballShadow.current) {
      ballShadow.current.position.set(a.ballVis.x, 0.025, a.ballVis.z);
      const k = 0.55 / (1 + a.ballVis.y * 0.6);
      ballShadow.current.scale.setScalar(k);
    }

    // ── stadium screen (redrawn when the score or the second changes)
    const text = `${s.score[0]}-${s.score[1]}-${Math.ceil(s.left)}`;
    if (text !== screen.current.text) {
      screen.current.text = text;
      drawScoreboard(tex.scoreCanvas.getContext("2d")!, tex.scoreCanvas.width, tex.scoreCanvas.height, s.score, s.left);
      refresh(tex.score);
    }

    // ── camera: from the side following the ball (wide screens), or behind ATOM's attack (tall phones)
    const aspect = size.width / Math.max(1, size.height);
    v.mode = aspect < 0.95 ? "behind" : "side";
    const c = cam.current;
    const bx = a.ballVis.x;
    const bz = a.ballVis.z;
    const pos = w.pos;
    const look = w.look;
    let fov: number;
    if (v.mode === "side") {
      // narrower screens step back a little to keep the same width of pitch in view
      const back = Math.min(1.5, Math.max(1, 1.75 / aspect));
      const cx = Math.max(-L / 2 + 9, Math.min(L / 2 - 9, bx));
      // closer to the play like a TV camera; it slides along the touchline and tilts with the ball
      pos.set(cx, 10.5 * back, bz * 0.35 + W / 2 + 9 * back);
      look.set(cx, 0, bz * 0.65 - 1);
      fov = 36;
    } else {
      const cx = Math.max(-L / 2 + 3, Math.min(L / 2 - 1, bx));
      pos.set(cx - 12.5, 10.5, bz * 0.5);
      look.set(cx + 9, 0, bz * 0.8);
      fov = 58;
    }
    if (c.snap) {
      c.pos.copy(pos);
      c.look.copy(look);
      c.snap = false;
    } else {
      const k = 1 - Math.exp(-dt * 3.2);
      c.pos.lerp(pos, k);
      c.look.lerp(look, k);
    }
    if (Math.abs(camera.fov - fov) > 0.01) {
      camera.fov = fov;
      camera.updateProjectionMatrix();
    }
    camera.position.copy(c.pos);
    camera.lookAt(c.look);
  });

  const standLen = STAND_LEN;
  const tiers = low ? 4 : 6;
  return (
    <>
      <color attach="background" args={["#0a1322"]} />
      <fog attach="fog" args={["#0a1322", 70, 160]} />
      <hemisphereLight args={["#eef3ff", "#1e3a26", 1.15]} />
      <directionalLight position={[-12, 30, 18]} intensity={1.55} />
      <ambientLight intensity={0.25} />

      {/* ground around the court, the pitch with its lines */}
      <mesh rotation-x={-Math.PI / 2} position={[0, -0.01, 0]}>
        <planeGeometry args={[L + 60, W + 70]} />
        <meshLambertMaterial color="#14301c" />
      </mesh>
      <mesh rotation-x={-Math.PI / 2} position={[0, 0, 0]}>
        <planeGeometry args={[L + 5, W + 5]} />
        <meshLambertMaterial color="#246b33" />
      </mesh>
      <mesh rotation-x={-Math.PI / 2} position={[0, 0.005, 0]}>
        <planeGeometry args={[L, W]} />
        <meshLambertMaterial map={tex.pitch} />
      </mesh>

      <Boards boards={tex.boards} />
      <Goal side={0} net={tex.net} />
      <Goal side={1} net={tex.net} />

      {/* the stand along the far side, the score screen on top, floodlights behind it */}
      {Array.from({ length: tiers }, (_, i) => {
        const z = -(W / 2 + 4.5 + i * 2.1);
        const top = 0.9 + i * 1.15;
        return (
          <group key={i}>
            <mesh position={[0, top / 2, z]}>
              <boxGeometry args={[standLen, top, 2.1]} />
              <meshLambertMaterial color={i % 2 ? "#2a303c" : "#323947"} />
            </mesh>
            {!low && (
              <mesh position={[0, top + 0.5, z + 0.35]}>
                <planeGeometry args={[standLen, 1]} />
                <meshBasicMaterial map={tex.crowd} toneMapped={false} color="#c8ccd6" />
              </mesh>
            )}
          </group>
        );
      })}
      <group position={[0, 0.9 + tiers * 1.15 + 2.6, -(W / 2 + 4.5 + (tiers - 1) * 2.1)]}>
        <mesh position={[0, 0, -0.2]}>
          <boxGeometry args={[12.8, 4.4, 0.4]} />
          <meshLambertMaterial color="#111418" />
        </mesh>
        <mesh position={[0, 0, 0.01]}>
          <planeGeometry args={[12, 3.75]} />
          <meshBasicMaterial map={tex.score} toneMapped={false} />
        </mesh>
        {[-4.5, 4.5].map((x) => (
          <mesh key={x} position={[x, -3.6, -0.2]}>
            <boxGeometry args={[0.3, 3.2, 0.3]} />
            <meshLambertMaterial color="#1b1f26" />
          </mesh>
        ))}
      </group>
      {[-1, 1].map((sx) => (
        <group key={sx} position={[sx * (L / 2 + 4), 0, -(W / 2 + 18)]}>
          <mesh position={[0, 11, 0]}>
            <cylinderGeometry args={[0.35, 0.5, 22, 10]} />
            <meshLambertMaterial color="#3a404a" />
          </mesh>
          <mesh position={[0, 22.4, 0.3]} rotation-x={0.35}>
            <boxGeometry args={[5, 2.6, 0.5]} />
            <meshLambertMaterial color="#20252c" />
          </mesh>
          {Array.from({ length: 8 }, (_, k) => (
            <mesh key={k} position={[-1.8 + (k % 4) * 1.2, 22.9 - Math.floor(k / 4) * 1.05, 0.62]} rotation-x={0.35}>
              <planeGeometry args={[0.9, 0.8]} />
              <meshBasicMaterial color="#fffbe8" toneMapped={false} />
            </mesh>
          ))}
        </group>
      ))}

      {/* players with blob shadows */}
      {team.map((f, i) => (
        <group key={i}>
          <primitive object={f.rig.root} />
          <mesh
            ref={(m) => {
              shadows.current[i] = m;
            }}
            geometry={geo.shadow}
          >
            <meshBasicMaterial map={tex.blob} transparent depthWrite={false} />
          </mesh>
        </group>
      ))}

      {/* the user's player */}
      <mesh ref={ring} geometry={geo.ring}>
        <meshBasicMaterial color="#ffffff" transparent opacity={0.9} depthWrite={false} />
      </mesh>
      <mesh ref={wedge} geometry={geo.wedge}>
        <meshBasicMaterial color="#ffffff" transparent opacity={0.85} depthWrite={false} side={THREE.DoubleSide} />
      </mesh>
      <mesh ref={marker} geometry={geo.marker}>
        <meshBasicMaterial color="#39ff88" toneMapped={false} />
      </mesh>

      {/* the ball */}
      <mesh ref={ball} position={[0, BALL_R, 0]} name="football-ball">
        <sphereGeometry args={[BALL_R, 28, 18]} />
        <meshStandardMaterial map={tex.ball} roughness={0.45} metalness={0} />
      </mesh>
      <mesh ref={ballShadow} geometry={geo.shadow}>
        <meshBasicMaterial map={tex.blob} transparent depthWrite={false} />
      </mesh>
    </>
  );
}

/** Low boards round the pitch with the club's adverts (open in front of the goal mouths). */
function Boards({ boards }: { boards: THREE.Texture }) {
  const pieces = useMemo(() => {
    const out: { x: number; z: number; len: number; rot: number }[] = [];
    // long sides (the near one shows its back to the camera)
    out.push({ x: 0, z: -(W / 2 + 0.25), len: L + 0.5, rot: 0 });
    out.push({ x: 0, z: W / 2 + 0.25, len: L + 0.5, rot: Math.PI });
    // ends: beside the goal, and behind the net
    for (const sx of [-1, 1]) {
      const side = W / 2 - GOAL;
      for (const sz of [-1, 1]) out.push({ x: sx * (L / 2 + 0.25), z: sz * (GOAL + side / 2), len: side + 0.5, rot: sx > 0 ? -Math.PI / 2 : Math.PI / 2 });
      out.push({ x: sx * (L / 2 + GOAL_D + 0.45), z: 0, len: GOAL * 2 + 0.6, rot: sx > 0 ? -Math.PI / 2 : Math.PI / 2 });
    }
    return out.map((p) => {
      const map = boards.clone();
      map.repeat.x = p.len / AD_STRIP;
      map.needsUpdate = true;
      return { ...p, map };
    });
  }, [boards]);
  useEffect(() => () => pieces.forEach((p) => p.map.dispose()), [pieces]);
  return (
    <>
      {pieces.map((p, i) => (
        <group key={i} position={[p.x, 0, p.z]} rotation-y={p.rot}>
          <mesh position={[0, BOARD_H / 2, 0]}>
            <boxGeometry args={[p.len, BOARD_H, 0.14]} />
            <meshLambertMaterial color="#0d1a12" />
          </mesh>
          {/* the advert faces the pitch (+z in the piece's frame) */}
          <mesh position={[0, BOARD_H / 2, 0.075]}>
            <planeGeometry args={[p.len, BOARD_H - 0.08]} />
            <meshBasicMaterial map={p.map} toneMapped={false} />
          </mesh>
        </group>
      ))}
    </>
  );
}

/** White posts and crossbar on the goal line, net behind (sides, back, roof). */
function Goal({ side, net }: { side: 0 | 1; net: THREE.Texture }) {
  const sx = side ? 1 : -1;
  const x = sx * (L / 2);
  const back = x + sx * GOAL_D;
  const netMat = useMemo(() => {
    const m = new THREE.MeshBasicMaterial({ map: net.clone(), transparent: true, depthWrite: false, side: THREE.DoubleSide });
    m.map!.repeat.set(8, 3);
    m.map!.needsUpdate = true;
    return m;
  }, [net]);
  useEffect(() => () => (netMat.map?.dispose(), netMat.dispose()), [netMat]);
  const post = "#f6f6f6";
  return (
    <group>
      {[-GOAL, GOAL].map((z) => (
        <mesh key={z} position={[x, GOAL_H / 2, z]}>
          <cylinderGeometry args={[0.08, 0.08, GOAL_H, 12]} />
          <meshLambertMaterial color={post} />
        </mesh>
      ))}
      <mesh position={[x, GOAL_H, 0]} rotation-x={Math.PI / 2}>
        <cylinderGeometry args={[0.08, 0.08, GOAL * 2 + 0.16, 12]} />
        <meshLambertMaterial color={post} />
      </mesh>
      {/* frame at the back */}
      {[-GOAL, GOAL].map((z) => (
        <mesh key={`b${z}`} position={[back, GOAL_H / 2 - 0.2, z]}>
          <cylinderGeometry args={[0.04, 0.04, GOAL_H - 0.4, 8]} />
          <meshLambertMaterial color="#cfd3d6" />
        </mesh>
      ))}
      {/* net: back, two sides, roof */}
      <mesh position={[back, (GOAL_H - 0.4) / 2, 0]} rotation-y={Math.PI / 2} material={netMat}>
        <planeGeometry args={[GOAL * 2, GOAL_H - 0.4]} />
      </mesh>
      {[-GOAL, GOAL].map((z) => (
        <mesh key={`s${z}`} position={[(x + back) / 2, GOAL_H / 2 - 0.1, z]} material={netMat}>
          <planeGeometry args={[GOAL_D, GOAL_H - 0.2]} />
        </mesh>
      ))}
      <mesh position={[(x + back) / 2, GOAL_H - 0.2, 0]} rotation-x={-Math.PI / 2} material={netMat}>
        <planeGeometry args={[GOAL_D, GOAL * 2]} />
      </mesh>
    </group>
  );
}
