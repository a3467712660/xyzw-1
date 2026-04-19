import { Buffer } from "node:buffer";
import { Resvg } from "@resvg/resvg-js";
import {
  fetchProxyResource,
  ProxySafetyError,
} from "../lib/proxySafety.js";

const IMAGE_WIDTH = 1200;
const PAGE_PADDING_X = 40;
const TABLE_WIDTH = IMAGE_WIDTH - PAGE_PADDING_X * 2;
const HEADER_HEIGHT = 150;
const SECTION_GAP = 26;
const SECTION_HEADER_HEIGHT = 42;
const STAT_CARD_HEIGHT = 56;
const STAT_ROW_GAP = 10;
const TABLE_HEADER_HEIGHT = 44;
const ROW_HEIGHT = 50;
const WARRANK_ROW_HEIGHT = 78;
const TACTICAL_ROW_HEIGHT = 48;
const PEACH_STYLE2_COLUMN_GAP = 16;
const PEACH_STYLE2_COLUMN_WIDTH = (TABLE_WIDTH - PEACH_STYLE2_COLUMN_GAP) / 2;
const PEACH_STYLE2_COLUMN_PADDING = 16;
const PEACH_STYLE2_INNER_WIDTH = PEACH_STYLE2_COLUMN_WIDTH - PEACH_STYLE2_COLUMN_PADDING * 2;
const PEACH_STYLE2_HEADER_HEIGHT = 62;
const PEACH_STYLE2_STAT_HEIGHT = 54;
const PEACH_STYLE2_RANK_CARD_HEIGHT = 98;
const PEACH_STYLE2_TABLE_HEADER_HEIGHT = 36;
const PEACH_STYLE2_ROW_HEIGHT = 40;
const BOTTOM_PADDING = 34;
const AVATAR_FETCH_TIMEOUT_MS = 1500;
const AVATAR_MAX_BYTES = 180 * 1024;
const AVATAR_CONCURRENCY = 6;
const WATERMARK_TEXT = "传说专用";

const TABLE_COLUMNS = [
  { key: "index", label: "序号", width: 60, align: "center" },
  { key: "avatar", label: "头像", width: 64, align: "center" },
  { key: "name", label: "成员", width: 250, align: "left" },
  { key: "roleId", label: "角色 ID", width: 150, align: "left" },
  { key: "killText", label: "击杀", width: 100, align: "right" },
  { key: "metric2Text", label: "指标二", width: 110, align: "right" },
  { key: "metric3Text", label: "指标三", width: 110, align: "right" },
  { key: "kdText", label: "K/D", width: 100, align: "right" },
  { key: "noteText", label: "备注", width: 176, align: "left" },
];

const WARRANK_COLUMNS = [
  { key: "index", label: "排名", width: 54, align: "center" },
  { key: "serverText", label: "服务器", width: 76, align: "center" },
  { key: "avatar", label: "头像", width: 64, align: "center" },
  { key: "name", label: "名称", width: 126, align: "left" },
  { key: "redQuenchText", label: "红淬", width: 70, align: "right" },
  { key: "topHeroes", label: "前三车头", width: 330, align: "left" },
  { key: "powerText", label: "战力", width: 112, align: "right" },
  { key: "announcementText", label: "公告", width: 188, align: "left" },
  { key: "allianceText", label: "联盟", width: 100, align: "center" },
];

const TONE_COLORS = Object.freeze({
  neutral: { accent: "#2563eb", bg: "#eff6ff", fg: "#1d4ed8", soft: "#dbeafe" },
  opponent: { accent: "#dc2626", bg: "#fff1f2", fg: "#be123c", soft: "#ffe4e6" },
  own: { accent: "#059669", bg: "#ecfdf5", fg: "#047857", soft: "#d1fae5" },
  salt: { accent: "#f97316", bg: "#fff7ed", fg: "#c2410c", soft: "#fed7aa" },
});

const PEACH_STYLE2_TONES = Object.freeze({
  opponent: { accent: "#e53935", bg: "#fff1f2", fg: "#b91c1c", soft: "#fecaca" },
  own: { accent: "#4285f4", bg: "#eff6ff", fg: "#1d4ed8", soft: "#bfdbfe" },
});

const svgEscape = (value) =>
  String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");

const isExportSafeTextCodePoint = (code) => {
  if (!Number.isFinite(code) || code < 32 || (code >= 127 && code <= 159)) return false;
  if (code === 0xFFFD) return false;
  if (code >= 0xE000 && code <= 0xF8FF) return false;
  if (code >= 0x25A0 && code <= 0x25FF) return false;
  if (code >= 0x1F000 && code <= 0x1FAFF) return false;
  if (code >= 0x2600 && code <= 0x27BF) return false;
  return (
    (code >= 0x20 && code <= 0x7E) ||
    (code >= 0x00B7 && code <= 0x00B7) ||
    (code >= 0x2010 && code <= 0x2026) ||
    (code >= 0x3000 && code <= 0x303F) ||
    (code >= 0x3040 && code <= 0x30FF) ||
    (code >= 0x3400 && code <= 0x4DBF) ||
    (code >= 0x4E00 && code <= 0x9FFF) ||
    (code >= 0xAC00 && code <= 0xD7AF) ||
    (code >= 0xFF00 && code <= 0xFFEF)
  );
};

const stripUnsafeTextChars = (value) =>
  Array.from(String(value ?? ""))
    .map((char) => (isExportSafeTextCodePoint(char.codePointAt(0)) ? char : " "))
    .join("");

const isPlaceholderTextChar = (char) =>
  char === "?" || char === "？" || char === "□" || char === "■";

const stripPlaceholderRuns = (value) => {
  const chars = Array.from(String(value ?? ""));
  let output = "";
  let run = "";
  const flushRun = () => {
    if (!run) return;
    output += run.length >= 2 ? " " : run;
    run = "";
  };
  chars.forEach((char) => {
    if (isPlaceholderTextChar(char)) {
      run += char;
      return;
    }
    flushRun();
    output += char;
  });
  flushRun();
  return output;
};

const isMostlyPlaceholderText = (value) => {
  const chars = Array.from(String(value ?? "").replace(/\s+/g, ""));
  if (chars.length < 2) return false;
  const placeholderCount = chars.filter(isPlaceholderTextChar).length;
  return placeholderCount >= 2 && placeholderCount / chars.length >= 0.5;
};

const normalizeText = (value, fallback = "-") => {
  const raw = stripUnsafeTextChars(value);
  const text = stripPlaceholderRuns(raw)
    .replace(/\s+/g, " ")
    .trim();
  if (isMostlyPlaceholderText(raw) || isMostlyPlaceholderText(text)) {
    return fallback;
  }
  return text || fallback;
};

