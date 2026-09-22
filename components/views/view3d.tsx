"use client";

import { Grid, OrbitControls } from "@react-three/drei";
import { useTheme } from "@teispace/next-themes";
import { Move3d } from "lucide-react";
import { useEffect, useLayoutEffect, useMemo, useRef } from "react";
import { Canvas, useThree, type ThreeEvent } from "@react-three/fiber";
import * as THREE from "three";

import { useT } from "@/hooks/use-t";
import { useVehicle } from "@/hooks/use-vehicle";
import { dimsFor } from "@/lib/geometry";
import { useLayoutStore } from "@/store/use-layout-store";
import { useUiStore } from "@/store/use-ui-store";
import { LayerControls } from "@/components/views/layer-controls";
import type { CargoItem, CylinderAxis, LoadingSide, Placement } from "@/types";

/**
 * 3D-вид: прозрачный кузов с рёбрами, InstancedMesh по группам
 * (товар × ориентация цилиндра), слои по высоте из ui-store (общие с 2D),
 * орбита/зум/панорама, выбор груза кликом. Мир — в метрах (мм × 0.001),
 * работы в кадре нет — все матрицы пересобираются только при изменении данных.
 */

const S = 0.001; // мм → метры

/** Отключить перехват луча (стены/дверь/рёбра не мешают кликам). */
const NO_RAYCAST = () => null;

interface Palette {
  edge: string;
  edgeOpacity: number;
  walls: string;
  wallsOpacity: number;
  floor: string;
  floorOpacity: number;
  grid: string;
  section: string;
  door: string;
  accent: string;
}

const PALETTES: Record<"dark" | "light", Palette> = {
  dark: {
    edge: "#8b7cf6",
    edgeOpacity: 0.7,
    walls: "#9d8cff",
    wallsOpacity: 0.045,
    floor: "#0e0a1e",
    floorOpacity: 0.55,
    grid: "#4b4470",
    section: "#7c6cf0",
    door: "#2dd4bf",
    accent: "#2dd4bf",
  },
  light: {
    edge: "#6d5ae6",
    edgeOpacity: 0.55,
    walls: "#8b7cf6",
    wallsOpacity: 0.05,
    floor: "#eeeaff",
    floorOpacity: 0.6,
    grid: "#a49cd4",
    section: "#6d5ae6",
    door: "#0d9488",
    accent: "#0d9488",
  },
};

/* ----------------------------- группы инстансов ----------------------------- */

interface InstanceGroup {
  key: string;
  item: CargoItem;
  axis: CylinderAxis;
  list: Placement[];
}

function buildGroups(
  visible: Placement[],
  itemById: Map<string, CargoItem>
): InstanceGroup[] {
  const map = new Map<string, InstanceGroup>();
  for (const p of visible) {
    const item = itemById.get(p.itemId);
    if (!item) continue;
    // цилиндр: up/side — разная геометрия → разные группы; у боксов ось фиксирована
    const axis: CylinderAxis = item.shape === "cylinder" ? p.axis : "up";
    const key = item.shape === "cylinder" ? `${item.id}|${axis}` : item.id;
    let g = map.get(key);
    if (!g) {
      g = { key, item, axis, list: [] };
      map.set(key, g);
    }
    g.list.push(p);
  }
  return [...map.values()].filter((g) => g.list.length > 0);
}

/** Геометрия в «базовой» ориентации (yaw=0), метры. */
function makeGeometry(item: CargoItem, axis: CylinderAxis): THREE.BufferGeometry {
  if (item.shape === "cylinder") {
    const r = (item.diameter / 2) * S;
    const len = item.length * S;
    const g = new THREE.CylinderGeometry(r, r, len, 28, 1);
    if (axis === "side") g.rotateZ(Math.PI / 2); // ось вдоль X (как dimsFor yaw=0)
    return g;
  }
  const d = dimsFor(item, 0, "up");
  return new THREE.BoxGeometry(d.dx * S, d.dz * S, d.dy * S);
}

