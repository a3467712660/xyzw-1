import { roadPointList } from "@/constants/legionWarRoadPoints";
import { typeBg, typeName } from "./legionWarFormatters";

export class HexGraph {
  static instance;

  nodes = {};

  evenQDirs = [
    { q: -1, r: 0 },
    { q: -1, r: -1 },
    { q: 0, r: 1 },
    { q: 0, r: -1 },
    { q: 1, r: 0 },
    { q: 1, r: -1 },
  ];

  oddQDirs = [
    { q: -1, r: 0 },
    { q: -1, r: 1 },
    { q: 0, r: 1 },
    { q: 0, r: -1 },
    { q: 1, r: 0 },
    { q: 1, r: 1 },
  ];

  constructor() {
    if (HexGraph.instance) {
      throw new Error("请使用HexGraph.getInstance()获取单例");
    }
    this.loadStaticNodes();
    HexGraph.instance = this;
  }

  static getInstance() {
    if (!HexGraph.instance) {
      return new HexGraph();
    }
    return HexGraph.instance;
  }

  loadStaticNodes() {
    roadPointList.forEach((item) => {
      this.addNode(item);
    });
  }

  removeAllNode() {
    this.nodes = {};
    this.loadStaticNodes();
  }

  addNode(item) {
    const nodeId = item.id;
    if (this.nodes[nodeId]) {
      return;
    }

    this.nodes[nodeId] = {
      id: item.id,
      type: item.type,
      belongsLegionId: item.belongsLegionId,
      hP: item.hP,
      maxHP: item.maxHP,
      point: item.point,
      colorBg: item?.belongsLegionInfo?.color || typeBg(item.type),
      typeName: typeName(item.type),
      position: {
        x: (`${item.id}`).split("_")[0],
        y: (`${item.id}`).split("_")[1],
      },
      neighbors: [],
    };
    this.buildAdjacency(this.nodes[nodeId]);
  }

  addNodeList(arrObject) {
    arrObject.forEach((item) => {
      this.addNode(item);
    });
  }

  buildAdjacency(node) {
    const { x, y } = node.position;
    const dirs = x % 2 === 0 ? this.evenQDirs : this.oddQDirs;

    dirs.forEach(({ q: dq, r: dr }) => {
      const neighborId = `${Number.parseInt(x) + dq}_${Number.parseInt(y) + dr}`;
      const neighborNode = this.nodes[neighborId];
      if (neighborNode) {
        if (!node.neighbors.includes(neighborNode)) {
          node.neighbors.push(neighborNode);
        }
        if (!neighborNode.neighbors.includes(node)) {
          neighborNode.neighbors.push(node);
        }
      }
    });
  }

  getNodeByCoords(nodeStr) {
    return this.nodes[nodeStr];
  }

  getAllNodes = function () {
    return Object.values(this.nodes);
  };

  findShortestPath(start, end, legionId) {
    if (!start.includes("_") || !start.includes("_") || start === end) {
      return false;
    }

    const startNode = this.getNodeByCoords(start);
    const endNode = this.getNodeByCoords(end);
    if (!startNode || !endNode) {
      return false;
    }

    const queue = [startNode];
    const predecessors = new Map();
    predecessors.set(startNode.id, null);

    let found = false;
    while (queue.length > 0 && !found) {
      const currentNode = queue.shift();
      if (currentNode.type !== 9 && currentNode.belongsLegionId !== legionId) {
        continue;
      }
      for (const neighbor of currentNode.neighbors) {
        if (!predecessors.has(neighbor.id)) {
          predecessors.set(neighbor.id, currentNode);
          queue.push(neighbor);

          if (neighbor.id === endNode.id) {
            found = true;
            break;
          }
        }
      }
    }

    if (!found) {
      return false;
    }

    const path = [];
    let current = endNode;
    while (current) {
      path.push(current);
      current = predecessors.get(current.id);
    }

    path.reverse();
    return path;
  }
}