const truncateText = (value, maxLength, fallback = "-") => {
  const chars = Array.from(normalizeText(value, fallback));
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

const parseExportNumber = (value) => {
  const parsed = Number(String(value ?? "").replace(/[^\d.-]/g, ""));
  return Number.isFinite(parsed) ? parsed : 0;
};

const cellTextX = (x, width, align) => {
  if (align === "right") return x + width - 14;
  if (align === "center") return x + width / 2;
  return x + 14;
};

const toneColor = (tone) => TONE_COLORS[tone] || TONE_COLORS.neutral;

const allianceColor = (value) => {
  const text = String(value || "");
  if (text.includes("大联盟")) return { bg: "#eff6ff", fg: "#1d4ed8", stroke: "#bfdbfe" };
  if (text.includes("梦")) return { bg: "#fdf2f8", fg: "#be185d", stroke: "#fbcfe8" };
  if (text.includes("正义")) return { bg: "#ecfdf5", fg: "#047857", stroke: "#bbf7d0" };
  if (text.includes("龙")) return { bg: "#fff7ed", fg: "#c2410c", stroke: "#fed7aa" };
  return { bg: "#f1f5f9", fg: "#475569", stroke: "#e2e8f0" };
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

function sniffImageDataPrefix(buffer) {
  if (!Buffer.isBuffer(buffer) || buffer.length < 12) return "";
  if (buffer.subarray(0, 8).toString("hex") === "89504e470d0a1a0a") {
    return "image/png";
  }
  if (buffer[0] === 0xFF && buffer[1] === 0xD8 && buffer[2] === 0xFF) {
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

const normalizeAvatarDataUrl = (value) => {
  const raw = String(value || "").trim();
  const match = raw.match(/^data:(image\/(?:png|jpeg|jpg|webp));base64,([a-z0-9+/=]+)$/i);
  if (!match) return "";
  const mimeType = match[1].toLowerCase() === "image/jpg"
    ? "image/jpeg"
    : match[1].toLowerCase();
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
      route: "/api/v1/battle-reports/:tokenId/export-image#avatar",
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
      console.warn("[battle-report-export] avatar fetch failed:", error?.message || error);
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

const renderDefs = () => `
  <defs>
    <linearGradient id="reportPageBg" x1="0" x2="1" y1="0" y2="1">
      <stop offset="0%" stop-color="#f8fafc" />
      <stop offset="58%" stop-color="#eef6ff" />
      <stop offset="100%" stop-color="#fff7ed" />
    </linearGradient>
    <linearGradient id="reportAccent" x1="0" x2="1" y1="0" y2="0">
      <stop offset="0%" stop-color="#f97316" />
      <stop offset="52%" stop-color="#2563eb" />
      <stop offset="100%" stop-color="#059669" />
    </linearGradient>
    <filter id="reportSoftShadow" x="-8%" y="-20%" width="116%" height="140%">
      <feDropShadow dx="0" dy="10" stdDeviation="10" flood-color="#0f172a" flood-opacity="0.10" />
    </filter>
    <linearGradient id="tacticalPanelBg" x1="0" x2="1" y1="0" y2="1">
      <stop offset="0%" stop-color="#111827" />
      <stop offset="58%" stop-color="#0f172a" />
      <stop offset="100%" stop-color="#172033" />
    </linearGradient>
    <linearGradient id="tacticalAccent" x1="0" x2="1" y1="0" y2="0">
      <stop offset="0%" stop-color="#38bdf8" />
      <stop offset="52%" stop-color="#f97316" />
      <stop offset="100%" stop-color="#22c55e" />
    </linearGradient>
    <filter id="tacticalShadow" x="-8%" y="-10%" width="116%" height="122%">
      <feDropShadow dx="0" dy="12" stdDeviation="12" flood-color="#0f172a" flood-opacity="0.20" />
    </filter>
    <pattern id="reportWatermark" width="520" height="260" patternUnits="userSpaceOnUse" patternTransform="rotate(-24)">
      <text x="42" y="138" fill="#64748b" fill-opacity="0.11" font-size="42" font-weight="850" letter-spacing="6">${svgEscape(WATERMARK_TEXT)}</text>
    </pattern>
  </defs>
`;

const renderBackground = (height) => `
  <rect x="0" y="0" width="${IMAGE_WIDTH}" height="${height}" fill="url(#reportPageBg)" />
  <rect x="-220" y="-180" width="${IMAGE_WIDTH + 440}" height="${height + 360}" fill="url(#reportWatermark)" />
`;

const renderHeader = ({
  badgeLabel,
  badgeValue,
  exportedAt,
  reportDate,
  sectionCount,
  showBadge = true,
  subtitle,
  title,
}) => `
  <rect x="32" y="24" width="${IMAGE_WIDTH - 64}" height="108" rx="18" fill="#ffffff" fill-opacity="0.97" stroke="#dbe7fb" filter="url(#reportSoftShadow)" />
  <rect x="32" y="24" width="${IMAGE_WIDTH - 64}" height="8" rx="4" fill="url(#reportAccent)" />
  <text x="58" y="64" fill="#0f172a" font-size="30" font-weight="850">${svgEscape(truncateText(title, 34, "战报导出"))}</text>
  <text x="58" y="92" fill="#475569" font-size="15">${svgEscape(truncateText(subtitle, 60, "战报详情"))}</text>
  <text x="58" y="119" fill="#64748b" font-size="13">战报日期：${svgEscape(truncateText(reportDate, 24))} · 导出时间：${svgEscape(truncateText(exportedAt, 32))}</text>
  ${showBadge
    ? `
      <rect x="924" y="48" width="198" height="46" rx="14" fill="#fff7ed" stroke="#fed7aa" />
      <text x="1023" y="68" text-anchor="middle" fill="#9a3412" font-size="13" font-weight="700">${svgEscape(truncateText(badgeLabel, 8, "报表分组"))}</text>
      <text x="1023" y="88" text-anchor="middle" fill="#0f172a" font-size="20" font-weight="850">${svgEscape(truncateText(badgeValue, 8, `${sectionCount} 组`))}</text>
    `
    : ""}
`;

const renderStats = ({ y, stats }) => {
  const safeStats = stats.length
    ? stats.slice(0, 8)
    : [{ label: "记录数", value: "0" }];
  const cardGap = 12;
  const cardWidth = (TABLE_WIDTH - cardGap * 3) / 4;
  return safeStats.map((item, index) => {
    const row = Math.floor(index / 4);
    const col = index % 4;
    const x = PAGE_PADDING_X + col * (cardWidth + cardGap);
    const cardY = y + row * (STAT_CARD_HEIGHT + STAT_ROW_GAP);
    return `
      <rect x="${x}" y="${cardY}" width="${cardWidth}" height="${STAT_CARD_HEIGHT}" rx="14" fill="#ffffff" fill-opacity="0.97" stroke="#dbe7fb" />
      <text x="${x + 18}" y="${cardY + 23}" fill="#64748b" font-size="12" font-weight="750">${svgEscape(truncateText(item.label, 12))}</text>
      <text x="${x + 18}" y="${cardY + 45}" fill="#0f172a" font-size="20" font-weight="850">${svgEscape(truncateText(item.value, 18))}</text>
    `;
  }).join("");
};

const getStatsHeight = (stats) => {
  const count = Math.max(1, Math.min(8, stats?.length || 0));
  const rows = Math.ceil(count / 4);
  return rows * STAT_CARD_HEIGHT + (rows - 1) * STAT_ROW_GAP;
};

const renderTableBodyWatermark = ({ y, height }) => {
  const rowCount = Math.max(1, Math.ceil(height / 220) + 1);
  const columnCount = 3;
  const watermarks = Array.from({ length: rowCount }, (_, rowIndex) =>
    Array.from({ length: columnCount }, (__, columnIndex) => {
      const x = -60 + columnIndex * 500 + (rowIndex % 2) * 180;
      const textY = 110 + rowIndex * 220;
      return `
        <text x="${x}" y="${textY}" fill="#475569" font-size="46" font-weight="850" letter-spacing="6">${svgEscape(WATERMARK_TEXT)}</text>
      `;
    }).join(""));
  return `
    <clipPath id="battleReportBodyWatermarkClip${Math.round(y)}">
      <rect x="${PAGE_PADDING_X}" y="${y}" width="${TABLE_WIDTH}" height="${height}" />
    </clipPath>
    <g clip-path="url(#battleReportBodyWatermarkClip${Math.round(y)})" opacity="0.09">
      <g transform="translate(${PAGE_PADDING_X}, ${y}) rotate(-20, ${TABLE_WIDTH / 2}, ${height / 2})">
        ${watermarks.join("")}
      </g>
    </g>
  `;
};

const renderTacticalBodyWatermark = ({ height, index, width, x, y }) => {
  const rowCount = Math.max(1, Math.ceil(height / 220) + 1);
  const columnCount = 3;
  const watermarks = Array.from({ length: rowCount }, (_, rowIndex) =>
    Array.from({ length: columnCount }, (__, columnIndex) => {
      const textX = -70 + columnIndex * 460 + (rowIndex % 2) * 160;
      const textY = 108 + rowIndex * 220;
      return `
        <text x="${textX}" y="${textY}" fill="#475569" font-size="44" font-weight="850" letter-spacing="6">${svgEscape(WATERMARK_TEXT)}</text>
      `;
    }).join(""));
  const clipId = `battleReportTacticalWatermarkClip${index}_${Math.round(y)}`;
  return `
    <clipPath id="${clipId}">
      <rect x="${x}" y="${y}" width="${width}" height="${height}" rx="16" />
    </clipPath>
    <g clip-path="url(#${clipId})" opacity="0.07">
      <g transform="translate(${x}, ${y}) rotate(-20, ${width / 2}, ${height / 2})">
        ${watermarks.join("")}
      </g>
    </g>
  `;
};

const renderTableHeader = ({
  metric2Label,
  metric3Label,
  primaryLabel,
  y,
}) => {
  let x = PAGE_PADDING_X;
  const cells = TABLE_COLUMNS.map((column, index) => {
    let label = column.label;
    if (column.key === "killText") {
      label = primaryLabel;
    } else if (column.key === "metric2Text") {
      label = metric2Label;
    } else if (column.key === "metric3Text") {
      label = metric3Label;
    }
    const cell = `
      <rect x="${x}" y="${y}" width="${column.width}" height="${TABLE_HEADER_HEIGHT}" fill="${index % 2 === 0 ? "#1e293b" : "#273449"}" />
      <text x="${cellTextX(x, column.width, column.align)}" y="${y + 28}" text-anchor="${textAnchor(column.align)}" fill="#f8fafc" font-size="13" font-weight="800">${svgEscape(truncateText(label, 10))}</text>
    `;
    x += column.width;
    return cell;
  });
  const clipId = `battleReportTableHeaderClip${Math.round(y)}`;
  return `
    <rect x="${PAGE_PADDING_X}" y="${y}" width="${TABLE_WIDTH}" height="${TABLE_HEADER_HEIGHT}" rx="16" fill="#1e293b" />
    <clipPath id="${clipId}"><rect x="${PAGE_PADDING_X}" y="${y}" width="${TABLE_WIDTH}" height="${TABLE_HEADER_HEIGHT}" rx="16" /></clipPath>
    <g clip-path="url(#${clipId})">${cells.join("")}</g>
  `;
};

const renderAvatar = ({ row, x, y, rowIndex, sectionIndex }) => {
  const centerX = x + 32;
  const centerY = y + 25;
  const clipId = `battleReportAvatarClip${sectionIndex}_${rowIndex}`;
  return `
    <circle cx="${centerX}" cy="${centerY}" r="17" fill="#eef6ff" stroke="#c7d9f3" />
    ${
      row.avatarDataUrl
        ? `
          <clipPath id="${clipId}">
            <circle cx="${centerX}" cy="${centerY}" r="17" />
          </clipPath>
          <image href="${svgEscape(row.avatarDataUrl)}" x="${centerX - 17}" y="${centerY - 17}" width="34" height="34" preserveAspectRatio="xMidYMid slice" clip-path="url(#${clipId})" />
          <circle cx="${centerX}" cy="${centerY}" r="17" fill="none" stroke="#c7d9f3" />
        `
        : `<text x="${centerX}" y="${centerY + 6}" text-anchor="middle" fill="#315b9e" font-size="14" font-weight="850">${svgEscape(truncateText(row.avatarText || row.name, 2, "?"))}</text>`
    }
  `;
};

const renderRows = ({ y, rows, sectionIndex }) =>
  rows.map((row, rowIndex) => {
    const rowY = y + rowIndex * ROW_HEIGHT;
    let x = PAGE_PADDING_X;
    const isEven = rowIndex % 2 === 0;
    const cells = TABLE_COLUMNS.map((column) => {
      const base = `
        <rect x="${x}" y="${rowY}" width="${column.width}" height="${ROW_HEIGHT}" fill="${isEven ? "#ffffff" : "#fbfdff"}" fill-opacity="0.96" />
        <line x1="${x}" y1="${rowY + ROW_HEIGHT}" x2="${x + column.width}" y2="${rowY + ROW_HEIGHT}" stroke="#e5edf8" />
      `;
      let content = "";
      if (column.key === "avatar") {
        content = renderAvatar({ row, x, y: rowY, rowIndex, sectionIndex });
      } else if (column.key === "index") {
        content = `
          <rect x="${x + column.width / 2 - 18}" y="${rowY + 13}" width="36" height="24" rx="12" fill="#fff7ed" stroke="#fed7aa" />
          <text x="${x + column.width / 2}" y="${rowY + 30}" text-anchor="middle" fill="#c2410c" font-size="13" font-weight="850">${svgEscape(truncateText(row.index, 4))}</text>
        `;
      } else {
        const maxLength = {
          kdText: 8,
          killText: 8,
          metric2Text: 8,
          metric3Text: 8,
          name: 18,
          noteText: 18,
          roleId: 18,
        }[column.key] || 12;
        const fill = ["killText", "metric2Text"].includes(column.key) ? "#dc2626" : "#1f2937";
        const fontWeight = column.key === "name" ? 760 : 560;
        content = `
          <text x="${cellTextX(x, column.width, column.align)}" y="${rowY + 31}" text-anchor="${textAnchor(column.align)}" fill="${fill}" font-size="14" font-weight="${fontWeight}">${svgEscape(truncateText(row[column.key], maxLength))}</text>
        `;
      }
      x += column.width;
      return `${base}${content}`;
    });
    return `<g>${cells.join("")}</g>`;
  }).join("");

const renderWarrankTableHeader = (y) => {
  let x = PAGE_PADDING_X;
  const cells = WARRANK_COLUMNS.map((column, index) => {
    const cell = `
      <rect x="${x}" y="${y}" width="${column.width}" height="${TABLE_HEADER_HEIGHT}" fill="${index % 2 === 0 ? "#1e293b" : "#273449"}" />
      <text x="${cellTextX(x, column.width, column.align)}" y="${y + 28}" text-anchor="${textAnchor(column.align)}" fill="#f8fafc" font-size="13" font-weight="800">${svgEscape(column.label)}</text>
    `;
    x += column.width;
    return cell;
  });
  const clipId = `warrankTableHeaderClip${Math.round(y)}`;
  return `
    <rect x="${PAGE_PADDING_X}" y="${y}" width="${TABLE_WIDTH}" height="${TABLE_HEADER_HEIGHT}" rx="16" fill="#1e293b" />
    <clipPath id="${clipId}"><rect x="${PAGE_PADDING_X}" y="${y}" width="${TABLE_WIDTH}" height="${TABLE_HEADER_HEIGHT}" rx="16" /></clipPath>
    <g clip-path="url(#${clipId})">${cells.join("")}</g>
  `;
};

const renderWarrankHeroAvatar = ({ hero, x, y, id }) => {
  const clipId = `warrankHeroClip${id}`;
  return `
    <circle cx="${x}" cy="${y}" r="13" fill="#eef6ff" stroke="#c7d9f3" />
    ${
      hero.avatarDataUrl
        ? `
          <clipPath id="${clipId}">
            <circle cx="${x}" cy="${y}" r="13" />
          </clipPath>
          <image href="${svgEscape(hero.avatarDataUrl)}" x="${x - 13}" y="${y - 13}" width="26" height="26" preserveAspectRatio="xMidYMid slice" clip-path="url(#${clipId})" />
          <circle cx="${x}" cy="${y}" r="13" fill="none" stroke="#c7d9f3" />
        `
        : `<text x="${x}" y="${y + 5}" text-anchor="middle" fill="#315b9e" font-size="11" font-weight="850">${svgEscape(truncateText(hero.avatarText || hero.name, 1, "?"))}</text>`
    }
  `;
};

const renderWarrankHeroes = ({ heroes = [], x, y, sectionIndex, rowIndex }) => {
  const safeHeroes = heroes.slice(0, 3);
  if (!safeHeroes.length) {
    return `<text x="${x + 14}" y="${y + 45}" fill="#94a3b8" font-size="13" font-weight="650">暂无车头</text>`;
  }
  return safeHeroes.map((hero, index) => {
    const cardX = x + 8 + index * 106;
    const cardY = y + 10;
    return `
      <rect x="${cardX}" y="${cardY}" width="100" height="58" rx="12" fill="#f8fafc" stroke="#e2e8f0" />
      ${renderWarrankHeroAvatar({
        hero,
        id: `${sectionIndex}_${rowIndex}_${index}`,
        x: cardX + 18,
        y: cardY + 21,
      })}
      <text x="${cardX + 38}" y="${cardY + 20}" fill="#0f172a" font-size="11" font-weight="800">${svgEscape(truncateText(hero.name, 5, "未知"))}</text>
      <rect x="${cardX + 38}" y="${cardY + 29}" width="38" height="17" rx="8.5" fill="#fff7ed" stroke="#fed7aa" />
      <text x="${cardX + 57}" y="${cardY + 41}" text-anchor="middle" fill="#c2410c" font-size="10" font-weight="850">${svgEscape(truncateText(hero.redQuenchText, 4, "0红"))}</text>
      <text x="${cardX + 94}" y="${cardY + 55}" text-anchor="end" fill="#475569" font-size="10" font-weight="800">四圣 ${svgEscape(truncateText(hero.holyBeastText, 3, "0"))}</text>
    `;
  }).join("");
};

const renderWarrankRows = ({ y, rows, sectionIndex }) =>
  rows.map((row, rowIndex) => {
    const rowY = y + rowIndex * WARRANK_ROW_HEIGHT;
    let x = PAGE_PADDING_X;
    const isEven = rowIndex % 2 === 0;
    const cells = WARRANK_COLUMNS.map((column) => {
      const base = `
        <rect x="${x}" y="${rowY}" width="${column.width}" height="${WARRANK_ROW_HEIGHT}" fill="${isEven ? "#ffffff" : "#fbfdff"}" fill-opacity="0.96" />
        <line x1="${x}" y1="${rowY + WARRANK_ROW_HEIGHT}" x2="${x + column.width}" y2="${rowY + WARRANK_ROW_HEIGHT}" stroke="#e5edf8" />
      `;
      let content = "";
      if (column.key === "avatar") {
        content = renderAvatar({
          row,
          x,
          y: rowY + 14,
          rowIndex,
          sectionIndex,
        });
      } else if (column.key === "index") {
        content = `
          <rect x="${x + column.width / 2 - 18}" y="${rowY + 27}" width="36" height="24" rx="12" fill="#fff7ed" stroke="#fed7aa" />
          <text x="${x + column.width / 2}" y="${rowY + 44}" text-anchor="middle" fill="#c2410c" font-size="13" font-weight="850">${svgEscape(truncateText(row.index, 4))}</text>
        `;
      } else if (column.key === "redQuenchText") {
        content = `
          <rect x="${x + column.width - 58}" y="${rowY + 27}" width="44" height="24" rx="12" fill="#fff7ed" stroke="#fed7aa" />
          <text x="${x + column.width - 36}" y="${rowY + 44}" text-anchor="middle" fill="#c2410c" font-size="12" font-weight="850">${svgEscape(truncateText(row.redQuenchText, 5, "0"))}</text>
        `;
      } else if (column.key === "topHeroes") {
        content = renderWarrankHeroes({
          heroes: row.topHeroes,
          rowIndex,
          sectionIndex,
          x,
          y: rowY,
        });
      } else if (column.key === "allianceText") {
        const color = allianceColor(row.allianceText);
        content = `
          <rect x="${x + 10}" y="${rowY + 27}" width="${column.width - 20}" height="24" rx="12" fill="${color.bg}" stroke="${color.stroke}" />
          <text x="${x + column.width / 2}" y="${rowY + 44}" text-anchor="middle" fill="${color.fg}" font-size="12" font-weight="800">${svgEscape(truncateText(row.allianceText, 5, "未知"))}</text>
        `;
      } else {
        const maxLength = {
          announcementText: 15,
          name: 8,
          powerText: 9,
          serverText: 8,
        }[column.key] || 12;
        const fill = column.key === "powerText" ? "#dc2626" : "#1f2937";
        const fontWeight = column.key === "name" ? 760 : 560;
        content = `
          <text x="${cellTextX(x, column.width, column.align)}" y="${rowY + 45}" text-anchor="${textAnchor(column.align)}" fill="${fill}" font-size="14" font-weight="${fontWeight}">${svgEscape(truncateText(row[column.key], maxLength))}</text>
        `;
      }
      x += column.width;
      return `${base}${content}`;
    });
    return `<g>${cells.join("")}</g>`;
  }).join("");

const renderTacticalAvatar = ({ row, x, y, rowIndex, sectionIndex }) => {
  const clipId = `tacticalAvatarClip${sectionIndex}_${rowIndex}`;
  return `
    <circle cx="${x}" cy="${y}" r="15" fill="#eef6ff" stroke="#c7d9f3" />
    ${
      row.avatarDataUrl
        ? `
          <clipPath id="${clipId}">
            <circle cx="${x}" cy="${y}" r="15" />
          </clipPath>
          <image href="${svgEscape(row.avatarDataUrl)}" x="${x - 15}" y="${y - 15}" width="30" height="30" preserveAspectRatio="xMidYMid slice" clip-path="url(#${clipId})" />
          <circle cx="${x}" cy="${y}" r="15" fill="none" stroke="#c7d9f3" />
        `
        : `<text x="${x}" y="${y + 5}" text-anchor="middle" fill="#315b9e" font-size="12" font-weight="850">${svgEscape(truncateText(row.avatarText || row.name, 1, "?"))}</text>`
    }
  `;
};

const tacticalPanelColor = (key, index) => {
  const colors = [
    { accent: "#2563eb", bg: "#eff6ff", fg: "#1d4ed8", stroke: "#bfdbfe" },
    { accent: "#f97316", bg: "#fff7ed", fg: "#c2410c", stroke: "#fed7aa" },
    { accent: "#059669", bg: "#ecfdf5", fg: "#047857", stroke: "#bbf7d0" },
    { accent: "#7c3aed", bg: "#f5f3ff", fg: "#6d28d9", stroke: "#ddd6fe" },
  ];
  if (String(key || "").includes("kill")) return colors[1];
  if (String(key || "").includes("occupy")) return colors[0];
  if (String(key || "").includes("kd")) return colors[2];
  if (String(key || "").includes("revive")) return colors[3];
  return colors[index % colors.length];
};

const renderTacticalMetrics = ({ metrics, x, y, width }) => {
  const safeMetrics = metrics.length
    ? metrics.slice(0, 4)
    : [{ label: "记录数", value: "0", meta: "" }];
  const gap = 12;
  const cardWidth = (width - gap * 3) / 4;
  return safeMetrics.map((metric, index) => {
    const cardX = x + index * (cardWidth + gap);
    const color = tacticalPanelColor(metric.key, index);
    return `
      <rect x="${cardX}" y="${y}" width="${cardWidth}" height="78" rx="16" fill="#ffffff" fill-opacity="0.97" stroke="#dbe7fb" />
      <rect x="${cardX}" y="${y}" width="6" height="78" rx="3" fill="${color.accent}" />
      <text x="${cardX + 18}" y="${y + 25}" fill="#64748b" font-size="11" font-weight="800" letter-spacing="1.2">${svgEscape(truncateText(metric.label, 10))}</text>
      <text x="${cardX + 18}" y="${y + 51}" fill="#0f172a" font-size="23" font-weight="850">${svgEscape(truncateText(metric.value, 12))}</text>
      <text x="${cardX + 18}" y="${y + 68}" fill="#94a3b8" font-size="11" font-weight="650">${svgEscape(truncateText(metric.meta, 18, ""))}</text>
    `;
  }).join("");
};

const renderTacticalRankPanels = ({ panels, x, y, width }) => {
  const panelGap = 10;
  const panelHeight = 94;
  return (panels || []).slice(0, 4).map((panel, index) => {
    const color = tacticalPanelColor(panel.key, index);
    const panelY = y + index * (panelHeight + panelGap);
    const items = (panel.items || []).slice(0, 3);
    return `
      <g>
        <rect x="${x}" y="${panelY}" width="${width}" height="${panelHeight}" rx="16" fill="${color.bg}" stroke="${color.stroke}" />
        <rect x="${x}" y="${panelY}" width="5" height="${panelHeight}" rx="2.5" fill="${color.accent}" />
        <text x="${x + 16}" y="${panelY + 25}" fill="#0f172a" font-size="14" font-weight="850">${svgEscape(truncateText(panel.title, 12, "榜单"))}</text>
        ${items.map((item, itemIndex) => {
          const itemY = panelY + 45 + itemIndex * 15;
          return `
            <text x="${x + 18}" y="${itemY}" fill="${color.fg}" font-size="11" font-weight="850">0${itemIndex + 1}</text>
            <text x="${x + 48}" y="${itemY}" fill="#334155" font-size="12" font-weight="750">${svgEscape(truncateText(item.name, 10, "未知成员"))}</text>
            <text x="${x + width - 14}" y="${itemY}" text-anchor="end" fill="${color.fg}" font-size="12" font-weight="850">${svgEscape(truncateText(item.value, 8, "0"))}</text>
          `;
        }).join("")}
      </g>
    `;
  }).join("");
};

const TACTICAL_TABLE_COLUMNS = [
  { key: "index", label: "排名", width: 52, align: "center" },
  { key: "name", label: "成员", width: 270, align: "left" },
  { key: "killText", label: "击杀", width: 86, align: "right" },
  { key: "metric2Text", label: "死亡", width: 86, align: "right" },
  { key: "metric3Text", label: "攻城", width: 86, align: "right" },
  { key: "reviveText", label: "复活丹", width: 96, align: "right" },
  { key: "kdText", label: "K/D", width: 88, align: "right" },
];

const renderTacticalTable = ({ x, y, width, rows, sectionIndex }) => {
  let headerX = x;
  const headerCells = TACTICAL_TABLE_COLUMNS.map((column) => {
    const columnIndex = TACTICAL_TABLE_COLUMNS.indexOf(column);
    const cell = `
      <rect x="${headerX}" y="${y}" width="${column.width}" height="${TABLE_HEADER_HEIGHT}" fill="${columnIndex % 2 === 0 ? "#1e293b" : "#273449"}" />
      <text x="${cellTextX(headerX, column.width, column.align)}" y="${y + 28}" text-anchor="${textAnchor(column.align)}" fill="#f8fafc" font-size="12" font-weight="850">${svgEscape(column.label)}</text>
    `;
    headerX += column.width;
    return cell;
  }).join("");
  const bodyY = y + TABLE_HEADER_HEIGHT;
  let bodyRows = `<text x="${x + width / 2}" y="${bodyY + 32}" text-anchor="middle" fill="#94a3b8" font-size="14">暂无战报数据</text>`;
  if (rows.length) {
    bodyRows = rows.map((row, rowIndex) => {
      const rowY = bodyY + rowIndex * TACTICAL_ROW_HEIGHT;
      let cellX = x;
      const cells = TACTICAL_TABLE_COLUMNS.map((column) => {
        const fill = rowIndex % 2 === 0 ? "#ffffff" : "#fbfdff";
        let content = "";
        if (column.key === "index") {
          content = `
            <rect x="${cellX + column.width / 2 - 16}" y="${rowY + 12}" width="32" height="22" rx="11" fill="#fff7ed" stroke="#fed7aa" />
            <text x="${cellX + column.width / 2}" y="${rowY + 27}" text-anchor="middle" fill="#c2410c" font-size="12" font-weight="850">${svgEscape(truncateText(row.index, 4))}</text>
          `;
        } else if (column.key === "name") {
          content = `
            ${renderTacticalAvatar({
              row,
              x: cellX + 22,
              y: rowY + 24,
              rowIndex,
              sectionIndex,
            })}
            <text x="${cellX + 46}" y="${rowY + 30}" fill="#0f172a" font-size="13" font-weight="800">${svgEscape(truncateText(row.name, 16, "未知成员"))}</text>
          `;
        } else {
          const value = column.key === "reviveText"
            ? row.reviveText || row.noteText
            : row[column.key];
          const valueFill = column.key === "killText"
            ? "#dc2626"
            : column.key === "kdText" ? "#16a34a" : "#1f2937";
          content = `<text x="${cellTextX(cellX, column.width, column.align)}" y="${rowY + 30}" text-anchor="${textAnchor(column.align)}" fill="${valueFill}" font-size="13" font-weight="800">${svgEscape(truncateText(value, 8, "0"))}</text>`;
        }
        const cell = `
          <rect x="${cellX}" y="${rowY}" width="${column.width}" height="${TACTICAL_ROW_HEIGHT}" fill="${fill}" />
          <line x1="${cellX}" y1="${rowY + TACTICAL_ROW_HEIGHT}" x2="${cellX + column.width}" y2="${rowY + TACTICAL_ROW_HEIGHT}" stroke="#e5edf8" />
          ${content}
        `;
        cellX += column.width;
        return cell;
      }).join("");
      return `<g>${cells}</g>`;
    }).join("");
  }
  return `
    <rect x="${x}" y="${y}" width="${width}" height="${TABLE_HEADER_HEIGHT + Math.max(1, rows.length) * TACTICAL_ROW_HEIGHT}" rx="16" fill="#ffffff" fill-opacity="0.97" stroke="#dbe7fb" filter="url(#reportSoftShadow)" />
    <clipPath id="tacticalTableClip${Math.round(y)}">
      <rect x="${x}" y="${y}" width="${width}" height="${TABLE_HEADER_HEIGHT + Math.max(1, rows.length) * TACTICAL_ROW_HEIGHT}" rx="16" />
    </clipPath>
    <g clip-path="url(#tacticalTableClip${Math.round(y)})">
      ${headerCells}
      ${bodyRows}
    </g>
  `;
};

const renderTacticalSection = ({ section, y, index }) => {
  const shellX = PAGE_PADDING_X;
  const shellY = y;
  const shellWidth = TABLE_WIDTH;
  const innerX = shellX + 20;
  const innerWidth = shellWidth - 40;
  const metricsY = shellY + 20;
  const metricsHeight = 78;
  const contentY = metricsY + metricsHeight + 16;
  const rankWidth = 300;
  const contentGap = 16;
  const tableX = innerX + rankWidth + contentGap;
  const tableWidth = innerWidth - rankWidth - contentGap;
  const leftHeight = Math.max(1, Math.min(4, section.rankPanels.length || 0)) * 94
    + Math.max(0, Math.min(4, section.rankPanels.length || 0) - 1) * 10;
  const tableHeight = TABLE_HEADER_HEIGHT + Math.max(1, section.rows.length) * TACTICAL_ROW_HEIGHT;
  const contentHeight = Math.max(leftHeight, tableHeight);
  const shellHeight = 20 + metricsHeight + 16 + contentHeight + 20;
  const metrics = section.metrics.length
    ? section.metrics
    : section.stats.slice(0, 4).map((item) => ({ ...item, meta: "" }));
  return {
    height: shellHeight,
    svg: `
      <g>
        <rect x="${shellX}" y="${shellY}" width="${shellWidth}" height="${shellHeight}" rx="18" fill="#ffffff" fill-opacity="0.97" stroke="#dbe7fb" filter="url(#reportSoftShadow)" />
        <rect x="${shellX}" y="${shellY}" width="${shellWidth}" height="5" rx="2.5" fill="url(#reportAccent)" />
        ${renderTacticalMetrics({ metrics, width: innerWidth, x: innerX, y: metricsY })}
        ${renderTacticalRankPanels({
          panels: section.rankPanels,
          width: rankWidth,
          x: innerX,
          y: contentY,
        })}
        ${renderTacticalTable({
          rows: section.rows,
          sectionIndex: index,
          width: tableWidth,
          x: tableX,
          y: contentY,
        })}
        ${renderTacticalBodyWatermark({
          height: contentHeight,
          index,
          width: innerWidth,
          x: innerX,
          y: contentY,
        })}
      </g>
    `,
  };
};

const peachStyle2Tone = (tone) =>
  PEACH_STYLE2_TONES[tone] || PEACH_STYLE2_TONES.own;

const renderPeachStyle2Header = ({ color, section, width, x, y }) => `
  <rect x="${x}" y="${y}" width="${width}" height="${PEACH_STYLE2_HEADER_HEIGHT}" rx="16" fill="#ffffff" stroke="#dbe7fb" />
  <rect x="${x}" y="${y}" width="${width}" height="5" rx="2.5" fill="${color.accent}" />
  <circle cx="${x + 35}" cy="${y + 33}" r="18" fill="${color.bg}" stroke="${color.soft}" />
  <path d="M${x + 27} ${y + 27} h16 v7 c0 5 -4 9 -8 9 s-8 -4 -8 -9z" fill="${color.accent}" fill-opacity="0.9" />
  <path d="M${x + 30} ${y + 44} h10 v4 h-10z" fill="${color.accent}" fill-opacity="0.9" />
  <text x="${x + 64}" y="${y + 29}" fill="#0f172a" font-size="18" font-weight="850">${svgEscape(truncateText(section.title, 18, "俱乐部"))}</text>
  <text x="${x + 64}" y="${y + 50}" fill="#64748b" font-size="12" font-weight="700">${svgEscape(truncateText(section.subtitle, 30, ""))}</text>
`;

const renderPeachStyle2Stats = ({ color, stats, width, x, y }) => {
  const safeStats = (stats || []).slice(0, 4);
  const gap = 10;
  const cardWidth = (width - gap) / 2;
  return safeStats.map((stat, index) => {
    const row = Math.floor(index / 2);
    const col = index % 2;
    const cardX = x + col * (cardWidth + gap);
    const cardY = y + row * (PEACH_STYLE2_STAT_HEIGHT + gap);
    return `
      <rect x="${cardX}" y="${cardY}" width="${cardWidth}" height="${PEACH_STYLE2_STAT_HEIGHT}" rx="12" fill="#f8fafc" stroke="#e2e8f0" />
      <rect x="${cardX}" y="${cardY}" width="5" height="${PEACH_STYLE2_STAT_HEIGHT}" rx="2.5" fill="${color.accent}" fill-opacity="0.88" />
      <text x="${cardX + 16}" y="${cardY + 21}" fill="#64748b" font-size="11" font-weight="760">${svgEscape(truncateText(stat.label, 10, "指标"))}</text>
      <text x="${cardX + 16}" y="${cardY + 43}" fill="#0f172a" font-size="18" font-weight="850">${svgEscape(truncateText(stat.value, 12, "0"))}</text>
    `;
  }).join("");
};

const renderPeachStyle2RankPanels = ({ color, panels, width, x, y }) => {
  const safePanels = (panels || []).slice(0, 4);
  const gap = 10;
  const cardWidth = (width - gap) / 2;
  return safePanels.map((panel, index) => {
    const row = Math.floor(index / 2);
    const col = index % 2;
    const cardX = x + col * (cardWidth + gap);
    const cardY = y + row * (PEACH_STYLE2_RANK_CARD_HEIGHT + gap);
    const items = (panel.items || []).slice(0, 3);
    return `
      <g>
        <rect x="${cardX}" y="${cardY}" width="${cardWidth}" height="${PEACH_STYLE2_RANK_CARD_HEIGHT}" rx="12" fill="#ffffff" stroke="#dbe7fb" />
        <rect x="${cardX}" y="${cardY}" width="${cardWidth}" height="30" rx="12" fill="${color.accent}" />
        <rect x="${cardX}" y="${cardY + 18}" width="${cardWidth}" height="12" fill="${color.accent}" />
        <text x="${cardX + cardWidth / 2}" y="${cardY + 21}" text-anchor="middle" fill="#ffffff" font-size="12" font-weight="850">${svgEscape(truncateText(panel.title, 12, "Top3"))}</text>
        ${items.map((item, itemIndex) => {
          const itemY = cardY + 48 + itemIndex * 16;
          return `
            <text x="${cardX + 12}" y="${itemY}" fill="${color.fg}" font-size="11" font-weight="850">0${itemIndex + 1}</text>
            <text x="${cardX + 38}" y="${itemY}" fill="#334155" font-size="12" font-weight="760">${svgEscape(truncateText(item.name, 8, "未知成员"))}</text>
            <text x="${cardX + cardWidth - 12}" y="${itemY}" text-anchor="end" fill="#0f172a" font-size="12" font-weight="850">${svgEscape(truncateText(item.value, 8, "0"))}</text>
          `;
        }).join("")}
      </g>
    `;
  }).join("");
};

const PEACH_STYLE2_TABLE_COLUMNS = [
  { key: "index", label: "排名", width: 42, align: "center" },
  { key: "name", label: "成员", width: 150, align: "left" },
  { key: "killText", label: "击杀", width: 98, align: "right" },
  { key: "metric3Text", label: "连杀", width: 58, align: "right" },
  { key: "noteText", label: "抢船", width: 58, align: "right" },
  { key: "metric2Text", label: "复活", width: 58, align: "right" },
  { key: "kdText", label: "K/D", width: 56, align: "right" },
];

const renderPeachStyle2Table = ({ color, maxKill, rows, sectionIndex, width, x, y }) => {
  let headerX = x;
  const headerCells = PEACH_STYLE2_TABLE_COLUMNS.map((column) => {
    const cell = `
      <rect x="${headerX}" y="${y}" width="${column.width}" height="${PEACH_STYLE2_TABLE_HEADER_HEIGHT}" fill="${color.accent}" />
      <text x="${cellTextX(headerX, column.width, column.align)}" y="${y + 24}" text-anchor="${textAnchor(column.align)}" fill="#ffffff" font-size="11" font-weight="850">${svgEscape(column.label)}</text>
    `;
    headerX += column.width;
    return cell;
  }).join("");
  const bodyY = y + PEACH_STYLE2_TABLE_HEADER_HEIGHT;
  const bodyHeight = Math.max(1, rows.length) * PEACH_STYLE2_ROW_HEIGHT;
  const bodyRows = rows.length
    ? rows.map((row, rowIndex) => {
        const rowY = bodyY + rowIndex * PEACH_STYLE2_ROW_HEIGHT;
        let cellX = x;
        const cells = PEACH_STYLE2_TABLE_COLUMNS.map((column) => {
          const fill = rowIndex % 2 === 0 ? "#ffffff" : "#fbfdff";
          let content = "";
          if (column.key === "index") {
            const rank = rowIndex < 3 ? `${rowIndex + 1}` : row.index;
            content = `
            <rect x="${cellX + column.width / 2 - 14}" y="${rowY + 10}" width="28" height="20" rx="10" fill="${rowIndex < 3 ? "#fff7ed" : "#f8fafc"}" stroke="${rowIndex < 3 ? "#fed7aa" : "#e2e8f0"}" />
            <text x="${cellX + column.width / 2}" y="${rowY + 24}" text-anchor="middle" fill="${rowIndex < 3 ? "#c2410c" : "#64748b"}" font-size="11" font-weight="850">${svgEscape(truncateText(rank, 4, "0"))}</text>
          `;
          } else if (column.key === "name") {
            content = `
            ${renderTacticalAvatar({
              row,
              x: cellX + 18,
              y: rowY + 20,
              rowIndex,
              sectionIndex,
            })}
            <text x="${cellX + 40}" y="${rowY + 25}" fill="#0f172a" font-size="12" font-weight="800">${svgEscape(truncateText(row.name, 10, "未知成员"))}</text>
          `;
          } else if (column.key === "killText") {
            const killValue = parseExportNumber(row.killText);
            const percent = maxKill > 0 ? Math.min(1, killValue / maxKill) : 0;
            const barWidth = 48;
            content = `
            <text x="${cellX + 28}" y="${rowY + 25}" text-anchor="end" fill="#dc2626" font-size="12" font-weight="850">${svgEscape(truncateText(row.killText, 6, "0"))}</text>
            <rect x="${cellX + 36}" y="${rowY + 17}" width="${barWidth}" height="5" rx="2.5" fill="#fee2e2" />
            <rect x="${cellX + 36}" y="${rowY + 17}" width="${Math.max(3, barWidth * percent)}" height="5" rx="2.5" fill="#ef4444" />
          `;
          } else {
            const fillColor = column.key === "kdText" ? "#16a34a" : "#334155";
            content = `<text x="${cellTextX(cellX, column.width, column.align)}" y="${rowY + 25}" text-anchor="${textAnchor(column.align)}" fill="${fillColor}" font-size="12" font-weight="800">${svgEscape(truncateText(row[column.key], 6, "0"))}</text>`;
          }
          const cell = `
          <rect x="${cellX}" y="${rowY}" width="${column.width}" height="${PEACH_STYLE2_ROW_HEIGHT}" fill="${fill}" fill-opacity="0.97" />
          <line x1="${cellX}" y1="${rowY + PEACH_STYLE2_ROW_HEIGHT}" x2="${cellX + column.width}" y2="${rowY + PEACH_STYLE2_ROW_HEIGHT}" stroke="#eef2f7" />
          ${content}
        `;
          cellX += column.width;
          return cell;
        }).join("");
        return `<g>${cells}</g>`;
      }).join("")
    : `<text x="${x + width / 2}" y="${bodyY + 28}" text-anchor="middle" fill="#94a3b8" font-size="13">暂无战绩数据</text>`;
  const clipId = `peachStyle2TableClip${sectionIndex}_${Math.round(y)}`;
  return `
    <rect x="${x}" y="${y}" width="${width}" height="${PEACH_STYLE2_TABLE_HEADER_HEIGHT + bodyHeight}" rx="13" fill="#ffffff" stroke="#dbe7fb" />
    <clipPath id="${clipId}">
      <rect x="${x}" y="${y}" width="${width}" height="${PEACH_STYLE2_TABLE_HEADER_HEIGHT + bodyHeight}" rx="13" />
    </clipPath>
    <g clip-path="url(#${clipId})">
      ${headerCells}
      ${bodyRows}
    </g>
  `;
};

const renderPeachStyle2Column = ({ section, x, y, index }) => {
  const color = peachStyle2Tone(section.tone);
  const innerX = x + PEACH_STYLE2_COLUMN_PADDING;
  const headerY = y + 16;
  const statsY = headerY + PEACH_STYLE2_HEADER_HEIGHT + 14;
  const statsHeight = PEACH_STYLE2_STAT_HEIGHT * 2 + 10;
  const ranksY = statsY + statsHeight + 14;
  const ranksHeight = PEACH_STYLE2_RANK_CARD_HEIGHT * 2 + 10;
  const tableY = ranksY + ranksHeight + 14;
  const maxKill = Math.max(...section.rows.map((row) => parseExportNumber(row.killText)), 0);
  const tableHeight = PEACH_STYLE2_TABLE_HEADER_HEIGHT
    + Math.max(1, section.rows.length) * PEACH_STYLE2_ROW_HEIGHT;
  const contentHeight = tableY - y + tableHeight + 18;
  return {
    height: contentHeight,
    svg: `
      <g>
        <rect x="${x}" y="${y}" width="${PEACH_STYLE2_COLUMN_WIDTH}" height="${contentHeight}" rx="18" fill="#ffffff" fill-opacity="0.97" stroke="#dbe7fb" filter="url(#reportSoftShadow)" />
        ${renderPeachStyle2Header({
          color,
          section,
          width: PEACH_STYLE2_INNER_WIDTH,
          x: innerX,
          y: headerY,
        })}
        ${renderPeachStyle2Stats({
          color,
          stats: section.stats,
          width: PEACH_STYLE2_INNER_WIDTH,
          x: innerX,
          y: statsY,
        })}
        ${renderPeachStyle2RankPanels({
          color,
          panels: section.rankPanels,
          width: PEACH_STYLE2_INNER_WIDTH,
          x: innerX,
          y: ranksY,
        })}
        ${renderPeachStyle2Table({
          color,
          maxKill,
          rows: section.rows,
          sectionIndex: index,
          width: PEACH_STYLE2_INNER_WIDTH,
          x: innerX,
          y: tableY,
        })}
        ${renderTacticalBodyWatermark({
          height: tableHeight,
          index: `peach_${index}`,
          width: PEACH_STYLE2_INNER_WIDTH,
          x: innerX,
          y: tableY,
        })}
      </g>
    `,
  };
};

const renderPeachStyle2Sections = ({ sections, y }) => {
  const ownSection = sections[0] || {
    rankPanels: [],
    rows: [],
    stats: [],
    subtitle: "我方战绩",
    title: "我方俱乐部",
    tone: "own",
  };
  const opponentSection = sections[1] || {
    rankPanels: [],
    rows: [],
    stats: [],
    subtitle: "敌方战绩",
    title: "敌方俱乐部",
    tone: "opponent",
  };
  const ownColumn = renderPeachStyle2Column({
    index: 0,
    section: ownSection,
    x: PAGE_PADDING_X,
    y,
  });
  const opponentColumn = renderPeachStyle2Column({
    index: 1,
    section: opponentSection,
    x: PAGE_PADDING_X + PEACH_STYLE2_COLUMN_WIDTH + PEACH_STYLE2_COLUMN_GAP,
    y,
  });
  return {
    height: Math.max(ownColumn.height, opponentColumn.height),
    svg: `${ownColumn.svg}${opponentColumn.svg}`,
  };
};

const renderSection = ({ section, y, index }) => {
  if (section.layout === "tactical") {
    return renderTacticalSection({ section, y, index });
  }
  const tone = toneColor(section.tone);
  const statsHeight = getStatsHeight(section.stats);
  const isWarrankLayout = section.layout === "warrank";
  const rowHeight = isWarrankLayout ? WARRANK_ROW_HEIGHT : ROW_HEIGHT;
  const sectionHeaderY = y;
  const statsY = sectionHeaderY + SECTION_HEADER_HEIGHT + 10;
  const tableY = statsY + statsHeight + 16;
  const rowsY = tableY + TABLE_HEADER_HEIGHT;
  const bodyHeight = Math.max(1, section.rows.length) * rowHeight;
  const sectionHeight = SECTION_HEADER_HEIGHT + 10 + statsHeight + 16
    + TABLE_HEADER_HEIGHT + bodyHeight + 12;
  const rowsSvg = section.rows.length
    ? isWarrankLayout
      ? renderWarrankRows({ y: rowsY, rows: section.rows, sectionIndex: index })
      : renderRows({ y: rowsY, rows: section.rows, sectionIndex: index })
    : `<text x="${IMAGE_WIDTH / 2}" y="${rowsY + 32}" text-anchor="middle" fill="#64748b" font-size="15">暂无战报数据</text>`;
  const headerSvg = isWarrankLayout
    ? renderWarrankTableHeader(tableY)
    : renderTableHeader({
        primaryLabel: section.primaryLabel,
        y: tableY,
        metric2Label: section.metric2Label,
        metric3Label: section.metric3Label,
      });

  return {
    height: sectionHeight,
    svg: `
      <g>
        <rect x="${PAGE_PADDING_X}" y="${sectionHeaderY}" width="${TABLE_WIDTH}" height="${SECTION_HEADER_HEIGHT}" rx="15" fill="${tone.bg}" stroke="${tone.soft}" />
        <rect x="${PAGE_PADDING_X}" y="${sectionHeaderY}" width="7" height="${SECTION_HEADER_HEIGHT}" rx="3.5" fill="${tone.accent}" />
        <text x="${PAGE_PADDING_X + 22}" y="${sectionHeaderY + 27}" fill="#0f172a" font-size="17" font-weight="850">${svgEscape(truncateText(section.title, 36, "战报分组"))}</text>
        <text x="${IMAGE_WIDTH - PAGE_PADDING_X - 18}" y="${sectionHeaderY + 27}" text-anchor="end" fill="${tone.fg}" font-size="13" font-weight="800">${svgEscape(truncateText(section.subtitle, 40, ""))}</text>
        ${renderStats({ y: statsY, stats: section.stats })}
        <rect x="${PAGE_PADDING_X}" y="${tableY}" width="${TABLE_WIDTH}" height="${TABLE_HEADER_HEIGHT + bodyHeight}" rx="16" fill="#ffffff" fill-opacity="0.97" stroke="#dbe7fb" filter="url(#reportSoftShadow)" />
        ${headerSvg}
        ${rowsSvg}
        ${renderTableBodyWatermark({ y: rowsY, height: bodyHeight })}
      </g>
    `,
  };
};

const prepareRows = async (rows = []) =>
  mapWithConcurrency(rows, async (row) => {
    const topHeroes = await mapWithConcurrency(
      (row.topHeroes || []).slice(0, 3),
      async (hero) => ({
        avatarDataUrl: normalizeAvatarDataUrl(hero.avatarDataUrl)
          || await fetchAvatarDataUrl(hero.avatarUrl),
        avatarText: normalizeText(hero.avatarText, "?"),
        holyBeastText: normalizeText(hero.holyBeastText, "0"),
        name: normalizeText(hero.name, "未知"),
        redQuenchText: normalizeText(hero.redQuenchText, "0红"),
      }),
      3,
    );
    return {
      allianceText: normalizeText(row.allianceText),
      announcementText: normalizeText(row.announcementText),
      avatarDataUrl: normalizeAvatarDataUrl(row.avatarDataUrl)
        || await fetchAvatarDataUrl(row.avatarUrl),
      avatarText: normalizeText(row.avatarText, "?"),
      index: normalizeText(row.index),
      kdText: normalizeText(row.kdText),
      killText: normalizeText(row.killText),
      metric2Text: normalizeText(row.metric2Text),
      metric3Text: normalizeText(row.metric3Text),
      name: normalizeText(row.name, "未知成员"),
      noteText: normalizeText(row.noteText, "-"),
      powerText: normalizeText(row.powerText),
      redQuenchText: normalizeText(row.redQuenchText),
      reviveText: normalizeText(row.reviveText, ""),
      roleId: normalizeText(row.roleId, "-"),
      serverText: normalizeText(row.serverText),
      topHeroes,
    };
  });

const sortRowsByKdDesc = (rows = []) =>
  rows
    .map((row, order) => ({
      kdValue: parseExportNumber(row.kdText),
      order,
      row,
    }))
    .sort((a, b) => b.kdValue - a.kdValue || a.order - b.order)
    .map(({ row }, index) => ({
      ...row,
      index: normalizeText(index + 1),
    }));

export const createBattleReportExportImageService = () => ({
  async renderBattleReportImage(payload) {
    const sections = await mapWithConcurrency(payload.sections || [], async (section) => {
      const layout = ["tactical", "warrank"].includes(section.layout)
        ? section.layout
        : "standard";
      const preparedRows = await prepareRows(section.rows || []);
      const shouldSortByKd = ["salt-field", "peach-garden"].includes(payload.reportType)
        && layout !== "warrank";
      return {
        metric2Label: normalizeText(section.metric2Label, "指标二"),
        metric3Label: normalizeText(section.metric3Label, "指标三"),
        primaryLabel: normalizeText(section.primaryLabel, "击杀"),
        layout,
        metrics: (section.metrics || []).map((item) => ({
          label: normalizeText(item.label),
          meta: normalizeText(item.meta, ""),
          value: normalizeText(item.value),
        })),
        rankPanels: (section.rankPanels || []).map((panel) => ({
          items: (panel.items || []).map((item) => ({
            name: normalizeText(item.name, "未知成员"),
            value: normalizeText(item.value, "0"),
          })),
          key: normalizeText(panel.key, "rank"),
          title: normalizeText(panel.title, "榜单"),
        })),
        rows: shouldSortByKd ? sortRowsByKdDesc(preparedRows) : preparedRows,
        stats: (section.stats || []).map((item) => ({
          label: normalizeText(item.label),
          value: normalizeText(item.value),
        })),
        statusLabel: normalizeText(section.statusLabel, "总 K/D"),
        statusValue: normalizeText(section.statusValue, "0.00"),
        subtitle: normalizeText(section.subtitle, ""),
        title: normalizeText(section.title, "战报分组"),
        tone: section.tone || "neutral",
      };
    });
    const title = normalizeText(payload.title, "战报导出");
    const subtitle = normalizeText(payload.subtitle, "战报详情");
    const reportDate = normalizeText(payload.reportDate, "-");
    const exportedAt = normalizeText(payload.exportedAt, new Date().toISOString());
    const firstTacticalSection = sections.find((section) => section.layout === "tactical");
    const badgeLabel = normalizeText(
      payload.badgeLabel,
      firstTacticalSection?.statusLabel || "报表分组",
    );
    const badgeValue = normalizeText(
      payload.badgeValue,
      firstTacticalSection?.statusValue || `${sections.length} 组`,
    );
    let height = HEADER_HEIGHT + BOTTOM_PADDING;
    let renderedSections = [];
    if (payload.reportType === "peach-garden") {
      const rendered = renderPeachStyle2Sections({ sections, y: HEADER_HEIGHT });
      renderedSections = [rendered];
      height = HEADER_HEIGHT + rendered.height + BOTTOM_PADDING;
    } else {
      let cursorY = HEADER_HEIGHT;
      renderedSections = sections.map((section, index) => {
        const rendered = renderSection({ section, y: cursorY, index });
        cursorY += rendered.height + SECTION_GAP;
        return rendered;
      });
      height = cursorY - SECTION_GAP + BOTTOM_PADDING;
    }
    const headerSvg = renderHeader({
      badgeLabel,
      badgeValue,
      exportedAt,
      reportDate,
      sectionCount: sections.length,
      showBadge: payload.reportType !== "peach-garden",
      subtitle,
      title,
    });
    const svg = `
      <svg xmlns="http://www.w3.org/2000/svg" width="${IMAGE_WIDTH}" height="${height}" viewBox="0 0 ${IMAGE_WIDTH} ${height}">
        ${renderDefs()}
        <style>
          text { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", "PingFang SC", "Microsoft YaHei", Arial, sans-serif; }
        </style>
        ${renderBackground(height)}
        ${headerSvg}
        ${renderedSections.map((section) => section.svg).join("")}
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

export const battleReportExportImageService = createBattleReportExportImageService();