function CargoGroup({
  item,
  axis,
  list,
  selected,
  onSelect,
}: {
  item: CargoItem;
  axis: CylinderAxis;
  list: Placement[];
  selected: boolean;
  onSelect: (id: string, additive: boolean) => void;
}) {
  const geometry = useMemo(() => makeGeometry(item, axis), [item, axis]);
  const material = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: new THREE.Color(item.color),
        roughness: 0.5,
        metalness: 0.06,
        transparent: true,
        opacity: 0.93,
      }),
    [item.color]
  );

  useEffect(() => {
    return () => {
      geometry.dispose();
      material.dispose();
    };
  }, [geometry, material]);

  const meshRef = useRef<THREE.InstancedMesh>(null);
  const baseColor = useMemo(() => new THREE.Color(item.color), [item.color]);

  useLayoutEffect(() => {
    const mesh = meshRef.current;
    if (!mesh) return;
    const m = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    const e = new THREE.Euler();
    const pos = new THREE.Vector3();
    const scl = new THREE.Vector3(1, 1, 1);
    const c = new THREE.Color();
    const white = WHITE_COLOR;
    for (let i = 0; i < list.length; i++) {
      const p = list[i];
      const d = dimsFor(item, p.yaw, p.axis);
      e.set(0, p.yaw === 90 ? Math.PI / 2 : 0, 0);
      q.setFromEuler(e);
      // центр единицы в трёх-координатах: X→X, Z(высота)→Y, Y(ширина)→Z
      pos.set(
        (p.x + d.dx / 2) * S,
        (p.z + d.dz / 2) * S,
        (p.y + d.dy / 2) * S
      );
      m.compose(pos, q, scl);
      mesh.setMatrixAt(i, m);
      c.copy(baseColor);
      if (selected) c.lerp(white, 0.42);
      mesh.setColorAt(i, c);
    }
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  }, [list, item, selected, baseColor]);

  const handleClick = (e: ThreeEvent<MouseEvent>) => {
    e.stopPropagation();
    onSelect(
      item.id,
      e.nativeEvent.ctrlKey || e.nativeEvent.metaKey || e.nativeEvent.shiftKey
    );
  };

  const handleOver = () => {
    document.body.style.cursor = "pointer";
  };
  const handleOut = () => {
    document.body.style.cursor = "";
  };

  return (
    <instancedMesh
      ref={meshRef}
      args={[geometry, material, list.length]}
      frustumCulled={false}
      onClick={handleClick}
      onPointerOver={handleOver}
      onPointerOut={handleOut}
    />
  );
}

const WHITE_COLOR = new THREE.Color("#ffffff");

/* ----------------------------- кузов ----------------------------- */

function TruckBody({
  L,
  W,
  H,
  loadingSide,
  palette,
}: {
  L: number;
  W: number;
  H: number;
  loadingSide: LoadingSide;
  palette: Palette;
}) {
  const l = L * S;
  const w = W * S;
  const h = H * S;

  const wallsGeo = useMemo(() => new THREE.BoxGeometry(l, h, w), [l, h, w]);
  const edgesGeo = useMemo(() => new THREE.EdgesGeometry(wallsGeo), [wallsGeo]);
  const floorGeo = useMemo(() => new THREE.PlaneGeometry(l, w), [l, w]);
  const doorGeo = useMemo(() => {
    if (loadingSide === "rear" || loadingSide === "top") {
      return new THREE.BoxGeometry(0.03, h, w * 0.999);
    }
    return new THREE.BoxGeometry(l * 0.999, h, 0.03);
  }, [loadingSide, l, h, w]);

  useEffect(() => {
    return () => {
      wallsGeo.dispose();
      edgesGeo.dispose();
      floorGeo.dispose();
      doorGeo.dispose();
    };
  }, [wallsGeo, edgesGeo, floorGeo, doorGeo]);

  const bodyPos: [number, number, number] = [l / 2, h / 2, w / 2];

  let doorPos: [number, number, number] = [l, h / 2, w / 2];
  if (loadingSide === "left") doorPos = [l / 2, h / 2, 0];
  else if (loadingSide === "right") doorPos = [l / 2, h / 2, w];
  else if (loadingSide === "top") doorPos = [l / 2, h, w / 2];

  return (
    <group>
      {/* прозрачные стены (не перехватывают клики) */}
      <mesh geometry={wallsGeo} position={bodyPos} raycast={NO_RAYCAST}>
        <meshStandardMaterial
          color={palette.walls}
          transparent
          opacity={palette.wallsOpacity}
          roughness={0.15}
          metalness={0.1}
          side={THREE.DoubleSide}
          depthWrite={false}
        />
      </mesh>

      {/* рёбра */}
      <lineSegments geometry={edgesGeo} position={bodyPos} raycast={NO_RAYCAST}>
        <lineBasicMaterial
          color={palette.edge}
          transparent
          opacity={palette.edgeOpacity}
        />
      </lineSegments>

      {/* пол */}
      <mesh
        geometry={floorGeo}
        position={[l / 2, 0.004, w / 2]}
        rotation={[-Math.PI / 2, 0, 0]}
        onClick={(e) => {
          e.stopPropagation();
          useLayoutStore.getState().clearSelection();
        }}
      >
        <meshStandardMaterial
          color={palette.floor}
          transparent
          opacity={palette.floorOpacity}
          roughness={0.9}
          metalness={0}
        />
      </mesh>

      {/* маркер стороны загрузки — светящаяся плоскость двери */}
      <mesh geometry={doorGeo} position={doorPos} raycast={NO_RAYCAST}>
        <meshBasicMaterial
          color={palette.door}
          transparent
          opacity={0.16}
          side={THREE.DoubleSide}
          depthWrite={false}
        />
      </mesh>
    </group>
  );
}

/* ----------------------------- камера ----------------------------- */

interface SimpleControls {
  target: THREE.Vector3;
  update: () => void;
}

function CameraRig({ L, W, H }: { L: number; W: number; H: number }) {
  const camera = useThree((s) => s.camera);
  const controls = useThree((s) => s.controls) as unknown as SimpleControls | null;

  useEffect(() => {
    const l = L * S;
    const w = W * S;
    const h = H * S;
    const d = Math.max(l, w, h) * 1.2;
    const tx = l / 2;
    const ty = h * 0.45;
    const tz = w / 2;
    if (controls) {
      controls.target.set(tx, ty, tz);
      controls.update();
    }
    camera.position.set(tx + d * 0.7, h + d * 0.55, tz + d * 0.85);
  }, [L, W, H, camera, controls]);

  return null;
}

