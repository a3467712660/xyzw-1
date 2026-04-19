import { Resvg } from "@resvg/resvg-js";

const IMAGE_WIDTH = 1200;
const PAGE_PADDING_X = 40;
const HEADER_HEIGHT = 132;
const SUMMARY_HEIGHT = 72;
const TABLE_HEADER_HEIGHT = 46;
const ROW_HEIGHT = 52;
const FOOTER_HEIGHT = 52;
const TABLE_WIDTH = IMAGE_WIDTH - PAGE_PADDING_X * 2;

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
  if (!value || value === "-") return { bg: "#f1f5f9", fg: "#64748b" };
  if (String(value).includes("会长")) return { bg: "#fff7ed", fg: "#c2410c" };
  if (String(value).includes("副")) return { bg: "#eff6ff", fg: "#1d4ed8" };
  return { bg: "#f8fafc", fg: "#475569" };
};

const lineupColor = (value) => {
  if (!value || value === "-") return { bg: "#f1f5f9", fg: "#64748b" };
  return { bg: "#ecfdf5", fg: "#047857" };
};

const renderTag = ({ x, y, text, color, maxWidth }) => {
  const label = truncateText(text, 8);
  const width = Math.min(maxWidth, Math.max(42, Array.from(label).length * 13 + 24));
  const left = x - width / 2;
  return `
    <rect x="${left}" y="${y - 13}" width="${width}" height="26" rx="13" fill="${color.bg}" />
    <text x="${x}" y="${y + 5}" text-anchor="middle" fill="${color.fg}" font-size="14" font-weight="700">${svgEscape(label)}</text>
  `;
};

const renderHeader = ({ clubName, exportedAt, memberCount }) => `
  <rect x="0" y="0" width="${IMAGE_WIDTH}" height="100%" fill="#f6f9ff" />
  <rect x="24" y="24" width="${IMAGE_WIDTH - 48}" height="84" rx="20" fill="#ffffff" stroke="#dbe7fb" />
  <text x="48" y="62" fill="#10203f" font-size="28" font-weight="800">${svgEscape(truncateText(clubName, 36))}</text>
  <text x="48" y="88" fill="#64748b" font-size="15">俱乐部成员详情 · 固定宽度导出</text>
  <rect x="908" y="42" width="228" height="42" rx="21" fill="#eff6ff" />
  <text x="1022" y="68" text-anchor="middle" fill="#1d4ed8" font-size="16" font-weight="700">成员 ${memberCount} 人</text>
  <text x="48" y="126" fill="#64748b" font-size="14">导出时间：${svgEscape(truncateText(exportedAt, 32))}</text>
`;

const renderSummary = ({ y, members }) => {
  const withLineupCount = members.filter((member) => member.lineupType && member.lineupType !== "-").length;
  const managerCount = members.filter((member) =>
    String(member.jobLabel || "").includes("会长")).length;
  const items = [
    { label: "成员数量", value: `${members.length}` },
    { label: "已识别阵容", value: `${withLineupCount}` },
    { label: "管理成员", value: `${managerCount}` },
  ];
  return `
    <g transform="translate(${PAGE_PADDING_X}, ${y})">
      ${items.map((item, index) => {
        const x = index * 220;
        return `
          <rect x="${x}" y="0" width="196" height="54" rx="14" fill="#ffffff" stroke="#dbe7fb" />
          <text x="${x + 18}" y="22" fill="#64748b" font-size="13">${svgEscape(item.label)}</text>
          <text x="${x + 18}" y="43" fill="#0f172a" font-size="22" font-weight="800">${svgEscape(item.value)}</text>
        `;
      }).join("")}
    </g>
  `;
};

