import type { MouseEvent as ReactMouseEvent } from "react";

import type { CanvasConnection, CanvasNodeData, ConnectionHandle, Position } from "./types";
import { canvasTheme } from "./canvas-theme";

export function getConnectionPathGeometry(from: CanvasNodeData, to: CanvasNodeData): {
    pathD: string;
    midpoint: Position;
} {
    const startX = from.position.x + from.width;
    const startY = from.position.y + from.height / 2;
    const endX = to.position.x;
    const endY = to.position.y + to.height / 2;
    const dx = Math.abs(endX - startX);
    const curvature = Math.max(dx * 0.5, 50);
    const pathD = `M ${startX} ${startY} C ${startX + curvature} ${startY}, ${endX - curvature} ${endY}, ${endX} ${endY}`;

    const t = 0.5;
    const u = 1 - t;
    const midpoint = {
        x:
            u * u * u * startX +
            3 * u * u * t * (startX + curvature) +
            3 * u * t * t * (endX - curvature) +
            t * t * t * endX,
        y:
            u * u * u * startY +
            3 * u * u * t * startY +
            3 * u * t * t * endY +
            t * t * t * endY,
    };

    return { pathD, midpoint };
}

export function ConnectionPath({
    connection,
    from,
    to,
    active,
    animated = false,
    onSelect,
    onContextMenu,
}: {
    connection: CanvasConnection;
    from: CanvasNodeData;
    to: CanvasNodeData;
    active: boolean;
    animated?: boolean;
    onSelect: () => void;
    onContextMenu?: (event: ReactMouseEvent<SVGPathElement>) => void;
}) {
    const { pathD } = getConnectionPathGeometry(from, to);

    return (
        <g>
            <path
                data-connection-id={connection.id}
                d={pathD}
                stroke="transparent"
                strokeWidth="16"
                fill="none"
                style={{ cursor: "pointer", pointerEvents: "stroke" }}
                onClick={(event) => {
                    event.stopPropagation();
                    onSelect();
                }}
                onContextMenu={(event) => {
                    event.preventDefault();
                    event.stopPropagation();
                    onContextMenu?.(event);
                }}
            />
            <path
                d={pathD}
                stroke={active ? canvasTheme.node.activeStroke : canvasTheme.node.muted}
                strokeWidth={active ? 3 : 2}
                strokeOpacity={active ? 1 : 0.82}
                fill="none"
                strokeDasharray={animated ? "6 6" : undefined}
                className={animated ? "canvas-connection-flow" : undefined}
                style={{ filter: active ? `drop-shadow(0 0 8px ${canvasTheme.node.activeStroke}66)` : undefined, pointerEvents: "none" }}
            />
        </g>
    );
}

const CONNECTION_REJECT_STROKE = "#ef4444";

export function ActiveConnectionPath({ node, handle, mouseWorld, target, rejected = false, animated = false }: { node?: CanvasNodeData; handle: ConnectionHandle; mouseWorld: Position; target?: CanvasNodeData; rejected?: boolean; animated?: boolean }) {
    if (!node) return null;

    const startX = handle.handleType === "source" ? node.position.x + node.width : mouseWorld.x;
    const startY = handle.handleType === "source" ? node.position.y + node.height / 2 : mouseWorld.y;
    const endX = handle.handleType === "source" ? mouseWorld.x : node.position.x;
    const endY = handle.handleType === "source" ? mouseWorld.y : node.position.y + node.height / 2;
    const snappedStartX = handle.handleType === "target" && target ? target.position.x + target.width : startX;
    const snappedStartY = handle.handleType === "target" && target ? target.position.y + target.height / 2 : startY;
    const snappedEndX = handle.handleType === "source" && target ? target.position.x : endX;
    const snappedEndY = handle.handleType === "source" && target ? target.position.y + target.height / 2 : endY;
    const distance = Math.abs(snappedEndX - snappedStartX);
    const pathD = `M ${snappedStartX} ${snappedStartY} C ${snappedStartX + distance * 0.5} ${snappedStartY}, ${snappedEndX - distance * 0.5} ${snappedEndY}, ${snappedEndX} ${snappedEndY}`;

    return (
        <path
            d={pathD}
            stroke={rejected ? CONNECTION_REJECT_STROKE : canvasTheme.node.activeStroke}
            strokeWidth="2"
            fill="none"
            strokeDasharray="5,5"
            className={animated ? "canvas-connection-flow" : undefined}
        />
    );
}