/* ----------------------------- сцена ----------------------------- */

export default function View3D() {
  const t = useT();
  const { theme } = useTheme();
  const palette = PALETTES[theme === "light" ? "light" : "dark"];

  const items = useLayoutStore((s) => s.items);
  const placements = useLayoutStore((s) => s.placements);
  const layers = useLayoutStore((s) => s.layers);
  const selectedIds = useLayoutStore((s) => s.selectedIds);
  const select = useLayoutStore((s) => s.select);
  const clearSelection = useLayoutStore((s) => s.clearSelection);
  const loadingSide = useLayoutStore((s) => s.loadingSide);
  const activeLayer = useUiStore((s) => s.activeLayer);
  const vehicle = useVehicle();

  const itemById = useMemo(() => new Map(items.map((i) => [i.id, i])), [items]);

  const visible = useMemo(() => {
    if (activeLayer < 0) return placements;
    const layer = layers.find((l) => l.index === activeLayer);
    if (!layer) return placements;
    return placements.filter((p) => Math.abs(p.z - layer.z) < 1);
  }, [placements, activeLayer, layers]);

  const groups = useMemo(() => buildGroups(visible, itemById), [visible, itemById]);

  const hiddenByLayer = visible.length === 0 && placements.length > 0;

  const L = vehicle.innerLength;
  const W = vehicle.innerWidth;
  const H = vehicle.innerHeight;
  const l = L * S;
  const w = W * S;

  if (items.length === 0) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3 p-6 text-center">
        <div className="rounded-2xl bg-accent/12 p-4">
          <Move3d className="size-8 text-accent" />
        </div>
        <p className="text-sm font-medium text-fg-2">{t("empty.3d.title")}</p>
        <p className="max-w-sm text-xs leading-relaxed text-muted">
          {t("empty.3d.text")}
        </p>
      </div>
    );
  }

  return (
    <div className="absolute inset-0">
      <Canvas
        dpr={[1, 2]}
        gl={{ antialias: true, alpha: true }}
        camera={{ fov: 38, near: 0.05, far: 2000, position: [l * 1.2, H * S + l * 0.6, w * 1.4] }}
        onPointerMissed={() => clearSelection()}
      >
        <ambientLight intensity={0.75} />
        <hemisphereLight args={["#c9c4ff", "#0b0816", 0.45]} />
        <directionalLight
          position={[l * 0.8, Math.max(l, w) * 1.3, w * 0.7]}
          intensity={1.1}
          color="#fff6ee"
        />
        <directionalLight
          position={[-l * 0.6, Math.max(l, w) * 0.9, -w * 0.8]}
          intensity={0.35}
          color="#8fb7ff"
        />

        <TruckBody L={L} W={W} H={H} loadingSide={loadingSide} palette={palette} />

        <Grid
          position={[l / 2, -0.002, w / 2]}
          cellSize={0.5}
          cellThickness={0.55}
          cellColor={palette.grid}
          sectionSize={2.5}
          sectionThickness={0.9}
          sectionColor={palette.section}
          fadeDistance={Math.max(l, w) * 3}
          fadeStrength={1.5}
          infiniteGrid
        />

        {groups.map((g) => (
          <CargoGroup
            key={g.key}
            item={g.item}
            axis={g.axis}
            list={g.list}
            selected={selectedIds.includes(g.item.id)}
            onSelect={select}
          />
        ))}

        <CameraRig L={L} W={W} H={H} />
        <OrbitControls
          makeDefault
          enableDamping
          dampingFactor={0.08}
          enablePan
          panSpeed={0.75}
          rotateSpeed={0.65}
          zoomSpeed={0.9}
          minDistance={Math.max(l, w) * 0.25}
          maxDistance={Math.max(l, w, H * S) * 6}
          minPolarAngle={0.08}
          maxPolarAngle={Math.PI / 2 - 0.03}
        />
      </Canvas>

      {/* слои — те же контролы, что в 2D (активный слой общий) */}
      <div className="absolute inset-x-2 top-2 flex items-start justify-between gap-2">
        <div className="glass-strong flex items-center gap-1 rounded-xl p-1">
          <LayerControls />
        </div>
      </div>

      {hiddenByLayer && (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
          <span className="glass-strong rounded-xl px-4 py-2 text-xs text-muted">
            {t("layer.n", { n: activeLayer + 1 })} — {t("metric.placed")}: 0
          </span>
        </div>
      )}

      {/* подсказка по управлению */}
      <div className="pointer-events-none absolute bottom-3 left-1/2 flex -translate-x-1/2 items-center gap-2 rounded-full glass-strong px-3.5 py-1.5 text-[11px] text-muted">
        <Move3d className="size-3.5 shrink-0 text-accent" />
        {t("view.3d.hint")}
      </div>
    </div>
  );
}
