import { Resvg } from "@resvg/resvg-js";
import {
  fetchProxyResource,
  ProxySafetyError,
} from "../lib/proxySafety.js";
import { getArenaLineupClass } from "../../../src/components/cards/pvp/arenaPvpFormatters.js";

const IMAGE_WIDTH = 1200;
const PAGE_PADDING_X = 40;
const HEADER_HEIGHT = 156;
const SUMMARY_HEIGHT = 94;
const TABLE_HEADER_HEIGHT = 50;
const ROW_HEIGHT = 58;
const BOTTOM_PADDING = 32;
const TABLE_WIDTH = IMAGE_WIDTH - PAGE_PADDING_X * 2;
const AVATAR_FETCH_TIMEOUT_MS = 1500;
const AVATAR_MAX_BYTES = 180 * 1024;
const AVATAR_CONCURRENCY = 6;

const COLUMNS = [
  { key: "index", label: "序号", width: 70, align: "center" },
  { key: "avatar", label: "头像", width: 74, align: "center" },
  { key: "name", label: "成员", width: 250, align: "left" },
  { key: "roleId", label: "角色 ID", width: 170, align: "left" },
  { key: "powerText", label: "战力", width: 155, align: "right" },
  { key: "redQuenchText", label: "红淬", width: 100, align: "center" },
  { key: "lineupType", label: "阵容", width: 145, align: "center" },
  { key: "jobLabel", label: "职位", width: 156, align: "center" },
];

const svgEscape = (value) =>
  String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");

const normalizeText = (value, fallback = "-") => {
  const text = String(value ?? "").trim();
  return text || fallback;
};