const renderTableHeader = (y) => {
  let x = PAGE_PADDING_X;
  const cells = COLUMNS.map((column, index) => {
    const cell = `
      <rect x="${x}" y="${y}" width="${column.width}" height="${TABLE_HEADER_HEIGHT}" fill="${index % 2 === 0 ? "#edf5ff" : "#f4f8ff"}" />
      <text x="${cellTextX(x, column.width, column.align)}" y="${y + 29}" text-anchor="${textAnchor(column.align)}" fill="#294676" font-size="15" font-weight="800">${svgEscape(column.label)}</text>
    `;
    x += column.width;
    return cell;
  });
  return `
    <rect x="${PAGE_PADDING_X}" y="${y}" width="${TABLE_WIDTH}" height="${TABLE_HEADER_HEIGHT}" rx="14" fill="#edf5ff" />
    <clipPath id="tableHeaderClip"><rect x="${PAGE_PADDING_X}" y="${y}" width="${TABLE_WIDTH}" height="${TABLE_HEADER_HEIGHT}" rx="14" /></clipPath>
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
        <rect x="${x}" y="${rowY}" width="${column.width}" height="${ROW_HEIGHT}" fill="${isEven ? "#ffffff" : "#f8fbff"}" />
        <line x1="${x}" y1="${rowY + ROW_HEIGHT}" x2="${x + column.width}" y2="${rowY + ROW_HEIGHT}" stroke="#e8eef8" />
      `;
      let content = "";
      if (column.key === "avatar") {
        content = `
          <circle cx="${x + column.width / 2}" cy="${rowY + 26}" r="17" fill="#e8f1ff" stroke="#bfd2f4" />
          <text x="${x + column.width / 2}" y="${rowY + 32}" text-anchor="middle" fill="#315b9e" font-size="15" font-weight="800">${svgEscape(truncateText(member.avatarText || member.name, 2))}</text>
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
        content = `
          <text x="${cellTextX(x, column.width, column.align)}" y="${rowY + 32}" text-anchor="${textAnchor(column.align)}" fill="${fill}" font-size="15" font-weight="${column.key === "name" ? 700 : 500}">${svgEscape(truncateText(member[column.key], maxLength))}</text>
        `;
      }
      x += column.width;
      return `${base}${content}`;
    });
    return `<g>${cells.join("")}</g>`;
  }).join("");

const renderFooter = (y) => `
  <text x="${IMAGE_WIDTH / 2}" y="${y + 30}" text-anchor="middle" fill="#94a3b8" font-size="13">XYZW Web Helper · 后端固定模板导出</text>
`;

export const createClubMemberExportImageService = () => ({
  renderClubMembersImage(payload) {
    const members = (payload.members || []).map((member) => ({
      index: normalizeText(member.index),
      name: normalizeText(member.name),
      roleId: normalizeText(member.roleId),
      powerText: normalizeText(member.powerText),
      redQuenchText: normalizeText(member.redQuenchText),
      lineupType: normalizeText(member.lineupType),
      jobLabel: normalizeText(member.jobLabel),
      avatarText: normalizeText(member.avatarText, "?"),
    }));
    const clubName = normalizeText(payload.clubName, "俱乐部成员信息");
    const exportedAt = normalizeText(payload.exportedAt, new Date().toISOString());
    const memberCount = Number.isFinite(Number(payload.memberCount))
      ? Number(payload.memberCount)
      : members.length;
    const tableY = HEADER_HEIGHT + SUMMARY_HEIGHT;
    const rowsY = tableY + TABLE_HEADER_HEIGHT;
    const height = rowsY + Math.max(1, members.length) * ROW_HEIGHT + FOOTER_HEIGHT;
    const rowsSvg = members.length
      ? renderRows({ y: rowsY, members })
      : `<text x="${IMAGE_WIDTH / 2}" y="${rowsY + 34}" text-anchor="middle" fill="#64748b" font-size="16">暂无成员数据</text>`;
    const svg = `
      <svg xmlns="http://www.w3.org/2000/svg" width="${IMAGE_WIDTH}" height="${height}" viewBox="0 0 ${IMAGE_WIDTH} ${height}">
        <style>
          text { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", "PingFang SC", "Microsoft YaHei", Arial, sans-serif; }
        </style>
        ${renderHeader({ clubName, exportedAt, memberCount })}
        ${renderSummary({ y: HEADER_HEIGHT, members })}
        <rect x="${PAGE_PADDING_X}" y="${tableY}" width="${TABLE_WIDTH}" height="${TABLE_HEADER_HEIGHT + Math.max(1, members.length) * ROW_HEIGHT}" rx="14" fill="#ffffff" stroke="#dbe7fb" />
        ${renderTableHeader(tableY)}
        ${rowsSvg}
        ${renderFooter(height - FOOTER_HEIGHT)}
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
