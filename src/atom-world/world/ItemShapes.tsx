import { ITEM_KINDS, itemBoxes, type WorldItem } from "./items";
import { worldItems } from "./registry";

/** One item on a floor plan (SVG, world x / z in metres), turned like in the 3D world. */
export function ItemShape({ item, stroke, strokeWidth = 0.2, opacity }: { item: WorldItem; stroke?: string; strokeWidth?: number; opacity?: number }) {
  const k = ITEM_KINDS[item.kind];
  const deg = (-item.rotY * 180) / Math.PI;
  return (
    <g transform={`translate(${item.x} ${item.z}) rotate(${deg})`} opacity={opacity}>
      {itemBoxes(item).map((b, i) => (
        <rect
          key={i}
          x={b.x0}
          y={b.z0}
          width={b.x1 - b.x0}
          height={b.z1 - b.z0}
          rx={0.1}
          fill={item.kind === "footballs-table" && i === 1 ? "#d32626" : k.color}
          stroke={stroke}
          strokeWidth={stroke ? strokeWidth : undefined}
        />
      ))}
      {item.kind === "gc-station" && item.number !== undefined && (
        <text x={0} y={0.75} fontSize={0.5} fill="#0f6b3a" textAnchor="middle" transform={`rotate(${-deg} 0 0.6)`}>
          {item.number.toLocaleString("fa-IR")}
        </text>
      )}
    </g>
  );
}

/** Every item of one environment level, as currently placed (mini-map). */
export function ItemShapes({ envId, level, hot }: { envId: string; level: string; hot: (id: string) => string }) {
  return (
    <>
      {worldItems()
        .filter((i) => i.env === envId && i.level === level)
        .map((i) => (
          <ItemShape key={i.id} item={i} stroke={hot(i.id) === "none" ? undefined : hot(i.id)} />
        ))}
    </>
  );
}