const normalizeAvatarUrl = (value) => {
  const raw = String(value || "")
    .replace(/`/g, "")
    .replace(/^["']+|["']+$/g, "")
    .trim();
  if (!raw) return "";
  if (raw.startsWith("//")) {
    return `https:${raw}`;
  }
  try {
    const parsed = new URL(raw);
    if (!["http:", "https:"].includes(parsed.protocol)) {
      return "";
    }
    if (parsed.username || parsed.password) {
      return "";
    }
    return parsed.toString();
  } catch {
    return "";
  }
};

const normalizeAvatarDataUrl = (value) => {
  const raw = String(value || "").trim();
  const match = raw.match(/^data:(image\/(?:png|jpeg|jpg|webp));base64,([a-z0-9+/=]+)$/i);
  if (!match) return "";
  const mimeType = match[1].toLowerCase() === "image/jpg" ? "image/jpeg" : match[1].toLowerCase();
  try {
    const body = Buffer.from(match[2], "base64");
    const sniffed = sniffImageDataPrefix(body);
    if (!sniffed || sniffed !== mimeType || body.length > AVATAR_MAX_BYTES) {
      return "";
    }
    return `data:${mimeType};base64,${body.toString("base64")}`;
  } catch {
    return "";
  }
};

const truncateText = (value, maxLength) => {
  const chars = Array.from(normalizeText(value));
  if (chars.length <= maxLength) {
    return chars.join("");
  }
  return `${chars.slice(0, Math.max(0, maxLength - 1)).join("")}…`;
};

const textAnchor = (align) => {
  if (align === "right") return "end";
  if (align === "center") return "middle";
  return "start";
};

const cellTextX = (x, width, align) => {
  if (align === "right") return x + width - 16;
  if (align === "center") return x + width / 2;
  return x + 16;
};

const statusColor = (value) => {
  if (!value || value === "-") return { bg: "#f1f5f9", fg: "#64748b", stroke: "#e2e8f0" };
  if (String(value).includes("会长")) return { bg: "#fff7ed", fg: "#c2410c", stroke: "#fed7aa" };
  if (String(value).includes("副")) return { bg: "#eff6ff", fg: "#1d4ed8", stroke: "#bfdbfe" };
  return { bg: "#f8fafc", fg: "#475569", stroke: "#e2e8f0" };
};

const ARENA_LINEUP_COLORS = Object.freeze({
  blue: { bg: "#cfe2ff", fg: "#0f3b8a", stroke: "#9dc3ff" },
  gray: { bg: "#eceff3", fg: "#4b5563", stroke: "#d5dbe3" },
  green: { bg: "#d7f5df", fg: "#1f6b2d", stroke: "#ade6bb" },
  pink: { bg: "#ffd6ef", fg: "#8a2c68", stroke: "#ffb7df" },
  purple: { bg: "#e8d8ff", fg: "#5a2b8a", stroke: "#cdb1ff" },
  red: { bg: "#ffd8d8", fg: "#8a1f1f", stroke: "#ffb0b0" },
});

const lineupColor = (value) => {
  const className = getArenaLineupClass(value, "未知");
  return ARENA_LINEUP_COLORS[className] || ARENA_LINEUP_COLORS.gray;
};

const renderTag = ({ x, y, text, color, maxWidth }) => {
  const label = truncateText(text, 8);
  const width = Math.min(maxWidth, Math.max(42, Array.from(label).length * 13 + 24));
  const left = x - width / 2;
  return `
    <rect x="${left}" y="${y - 13}" width="${width}" height="26" rx="13" fill="${color.bg}" stroke="${color.stroke}" />
    <text x="${x}" y="${y + 5}" text-anchor="middle" fill="${color.fg}" font-size="14" font-weight="700">${svgEscape(label)}</text>
  `;
};

const renderDefs = () => `
  <defs>
    <linearGradient id="pageBg" x1="0" x2="1" y1="0" y2="1">
      <stop offset="0%" stop-color="#f8fafc" />
      <stop offset="55%" stop-color="#eef6ff" />
      <stop offset="100%" stop-color="#fff7ed" />
    </linearGradient>
    <linearGradient id="headerAccent" x1="0" x2="1" y1="0" y2="0">
      <stop offset="0%" stop-color="#f97316" />
      <stop offset="54%" stop-color="#2563eb" />
      <stop offset="100%" stop-color="#059669" />
    </linearGradient>
    <filter id="softShadow" x="-8%" y="-20%" width="116%" height="140%">
      <feDropShadow dx="0" dy="10" stdDeviation="10" flood-color="#0f172a" flood-opacity="0.10" />
    </filter>
  </defs>
`;

const renderHeader = ({ clubName, exportedAt, memberCount, subtitle }) => `
  <rect x="0" y="0" width="${IMAGE_WIDTH}" height="100%" fill="url(#pageBg)" />
  <rect x="32" y="24" width="${IMAGE_WIDTH - 64}" height="108" rx="18" fill="#ffffff" stroke="#dbe7fb" filter="url(#softShadow)" />
  <rect x="32" y="24" width="${IMAGE_WIDTH - 64}" height="8" rx="4" fill="url(#headerAccent)" />
  <text x="58" y="64" fill="#0f172a" font-size="30" font-weight="850">${svgEscape(truncateText(clubName, 34))}</text>
  <text x="58" y="92" fill="#475569" font-size="15">${svgEscape(truncateText(subtitle, 52))}</text>
  <text x="58" y="119" fill="#64748b" font-size="13">导出时间：${svgEscape(truncateText(exportedAt, 32))}</text>
  <rect x="924" y="48" width="198" height="46" rx="14" fill="#fff7ed" stroke="#fed7aa" />
  <text x="1023" y="68" text-anchor="middle" fill="#9a3412" font-size="13" font-weight="700">成员总数</text>
  <text x="1023" y="88" text-anchor="middle" fill="#0f172a" font-size="20" font-weight="850">${memberCount} 人</text>
`;

const renderSummary = ({ y, members }) => {
  const withLineupCount = members.filter((member) => member.lineupType && member.lineupType !== "-").length;
  const avatarCount = members.filter((member) => member.avatarDataUrl).length;
  const items = [
    { label: "成员数量", value: `${members.length}`, accent: "#2563eb", meta: "当前导出" },
    { label: "已识别阵容", value: `${withLineupCount}`, accent: "#059669", meta: "阵容标签" },
    { label: "头像展示", value: `${avatarCount}`, accent: "#f97316", meta: "真实头像" },
  ];
  return `
    <g transform="translate(${PAGE_PADDING_X}, ${y})">
      ${items.map((item, index) => {
        const x = index * 262;
        return `
          <rect x="${x}" y="0" width="238" height="70" rx="16" fill="#ffffff" stroke="#dbe7fb" filter="url(#softShadow)" />
          <rect x="${x}" y="0" width="6" height="70" rx="3" fill="${item.accent}" />
          <text x="${x + 22}" y="25" fill="#64748b" font-size="13" font-weight="650">${svgEscape(item.label)}</text>
          <text x="${x + 22}" y="54" fill="#0f172a" font-size="26" font-weight="850">${svgEscape(item.value)}</text>
          <text x="${x + 188}" y="54" text-anchor="end" fill="${item.accent}" font-size="12" font-weight="700">${svgEscape(item.meta)}</text>
        `;
      }).join("")}
    </g>
  `;
};

const renderTableHeader = (y) => {
  let x = PAGE_PADDING_X;
  const cells = COLUMNS.map((column, index) => {
    const cell = `
      <rect x="${x}" y="${y}" width="${column.width}" height="${TABLE_HEADER_HEIGHT}" fill="${index % 2 === 0 ? "#1e293b" : "#273449"}" />
      <text x="${cellTextX(x, column.width, column.align)}" y="${y + 31}" text-anchor="${textAnchor(column.align)}" fill="#f8fafc" font-size="14" font-weight="800">${svgEscape(column.label)}</text>
    `;
    x += column.width;
    return cell;
  });
  return `
    <rect x="${PAGE_PADDING_X}" y="${y}" width="${TABLE_WIDTH}" height="${TABLE_HEADER_HEIGHT}" rx="16" fill="#1e293b" />
    <clipPath id="tableHeaderClip"><rect x="${PAGE_PADDING_X}" y="${y}" width="${TABLE_WIDTH}" height="${TABLE_HEADER_HEIGHT}" rx="16" /></clipPath>
    <g clip-path="url(#tableHeaderClip)">${cells.join("")}</g>
  `;
};

const renderRows = ({ y, members }) =>
  members.map((member, rowIndex) => {
    const rowY = y + rowIndex * ROW_HEIGHT;
    let x = PAGE_PADDING_X;
    const isEven = rowIndex % 2 === 0;
    const cells = COLUMNS.map((column) => {
      const base = `
        <rect x="${x}" y="${rowY}" width="${column.width}" height="${ROW_HEIGHT}" fill="${isEven ? "#ffffff" : "#fbfdff"}" />
        <line x1="${x}" y1="${rowY + ROW_HEIGHT}" x2="${x + column.width}" y2="${rowY + ROW_HEIGHT}" stroke="#e5edf8" />
      `;
      let content = "";
      if (column.key === "avatar") {
        const avatarX = x + column.width / 2 - 20;
        const avatarY = rowY + 9;
        const clipId = `avatarClip${rowIndex}`;
        content = `
          <circle cx="${x + column.width / 2}" cy="${rowY + 29}" r="20" fill="#eef6ff" stroke="#c7d9f3" />
          ${
            member.avatarDataUrl
              ? `
                <clipPath id="${clipId}">
                  <circle cx="${x + column.width / 2}" cy="${rowY + 29}" r="20" />
                </clipPath>
                <image href="${svgEscape(member.avatarDataUrl)}" x="${avatarX}" y="${avatarY}" width="40" height="40" preserveAspectRatio="xMidYMid slice" clip-path="url(#${clipId})" />
                <circle cx="${x + column.width / 2}" cy="${rowY + 29}" r="20" fill="none" stroke="#c7d9f3" />
              `
              : `<text x="${x + column.width / 2}" y="${rowY + 35}" text-anchor="middle" fill="#315b9e" font-size="16" font-weight="850">${svgEscape(truncateText(member.avatarText || member.name, 2))}</text>`
          }
        `;
      } else if (column.key === "lineupType") {
        content = renderTag({
          x: x + column.width / 2,
          y: rowY + 26,
          text: member.lineupType,
          color: lineupColor(member.lineupType),
          maxWidth: column.width - 22,
        });
      } else if (column.key === "jobLabel") {
        content = renderTag({
          x: x + column.width / 2,
          y: rowY + 26,
          text: member.jobLabel,
          color: statusColor(member.jobLabel),
          maxWidth: column.width - 22,
        });
      } else {
        const maxLength = {
          index: 4,
          name: 20,
          roleId: 22,
          powerText: 18,
          redQuenchText: 8,
        }[column.key] || 16;
        const fill = column.key === "redQuenchText" ? "#dc2626" : "#1f2937";
        const fontWeight = column.key === "index" ? 800 : column.key === "name" ? 750 : 550;
        const displayText = truncateText(member[column.key], maxLength);
        if (column.key === "index") {
          content = `
            <rect x="${x + column.width / 2 - 18}" y="${rowY + 17}" width="36" height="24" rx="12" fill="#fff7ed" stroke="#fed7aa" />
            <text x="${x + column.width / 2}" y="${rowY + 34}" text-anchor="middle" fill="#c2410c" font-size="13" font-weight="850">${svgEscape(displayText)}</text>
          `;
        } else {
          content = `
            <text x="${cellTextX(x, column.width, column.align)}" y="${rowY + 35}" text-anchor="${textAnchor(column.align)}" fill="${fill}" font-size="15" font-weight="${fontWeight}">${svgEscape(displayText)}</text>
          `;
        }
      }
      x += column.width;
      return `${base}${content}`;
    });
    return `<g>${cells.join("")}</g>`;
  }).join("");

function sniffImageDataPrefix(buffer) {
  if (!Buffer.isBuffer(buffer) || buffer.length < 12) return "";
  if (buffer.subarray(0, 8).toString("hex") === "89504e470d0a1a0a") {
    return "image/png";
  }
  if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
    return "image/jpeg";
  }
  if (
    buffer.subarray(0, 4).toString("ascii") === "RIFF"
    && buffer.subarray(8, 12).toString("ascii") === "WEBP"
  ) {
    return "image/webp";
  }
  return "";
}

const imageContentTypeToDataPrefix = (contentType, bodyBuffer) => {
  const normalized = String(contentType || "").split(";")[0].trim().toLowerCase();
  if (normalized === "image/jpeg" || normalized === "image/jpg") return "image/jpeg";
  if (normalized === "image/png") return "image/png";
  if (normalized === "image/webp") return "image/webp";
  return sniffImageDataPrefix(bodyBuffer);
};

const fetchAvatarDataUrl = async (avatarUrl) => {
  const normalizedUrl = normalizeAvatarUrl(avatarUrl);
  if (!normalizedUrl) return "";
  const parsed = new URL(normalizedUrl);
  try {
    const upstream = await fetchProxyResource({
      route: "/api/v1/game-features/:tokenId/club-members/export-image#avatar",
      url: normalizedUrl,
      method: "GET",
      headers: {
        Accept: "image/avif,image/webp,image/png,image/jpeg,image/*;q=0.8,*/*;q=0.1",
      },
      allowedHosts: [parsed.hostname],
      fallbackAllowedHosts: [],
      allowedContentTypes: [
        "image/png",
        "image/jpeg",
        "image/jpg",
        "image/webp",
        "application/octet-stream",
        "binary/octet-stream",
      ],
      timeoutMs: AVATAR_FETCH_TIMEOUT_MS,
      maxResponseBytes: AVATAR_MAX_BYTES,
    });
    if (upstream.status < 200 || upstream.status >= 300) {
      return "";
    }
    const dataPrefix = imageContentTypeToDataPrefix(
      upstream.contentType,
      upstream.bodyBuffer,
    );
    if (!dataPrefix || !upstream.bodyBuffer?.length) {
      return "";
    }
    return `data:${dataPrefix};base64,${upstream.bodyBuffer.toString("base64")}`;
  } catch (error) {
    if (!(error instanceof ProxySafetyError)) {
      console.warn("[club-member-export] avatar fetch failed:", error?.message || error);
    }
    return "";
  }
};

const mapWithConcurrency = async (items, mapper, concurrency = AVATAR_CONCURRENCY) => {
  const output = new Array(items.length);
  let cursor = 0;
  const workers = Array.from({ length: Math.min(concurrency, items.length) }, async () => {
    while (cursor < items.length) {
      const index = cursor;
      cursor += 1;
      output[index] = await mapper(items[index], index);
    }
  });
  await Promise.all(workers);
  return output;
};

export const createClubMemberExportImageService = () => ({
  async renderClubMembersImage(payload) {
    const members = await mapWithConcurrency(payload.members || [], async (member) => ({
      index: normalizeText(member.index),
      name: normalizeText(member.name),
      roleId: normalizeText(member.roleId),
      powerText: normalizeText(member.powerText),
      redQuenchText: normalizeText(member.redQuenchText),
      lineupType: normalizeText(member.lineupType),
      jobLabel: normalizeText(member.jobLabel),
      avatarText: normalizeText(member.avatarText, "?"),
      avatarDataUrl: normalizeAvatarDataUrl(member.avatarDataUrl)
        || await fetchAvatarDataUrl(member.avatarUrl),
    }));
    const clubName = normalizeText(payload.clubName, "俱乐部成员信息");
    const subtitle = normalizeText(payload.subtitle, "俱乐部成员详情");
    const exportedAt = normalizeText(payload.exportedAt, new Date().toISOString());
    const memberCount = Number.isFinite(Number(payload.memberCount))
      ? Number(payload.memberCount)
      : members.length;
    const tableY = HEADER_HEIGHT + SUMMARY_HEIGHT;
    const rowsY = tableY + TABLE_HEADER_HEIGHT;
    const height = rowsY + Math.max(1, members.length) * ROW_HEIGHT + BOTTOM_PADDING;
    const rowsSvg = members.length
      ? renderRows({ y: rowsY, members })
      : `<text x="${IMAGE_WIDTH / 2}" y="${rowsY + 34}" text-anchor="middle" fill="#64748b" font-size="16">暂无成员数据</text>`;
    const svg = `
      <svg xmlns="http://www.w3.org/2000/svg" width="${IMAGE_WIDTH}" height="${height}" viewBox="0 0 ${IMAGE_WIDTH} ${height}">
        ${renderDefs()}
        <style>
          text { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", "PingFang SC", "Microsoft YaHei", Arial, sans-serif; }
        </style>
        ${renderHeader({ clubName, exportedAt, memberCount, subtitle })}
        ${renderSummary({ y: HEADER_HEIGHT, members })}
        <rect x="${PAGE_PADDING_X}" y="${tableY}" width="${TABLE_WIDTH}" height="${TABLE_HEADER_HEIGHT + Math.max(1, members.length) * ROW_HEIGHT}" rx="14" fill="#ffffff" stroke="#dbe7fb" />
        ${renderTableHeader(tableY)}
        ${rowsSvg}
      </svg>
    `;

    const renderer = new Resvg(svg, {
      fitTo: {
        mode: "width",
        value: IMAGE_WIDTH,
      },
      font: {
        loadSystemFonts: true,
      },
    });
    const pngData = renderer.render().asPng();
    return Buffer.from(pngData);
  },
});

export const clubMemberExportImageService = createClubMemberExportImageService();
